"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, quizzes } from "@/lib/db/schema";
import { getActor } from "@/lib/auth-helpers";
import { payment } from "@/lib/payment";
import {
  packById,
  DONATION_MIN,
  DONATION_MAX,
  EXTEND_DAYS,
  AI_ANALYSIS_COST_CREDITS,
} from "@/lib/pricing";
import { aiAvailable } from "@/lib/ai";

/** ซื้อแพ็กเครดิต (mock=ได้ทันที, stripe=ไปหน้า Stripe) */
export async function buyCreditPack(packId: string) {
  const user = await getActor();
  if (!packById(packId)) throw new Error("ไม่พบแพ็ก");
  const { url } = await payment.checkoutCreditPack(user.id, packId);
  redirect(url);
}

/** โดเนทให้แพลตฟอร์ม */
export async function donate(formData: FormData) {
  const user = await getActor();
  const amount = Math.floor(Number(formData.get("amount")));
  if (!Number.isFinite(amount) || amount < DONATION_MIN || amount > DONATION_MAX)
    redirect("/dashboard/billing?error=amount");
  const { url } = await payment.checkoutDonation(user.id, amount);
  redirect(url);
}

/** ต่ออายุ quiz +30 วัน โดยใช้ 1 เครดิต */
export async function extendQuizWithCredit(quizId: string) {
  const user = await getActor();
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, user.id)))
    .limit(1);
  if (!quiz) throw new Error("not found");

  const [u] = await db
    .select({ credits: users.quizCredits })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if ((u?.credits ?? 0) < 1) redirect("/dashboard/billing?error=nocredit");

  const base =
    quiz.expiresAt && quiz.expiresAt > new Date() ? quiz.expiresAt : new Date();
  const newExpiry = new Date(base.getTime() + EXTEND_DAYS * 86400_000);

  await db.transaction(async (tx) => {
    await tx
      .update(quizzes)
      .set({
        status: "published",
        expiresAt: newExpiry,
        publishedAt: quiz.publishedAt ?? new Date(),
      })
      .where(eq(quizzes.id, quizId));
    await tx
      .update(users)
      .set({ quizCredits: sql`${users.quizCredits} - 1` })
      .where(eq(users.id, user.id));
  });

  revalidatePath("/dashboard");
}

/**
 * เปิดบทวิเคราะห์ AI ให้ quiz หนึ่งอัน — จ่ายครั้งเดียว ไม่จำกัดจำนวนคนเล่น
 * admin เปิดได้ฟรี (เหมือนโควตาสร้าง) — DESIGN.md ข้อ 10.3
 */
export async function enableAiAnalysis(
  quizId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getActor();

  if (!aiAvailable())
    return { ok: false, error: "ระบบ AI ยังไม่ได้ตั้งค่า ลองใหม่ภายหลัง" };

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, user.id)))
    .limit(1);
  if (!quiz) return { ok: false, error: "ไม่พบ quiz" };

  // เปิดอยู่แล้ว → ไม่คิดเงินซ้ำ
  if (quiz.settings?.aiAnalysis) return { ok: true };

  const free = user.role === "admin";

  try {
    await db.transaction(async (tx) => {
      if (!free) {
        // หักแบบมีเงื่อนไขในคำสั่งเดียว — กดรัว ๆ ก็หักจนติดลบไม่ได้
        const charged = await tx
          .update(users)
          .set({
            quizCredits: sql`${users.quizCredits} - ${AI_ANALYSIS_COST_CREDITS}`,
          })
          .where(
            and(
              eq(users.id, user.id),
              gte(users.quizCredits, AI_ANALYSIS_COST_CREDITS),
            ),
          )
          .returning({ id: users.id });
        // ไม่มีแถวถูกอัปเดต = เครดิตไม่พอ → ทิ้งทั้ง transaction
        if (charged.length === 0) throw new Error("NO_CREDIT");
      }

      await tx
        .update(quizzes)
        .set({ settings: { ...quiz.settings, aiAnalysis: true } })
        .where(eq(quizzes.id, quizId));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_CREDIT") {
      return {
        ok: false,
        error: `เครดิตไม่พอ — ต้องใช้ ${AI_ANALYSIS_COST_CREDITS} เครดิต`,
      };
    }
    throw e;
  }

  revalidatePath(`/create/${quizId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** ปิดบทวิเคราะห์ AI (ไม่คืนเครดิต — เปิดใหม่ต้องจ่ายอีกครั้ง) */
export async function disableAiAnalysis(quizId: string): Promise<void> {
  const user = await getActor();
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, user.id)))
    .limit(1);
  if (!quiz) throw new Error("not found");

  await db
    .update(quizzes)
    .set({ settings: { ...quiz.settings, aiAnalysis: false } })
    .where(eq(quizzes.id, quizId));
  revalidatePath(`/create/${quizId}`);
}
