import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutForm } from "@/components/settings/payout-form";

export const metadata = { title: "ตั้งค่า · Quibby" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const [me] = await db
    .select({ creatorPayout: users.creatorPayout })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${kanit.className} text-2xl font-semibold`}>
            ช่องทางรับโดเนท
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ตั้งช่องทางให้คนเล่นโดเนทให้คุณโดยตรง — จะแสดงในหน้าผลลัพธ์ quiz ของคุณ
          </p>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
          ← แดชบอร์ด
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ช่องทางรับโดเนทส่วนตัว (Tip Jar)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            อัปโหลดรูป QR พร้อมเพย์/ธนาคาร เพื่อให้คนที่ชอบ quiz ของคุณโดเนทได้
            (ไม่อัปโหลดก็ได้ — เว้นว่าง = ไม่แสดง)
          </p>
          <PayoutForm initial={me?.creatorPayout ?? {}} />
        </CardContent>
      </Card>
    </main>
  );
}
