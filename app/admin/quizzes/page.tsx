import Link from "next/link";
import { desc, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes, users } from "@/lib/db/schema";
import { adminUnpublishQuiz, adminDeleteQuiz } from "@/lib/actions/admin";
import { CATEGORY_LABEL } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  published: "เผยแพร่",
  expired: "หมดอายุ",
  archived: "เก็บถาวร",
};

export default async function AdminQuizzes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const rows = await db
    .select({
      id: quizzes.id,
      publicId: quizzes.publicId,
      title: quizzes.title,
      status: quizzes.status,
      category: quizzes.category,
      playCount: quizzes.playCount,
      viewCount: quizzes.viewCount,
      ownerEmail: users.email,
    })
    .from(quizzes)
    .innerJoin(users, eq(quizzes.ownerId, users.id))
    .where(q.trim() ? ilike(quizzes.title, `%${q.trim()}%`) : undefined)
    .orderBy(desc(quizzes.createdAt))
    .limit(100);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Quiz ทั้งหมด</h1>

      <form action="/admin/quizzes" className="flex max-w-sm gap-2">
        <Input name="q" defaultValue={q} placeholder="ค้นหาชื่อ quiz…" />
        <Button type="submit">ค้นหา</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">ชื่อ</th>
              <th className="p-2">เจ้าของ</th>
              <th className="p-2">หมวด</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">เล่น/ดู</th>
              <th className="p-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">{r.title}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.ownerEmail}</td>
                <td className="p-2 text-xs">{CATEGORY_LABEL[r.category]}</td>
                <td className="p-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                <td className="p-2 text-xs">
                  {r.playCount}/{r.viewCount}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {r.status === "published" && (
                      <Button size="xs" variant="ghost" render={<Link href={`/quiz/${r.publicId}`} target="_blank" />}>
                        เปิดดู
                      </Button>
                    )}
                    {r.status === "published" && (
                      <form action={adminUnpublishQuiz.bind(null, r.id)}>
                        <Button size="xs" variant="outline" type="submit">
                          ปลดเผยแพร่
                        </Button>
                      </form>
                    )}
                    <form action={adminDeleteQuiz.bind(null, r.id)}>
                      <Button size="xs" variant="destructive" type="submit">
                        ลบ
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
