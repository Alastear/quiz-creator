import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";

// กฎสิทธิ์การใช้งาน (DESIGN.md ข้อ 10.3) — ตรวจฝั่ง server เสมอ
export const FREE_ACTIVE_QUIZ_LIMIT = 3;
export const QUIZ_LIFESPAN_DAYS = 7;

/** จำนวน quiz ที่ active (published) อยู่ — ไม่นับอันที่หมดอายุ/archived */
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

export type EntitlementUser = { id: string; plan: string; quizCredits: number };

/** เผยแพร่ quiz ใหม่ได้ไหม (free = active ≤ 3, เกินต้องมี credit — หัก credit จริงตอน Phase 6) */
export async function canPublishQuiz(
  user: EntitlementUser,
  quizId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const active = await countActiveQuizzes(user.id, quizId);
  if (active < FREE_ACTIVE_QUIZ_LIMIT) return { ok: true };
  if (user.quizCredits > 0) return { ok: true };
  return {
    ok: false,
    reason: `แพ็กฟรีเผยแพร่ได้สูงสุด ${FREE_ACTIVE_QUIZ_LIMIT} quiz พร้อมกัน — ปล่อยอันเก่าให้หมดอายุ หรือเพิ่มเครดิต`,
  };
}

/** วันหมดอายุ = ตอนนี้ + 7 วัน */
export function quizExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + QUIZ_LIFESPAN_DAYS * 24 * 60 * 60 * 1000);
}
