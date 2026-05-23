// ราคา/แพ็ก (DESIGN.md ข้อ 10.1) — บาท
// โมเดล credit เดียว: 1 เครดิต = เผยแพร่ quiz เกินโควตา 1 อัน หรือ ต่ออายุ +30 วัน

export const CREDIT_PACKS = [
  { id: "c1", credits: 1, price: 19, label: "1 เครดิต" },
  { id: "c5", credits: 5, price: 79, label: "5 เครดิต (คุ้มกว่า)" },
  { id: "c12", credits: 12, price: 169, label: "12 เครดิต (คุ้มสุด)" },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export function packById(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

export const DONATION_PRESETS = [20, 50, 100] as const;
export const DONATION_MIN = 20;
export const DONATION_MAX = 5000;

export const EXTEND_DAYS = 30;
export const EXTEND_COST_CREDITS = 1; // ต่ออายุ +30 วัน
export const EXTRA_QUIZ_COST_CREDITS = 1; // เผยแพร่เกินโควตาฟรี
