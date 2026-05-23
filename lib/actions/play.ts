"use server";

import { headers } from "next/headers";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes, questions, choices, results, plays, users } from "@/lib/db/schema";
import { computeResult, type ScoringChoice, type ScoringResult } from "@/lib/scoring";
import { ratelimit } from "@/lib/ratelimit";

export type PlayResult = {
  resultKey: string;
  title: string;
  description: string | null;
  mediaUrl: string | null;
  shareText: string | null;
  showProbabilityBar: boolean;
  distribution: { title: string; pct: number }[];
  creatorTip: {
    qrUrl?: string;
    bankName?: string;
    bankAccount?: string;
    accountName?: string;
    externalUrl?: string;
    message?: string;
  } | null;
};

/**
 * รับคำตอบจากผู้เล่น แล้ว "คิดผลลัพธ์ฝั่ง server" (ไม่เชื่อ client) — DESIGN.md ข้อ 12
 * answers: [{ questionId, choiceId }]
 */
export async function submitPlay(
  publicId: string,
  answers: { questionId: string; choiceId?: string; text?: string }[],
): Promise<PlayResult> {
  // rate-limit ต่อ IP กัน spam submit (headers() ใช้ได้เฉพาะใน request scope)
  let ip = "unknown";
  try {
    const h = await headers();
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown";
  } catch {
    // เรียกนอก request (เช่น script) — ข้าม
  }
  const rl = await ratelimit.limit(`play:${ip}`, { limit: 40, windowMs: 60_000 });
  if (!rl.success) throw new Error("เล่นถี่เกินไป ลองใหม่อีกครั้ง");

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);

  if (!quiz || quiz.status !== "published") throw new Error("quiz ไม่พร้อมเล่น");
  if (quiz.expiresAt && quiz.expiresAt < new Date())
    throw new Error("quiz หมดอายุแล้ว");

  const rs = await db
    .select()
    .from(results)
    .where(eq(results.quizId, quiz.id))
    .orderBy(asc(results.orderIndex));

  const qs = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.quizId, quiz.id));
  const qIds = new Set(qs.map((q) => q.id));

  const cs = qs.length
    ? await db
        .select()
        .from(choices)
        .where(inArray(choices.questionId, [...qIds]))
    : [];
  const choiceById = new Map(cs.map((c) => [c.id, c]));

  // เก็บเฉพาะคำตอบที่อ้างถึง choice จริงของ quiz นี้ (กันปลอม)
  const chosen: ScoringChoice[] = [];
  const cleanAnswers: Record<string, string> = {};
  for (const a of answers) {
    if (a.choiceId) {
      const c = choiceById.get(a.choiceId);
      if (c && c.questionId === a.questionId && qIds.has(a.questionId)) {
        chosen.push({ scoreMap: c.scoreMap, points: c.points });
        cleanAnswers[a.questionId] = a.choiceId;
      }
    } else if (a.text && qIds.has(a.questionId)) {
      // text answer: เก็บไว้ดู ไม่คิดคะแนน (จำกัดความยาวกัน abuse)
      cleanAnswers[a.questionId] = a.text.slice(0, 1000);
    }
  }

  const scoringResults = rs.map<ScoringResult>((r) => ({
    resultKey: r.resultKey,
    orderIndex: r.orderIndex,
    scoreMin: r.scoreMin,
    scoreMax: r.scoreMax,
  }));

  const outcome = computeResult(
    quiz.resultLogic === "range" ? "range" : "archetype",
    chosen,
    scoringResults,
  );

  const winner = rs.find((r) => r.resultKey === outcome.resultKey) ?? rs[0];
  const titleByKey = new Map(rs.map((r) => [r.resultKey, r.title]));

  // ช่องทางโดเนทของผู้สร้าง (ถ้าเปิดไว้) — DESIGN.md ข้อ 10.5
  const [owner] = await db
    .select({ payout: users.creatorPayout })
    .from(users)
    .where(eq(users.id, quiz.ownerId))
    .limit(1);
  const p = owner?.payout;
  const creatorTip =
    p?.enabled && (p.qrUrl || p.bankAccount || p.externalUrl)
      ? {
          qrUrl: p.qrUrl,
          bankName: p.bankName,
          bankAccount: p.bankAccount,
          accountName: p.accountName,
          externalUrl: p.externalUrl,
          message: p.message,
        }
      : null;

  await db.transaction(async (tx) => {
    await tx.insert(plays).values({
      quizId: quiz.id,
      resultId: winner.id,
      answers: cleanAnswers,
    });
    await tx
      .update(quizzes)
      .set({ playCount: sql`${quizzes.playCount} + 1` })
      .where(eq(quizzes.id, quiz.id));
  });

  return {
    resultKey: winner.resultKey,
    title: winner.title,
    description: winner.description,
    mediaUrl: winner.mediaUrl,
    shareText: winner.shareText,
    showProbabilityBar: Boolean(quiz.settings?.showProbabilityBar),
    distribution: (outcome.distribution ?? []).map((d) => ({
      title: titleByKey.get(d.resultKey) ?? d.resultKey,
      pct: d.pct,
    })),
    creatorTip,
  };
}
