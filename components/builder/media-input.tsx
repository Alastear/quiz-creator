"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ใส่รูปได้ 2 ทาง: อัปโหลด (ฟรีทุก tier) หรือวาง URL (DESIGN.md ข้อ 12)
export function MediaInput({
  value,
  onChange,
  placeholder = "รูป (URL) หรือกดอัปโหลด",
  accept = "image/*",
}: {
  value?: string;
  onChange: (url: string) => void;
  placeholder?: string;
  accept?: string;
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
      if (!res.ok) {
        setErr(json.error ?? "อัปโหลดไม่สำเร็จ");
      } else {
        onChange(json.url);
      }
    } catch {
      setErr("อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => ref.current?.click()}
        >
          {busy ? "กำลังอัปโหลด…" : "อัปโหลด"}
        </Button>
        <input
          ref={ref}
          type="file"
          accept={accept}
          hidden
          onChange={onFile}
        />
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {value && (
        <img
          src={value}
          alt=""
          className="h-16 w-auto rounded border object-cover"
        />
      )}
    </div>
  );
}
