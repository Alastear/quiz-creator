"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, quizzes, auditLogs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

async function logAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: unknown,
) {
  const h = await headers();
  await db.insert(auditLogs).values({
    actorUserId: actorId,
    action,
    targetType,
    targetId,
    detail: detail ?? null,
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null,
  });
}

// ---- Users ----
export async function setUserStatus(
  userId: string,
  status: "active" | "suspended",
) {
  const admin = await requireAdmin();
  await db.update(users).set({ status }).where(eq(users.id, userId));
  await logAudit(admin.id, `user.${status}`, "user", userId);
  revalidatePath("/admin/users");
}

export async function setUserRole(
  userId: string,
  role: "user" | "support" | "admin",
): Promise<void> {
  const admin = await requireAdmin();
  // กันเผลอถอดสิทธิ์ตัวเอง
  if (userId === admin.id && role !== "admin") return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  await logAudit(admin.id, "user.role", "user", userId, { role });
  revalidatePath("/admin/users");
}

export async function adjustCredits(userId: string, delta: number) {
  const admin = await requireAdmin();
  await db
    .update(users)
    .set({ quizCredits: sql`greatest(0, ${users.quizCredits} + ${delta})` })
    .where(eq(users.id, userId));
  await logAudit(admin.id, "credit.adjust", "user", userId, { delta });
  revalidatePath("/admin/users");
}

// ---- Quizzes ----
export async function adminUnpublishQuiz(quizId: string) {
  const admin = await requireAdmin();
  await db
    .update(quizzes)
    .set({ status: "draft", expiresAt: null })
    .where(eq(quizzes.id, quizId));
  await logAudit(admin.id, "quiz.unpublish", "quiz", quizId);
  revalidatePath("/admin/quizzes");
}

export async function adminDeleteQuiz(quizId: string) {
  const admin = await requireAdmin();
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  await logAudit(admin.id, "quiz.delete", "quiz", quizId);
  revalidatePath("/admin/quizzes");
}
