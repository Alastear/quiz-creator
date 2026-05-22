import { signIn } from "@/auth";
import { env } from "@/lib/env";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl = "/dashboard" } = await searchParams;

  async function emailSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("nodemailer", { email, redirectTo: callbackUrl });
  }

  async function googleSignIn() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className={`${kanit.className} text-2xl`}>
            เข้าสู่ระบบ Quibby
          </CardTitle>
          <CardDescription>
            สมัครหรือเข้าสู่ระบบเพื่อเริ่มสร้าง quiz ของคุณ
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <form action={emailSignIn} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              ส่งลิงก์เข้าสู่ระบบทางอีเมล
            </Button>
          </form>

          {googleEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                หรือ
                <span className="h-px flex-1 bg-border" />
              </div>
              <form action={googleSignIn}>
                <Button type="submit" variant="outline" className="w-full">
                  เข้าสู่ระบบด้วย Google
                </Button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            การเข้าสู่ระบบถือว่ายอมรับเงื่อนไขการใช้งาน
            <br />
            เราจะขอความยินยอม PDPA ก่อนเริ่มใช้งาน
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export const metadata = { title: "เข้าสู่ระบบ · Quibby" };
