import {
  Sarabun,
  Kanit,
  Prompt,
  Bai_Jamjuree,
  Mitr,
} from "next/font/google";

// ฟอนต์ไทย 5 แบบที่ผู้สร้าง quiz เลือกได้ (DESIGN.md ข้อ 6.1)
// แต่ละตัว expose เป็น CSS variable เพื่อให้ธีมของ quiz สลับฟอนต์ได้
// โหลดเฉพาะ weight ที่ใช้ + subset thai/latin เพื่อไม่ให้ bundle ใหญ่

export const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const baiJamjuree = Bai_Jamjuree({
  variable: "--font-bai-jamjuree",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const mitr = Mitr({
  variable: "--font-mitr",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** ทุก CSS variable รวมกัน เอาไปแปะที่ <html> ครั้งเดียว */
export const allFontVariables = [
  sarabun.variable,
  kanit.variable,
  prompt.variable,
  baiJamjuree.variable,
  mitr.variable,
].join(" ");

/** key ที่เก็บใน quizzes.theme.fontFamily → ใช้ map ไป CSS variable */
export const QUIZ_FONTS = {
  sarabun: { label: "Sarabun", varName: "var(--font-sarabun)" },
  kanit: { label: "Kanit", varName: "var(--font-kanit)" },
  prompt: { label: "Prompt", varName: "var(--font-prompt)" },
  baiJamjuree: { label: "Bai Jamjuree", varName: "var(--font-bai-jamjuree)" },
  mitr: { label: "Mitr", varName: "var(--font-mitr)" },
} as const;

export type QuizFontKey = keyof typeof QUIZ_FONTS;
export const DEFAULT_QUIZ_FONT: QuizFontKey = "sarabun";
