import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export const metadata = { title: "บัญชีถูกระงับ · Quibby" };

export default function SuspendedPage() {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">บัญชีถูกระงับ</h1>
      <p className="max-w-md text-muted-foreground">
        บัญชีของคุณถูกระงับการใช้งานชั่วคราว หากคิดว่าเป็นความผิดพลาด
        โปรดติดต่อผู้ดูแลระบบ
      </p>
      <form action={logout}>
        <Button variant="outline">ออกจากระบบ</Button>
      </form>
    </main>
  );
}
