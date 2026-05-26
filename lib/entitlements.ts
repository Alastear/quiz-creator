import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// โควตาสร้าง quiz แบบ "ถังสิทธิ์" (DESIGN.md ข้อ 10.3)
// - เพดาน 10, เริ่มที่ 10
// - สร้าง 1 อัน → สิทธิ์ −1
// - ทุกวันจันทร์ → +2 (ไม่เกิน 10)
// - ลบ/หมดอายุ quiz → คืนสิทธิ์ +1 (ไม่เกิน 10)
// - admin = ไม่จำกัด
export const MAX_ALLOWANCE = 10;
export const WEEKLY_REFILL = 2;
export const QUIZ_LIFESPAN_DAYS = 30;

// จุดอ้างอิงวันจันทร์ 00:00 เวลาไทย (1 ม.ค. 2024 = วันจันทร์ = 2023-12-31T17:00:00Z)
const EPOCH_MONDAY_MS = Date.UTC(2023, 11, 31, 17, 0, 0);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Actor = { id: string; role: string };
const isAdmin = (a: Actor) => a.role === "admin";

/** index ของสัปดาห์ (เพิ่มทีละ 1 ทุกวันจันทร์ 00:00 ไทย) */
function weekIndex(d: Date): number {
  return Math.floor((d.getTime() - EPOCH_MONDAY_MS) / WEEK_MS);
}

/** สิทธิ์ที่แท้จริงตอนนี้ = ค่าที่เก็บไว้ + (2 × จำนวนวันจันทร์ที่ผ่านมา) เพดาน 10 */
export function effectiveAllowance(
  stored: number,
  refilledAt: Date,
  now: Date = new Date(),
): number {
  const weeks = Math.max(0, weekIndex(now) - weekIndex(refilledAt));
  return Math.min(MAX_ALLOWANCE, stored + WEEKLY_REFILL * weeks);
}

/** อ่านสิทธิ์คงเหลือปัจจุบัน (admin = Infinity) — ไม่เขียน DB */
export async function getAllowance(actor: Actor): Promise<number> {
  if (isAdmin(actor)) return Infinity;
  const [u] = await db
    .select({
      a: users.createAllowance,
      r: users.allowanceRefilledAt,
    })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  if (!u) return 0;
  return effectiveAllowance(u.a, u.r);
}

/** ใช้สิทธิ์ 1 (เติมวันจันทร์ก่อน) — admin ไม่จำกัด */
export async function consumeAllowance(
  actor: Actor,
): Promise<{ ok: boolean; reason?: string }> {
  if (isAdmin(actor)) return { ok: true };
  const now = new Date();
  const [u] = await db
    .select({ a: users.createAllowance, r: users.allowanceRefilledAt })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  if (!u) return { ok: false, reason: "ไม่พบบัญชี" };

  const eff = effectiveAllowance(u.a, u.r, now);
  if (eff < 1)
    return {
      ok: false,
      reason: `สิทธิ์การสร้างหมดแล้ว — จะเติมให้ +${WEEKLY_REFILL} ทุกวันจันทร์ (สูงสุด ${MAX_ALLOWANCE}) หรือลบ quiz เก่าเพื่อคืนสิทธิ์`,
    };

  await db
    .update(users)
    .set({ createAllowance: eff - 1, allowanceRefilledAt: now })
    .where(eq(users.id, actor.id));
  return { ok: true };
}

/** คืนสิทธิ์ n หน่วย (ลบ/หมดอายุ quiz) — เติมวันจันทร์ค้างก่อน, เพดาน 10 */
export async function refundAllowance(
  ownerId: string,
  n = 1,
): Promise<void> {
  const now = new Date();
  const [u] = await db
    .select({
      a: users.createAllowance,
      r: users.allowanceRefilledAt,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!u || u.role === "admin") return; // admin ไม่ใช้ระบบสิทธิ์
  const eff = effectiveAllowance(u.a, u.r, now);
  await db
    .update(users)
    .set({
      createAllowance: Math.min(MAX_ALLOWANCE, eff + n),
      allowanceRefilledAt: now,
    })
    .where(eq(users.id, ownerId));
}

/** วันหมดอายุ = ตอนนี้ + 30 วัน */
export function quizExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + QUIZ_LIFESPAN_DAYS * 24 * 60 * 60 * 1000);
}
