"use client";

import { QUIZ_FONTS } from "@/lib/fonts";

// แสดงตัวอย่างฟอนต์จริงในแต่ละปุ่ม (ฟอนต์ทั้ง 5 โหลดไว้ที่ <html> แล้ว)
export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(QUIZ_FONTS).map(([k, v]) => (
        <button
          type="button"
          key={k}
          onClick={() => onChange(k)}
          style={{ fontFamily: v.varName }}
          className={`rounded-md border px-3 py-2 text-sm transition-colors ${
            value === k
              ? "border-primary ring-2 ring-primary/30"
              : "hover:bg-muted"
          }`}
        >
          {v.label} · ก ข ค ABC
        </button>
      ))}
    </div>
  );
}
