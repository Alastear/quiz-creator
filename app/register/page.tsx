import Link from "next/link";
import { env } from "@/lib/env";
import { kanit } from "@/lib/fonts";
import { RegisterForm, GoogleButton } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export const metadata = { title: "สมัครสมาชิก · Quibby" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl = "/dashboard" } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className={`${kanit.className} text-2xl`}>
            สมัครสมาชิก Quibby
          </CardTitle>
          <CardDescription>สร้างบัญชีเพื่อเริ่มสร้าง quiz</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <RegisterForm />

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
            มีบัญชีแล้ว?{" "}
            <Link
              href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="text-primary underline"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
