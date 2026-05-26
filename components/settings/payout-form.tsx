"use client";

import { useState, useTransition } from "react";
import { saveCreatorPayout, type CreatorPayout } from "@/lib/actions/settings";
import { MediaInput } from "@/components/builder/media-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// รับโดเนทด้วย QR code อย่างเดียว (อัปโหลดรูป) — ไม่รับข้อมูลตัวอักษร
export function PayoutForm({ initial }: { initial: Partial<CreatorPayout> }) {
  const [v, setV] = useState<CreatorPayout>({ enabled: false, ...initial });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
          onChange={(e) => setV((p) => ({ ...p, enabled: e.target.checked }))}
        />
        เปิดให้แสดง QR รับโดเนทบนหน้าผลลัพธ์ quiz ของฉัน
      </label>

      <div className="flex flex-col gap-1.5">
        <Label>QR code รับเงิน (พร้อมเพย์/ธนาคาร)</Label>
        <MediaInput
          value={v.qrUrl ?? ""}
          onChange={(url) => setV((p) => ({ ...p, qrUrl: url }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          บันทึก
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>

      <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        ⚠️ อัปโหลดได้เฉพาะรูป QR เท่านั้น (ไม่รับเลขบัญชี/ลิงก์ เพื่อความปลอดภัย) ·
        QR นี้เป็นของคุณเอง Quibby เป็นเพียงที่แสดงผล ไม่เกี่ยวข้องกับการโอนเงิน
      </p>
    </div>
  );
}
