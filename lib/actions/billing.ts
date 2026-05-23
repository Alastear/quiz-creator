"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, quizzes } from "@/lib/db/schema";
import { getActor } from "@/lib/auth-helpers";
import { payment } from "@/lib/payment";
import { packById, DONATION_MIN, DONATION_MAX, EXTEND_DAYS } from "@/lib/pricing";

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
