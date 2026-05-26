import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";

// โควตาช่วงใช้ฟรี (DESIGN.md ข้อ 10.3) — ปรับเรื่องเครดิตทีหลัง
export const MAX_ACTIVE_QUIZZES = 10; // active (เผยแพร่อยู่) สูงสุดพร้อมกัน
export const WEEKLY_CREATE_LIMIT = 2; // สร้างใหม่ได้กี่อันต่อ 7 วัน
export const QUIZ_LIFESPAN_DAYS = 30; // อายุ quiz หลังเผยแพร่

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type Actor = { id: string; role: string };
const isAdmin = (a: Actor) => a.role === "admin";

/** จำนวน quiz ที่ active (published) อยู่ — ไม่นับ expired/archived */
export async function countActiveQuizzes(
  ownerId: string,
  excludeQuizId?: string,
): Promise<number> {
  const where = excludeQuizId
    ? and(
        eq(quizzes.ownerId, ownerId),
        eq(quizzes.status, "published"),
        ne(quizzes.id, excludeQuizId),
      )
    : and(eq(quizzes.ownerId, ownerId), eq(quizzes.status, "published"));
  const rows = await db.select({ id: quizzes.id }).from(quizzes).where(where);
  return rows.length;
}

/**
 * จำนวน quiz ที่สร้างใน 7 วันล่าสุด — นับเฉพาะที่ยังอยู่ (draft/published)
 * ลบ/หมดอายุ/archive → ไม่ถูกนับ → สิทธิ์สร้างกลับมา
 */
export async function countCreatedThisWeek(ownerId: string): Promise<number> {
  const since = new Date(Date.now() - WEEK_MS);
  const rows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(
      and(
        eq(quizzes.ownerId, ownerId),
        gte(quizzes.createdAt, since),
        inArray(quizzes.status, ["draft", "published"]),
      ),
    );
  return rows.length;
}

/** โควตาสร้างที่เหลือสัปดาห์นี้ (admin = ไม่จำกัด → คืน Infinity) */
export async function weeklyCreateRemaining(actor: Actor): Promise<number> {
  if (isAdmin(actor)) return Infinity;
  const used = await countCreatedThisWeek(actor.id);
  return Math.max(0, WEEKLY_CREATE_LIMIT - used); // ไม่ต่ำกว่า 0
}

/** สร้าง quiz ใหม่ได้ไหม (admin ไม่จำกัด, นอกนั้น ≤ 2/สัปดาห์) */
export async function canCreateQuiz(
  actor: Actor,
): Promise<{ ok: boolean; reason?: string }> {
  if (isAdmin(actor)) return { ok: true };
  const remaining = await weeklyCreateRemaining(actor);
  if (remaining > 0) return { ok: true };
  return {
    ok: false,
    reason: `สัปดาห์นี้สร้างครบ ${WEEKLY_CREATE_LIMIT} อันแล้ว — สร้างเพิ่มได้สัปดาห์หน้า`,
  };
}

/** เผยแพร่ได้ไหม (admin ไม่จำกัด, นอกนั้น active ≤ 10) */
export async function canPublishQuiz(
  actor: Actor,
  quizId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (isAdmin(actor)) return { ok: true };
  const active = await countActiveQuizzes(actor.id, quizId);
  if (active < MAX_ACTIVE_QUIZZES) return { ok: true };
  return {
    ok: false,
    reason: `เผยแพร่ได้สูงสุด ${MAX_ACTIVE_QUIZZES} อันพร้อมกัน — ปล่อยอันเก่าให้หมดอายุก่อน`,
  };
}

/** วันหมดอายุ = ตอนนี้ + 30 วัน */
export function quizExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + QUIZ_LIFESPAN_DAYS * 24 * 60 * 60 * 1000);
}
