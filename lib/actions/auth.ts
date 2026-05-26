"use server";

import { headers } from "next/headers";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { emailer } from "@/lib/email";
import { ratelimit } from "@/lib/ratelimit";
import { env } from "@/lib/env";

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(200),
});

export type RegisterInput = z.infer<typeof schema>;

/** สมัครด้วย email+password → ส่งอีเมลยืนยัน (verify ครั้งแรก) */
export async function registerUser(
  input: RegisterInput,
): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const rl = await ratelimit.limit(`register:${ip}`, {
    limit: 5,
    windowMs: 600_000,
  });
  if (!rl.success) return { ok: false, error: "สมัครถี่เกินไป ลองใหม่ภายหลัง" };

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const email = parsed.data.email.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing)
    return { ok: false, error: "อีเมลนี้ถูกใช้แล้ว ลองเข้าสู่ระบบ" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [created] = await db
    .insert(users)
    .values({ email, name: parsed.data.name || null, passwordHash })
    .returning({ id: users.id });

  // สร้าง token ยืนยันอีเมล (เก็บใน verification_tokens)
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(verificationTokens).values({
    identifier: email,
    token,
    expires: new Date(Date.now() + 24 * 3600 * 1000),
  });

  const url = `${env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
  try {
    await emailer.send({
      to: email,
      subject: "ยืนยันอีเมลสำหรับ Quibby",
      body: [
        "สวัสดี! 👋",
        "",
        "ยืนยันอีเมลเพื่อเริ่มใช้งาน Quibby (คลิกครั้งเดียว ลิงก์ใช้ได้ 24 ชม.):",
        url,
        "",
        "ถ้าคุณไม่ได้สมัคร ละเว้นอีเมลนี้ได้เลย",
      ].join("\n"),
    });
  } catch (e) {
    // ส่งอีเมลไม่สำเร็จ → ลบ user + token ที่เพิ่งสร้าง กันค้างแบบ verify ไม่ได้
    await db.delete(users).where(eq(users.id, created.id));
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));
    console.error("registerUser: email send failed", e);
    return {
      ok: false,
      error:
        "ส่งอีเมลยืนยันไม่สำเร็จ — ระบบอีเมลอาจยังไม่ได้ตั้งค่า ลองสมัครด้วย Google ไปก่อน",
    };
  }

  return { ok: true };
}
