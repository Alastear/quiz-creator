import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { emailer } from "@/lib/email";

// ขยาย type ของ session ให้มี id/role/status/plan (DESIGN.md ข้อ 8/11)
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "support" | "admin";
      status: "active" | "suspended";
      plan: "free" | "pro";
    } & DefaultSession["user"];
  }
}

const providers: Provider[] = [];

// Google เปิดเฉพาะเมื่อมี credentials (local ที่ไม่ตั้งไว้ → ใช้ magic link แทนได้)
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

// Magic link — ส่งผ่าน emailer adapter (dev: console / prod: Resend)
providers.push(
  Nodemailer({
    from: env.EMAIL_FROM,
    maxAge: 60 * 30, // 30 นาที
    // server ไม่ถูกใช้จริงเพราะ override sendVerificationRequest ด้านล่าง
    server: { host: "localhost", port: 587, auth: { user: "", pass: "" } },
    async sendVerificationRequest({ identifier, url }) {
      await emailer.send({
        to: identifier,
        subject: "ลิงก์เข้าสู่ระบบ Quibby",
        body: [
          "สวัสดี! 👋",
          "",
          "คลิกลิงก์ด้านล่างเพื่อเข้าสู่ระบบ Quibby (ใช้ได้ภายใน 30 นาที):",
          url,
          "",
          "ถ้าคุณไม่ได้เป็นคนขอเข้าสู่ระบบ ละเว้นอีเมลนี้ได้เลย",
        ].join("\n"),
      });
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  callbacks: {
    // database strategy → user คือ row จาก DB ใส่ฟิลด์ Quibby เข้า session
    session({ session, user }) {
      session.user.id = user.id;
      // @ts-expect-error ฟิลด์เสริมจาก users table
      session.user.role = user.role;
      // @ts-expect-error
      session.user.status = user.status;
      // @ts-expect-error
      session.user.plan = user.plan;
      return session;
    },
  },
});
