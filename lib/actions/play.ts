"use server";

import { headers } from "next/headers";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  quizzes,
  questions,
  choices,
  results,
  plays,
  users,
} from "@/lib/db/schema";
import {
  computeResult,
  type ScoringChoice,
  type ScoringResult,
} from "@/lib/scoring";
import { ratelimit } from "@/lib/ratelimit";
import { analyzer } from "@/lib/ai";

/** จำนวนชนิด MBTI ที่แสดงเป็นอันดับความเข้ากัน */
const MBTI_RANKING_SIZE = 5;
import {
  FUNCTION_INFO,
  FUNCTION_STACK,
  STACK_LABEL,
  rankTypes,
  dimensionsFromFunctions,
  scoreFunctionsFromRatings,
  normalizeFunctionScores,
  FUNCTION_CODES,
  type FunctionCode,
} from "@/lib/mbti";

export type PlayResult = {
  resultKey: string;
  title: string;
  description: string | null;
  mediaUrl: string | null;
  shareText: string | null;
  showProbabilityBar: boolean;
  distribution: { title: string; pct: number }[];
  creatorTip: { qrUrl: string } | null;
  /** บทวิเคราะห์ AI — null เมื่อ quiz ไม่ได้เปิด, ระบบปิด, หรือเรียกไม่สำเร็จ */
  aiAnalysis: string | null;
  /** รายละเอียด MBTI ตอน quiz ใช้ aiScoring — null สำหรับ quiz ทั่วไป */
  mbti: MbtiBreakdown | null;
};

/** ผลของการส่งคำตอบ — ความผิดพลาดที่คาดไว้คืนเป็น error ไม่ใช่ throw
 *  เพราะ Next.js เซ็นเซอร์ข้อความของ error ที่ throw จาก server action ตอน production
 *  ผู้เล่นจะได้เห็นสาเหตุจริงและกดลองใหม่ได้ */
export type PlaySubmission =
  { ok: true; result: PlayResult } | { ok: false; error: string };

export type MbtiBreakdown = {
  type: string;
  /** โปรไฟล์ฟังก์ชันเข้ากับชนิดอันดับ 1 แค่ไหน 0-100 */
  confidence: number;
  /** อันดับความเข้ากันหลายชนิด — ไม่ได้ฟันธงชนิดเดียว */
  ranking: { type: string; fit: number; title: string }[];
  /** true = ผู้เล่นเลือกระดับเดิมแทบทุกข้อ ผลลัพธ์แทบไม่มีความหมาย */
  lowSignal: boolean;
  dimensions: { axis: string; pick: string; strength: number }[];
  /** 8 ฟังก์ชันเรียงจากเด่นสุด พร้อมคำอธิบายไทย */
  functions: {
    code: string;
    strength: number;
    note: string;
    thai: string;
    nick: string;
    blurb: string;
    /** ป้ายลำดับมาตรฐานของ type นี้ (หลัก/รอง/ตติยะ/ด้อย) ถ้าอยู่ใน stack */
    stackLabel: string | null;
  }[];
};

/**
 * รับคำตอบจากผู้เล่น แล้ว "คิดผลลัพธ์ฝั่ง server" (ไม่เชื่อ client) — DESIGN.md ข้อ 12
 * answers: [{ questionId, choiceId }]
 */
