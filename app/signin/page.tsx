import Link from "next/link";
import { env } from "@/lib/env";
import { kanit } from "@/lib/fonts";
import { LoginForm, GoogleButton } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export const metadata = { title: "เข้าสู่ระบบ · Quibby" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; verified?: string; error?: string }>;
}) {
  const { callbackUrl = "/dashboard", verified, error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className={`${kanit.className} text-2xl`}>
            เข้าสู่ระบบ Quibby
          </CardTitle>
          <CardDescription>ยินดีต้อนรับกลับมา</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {verified && (
            <p className="rounded-md border border-green-500/40 bg-green-500/10 p-2 text-center text-sm">
              ยืนยันอีเมลแล้ว เข้าสู่ระบบได้เลย ✓
            </p>
          )}
          {error === "verify" && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-center text-sm text-destructive">
              ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ
            </p>
          )}

          <LoginForm callbackUrl={callbackUrl} />

          {googleEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                หรือ
                <span className="h-px flex-1 bg-border" />
              </div>
              <GoogleButton callbackUrl={callbackUrl} />
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <Link
              href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="text-primary underline"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
