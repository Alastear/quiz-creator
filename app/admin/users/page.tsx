import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, quizzes } from "@/lib/db/schema";
import {
  setUserStatus,
  setUserRole,
  adjustCredits,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const rows = await db
    .select()
    .from(users)
    .where(
      q.trim()
        ? or(ilike(users.email, `%${q.trim()}%`), ilike(users.name, `%${q.trim()}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(100);

  // จำนวน quiz ต่อ user
  const counts = await db
    .select({ ownerId: quizzes.ownerId, n: sql<number>`count(*)::int` })
    .from(quizzes)
    .groupBy(quizzes.ownerId);
  const quizCount = new Map(counts.map((c) => [c.ownerId, c.n]));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">ผู้ใช้</h1>

      <form action="/admin/users" className="flex max-w-sm gap-2">
        <Input name="q" defaultValue={q} placeholder="ค้นหาอีเมล/ชื่อ…" />
        <Button type="submit">ค้นหา</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">อีเมล</th>
              <th className="p-2">สิทธิ์</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">แพ็ก</th>
              <th className="p-2">เครดิต</th>
              <th className="p-2">quiz</th>
              <th className="p-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{u.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  <span
                    className={
                      u.status === "suspended" ? "text-destructive" : ""
                    }
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-2">{u.plan}</td>
                <td className="p-2">{u.quizCredits}</td>
                <td className="p-2">{quizCount.get(u.id) ?? 0}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {u.status === "active" ? (
                      <FormBtn action={setUserStatus.bind(null, u.id, "suspended")} label="ระงับ" variant="destructive" />
                    ) : (
                      <FormBtn action={setUserStatus.bind(null, u.id, "active")} label="ปลดระงับ" />
                    )}
                    {u.role === "admin" ? (
                      <FormBtn action={setUserRole.bind(null, u.id, "user")} label="ถอน admin" variant="outline" />
                    ) : (
                      <FormBtn action={setUserRole.bind(null, u.id, "admin")} label="ตั้ง admin" variant="outline" />
                    )}
                    <FormBtn action={adjustCredits.bind(null, u.id, 1)} label="+1 เครดิต" variant="ghost" />
                    <FormBtn action={adjustCredits.bind(null, u.id, -1)} label="−1" variant="ghost" />
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

function FormBtn({
  action,
  label,
  variant = "secondary",
}: {
  action: () => Promise<void>;
  label: string;
  variant?: "secondary" | "outline" | "ghost" | "destructive";
}) {
  return (
    <form action={action}>
      <Button type="submit" size="xs" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