export async function submitPlay(
  publicId: string,
  answers: { questionId: string; choiceId?: string; text?: string }[],
): Promise<PlaySubmission> {
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
  const rl = await ratelimit.limit(`play:${ip}`, {
    limit: 40,
    windowMs: 60_000,
  });
  if (!rl.success) return { ok: false, error: "เล่นถี่เกินไป ลองใหม่อีกครั้ง" };

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);

  if (!quiz || quiz.status !== "published")
    return { ok: false, error: "quiz ไม่พร้อมเล่น" };
  if (quiz.expiresAt && quiz.expiresAt < new Date())
    return { ok: false, error: "quiz หมดอายุแล้ว" };

  const rs = await db
    .select()
    .from(results)
    .where(eq(results.quizId, quiz.id))
    .orderBy(asc(results.orderIndex));

  const qs = await db
    .select({
      id: questions.id,
      promptText: questions.promptText,
      facet: questions.facet,
    })
    .from(questions)
    .where(eq(questions.quizId, quiz.id));
  const qIds = new Set(qs.map((q) => q.id));
  const promptById = new Map(qs.map((q) => [q.id, q.promptText]));
  const facetById = new Map(qs.map((q) => [q.id, q.facet]));

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
  // บริบทให้ AI อ่าน — สร้างจากข้อมูลฝั่ง server เท่านั้น ไม่เอาข้อความดิบจาก client
  const textAnswers: { question: string; answer: string }[] = [];
  const choiceAnswers: {
    question: string;
    answer: string;
    facet: string | null;
    /** ลำดับตัวเลือก 0 = "ใช่เลย" … 4 = "ไม่เลย" */
    level: number;
  }[] = [];
  for (const a of answers) {
    if (a.choiceId) {
      const c = choiceById.get(a.choiceId);
      if (c && c.questionId === a.questionId && qIds.has(a.questionId)) {
        chosen.push({ scoreMap: c.scoreMap, points: c.points });
        cleanAnswers[a.questionId] = a.choiceId;
        choiceAnswers.push({
          question: promptById.get(a.questionId) ?? "",
          answer: c.labelText,
          facet: facetById.get(a.questionId) ?? null,
          level: c.orderIndex,
        });
      }
    } else if (a.text && qIds.has(a.questionId)) {
      // text answer: เก็บไว้ดู ไม่คิดคะแนน (จำกัดความยาวกัน abuse)
      const trimmed = a.text.slice(0, 1000);
      cleanAnswers[a.questionId] = trimmed;
      textAnswers.push({
        question: promptById.get(a.questionId) ?? "",
        answer: trimmed,
      });
    }
  }

  const scoringResults = rs.map<ScoringResult>((r) => ({
    resultKey: r.resultKey,
    orderIndex: r.orderIndex,
    scoreMin: r.scoreMin,
    scoreMax: r.scoreMax,
  }));

  // quiz แนว MBTI (quizzes.settings.aiScoring): คะแนนฟังก์ชันคำนวณในโค้ด
  // ส่วน AI อ่านคำตอบแล้วเขียนคำอธิบาย — ถ้า AI ล่มก็ยังไม่มีบทวิเคราะห์ให้อ่าน
  // จึงถือว่าเล่นไม่สำเร็จ ให้ผู้เล่นกดส่งใหม่ดีกว่าแสดงผลเปล่า ๆ
  let verdict: Awaited<ReturnType<typeof analyzer.classify>> | null = null;
  let functionScores: Record<FunctionCode, number> | null = null;
  let lowSignal = false;
  if (quiz.settings?.aiScoring) {
    if (!analyzer.enabled)
      return {
        ok: false,
        error: "quiz นี้ต้องใช้ AI ตัดสินผล แต่ระบบ AI ยังไม่ได้ตั้งค่า",
      };
    if (choiceAnswers.length === 0)
      return { ok: false, error: "ยังไม่ได้ตอบคำถาม" };

    const aiRl = await ratelimit.limit(`ai:${ip}`, {
      limit: 5,
      windowMs: 300_000,
    });
    if (!aiRl.success)
      return { ok: false, error: "ใช้ AI ถี่เกินไป รออีกสักครู่แล้วลองใหม่" };

    // คะแนนฟังก์ชันคำนวณจากคำตอบตรง ๆ ที่นี่ ไม่ได้ให้ AI เป็นคนให้คะแนน
    // แล้วยืดเทียบกับตัวผู้ตอบเอง กัน bias ของคนที่ชอบตอบ "ใช่" หรือ "ไม่" เป็นหลัก
    const rawScores = scoreFunctionsFromRatings(
      choiceAnswers.map((a) => ({ facet: a.facet, level: a.level })),
    );
    const normalized = normalizeFunctionScores(rawScores);
    functionScores = normalized.scores;
    lowSignal = !normalized.informative;

    try {
      verdict = await analyzer.classify({
        quizTitle: quiz.title,
        ratings: choiceAnswers.map((a) => ({
          statement: a.question,
          answer: a.answer,
          facet: a.facet,
        })),
        textAnswers,
        functionScores: FUNCTION_CODES.map((code) => ({
          code,
          strength: functionScores![code],
        })),
      });
    } catch (e) {
      console.error("submitPlay: ai classify failed", e);
      return {
        ok: false,
        error: "AI วิเคราะห์ผลไม่สำเร็จ ลองกดส่งคำตอบอีกครั้ง",
      };
    }
  }

  const titleByKey = new Map(rs.map((r) => [r.resultKey, r.title]));

  // AI ให้แค่คะแนนฟังก์ชัน — ชนิด MBTI คำนวณจากโปรไฟล์คะแนนทั้ง 8 ตัวตรงนี้
  // (สูตรอยู่ใน lib/mbti.ts: เทียบระยะห่างกับโปรไฟล์ในอุดมคติของแต่ละชนิด)
  let mbti: MbtiBreakdown | null = null;
  if (verdict && functionScores) {
    const scoreByCode = functionScores;
    const noteByCode = new Map(verdict.functions.map((f) => [f.code, f.note]));
    const ranked = rankTypes(scoreByCode);
    const best = ranked[0];
    const stack = FUNCTION_STACK[best.type];

    mbti = {
      type: best.type,
      confidence: best.fit,
      lowSignal,
      // โชว์หลายชนิดแทนการฟันธงตัวเดียว — โปรไฟล์คนจริงมักคาบเกี่ยวหลายแบบ
      ranking: ranked.slice(0, MBTI_RANKING_SIZE).map((m) => ({
        type: m.type,
        fit: m.fit,
        title: titleByKey.get(m.type) ?? m.type,
      })),
      dimensions: dimensionsFromFunctions(scoreByCode, best.type),
      // แปะคำอธิบายไทยตั้งแต่ฝั่ง server — component ฝั่ง client จะได้ไม่ต้องรู้จักตาราง MBTI
      functions: [...FUNCTION_CODES]
        .map((code) => ({ code, strength: scoreByCode[code] }))
        .sort((a, b) => b.strength - a.strength)
        .map((f) => {
          const info = FUNCTION_INFO[f.code];
          const at = stack.indexOf(f.code);
          return {
            code: f.code as string,
            strength: f.strength,
            note: noteByCode.get(f.code) ?? "",
            thai: info?.thai ?? f.code,
            nick: info?.nick ?? "",
            blurb: info?.blurb ?? "",
            stackLabel: at >= 0 ? STACK_LABEL[at] : null,
          };
        }),
    };
  }

  const outcome = mbti
    ? { resultKey: mbti.type, distribution: undefined }
    : computeResult(
        quiz.resultLogic === "range" ? "range" : "archetype",
        chosen,
        scoringResults,
      );

  const matched = rs.find((r) => r.resultKey === outcome.resultKey);
  if (mbti && !matched)
    return {
      ok: false,
      error: `คำนวณได้ผลลัพธ์ที่ไม่มีใน quiz นี้ (${mbti.type}) ลองใหม่อีกครั้ง`,
    };
  const winner = matched ?? rs[0];

  // ช่องทางโดเนทของผู้สร้าง (ถ้าเปิดไว้) — DESIGN.md ข้อ 10.5
  const [owner] = await db
    .select({ payout: users.creatorPayout })
    .from(users)
    .where(eq(users.id, quiz.ownerId))
    .limit(1);
  const p = owner?.payout;
  const creatorTip = p?.enabled && p.qrUrl ? { qrUrl: p.qrUrl } : null;

  // บทวิเคราะห์ AI (DESIGN.md ข้อ 6.2) — เปิดต่อ quiz และต้องมี driver พร้อม
  // ล้มเหลวแล้วต้องไม่ทำให้ผู้เล่นไม่ได้ผลลัพธ์ จึงกลืน error แล้วคืน null
  let aiAnalysis: string | null = verdict?.analysis ?? null;
  if (
    !verdict &&
    quiz.settings?.aiAnalysis &&
    analyzer.enabled &&
    textAnswers.length
  ) {
    const aiRl = await ratelimit.limit(`ai:${ip}`, {
      limit: 5,
      windowMs: 300_000,
    });
    if (aiRl.success) {
      try {
        aiAnalysis = await analyzer.analyze({
          quizTitle: quiz.title,
          resultTitle: winner.title,
          resultDescription: winner.description,
          textAnswers,
          choiceAnswers,
        });
      } catch (e) {
        console.error("submitPlay: ai analyze failed", e);
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(plays).values({
      quizId: quiz.id,
      resultId: winner.id,
      answers: cleanAnswers,
      aiAnalysis,
      aiVerdict: verdict ? { ...verdict, derived: mbti } : null,
    });
    await tx
      .update(quizzes)
      .set({ playCount: sql`${quizzes.playCount} + 1` })
      .where(eq(quizzes.id, quiz.id));
  });

  return {
    ok: true,
    result: {
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
      aiAnalysis,
      mbti,
    },
  };
}
