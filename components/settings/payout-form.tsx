"use client";

import { useState, useTransition } from "react";
import { saveCreatorPayout, type CreatorPayout } from "@/lib/actions/settings";
import { MediaInput } from "@/components/builder/media-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PayoutForm({ initial }: { initial: Partial<CreatorPayout> }) {
  const [v, setV] = useState<CreatorPayout>({ enabled: false, ...initial });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof CreatorPayout>(k: K, val: CreatorPayout[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function save() {
    start(async () => {
      const r = await saveCreatorPayout(v);
      setMsg(r.ok ? "บันทึกแล้ว ✓" : (r.error ?? "บันทึกไม่สำเร็จ"));
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.enabled ?? false}
          onChange={(e) => set("enabled", e.target.checked)}
        />
        เปิดให้แสดงช่องทางรับโดเนทบนหน้าผลลัพธ์ quiz ของฉัน
      </label>

      <div className="flex flex-col gap-1.5">
        <Label>QR code (PromptPay/ธนาคาร)</Label>
        <MediaInput
          value={v.qrUrl ?? ""}
          placeholder="อัปโหลดรูป QR หรือวาง URL"
          onChange={(url) => set("qrUrl", url)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ธนาคาร">
          <Input value={v.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
        </Field>
        <Field label="เลขบัญชี">
          <Input value={v.bankAccount ?? ""} onChange={(e) => set("bankAccount", e.target.value)} />
        </Field>
      </div>
      <Field label="ชื่อบัญชี">
        <Input value={v.accountName ?? ""} onChange={(e) => set("accountName", e.target.value)} />
      </Field>
      <Field label="ลิงก์โดเนทอื่น (Ko-fi / PayPal.me ฯลฯ)">
        <Input value={v.externalUrl ?? ""} placeholder="https://..." onChange={(e) => set("externalUrl", e.target.value)} />
      </Field>
      <Field label="ข้อความเชิญชวน">
        <Input value={v.message ?? ""} placeholder="ถ้าชอบ quiz นี้ เลี้ยงกาแฟผมได้นะ ☕" onChange={(e) => set("message", e.target.value)} />
      </Field>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          บันทึก
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>

      <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        ⚠️ ช่องทางนี้เป็นของคุณเอง Quibby เป็นเพียงที่แสดงผล ไม่เกี่ยวข้องกับการโอนเงิน
        และไม่รับผิดชอบใด ๆ ข้อมูลที่ใส่จะแสดงต่อผู้เล่นแบบสาธารณะ
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
