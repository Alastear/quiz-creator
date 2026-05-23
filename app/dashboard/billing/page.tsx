import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, transactions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { buyCreditPack, donate } from "@/lib/actions/billing";
import { CREDIT_PACKS, DONATION_PRESETS } from "@/lib/pricing";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KIND_LABEL: Record<string, string> = {
  credit_pack: "ซื้อเครดิต",
  donation: "โดเนท",
  pro: "Pro",
};

export const metadata = { title: "เครดิต · Quibby" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; error?: string }>;
}) {
  const user = await requireUser("/dashboard/billing");
  const { paid, error } = await searchParams;

  const [me] = await db
    .select({ credits: users.quizCredits })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const txns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(desc(transactions.createdAt))
    .limit(20);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className={`${kanit.className} text-2xl font-semibold`}>เครดิต & การจ่ายเงิน</h1>
        <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
          ← แดชบอร์ด
        </Button>
      </div>

      {paid && (
        <p className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm">
          {paid === "donation" ? "ขอบคุณสำหรับการสนับสนุน 💚" : "เติมเครดิตสำเร็จ ✓"}
        </p>
      )}
      {error === "amount" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          จำนวนเงินไม่ถูกต้อง
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">เครดิตคงเหลือ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{me?.credits ?? 0}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            1 เครดิต = เผยแพร่ quiz เกินโควตาฟรี 1 อัน หรือ ต่ออายุ +30 วัน
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ซื้อเครดิต</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <form key={p.id} action={buyCreditPack.bind(null, p.id)}>
              <button
                type="submit"
                className="flex w-full flex-col items-center rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <span className="text-2xl font-bold">{p.credits}</span>
                <span className="text-xs text-muted-foreground">เครดิต</span>
                <span className="mt-2 font-medium">{p.price} ฿</span>
              </button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">สนับสนุน Quibby (โดเนท)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={donate} className="flex flex-wrap items-center gap-2">
            {DONATION_PRESETS.map((a) => (
              <Button
                key={a}
                type="submit"
                name="amount"
                value={a}
                variant="outline"
              >
                {a} ฿
              </Button>
            ))}
            <span className="text-sm text-muted-foreground">หรือ</span>
            <Input
              name="amount"
              type="number"
              min={20}
              placeholder="ระบุจำนวน"
              className="w-32"
            />
            <Button type="submit">โดเนท</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติ</CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          ) : (
            <ul className="divide-y text-sm">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    {KIND_LABEL[t.kind] ?? t.kind}
                    {t.creditsGranted > 0 && ` (+${t.creditsGranted} เครดิต)`}
                  </span>
                  <span>{t.amount} ฿</span>
                  <span className="text-xs text-muted-foreground">
                    {t.createdAt.toLocaleDateString("th-TH")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
