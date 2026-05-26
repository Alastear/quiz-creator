"use client";

import { ThemeProvider as NextThemes } from "next-themes";

// ธีม 4 แบบ — ตั้ง class ที่ <html> (light=:root, dark/earth/sky = override ใน globals.css)
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark", "earth", "sky"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemes>
  );
}
