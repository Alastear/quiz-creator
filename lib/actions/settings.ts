"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getActor } from "@/lib/auth-helpers";
import { ratelimit } from "@/lib/ratelimit";

// รับเฉพาะ QR code (รูป) — ตัดข้อมูลตัวอักษรออกเพื่อกันข้อมูลส่วนตัวรั่ว/ถูกใช้ในทางไม่ดี
const payoutSchema = z.object({
  enabled: z.boolean().default(false),
  qrUrl: z.string().trim().max(2000).optional(),
});

export type CreatorPayout = z.infer<typeof payoutSchema>;

/** บันทึกช่องทางรับโดเนทส่วนตัวของผู้สร้าง (DESIGN.md ข้อ 10.5) */
export async function saveCreatorPayout(
  input: CreatorPayout,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getActor();
  // rate-limit การแก้ช่องทางรับเงิน (กันบัญชีโดน hijack แล้วสับเปลี่ยน QR)
  const rl = await ratelimit.limit(`payout:${user.id}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.success) return { ok: false, error: "แก้ไขถี่เกินไป" };

  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  await db
    .update(users)
    .set({ creatorPayout: parsed.data })
    .where(eq(users.id, user.id));
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
