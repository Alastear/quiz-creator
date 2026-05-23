import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, transactions } from "@/lib/db/schema";
import { packById } from "@/lib/pricing";

// เติม credit / บันทึกโดเนท — ใช้ร่วมกันทั้ง mock (ทันที) และ Stripe webhook (ภายหลัง)
// idempotent ด้วย providerRef (กัน fulfil ซ้ำ)

async function alreadyProcessed(providerRef: string): Promise<boolean> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(eq(transactions.providerRef, providerRef), eq(transactions.status, "paid")),
    )
    .limit(1);
  return rows.length > 0;
}

export async function fulfillCreditPack(
  userId: string,
  packId: string,
  provider: string,
  providerRef: string,
): Promise<{ ok: boolean; error?: string }> {
  const pack = packById(packId);
  if (!pack) return { ok: false, error: "ไม่พบแพ็ก" };
  if (await alreadyProcessed(providerRef)) return { ok: true };

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values({
      userId,
      kind: "credit_pack",
      amount: pack.price,
      creditsGranted: pack.credits,
      provider,
      providerRef,
      status: "paid",
      metadata: { packId },
    });
    await tx
      .update(users)
      .set({ quizCredits: sql`${users.quizCredits} + ${pack.credits}` })
      .where(eq(users.id, userId));
  });
  return { ok: true };
}

export async function fulfillDonation(
  userId: string,
  amount: number,
  provider: string,
  providerRef: string,
): Promise<{ ok: boolean; error?: string }> {
  if (await alreadyProcessed(providerRef)) return { ok: true };
  await db.insert(transactions).values({
    userId,
    kind: "donation",
    amount,
    creditsGranted: 0,
    provider,
    providerRef,
    status: "paid",
  });
  return { ok: true };
}
