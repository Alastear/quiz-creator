// หมวดหมู่ quiz + ป้ายภาษาไทย (ใช้ทั้ง builder และหน้า discovery)
export const QUIZ_CATEGORIES = [
  { key: "personality", label: "ทายนิสัย", emoji: "🧠" },
  { key: "love", label: "ความรัก", emoji: "💖" },
  { key: "work", label: "การงาน/การเรียน", emoji: "💼" },
  { key: "knowledge", label: "ความรู้รอบตัว", emoji: "📚" },
  { key: "popculture", label: "ป็อปคัลเจอร์", emoji: "🎬" },
  { key: "lifestyle", label: "ไลฟ์สไตล์", emoji: "🌿" },
  { key: "other", label: "อื่น ๆ", emoji: "✨" },
] as const;

export type QuizCategoryKey = (typeof QUIZ_CATEGORIES)[number]["key"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  QUIZ_CATEGORIES.map((c) => [c.key, `${c.emoji} ${c.label}`]),
);
