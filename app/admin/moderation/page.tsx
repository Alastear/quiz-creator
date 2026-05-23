import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, quizzes } from "@/lib/db/schema";
import { resolveReport } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export default async function AdminModeration() {
  const open = await db
    .select()
    .from(reports)
    .where(inArray(reports.status, ["open", "reviewing"]))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  const quizIds = [...new Set(open.map((r) => r.quizId))];
  const qs = quizIds.length
    ? await db
        .select({ id: quizzes.id, title: quizzes.title, publicId: quizzes.publicId, status: quizzes.status })
        .from(quizzes)
        .where(inArray(quizzes.id, quizIds))
    : [];
  const quizById = new Map(qs.map((q) => [q.id, q]));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">รายงาน ({open.length})</h1>

      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          ไม่มีรายงานที่ค้างอยู่ 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {open.map((r) => {
            const q = quizById.get(r.quizId);
            return (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {q?.title ?? "(quiz ถูกลบ)"}{" "}
                      {q && (
                        <Link
                          href={`/quiz/${q.publicId}`}
                          target="_blank"
                          className="text-xs text-primary underline"
                        >
                          เปิดดู
                        </Link>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      เหตุผล: {r.reason}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.createdAt.toLocaleString("th-TH")}
                      {q && ` · สถานะ quiz: ${q.status}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <form action={resolveReport.bind(null, r.id, "suspend")}>
                      <Button size="xs" variant="destructive" type="submit">
                        ระงับ quiz
                      </Button>
                    </form>
                    <form action={resolveReport.bind(null, r.id, "resolve")}>
                      <Button size="xs" variant="outline" type="submit">
                        จัดการแล้ว
                      </Button>
                    </form>
                    <form action={resolveReport.bind(null, r.id, "dismiss")}>
                      <Button size="xs" variant="ghost" type="submit">
                        ปิด
                      </Button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
