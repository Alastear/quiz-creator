import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { env } from "@/lib/env";

// ยืนยันอีเมลครั้งแรก → set emailVerified แล้วเด้งไปหน้า signin
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase();
  const token = url.searchParams.get("token");
  const signin = `${env.NEXT_PUBLIC_APP_URL}/signin`;

  if (!email || !token) {
    return NextResponse.redirect(`${signin}?error=verify`);
  }

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, token),
      ),
    )
    .limit(1);

  if (!row || row.expires < new Date()) {
    return NextResponse.redirect(`${signin}?error=verify`);
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.email, email));
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, token),
      ),
    );

  return NextResponse.redirect(`${signin}?verified=1`);
}
