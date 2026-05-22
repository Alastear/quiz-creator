import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { consents } from "@/lib/db/schema";
import { CURRENT_POLICY_VERSION, PDPA_SUMMARY } from "@/lib/consent";
import { hasCurrentConsent } from "@/lib/auth-helpers";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Section({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export const metadata = { title: "ความยินยอม PDPA · Quibby" };

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { callbackUrl = "/dashboard" } = await searchParams;

  // ยอมรับแล้วก็ข้ามไปเลย
  if (await hasCurrentConsent(session.user.id)) redirect(callbackUrl);

  async function accept() {
    "use server";
    const s = await auth();
    if (!s?.user) redirect("/signin");

    const h = await headers();
    await db.insert(consents).values({
      userId: s.user.id,
      policyVersion: CURRENT_POLICY_VERSION,
      ip:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null,
      userAgent: h.get("user-agent") ?? null,
    });

    redirect(callbackUrl);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className={`${kanit.className} text-xl`}>
            ความยินยอมการใช้ข้อมูล (PDPA)
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ก่อนเริ่มใช้งาน Quibby โปรดอ่านและยอมรับข้อมูลด้านล่าง
          </p>
          <Section title="ข้อมูลที่เราเก็บ" items={PDPA_SUMMARY.collect} />
          <Section title="นำไปใช้ทำอะไร" items={PDPA_SUMMARY.purpose} />
          <Section title="เก็บนานแค่ไหน" items={PDPA_SUMMARY.retention} />
          <Section title="สิทธิ์ของคุณ" items={PDPA_SUMMARY.rights} />
          <p className="text-xs text-muted-foreground">
            เวอร์ชันนโยบาย: {CURRENT_POLICY_VERSION}
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <form action={accept} className="w-full">
            <Button type="submit" className="w-full">
              ยอมรับและเริ่มใช้งาน
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            ถ้าไม่ยอมรับ จะยังใช้งานส่วนที่ต้องล็อกอินไม่ได้
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
