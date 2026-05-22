"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { quizzes, questions, choices, results } from "@/lib/db/schema";
import { getActor } from "@/lib/auth-helpers";
import { quizDraftSchema, type QuizDraft } from "@/lib/validation/quiz";
import { validateForPublish, type ScoringResult } from "@/lib/scoring";
import { canPublishQuiz, quizExpiry } from "@/lib/entitlements";
import { restoreArchivedQuiz } from "@/lib/lifecycle";

/** โหลด quiz ที่ user เป็นเจ้าของ (กัน IDOR) */
async function getOwnedQuiz(quizId: string, ownerId: string) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, ownerId)))
    .limit(1);
  if (!quiz) throw new Error("not found");
  return quiz;
}

/** สร้าง quiz เปล่า (มี seed ผลลัพธ์ 2 แบบ + คำถาม 1 ข้อ) แล้วเด้งไปหน้า builder */
export async function createQuiz() {
  const user = await getActor();
  const quizId = crypto.randomUUID();
  const publicId = nanoid(12);

  await db.transaction(async (tx) => {
    await tx.insert(quizzes).values({
      id: quizId,
      publicId,
      ownerId: user.id,
      title: "quiz ใหม่",
      resultLogic: "archetype",
      status: "draft",
    });
    const r1 = nanoid(6);
    const r2 = nanoid(6);
    await tx.insert(results).values([
      { quizId, orderIndex: 0, resultKey: r1, title: "ผลลัพธ์ A" },
      { quizId, orderIndex: 1, resultKey: r2, title: "ผลลัพธ์ B" },
    ]);
    const [q] = await tx
      .insert(questions)
      .values({ quizId, orderIndex: 0, promptText: "คำถามข้อแรก" })
      .returning({ id: questions.id });
    await tx.insert(choices).values([
      {
        questionId: q.id,
        orderIndex: 0,
        labelText: "ตัวเลือก 1",
        scoreMap: { [r1]: 1 },
      },
      {
        questionId: q.id,
        orderIndex: 1,
        labelText: "ตัวเลือก 2",
        scoreMap: { [r2]: 1 },
      },
    ]);
  });

  redirect(`/create/${quizId}`);
}

/** เซฟทั้ง quiz (replace questions/results ทั้งก้อนใน transaction) */
export async function saveQuiz(
  quizId: string,
  draft: QuizDraft,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getActor();
  await getOwnedQuiz(quizId, user.id);

  const parsed = quizDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const d = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(quizzes)
      .set({
        title: d.title,
        description: d.description ?? null,
        coverImageUrl: d.coverImageUrl || null,
        category: d.category,
        resultLogic: d.resultLogic,
        theme: d.theme,
        settings: d.settings,
      })
      .where(eq(quizzes.id, quizId));

    // replace results + questions (choices ลบตาม cascade)
    await tx.delete(results).where(eq(results.quizId, quizId));
    await tx.delete(questions).where(eq(questions.quizId, quizId));

    if (d.results.length) {
      await tx.insert(results).values(
        d.results.map((r, i) => ({
          quizId,
          orderIndex: i,
          resultKey: r.resultKey,
          title: r.title,
          description: r.description ?? null,
          mediaType: r.mediaType,
          mediaUrl: r.mediaUrl || null,
          shareText: r.shareText ?? null,
          scoreMin: r.scoreMin ?? null,
          scoreMax: r.scoreMax ?? null,
        })),
      );
    }

    for (const [qi, q] of d.questions.entries()) {
      const [inserted] = await tx
        .insert(questions)
        .values({
          quizId,
          orderIndex: qi,
          kind: q.kind,
          promptText: q.promptText,
          mediaType: q.mediaType,
          mediaUrl: q.mediaUrl || null,
        })
        .returning({ id: questions.id });

      // เก็บตัวเลือกเฉพาะ segment แบบ choice
      if (q.kind === "choice" && q.choices.length) {
        await tx.insert(choices).values(
          q.choices.map((c, ci) => ({
            questionId: inserted.id,
            orderIndex: ci,
            labelText: c.labelText,
            mediaType: c.mediaType,
            mediaUrl: c.mediaUrl || null,
            scoreMap: c.scoreMap,
            points: c.points,
          })),
        );
      }
    }
  });

  revalidatePath(`/create/${quizId}`);
  return { ok: true };
}

/** เผยแพร่ quiz: ตรวจ validation + สิทธิ์ + ตั้งวันหมดอายุ 7 วัน */
export async function publishQuiz(
  quizId: string,
): Promise<{ ok: boolean; errors?: string[] }> {
  const user = await getActor();
  const quiz = await getOwnedQuiz(quizId, user.id);

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId));
  const rs = await db.select().from(results).where(eq(results.quizId, quizId));
  const allChoices = await db.select().from(choices);
  const choicesByQ = new Map<string, typeof allChoices>();
  for (const c of allChoices) {
    const arr = choicesByQ.get(c.questionId) ?? [];
    arr.push(c);
    choicesByQ.set(c.questionId, arr);
  }

  const errors = validateForPublish({
    logic: quiz.resultLogic as "archetype" | "range",
    questions: qs.map((q) => ({
      kind: q.kind as "choice" | "text" | "story",
      choices: (choicesByQ.get(q.id) ?? []).map((c) => ({
        scoreMap: c.scoreMap,
        points: c.points,
      })),
    })),
    results: rs.map<ScoringResult>((r) => ({
      resultKey: r.resultKey,
      orderIndex: r.orderIndex,
      scoreMin: r.scoreMin,
      scoreMax: r.scoreMax,
    })),
  });
  if (errors.length) return { ok: false, errors };

  const gate = await canPublishQuiz(
    { id: user.id, plan: user.plan, quizCredits: 0 },
    quizId,
  );
  if (!gate.ok) return { ok: false, errors: [gate.reason ?? "เผยแพร่ไม่ได้"] };

  const now = new Date();
  await db
    .update(quizzes)
    .set({ status: "published", publishedAt: now, expiresAt: quizExpiry(now) })
    .where(eq(quizzes.id, quizId));

  revalidatePath(`/create/${quizId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function unpublishQuiz(quizId: string) {
  const user = await getActor();
  await getOwnedQuiz(quizId, user.id);
  await db
    .update(quizzes)
    .set({ status: "draft", expiresAt: null })
    .where(eq(quizzes.id, quizId));
  revalidatePath(`/create/${quizId}`);
  revalidatePath("/dashboard");
}

export async function deleteQuiz(quizId: string) {
  const user = await getActor();
  await getOwnedQuiz(quizId, user.id);
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** เผยแพร่ซ้ำ (ใช้กับ quiz ที่หมดอายุ) — wrapper คืน void สำหรับใช้เป็น form action */
export async function republishQuizAction(quizId: string): Promise<void> {
  await publishQuiz(quizId);
  revalidatePath("/dashboard");
}

/** กู้คืน quiz ที่ถูก archive → กลับเป็น draft แล้วเปิดหน้า builder */
export async function restoreQuiz(quizId: string) {
  const user = await getActor();
  const res = await restoreArchivedQuiz(quizId, user.id);
  revalidatePath("/dashboard");
  if (res.ok) redirect(`/create/${quizId}`);
}
