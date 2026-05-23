"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes, reports } from "@/lib/db/schema";
import { auth } from "@/auth";
import { ratelimit } from "@/lib/ratelimit";

/** ผู้เล่นรายงาน quiz (DESIGN.md ข้อ 11.2 F) — สาธารณะ, rate-limited */
export async function reportQuiz(
  publicId: string,
  formData: FormData,
): Promise<void> {
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  if (!reason) return;

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const rl = await ratelimit.limit(`report:${ip}`, { limit: 5, windowMs: 300_000 });
  if (!rl.success) return;

  const [quiz] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);
  if (!quiz) return;

  const session = await auth().catch(() => null);
  await db.insert(reports).values({
    quizId: quiz.id,
    reporterUserId: session?.user?.id ?? null,
    reason,
    ip,
  });
}
