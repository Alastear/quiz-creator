"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// อัปโหลดรูปอย่างเดียว (DESIGN.md ข้อ 12) — ตัด URL ภายนอกออกเพื่อกันปัญหา save-image (CORS)
// รูปทุกอันอยู่บนโดเมนเรา → แคปเป็นรูปผลลัพธ์ได้เสมอ
export function MediaInput({
  value,
  onChange,
  accept = "image/*",
  // placeholder ไม่ใช้แล้ว (เก็บไว้กันพังที่ call site เดิม)
  placeholder: _placeholder,
}: {
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setErr(json.error ?? "อัปโหลดไม่สำเร็จ");
      else onChange(json.url);
    } catch {
      setErr("อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      {value ? (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt=""
            className="h-16 w-auto rounded border object-cover"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => ref.current?.click()}
          >
            {busy ? "กำลังอัปโหลด…" : "เปลี่ยนรูป"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
          >
            ลบ
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => ref.current?.click()}
        >
          {busy ? "กำลังอัปโหลด…" : "+ อัปโหลดรูป"}
        </Button>
      )}
      <input ref={ref} type="file" accept={accept} hidden onChange={onFile} />
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
