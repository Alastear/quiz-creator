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
        <h1 className={`${kanit.className} text-2xl font-semibold`}>ตั้งค่า</h1>
        <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
          ← แดชบอร์ด
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ช่องทางรับโดเนทส่วนตัว (Tip Jar)</CardTitle>
        </CardHeader>
        <CardContent>
          <PayoutForm initial={me?.creatorPayout ?? {}} />
        </CardContent>
      </Card>
    </main>
  );
}
