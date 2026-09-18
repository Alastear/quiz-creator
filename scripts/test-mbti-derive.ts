// ตรวจสูตรคำนวณชนิด MBTI จากคะแนน cognitive function (ไม่เรียก AI ไม่แตะ DB)
// รัน: pnpm tsx scripts/test-mbti-derive.ts
//
// สูตรนี้คือหัวใจของ quiz MBTI — คำตอบ Likert → คะแนนฟังก์ชัน → ชนิด ทั้งหมดคำนวณในโค้ด
// ถ้าสูตรแยกชนิดไม่ออก ผลที่ผู้เล่นได้จะมั่วโดยไม่มีอะไรฟ้อง
import assert from "node:assert";
import {
  MBTI_TYPES,
  FUNCTION_STACK,
  FUNCTION_CODES,
  shadowOf,
  rankTypes,
  dimensionsFromFunctions,
  scoreFunctionsFromRatings,
  type FunctionCode,
} from "@/lib/mbti";

const IDEAL = [92, 76, 52, 34];
const SHADOW = 28;
/** ระยะห่างขั้นต่ำจากอันดับสอง — น้อยกว่านี้ถือว่าสูตรแยกไม่ขาด */
const MIN_MARGIN = 3;

function profileOf(type: (typeof MBTI_TYPES)[number]) {
  const s: Partial<Record<FunctionCode, number>> = {};
  FUNCTION_STACK[type].forEach((f, i) => (s[f] = IDEAL[i]));
  for (const f of shadowOf(type)) s[f] = SHADOW;
  return s;
}

let failures = 0;

// 1. โปรไฟล์อุดมคติของแต่ละชนิด ต้องคำนวณกลับมาได้ชนิดเดิมและทิ้งห่างอันดับสอง
console.log("── โปรไฟล์อุดมคติทั้ง 16 ชนิด ──");
for (const t of MBTI_TYPES) {
  const [best, second] = rankTypes(profileOf(t));
  const margin = best.fit - second.fit;
  const ok = best.type === t && margin >= MIN_MARGIN;
  if (!ok) {
    failures++;
    console.log(
      `  ✗ ${t} → ได้ ${best.type} ${best.fit}% · รอง ${second.type} ${second.fit}% (ห่าง ${margin})`,
    );
  }
}
console.log(
  failures === 0
    ? `  ✓ 16/16 คำนวณกลับถูก และห่างจากอันดับสอง ≥${MIN_MARGIN}%`
    : `  มีปัญหา ${failures} ชนิด`,
);

// 2. มิติที่แสดงต้องตรงกับตัวอักษรของชนิดเสมอ (ห้ามขัดกันบนหน้าจอ)
console.log("\n── มิติต้องตรงกับตัวอักษรของชนิด ──");
let dimBad = 0;
for (const t of MBTI_TYPES) {
  const dims = dimensionsFromFunctions(profileOf(t), t);
  dims.forEach((d, i) => {
    if (d.pick !== t[i] || d.strength < 50) {
      dimBad++;
      console.log(`  ✗ ${t} มิติ ${d.axis} → ${d.pick} ${d.strength}%`);
    }
  });
}
failures += dimBad;
console.log(dimBad === 0 ? "  ✓ ทุกมิติตรงกับชนิด และไม่มีแถบต่ำกว่า 50%" : "");

// 3. โปรไฟล์ที่ฝืนกฎคู่ตรงข้าม (Ti/Te สูงพร้อมกัน) ต้องยังตัดสินได้ ไม่เสมอกัน
console.log("\n── โปรไฟล์กำกวมที่ AI เคยให้มา ──");
const messy: Partial<Record<FunctionCode, number>> = {
  Ni: 90, Ti: 88, Si: 85, Te: 82, Ne: 40, Fi: 35, Fe: 25, Se: 20,
};
const [mb, ms] = rankTypes(messy);
const messyMargin = mb.fit - ms.fit;
console.log(`  ${mb.type} ${mb.fit}% vs ${ms.type} ${ms.fit}% → ห่าง ${messyMargin}%`);
if (messyMargin < 1) {
  failures++;
  console.log("  ✗ ยังเสมอกันอยู่");
} else {
  console.log("  ✓ แยกออกแล้ว");
}

// 4. เส้นทางจริง: คำตอบ Likert 80 ข้อ → คะแนนฟังก์ชัน → ชนิด ต้องวนกลับมาได้ครบ 16
//    (นี่คือสิ่งที่ผู้เล่นเจอจริง ต่างจากข้อ 1 ที่ป้อนโปรไฟล์อุดมคติเข้าไปตรง ๆ)
console.log("\n── เล่นจริง 80 ข้อ แล้ววนกลับมาเป็นชนิดเดิม ──");
const ANSWER_BY_POSITION = [0, 1, 2, 3];
const ANSWER_SHADOW = 4;
let roundTripBad = 0;
for (const t of MBTI_TYPES) {
  // ผู้เล่นแบบ t ตอบ 10 ข้อของแต่ละฟังก์ชันด้วยระดับตามตำแหน่งใน stack
  const ratings = FUNCTION_CODES.flatMap((code) => {
    const at = FUNCTION_STACK[t].indexOf(code);
    const level = at >= 0 ? ANSWER_BY_POSITION[at] : ANSWER_SHADOW;
    return Array.from({ length: 10 }, () => ({ facet: code as string, level }));
  });
  const scores = scoreFunctionsFromRatings(ratings);
  const [best, second] = rankTypes(scores);
  if (best.type !== t) {
    roundTripBad++;
    console.log(`  ✗ ${t} → ${best.type} (${best.fit}%) รอง ${second.type} ${second.fit}%`);
  }
}
failures += roundTripBad;
console.log(
  roundTripBad === 0
    ? "  ✓ 16/16 คำตอบของแต่ละชนิดคำนวณกลับมาเป็นชนิดเดิม"
    : `  มีปัญหา ${roundTripBad} ชนิด`,
);

// 5. คะแนนเท่ากันหมด = ไม่มีข้อมูล ต้องไม่ล่ม
const flat = Object.fromEntries(FUNCTION_CODES.map((f) => [f, 50]));
const [flatBest] = rankTypes(flat);
assert.ok(flatBest?.type, "คะแนนแบนราบต้องยังคืนชนิดได้ ไม่ throw");

console.log(failures === 0 ? "\nผ่านทั้งหมด" : `\nมีปัญหา ${failures} จุด`);
process.exit(failures === 0 ? 0 : 1);
