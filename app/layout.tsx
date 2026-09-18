import type { Metadata } from "next";
import { env } from "@/lib/env";
import { allFontVariables, sarabun } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  // ต้องตั้งไว้ ไม่งั้น URL รูป OG จะอิงกับ URL ของ deployment ซึ่งเปลี่ยนทุกครั้งที่ deploy
  // ทำให้ลิงก์ที่เคยแชร์ไปแล้วดึงรูปไม่ขึ้น
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Quibby — สร้าง quiz สนุก ๆ ของคุณเอง",
  description:
    "Quibby แพลตฟอร์มสร้าง quiz ทายผล/ทายนิสัยแบบง่าย ๆ สร้างเสร็จแชร์ได้ทันที",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      // Sarabun เป็นฟอนต์เริ่มต้นของแอป + โหลด CSS variable ของอีก 4 ฟอนต์ไว้ให้ธีม quiz เลือก
      className={`${allFontVariables} ${sarabun.className} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
