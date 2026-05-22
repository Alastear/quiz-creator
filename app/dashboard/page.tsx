import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth-helpers";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";

export const metadata = { title: "แดชบอร์ด · Quibby" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className={`${kanit.className} text-2xl font-semibold`}>
          แดชบอร์ด
        </h1>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            ออกจากระบบ
          </Button>
        </form>
      </div>

      <p className="mt-2 text-muted-foreground">
        สวัสดี {user.name ?? user.email} 👋
      </p>

      <div className="mt-8 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        ยังไม่มี quiz — ระบบสร้าง quiz จะมาใน Phase 2
        <div className="mt-4">
          <Button disabled>+ สร้าง quiz (เร็ว ๆ นี้)</Button>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Stat label="แพ็กเกจ" value={user.plan} />
        <Stat label="เครดิต" value={String(0)} />
        <Stat label="สิทธิ์" value={user.role} />
        <Stat label="สถานะ" value={user.status} />
      </dl>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
