import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { kanit } from "@/lib/fonts";

export const metadata = { title: "Admin · Quibby" };

const NAV = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/quizzes", label: "Quiz" },
  { href: "/admin/transactions", label: "การเงิน" },
  { href: "/admin/analytics", label: "สถิติ" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // กั้นทุกหน้าใน /admin

  return (
    <div className="flex min-h-full flex-1">
      <aside className="w-48 shrink-0 border-r p-4">
        <Link href="/admin" className={`${kanit.className} text-lg font-bold`}>
          Quibby Admin
        </Link>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/"
            className="mt-4 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            ← กลับหน้าเว็บ
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
