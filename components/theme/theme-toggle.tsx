"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const THEMES = [
  { key: "light", label: "☀️ สว่าง" },
  { key: "dark", label: "🌙 มืด" },
  { key: "earth", label: "🌿 เอิร์ธ" },
  { key: "sky", label: "☁️ ฟ้า" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // กัน hydration mismatch — แสดงค่าจริงหลัง mount
  const value = mounted ? (theme ?? "light") : "light";

  return (
    <select
      aria-label="เลือกธีม"
      value={value}
      onChange={(e) => setTheme(e.target.value)}
      className="h-8 rounded-md border bg-background px-2 text-sm"
    >
      {THEMES.map((t) => (
        <option key={t.key} value={t.key}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
