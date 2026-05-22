import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";
import { CATEGORY_LABEL } from "@/lib/categories";

export default async function AdminAnalytics() {
  const top = await db
    .select({
      title: quizzes.title,
      playCount: quizzes.playCount,
      viewCount: quizzes.viewCount,
    })
    .from(quizzes)
    .orderBy(desc(quizzes.playCount))
    .limit(10);

  const [totals] = await db
    .select({
      views: sql<number>`coalesce(sum(${quizzes.viewCount}),0)::int`,
      plays: sql<number>`coalesce(sum(${quizzes.playCount}),0)::int`,
    })
    .from(quizzes);

  const cats = await db
    .select({ category: quizzes.category, n: sql<number>`count(*)::int` })
    .from(quizzes)
    .groupBy(quizzes.category)
    .orderBy(desc(sql`count(*)`));

  const conv =
    totals && totals.views > 0
      ? Math.round((totals.plays / totals.views) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">สถิติ</h1>

      <section className="grid grid-cols-3 gap-4">
        <Stat label="เปิดดูรวม" value={totals?.views ?? 0} />
        <Stat label="เล่นรวม" value={totals?.plays ?? 0} />
        <Stat label="conversion (เล่น/เปิด)" value={`${conv}%`} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          quiz ยอดนิยม (ตามจำนวนเล่น)
        </h2>
        <ul className="divide-y rounded-lg border">
          {top.map((t, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-5 text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-xs text-muted-foreground">
                เล่น {t.playCount} · ดู {t.viewCount}
              </span>
            </li>
          ))}
          {top.length === 0 && (
            <li className="px-4 py-6 text-center text-muted-foreground">
              ยังไม่มีข้อมูล
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          สัดส่วนตามหมวดหมู่
        </h2>
        <ul className="divide-y rounded-lg border">
          {cats.map((c) => (
            <li key={c.category} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="flex-1">{CATEGORY_LABEL[c.category]}</span>
              <span className="text-xs text-muted-foreground">{c.n}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold">
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
