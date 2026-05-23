import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { env } from "@/lib/env";

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

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

// Email + password (Credentials บังคับใช้ JWT session)
providers.push(
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(creds) {
      const email = String(creds?.email ?? "").toLowerCase().trim();
      const password = String(creds?.password ?? "");
      if (!email || !password) return null;

      const [u] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      // ไม่มี user / เป็น Google-only / ยังไม่ verify / ถูกระงับ → ปฏิเสธ
      if (!u || !u.passwordHash) return null;
      if (!u.emailVerified) return null;
      if (u.status === "suspended") return null;

      const ok = await bcrypt.compare(password, u.passwordHash);
      if (!ok) return null;
      return { id: u.id, email: u.email, name: u.name, image: u.image };
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
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    // ดึง role/status/plan สดจาก DB ทุก request → suspend/เปลี่ยน role มีผลทันที
    async session({ session, token }) {
      if (token.sub) {
        const [u] = await db
          .select()
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);
        if (u) {
          session.user.id = u.id;
          session.user.email = u.email;
          session.user.name = u.name;
          session.user.role = u.role;
          session.user.status = u.status;
          session.user.plan = u.plan;
        }
      }
      return session;
    },
  },
});
