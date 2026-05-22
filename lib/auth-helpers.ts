import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { consents, users } from "@/lib/db/schema";
import { CURRENT_POLICY_VERSION } from "@/lib/consent";
import { env } from "@/lib/env";

/** ดึง user ปัจจุบันสำหรับ server action — โยน error ถ้าไม่ล็อกอิน/ถูกระงับ */
export async function getActor() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");
  if (session.user.status === "suspended") throw new Error("suspended");
  return session.user;
}

/**
 * บังคับสิทธิ์ admin (DESIGN.md ข้อ 11, 12) — ตรวจที่ server ทุก request
 * bootstrap: อีเมลใน ADMIN_EMAILS จะถูกตั้งเป็น admin อัตโนมัติ
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/admin");

  const adminEmails = env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isListed =
    !!session.user.email &&
    adminEmails.includes(session.user.email.toLowerCase());

  if (session.user.role !== "admin") {
    if (isListed) {
      await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, session.user.id));
    } else {
      redirect("/");
    }
  }
  return { ...session.user, role: "admin" as const };
}

/** มี consent เวอร์ชันปัจจุบันแล้วหรือยัง */
export async function hasCurrentConsent(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: consents.id })
    .from(consents)
    .where(
      and(
        eq(consents.userId, userId),
        eq(consents.policyVersion, CURRENT_POLICY_VERSION),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * ใช้ในหน้า/เลย์เอาต์ที่ต้องล็อกอิน — ตรวจครบวงจร (DESIGN.md ข้อ 8):
 * ไม่ล็อกอิน → /signin · ถูกระงับ → /suspended · ยังไม่ยอมรับ PDPA → /consent
 */
export async function requireUser(callbackUrl = "/dashboard") {
  const session = await auth();

  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (session.user.status === "suspended") {
    redirect("/suspended");
  }

  if (!(await hasCurrentConsent(session.user.id))) {
    redirect(`/consent?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return session.user;
}
