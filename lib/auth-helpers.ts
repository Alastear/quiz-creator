import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { consents } from "@/lib/db/schema";
import { CURRENT_POLICY_VERSION } from "@/lib/consent";

/** ดึง user ปัจจุบันสำหรับ server action — โยน error ถ้าไม่ล็อกอิน/ถูกระงับ */
export async function getActor() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");
  if (session.user.status === "suspended") throw new Error("suspended");
  return session.user;
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
