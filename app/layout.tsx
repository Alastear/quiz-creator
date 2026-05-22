import type { Metadata } from "next";
import { allFontVariables, sarabun } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
