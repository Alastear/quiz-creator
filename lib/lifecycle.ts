import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  quizzes,
  questions,
  choices,
  results,
  plays,
  quizArchives,
} from "@/lib/db/schema";

// อายุ/ระยะเวลา (DESIGN.md ข้อ 9)
export const ARCHIVE_GRACE_DAYS = 3; // expired กี่วันก่อนถูก archive
export const RESTORE_WINDOW_DAYS = 90; // archive กู้คืนได้ภายในกี่วัน
const DAY = 24 * 60 * 60 * 1000;

/** quiz ที่ published แล้วเลยวันหมดอายุ → expired */
export async function expirePublished(now: Date = new Date()): Promise<number> {
  const rows = await db
    .update(quizzes)
    .set({ status: "expired" })
    .where(and(eq(quizzes.status, "published"), lt(quizzes.expiresAt, now)))
    .returning({ id: quizzes.id });
  return rows.length;
}

/** quiz ที่ expired เกิน grace → archive (เก็บ JSON + ลบ rows ลูก + ตั้ง archived) */
export async function archiveExpired(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ARCHIVE_GRACE_DAYS * DAY);
  const candidates = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.status, "expired"), lt(quizzes.expiresAt, cutoff)));

  let archived = 0;
  for (const quiz of candidates) {
    const rs = await db
      .select()
      .from(results)
      .where(eq(results.quizId, quiz.id))
      .orderBy(asc(results.orderIndex));
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .orderBy(asc(questions.orderIndex));
    const cs = qs.length
      ? await db
          .select()
          .from(choices)
          .where(inArray(choices.questionId, qs.map((q) => q.id)))
          .orderBy(asc(choices.orderIndex))
      : [];

    // สรุปสัดส่วนผลลัพธ์จาก plays ก่อนลบ
    const resultRows = rs.map((r) => [r.id, r.resultKey] as const);
    const resultKeyById = new Map(resultRows);
    const breakdown: Record<string, number> = {};
    const playRows = await db
      .select({ resultId: plays.resultId })
      .from(plays)
      .where(eq(plays.quizId, quiz.id));
    for (const p of playRows) {
      const key = p.resultId ? resultKeyById.get(p.resultId) : undefined;
      if (key) breakdown[key] = (breakdown[key] ?? 0) + 1;
    }

    const data = {
      quiz: {
        title: quiz.title,
        description: quiz.description,
        coverImageUrl: quiz.coverImageUrl,
        category: quiz.category,
        resultLogic: quiz.resultLogic,
        theme: quiz.theme,
        settings: quiz.settings,
      },
      results: rs.map((r) => ({
        resultKey: r.resultKey,
        orderIndex: r.orderIndex,
        title: r.title,
        description: r.description,
        mediaType: r.mediaType,
        mediaUrl: r.mediaUrl,
        shareText: r.shareText,
        scoreMin: r.scoreMin,
        scoreMax: r.scoreMax,
      })),
      questions: qs.map((q) => ({
        orderIndex: q.orderIndex,
        kind: q.kind,
        promptText: q.promptText,
        mediaType: q.mediaType,
        mediaUrl: q.mediaUrl,
        choices: cs
          .filter((c) => c.questionId === q.id)
          .map((c) => ({
            orderIndex: c.orderIndex,
            labelText: c.labelText,
            mediaType: c.mediaType,
            mediaUrl: c.mediaUrl,
            scoreMap: c.scoreMap,
            points: c.points,
          })),
      })),
    };

    await db.transaction(async (tx) => {
      await tx.insert(quizArchives).values({
        quizId: quiz.id,
        ownerId: quiz.ownerId,
        data,
        statsSnapshot: {
          viewCount: quiz.viewCount,
          playCount: quiz.playCount,
          resultBreakdown: breakdown,
        },
        restorableUntil: new Date(now.getTime() + RESTORE_WINDOW_DAYS * DAY),
      });
      // ลบ rows ลูก (choices ตามด้วย questions ผ่าน cascade ก็ได้ แต่ทำชัด ๆ)
      await tx.delete(plays).where(eq(plays.quizId, quiz.id));
      await tx.delete(results).where(eq(results.quizId, quiz.id));
      await tx.delete(questions).where(eq(questions.quizId, quiz.id)); // choices cascade
      await tx
        .update(quizzes)
        .set({ status: "archived" })
        .where(eq(quizzes.id, quiz.id));
    });
    archived++;
  }
  return archived;
}

/** กู้คืน quiz จาก archive → กลับมาเป็น draft (ภายใน restorableUntil) */
export async function restoreArchivedQuiz(
  quizId: string,
  ownerId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const [archive] = await db
    .select()
    .from(quizArchives)
    .where(and(eq(quizArchives.quizId, quizId), eq(quizArchives.ownerId, ownerId)))
    .limit(1);
  if (!archive) return { ok: false, reason: "ไม่พบข้อมูลสำรอง" };
  if (archive.restorableUntil < new Date())
    return { ok: false, reason: "เลยกำหนดกู้คืนแล้ว" };

  const data = archive.data as {
    quiz: Record<string, unknown>;
    results: Array<Record<string, unknown>>;
    questions: Array<{ choices: Array<Record<string, unknown>>; [k: string]: unknown }>;
  };

  await db.transaction(async (tx) => {
    if (data.results.length) {
      await tx.insert(results).values(
        data.results.map((r) => ({ ...(r as object), quizId })) as never,
      );
    }
    for (const q of data.questions) {
      const { choices: qChoices, ...qRest } = q;
      const [ins] = await tx
        .insert(questions)
        .values({ ...(qRest as object), quizId } as never)
        .returning({ id: questions.id });
      if (qChoices?.length) {
        await tx.insert(choices).values(
          qChoices.map((c) => ({ ...(c as object), questionId: ins.id })) as never,
        );
      }
    }
    await tx
      .update(quizzes)
      .set({ status: "draft", expiresAt: null, publishedAt: null })
      .where(eq(quizzes.id, quizId));
    await tx.delete(quizArchives).where(eq(quizArchives.id, archive.id));
  });

  return { ok: true };
}
