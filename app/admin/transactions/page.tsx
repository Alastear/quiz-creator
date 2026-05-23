import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";

const KIND_LABEL: Record<string, string> = {
  credit_pack: "ซื้อเครดิต",
  donation: "โดเนท",
  pro: "Pro",
};

export default async function AdminTransactions() {
  const rows = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      credits: transactions.creditsGranted,
      provider: transactions.provider,
      status: transactions.status,
      createdAt: transactions.createdAt,
      email: users.email,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .orderBy(desc(transactions.createdAt))
    .limit(100);

  const sums = await db
    .select({
      kind: transactions.kind,
      total: sql<number>`coalesce(sum(${transactions.amount}),0)::int`,
    })
    .from(transactions)
    .where(eq(transactions.status, "paid"))
    .groupBy(transactions.kind);
  const revenue: Record<string, number> = {};
  let totalRevenue = 0;
  for (const s of sums) {
    revenue[s.kind] = s.total;
    totalRevenue += s.total;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">การเงิน</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="รายได้รวม" value={totalRevenue} />
        <Stat label="ขายเครดิต" value={revenue.credit_pack ?? 0} />
        <Stat label="โดเนท" value={revenue.donation ?? 0} />
        <Stat label="Pro" value={revenue.pro ?? 0} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">ผู้ใช้</th>
              <th className="p-2">ประเภท</th>
              <th className="p-2">ยอด (฿)</th>
              <th className="p-2">เครดิต</th>
              <th className="p-2">ช่องทาง</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">วันที่</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2 text-xs text-muted-foreground">{t.email}</td>
                <td className="p-2">{KIND_LABEL[t.kind] ?? t.kind}</td>
                <td className="p-2">{t.amount}</td>
                <td className="p-2">{t.credits || "—"}</td>
                <td className="p-2 text-xs">{t.provider}</td>
                <td className="p-2">{t.status}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {t.createdAt.toLocaleDateString("th-TH")}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={7}>
                  ยังไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold">{value.toLocaleString("th-TH")} ฿</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
