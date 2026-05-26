import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { quizzes, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { createQuiz, republishQuizAction, restoreQuiz } from "@/lib/actions/quiz";
import { extendQuizWithCredit } from "@/lib/actions/billing";
import { FREE_ACTIVE_QUIZ_LIMIT } from "@/lib/entitlements";
import { CreateQuizButton } from "@/components/dashboard/create-quiz-button";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";

export const metadata = { title: "แดชบอร์ด · Quibby" };

const STATUS_LABEL: Record<string, string> = {
  draft: "ฉบับร่าง",
  published: "เผยแพร่แล้ว",
  expired: "หมดอายุ",
  archived: "เก็บถาวร",
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const myQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, user.id))
    .orderBy(desc(quizzes.createdAt));

  const activeCount = myQuizzes.filter((q) => q.status === "published").length;

  const [me] = await db
    .select({ credits: users.quizCredits })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <Link
        href="/"
        className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← หน้าแรก
      </Link>
      <div className="flex items-center justify-between">
        <h1 className={`${kanit.className} text-2xl font-semibold`}>แดชบอร์ด</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/dashboard/settings" />}>
            ตั้งค่า
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/dashboard/billing" />}>
            เครดิต {me?.credits ?? 0}
          </Button>
          {user.role === "admin" && (
            <Button variant="secondary" size="sm" render={<Link href="/admin" />}>
              Admin
            </Button>
          )}
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        สวัสดี {user.name ?? user.email} · เผยแพร่อยู่ {activeCount}/
        {FREE_ACTIVE_QUIZ_LIMIT} (แพ็กฟรี)
      </p>

      <div className="mt-6">
        <form action={createQuiz}>
          <CreateQuizButton />
        </form>
      </div>

      <ul className="mt-6 space-y-2">
        {myQuizzes.length === 0 && (
          <li className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            ยังไม่มี quiz — กด “สร้าง quiz ใหม่” เพื่อเริ่ม
          </li>
        )}
        {myQuizzes.map((q) => (
          <li
            key={q.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{q.title}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABEL[q.status] ?? q.status}
                {q.status === "published" && q.expiresAt
                  ? ` · หมดอายุ ${q.expiresAt.toLocaleDateString("th-TH")}`
                  : ""}
                {" · "}เล่น {q.playCount} ครั้ง
              </p>
            </div>
            {q.status === "published" && (
              <form action={extendQuizWithCredit.bind(null, q.id)}>
                <Button size="sm" variant="ghost" type="submit">
                  ต่ออายุ +30 (1 เครดิต)
                </Button>
              </form>
            )}
            {q.status === "published" && (
              <Button
                size="sm"
                variant="ghost"
                render={<Link href={`/quiz/${q.publicId}`} target="_blank" />}
              >
                เปิดดู
              </Button>
            )}
            {q.status === "expired" && (
              <form action={republishQuizAction.bind(null, q.id)}>
                <Button size="sm" type="submit">
                  เผยแพร่อีกครั้ง
                </Button>
              </form>
            )}
            {q.status === "archived" ? (
              <form action={restoreQuiz.bind(null, q.id)}>
                <Button size="sm" type="submit">
                  กู้คืน
                </Button>
              </form>
            ) : (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/create/${q.id}`} />}
              >
                แก้ไข
              </Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
