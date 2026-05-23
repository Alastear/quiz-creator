"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerUser } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl })}
    >
      เข้าสู่ระบบด้วย Google
    </Button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error)
        setErr("อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ยืนยันอีเมล");
      else router.push(callbackUrl);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        เข้าสู่ระบบ
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await registerUser({ name, email, password });
      if (!res.ok) setErr(res.error ?? "สมัครไม่สำเร็จ");
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-md border border-green-500/40 bg-green-500/10 p-4 text-sm">
        ส่งอีเมลยืนยันแล้ว 📧 เปิดอีเมลแล้วคลิกลิงก์ยืนยัน จากนั้นเข้าสู่ระบบได้เลย
        <br />
        <span className="text-muted-foreground">
          (ตอน dev: ลิงก์ยืนยันจะพิมพ์ใน terminal ของ dev server)
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="r-name">ชื่อ (ไม่บังคับ)</Label>
        <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="r-email">อีเมล</Label>
        <Input
          id="r-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="r-password">รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
        <Input
          id="r-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        สมัครสมาชิก
      </Button>
    </form>
  );
}
