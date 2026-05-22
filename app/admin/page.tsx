import { desc, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, quizzes } from "@/lib/db/schema";

async function count(table: typeof users | typeof quizzes, where?: ReturnType<typeof gte>) {
  const q = db.select({ n: sql<number>`count(*)::int` }).from(table);
  const [row] = where ? await q.where(where) : await q;
  return row?.n ?? 0;
}

export default async function AdminOverview() {
  const weekAgo = new Date(Date.now() - 7 * 86400_000);

  const [totalUsers, newUsers] = await Promise.all([
    count(users),
    count(users, gte(users.createdAt, weekAgo)),
  ]);

  const statusRows = await db
    .select({ status: quizzes.status, n: sql<number>`count(*)::int` })
    .from(quizzes)
    .groupBy(quizzes.status);
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  const [plays] = await db
    .select({ total: sql<number>`coalesce(sum(${quizzes.playCount}),0)::int` })
    .from(quizzes);

  const recent = await db
    .select({ email: users.email, name: users.name, createdAt: users.createdAt, plan: users.plan })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(8);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">ภาพรวมระบบ</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="ผู้ใช้ทั้งหมด" value={totalUsers} />
        <Stat label="ผู้ใช้ใหม่ (7 วัน)" value={newUsers} />
        <Stat label="quiz เผยแพร่อยู่" value={byStatus.published ?? 0} />
        <Stat label="การเล่นรวม" value={plays?.total ?? 0} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          quiz ตามสถานะ
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="ฉบับร่าง" value={byStatus.draft ?? 0} />
          <Stat label="เผยแพร่" value={byStatus.published ?? 0} />
          <Stat label="หมดอายุ" value={byStatus.expired ?? 0} />
          <Stat label="เก็บถาวร" value={byStatus.archived ?? 0} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          ผู้ใช้ล่าสุด
        </h2>
        <ul className="divide-y rounded-lg border">
          {recent.map((u) => (
            <li key={u.email} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="flex-1 truncate">{u.name ?? u.email}</span>
              <span className="text-xs text-muted-foreground">{u.plan}</span>
              <span className="text-xs text-muted-foreground">
                {u.createdAt.toLocaleDateString("th-TH")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold">{value.toLocaleString("th-TH")}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
