"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, quizzes, auditLogs, reports, adSlots } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { setConfig } from "@/lib/config";

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

// ---- Moderation ----
export async function resolveReport(
  reportId: string,
  action: "suspend" | "dismiss" | "resolve",
) {
  const admin = await requireAdmin();
  const [rep] = await db
    .select({ quizId: reports.quizId })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  if (!rep) return;

  if (action === "suspend") {
    await db
      .update(quizzes)
      .set({ status: "draft", expiresAt: null })
      .where(eq(quizzes.id, rep.quizId));
    await logAudit(admin.id, "quiz.suspend_via_report", "quiz", rep.quizId);
  }
  await db
    .update(reports)
    .set({
      status: action === "dismiss" ? "dismissed" : "resolved",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
    })
    .where(eq(reports.id, reportId));
  await logAudit(admin.id, `report.${action}`, "report", reportId);
  revalidatePath("/admin/moderation");
}

// ---- Ad slots ----
export async function createAdSlot(formData: FormData) {
  const admin = await requireAdmin();
  const placement = String(formData.get("placement")) as
    | "footer"
    | "rail_left"
    | "rail_right"
    | "inline";
  const pages = String(formData.get("pages") ?? "home")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.insert(adSlots).values({
    placement,
    kind: "image",
    imageUrl: String(formData.get("imageUrl") ?? "") || null,
    targetUrl: String(formData.get("targetUrl") ?? "") || null,
    pages,
    enabled: true,
    updatedBy: admin.id,
  });
  await logAudit(admin.id, "ad.create", "ad_slot", placement, { pages });
  revalidatePath("/admin/ads");
}

export async function toggleAdSlot(id: string, enabled: boolean) {
  const admin = await requireAdmin();
  await db
    .update(adSlots)
    .set({ enabled, updatedBy: admin.id, updatedAt: new Date() })
    .where(eq(adSlots.id, id));
  await logAudit(admin.id, "ad.toggle", "ad_slot", id, { enabled });
  revalidatePath("/admin/ads");
}

export async function deleteAdSlot(id: string) {
  const admin = await requireAdmin();
  await db.delete(adSlots).where(eq(adSlots.id, id));
  await logAudit(admin.id, "ad.delete", "ad_slot", id);
  revalidatePath("/admin/ads");
}

// ---- System settings ----
export async function updateFlags(formData: FormData) {
  const admin = await requireAdmin();
  const value = {
    adsEnabled: formData.get("adsEnabled") === "on",
    signupsOpen: formData.get("signupsOpen") === "on",
  };
  await setConfig("flags", value, admin.id);
  await logAudit(admin.id, "config.flags", "config", "flags", value);
  revalidatePath("/admin/settings");
}

export async function updateAnnouncement(formData: FormData) {
  const admin = await requireAdmin();
  const value = {
    enabled: formData.get("enabled") === "on",
    text: String(formData.get("text") ?? "").slice(0, 500),
  };
  await setConfig("announcement", value, admin.id);
  await logAudit(admin.id, "config.announcement", "config", "announcement");
  revalidatePath("/admin/settings");
}
