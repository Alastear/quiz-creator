// ความรู้เรื่อง MBTI ที่ระบบต้องใช้ร่วมกัน (ไม่พึ่ง DB / ไม่พึ่ง AI จึงเทสต์ง่าย)
// การแบ่งงาน: AI ให้คะแนน cognitive function ทั้ง 8 ตัวจากคำตอบ
// ส่วนไฟล์นี้คำนวณต่อว่าโปรไฟล์คะแนนนั้นออกมาเป็น MBTI ชนิดไหน

export const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];

export const FUNCTION_CODES = [
  "Ni", "Ne", "Si", "Se", "Ti", "Te", "Fi", "Fe",
] as const;

export type FunctionCode = (typeof FUNCTION_CODES)[number];

/** ลำดับฟังก์ชันมาตรฐาน: หลัก → รอง → ตติยะ → ด้อย */
export const FUNCTION_STACK: Record<MbtiType, FunctionCode[]> = {
  INTJ: ["Ni", "Te", "Fi", "Se"],
  INTP: ["Ti", "Ne", "Si", "Fe"],
  ENTJ: ["Te", "Ni", "Se", "Fi"],
  ENTP: ["Ne", "Ti", "Fe", "Si"],
  INFJ: ["Ni", "Fe", "Ti", "Se"],
  INFP: ["Fi", "Ne", "Si", "Te"],
  ENFJ: ["Fe", "Ni", "Se", "Ti"],
  ENFP: ["Ne", "Fi", "Te", "Si"],
  ISTJ: ["Si", "Te", "Fi", "Ne"],
  ISFJ: ["Si", "Fe", "Ti", "Ne"],
  ESTJ: ["Te", "Si", "Ne", "Fi"],
  ESFJ: ["Fe", "Si", "Ne", "Ti"],
  ISTP: ["Ti", "Se", "Ni", "Fe"],
  ISFP: ["Fi", "Se", "Ni", "Te"],
  ESTP: ["Se", "Ti", "Fe", "Ni"],
  ESFP: ["Se", "Fi", "Te", "Ni"],
};

export const FUNCTION_INFO: Record<
  FunctionCode,
  { thai: string; nick: string; blurb: string }
> = {
  Ni: {
    thai: "สัญชาตญาณภายใน",
    nick: "ลางสังหรณ์ระยะไกล",
    blurb: "ปะติดปะต่อสัญญาณเล็ก ๆ จนเห็นภาพปลายทางก่อนคนอื่น อธิบายที่มาไม่ค่อยถูกแต่มักแม่น",
  },
  Ne: {
    thai: "สัญชาตญาณภายนอก",
    nick: "เครื่องแตกความเป็นไปได้",
    blurb: "เห็นอะไรหนึ่งอย่างแล้วแตกต่อได้สิบทาง สนุกกับการโยงเรื่องที่ดูไม่เกี่ยวกันเข้าหากัน",
  },
  Si: {
    thai: "ประสาทสัมผัสภายใน",
    nick: "คลังประสบการณ์",
    blurb: "จำรายละเอียดและความรู้สึกของสิ่งที่เคยเจอได้แม่น ใช้ของเดิมที่พิสูจน์แล้วเป็นหลักยึด",
  },
  Se: {
    thai: "ประสาทสัมผัสภายนอก",
    nick: "โหมดอยู่กับปัจจุบัน",
    blurb: "รับรู้สิ่งที่เกิดตรงหน้าได้ไวและตอบสนองทันที เก่งเรื่องหน้างานและสถานการณ์เฉพาะหน้า",
  },
  Ti: {
    thai: "ตรรกะภายใน",
    nick: "ระบบเหตุผลส่วนตัว",
    blurb: "ต้องเข้าใจว่ามันทำงานยังไงถึงจะยอมรับ รื้อของออกเป็นชิ้น ๆ แล้วประกอบใหม่ในหัว",
  },
  Te: {
    thai: "ตรรกะภายนอก",
    nick: "โหมดจัดการให้จบ",
    blurb: "วัดผลได้เป็นตัวเลข จัดคน จัดลำดับ แล้วผลักให้งานเดินถึงเส้นชัยอย่างมีประสิทธิภาพ",
  },
  Fi: {
    thai: "ความรู้สึกภายใน",
    nick: "เข็มทิศคุณค่า",
    blurb: "มีเกณฑ์ว่าอะไรถูกอะไรผิดของตัวเองชัดมาก ฝืนไม่ได้แม้คนทั้งห้องจะคิดต่าง",
  },
  Fe: {
    thai: "ความรู้สึกภายนอก",
    nick: "เรดาร์อารมณ์หมู่",
    blurb: "อ่านบรรยากาศและความรู้สึกคนในวงได้ไว ปรับตัวเองเพื่อให้ทุกคนไปต่อด้วยกันได้",
  },
};

export const STACK_LABEL = ["ฟังก์ชันหลัก", "ฟังก์ชันรอง", "ฟังก์ชันตติยะ", "ฟังก์ชันด้อย"];

export const DIMENSION_AXES = [
  { axis: "E/I", left: "E", right: "I", leftName: "เปิดตัว", rightName: "เก็บตัว" },
  { axis: "S/N", left: "S", right: "N", leftName: "รูปธรรม", rightName: "หยั่งรู้" },
  { axis: "T/F", left: "T", right: "F", leftName: "ตรรกะ", rightName: "ความรู้สึก" },
  { axis: "J/P", left: "J", right: "P", leftName: "วางแผน", rightName: "ยืดหยุ่น" },
] as const;

export function isMbtiType(v: unknown): v is MbtiType {
  return typeof v === "string" && (MBTI_TYPES as readonly string[]).includes(v);
}

export function isFunctionCode(v: unknown): v is FunctionCode {
  return typeof v === "string" && (FUNCTION_CODES as readonly string[]).includes(v);
}

// ── หาชนิดจากคะแนน cognitive function ───────────────────────────
// AI ให้คะแนนฟังก์ชันทั้ง 8 ตัวแยกกัน แล้วระบบคำนวณว่าโปรไฟล์นั้นใกล้ชนิดไหนที่สุด
// ทำแบบนี้แทนที่จะให้ AI เลือกชนิดเอง เพราะ:
//   1. คะแนนฟังก์ชันคือข้อมูลดิบ ชนิดเป็นข้อสรุป — สรุปด้วยสูตรตรวจสอบได้
//   2. ผลที่แสดงกับคะแนนที่แสดงไม่มีทางขัดกันเอง

/** ฟังก์ชันเงา = 4 ตัวที่ไม่ได้อยู่ใน stack หลัก (attitude ตรงข้าม) */
export function shadowOf(type: MbtiType): FunctionCode[] {
  const main = new Set(FUNCTION_STACK[type]);
  return FUNCTION_CODES.filter((f) => !main.has(f));
}

// โปรไฟล์ที่ "ควรจะเป็น" ของแต่ละตำแหน่ง — ใช้เทียบระยะห่างกับคะแนนจริง
const EXPECTED_MAIN = [92, 76, 52, 34]; // หลัก, รอง, ตติยะ, ด้อย
const EXPECTED_SHADOW = 28;

// ตำแหน่งหลัก/รองเป็นตัวชี้ขาดว่าเป็นชนิดไหน ส่วนเงาเป็นแค่หลักฐานประกอบ
// ถ้าให้น้ำหนักเท่ากันหมด ชนิดที่ต่างกันแค่ตำแหน่งท้าย ๆ จะคะแนนเสมอกันบ่อย
const WEIGHT_MAIN = [2.4, 1.6, 0.7, 0.5];
const WEIGHT_SHADOW = 0.35;
const WEIGHT_TOTAL =
  WEIGHT_MAIN.reduce((a, b) => a + b, 0) + WEIGHT_SHADOW * 4;

export type TypeMatch = {
  type: MbtiType;
  /** 0-100 — ยิ่งสูงยิ่งเข้ากับโปรไฟล์ */
  fit: number;
};

/**
 * เรียงทั้ง 16 ชนิดตามความเข้ากันกับคะแนนฟังก์ชันที่ได้มา
 * วัดด้วยระยะห่างเฉลี่ยจากโปรไฟล์ในอุดมคติของชนิดนั้น (ใช้ครบทั้ง 8 ตัว)
 */
export function rankTypes(
  scores: Partial<Record<FunctionCode, number>>,
): TypeMatch[] {
  const get = (f: FunctionCode) => scores[f] ?? 0;

  const ranked = MBTI_TYPES.map((type) => {
    const stack = FUNCTION_STACK[type];
    let diff = 0;
    stack.forEach((f, i) => {
      diff += WEIGHT_MAIN[i] * Math.abs(get(f) - EXPECTED_MAIN[i]);
    });
    for (const f of shadowOf(type)) {
      diff += WEIGHT_SHADOW * Math.abs(get(f) - EXPECTED_SHADOW);
    }
    // ระยะห่างถ่วงน้ำหนักเฉลี่ย (0-100) → กลับด้านเป็นคะแนนความเข้ากัน
    const fit = Math.max(0, Math.round(100 - diff / WEIGHT_TOTAL));
    return { type, fit };
  });

  return ranked.sort((a, b) => b.fit - a.fit);
}

/** ชนิดที่เข้ากับโปรไฟล์มากที่สุด */
export function deriveType(
  scores: Partial<Record<FunctionCode, number>>,
): TypeMatch {
  return rankTypes(scores)[0];
}

// จับคู่ตัวอักษรแต่ละมิติกับฟังก์ชันที่เป็นหลักฐานของฝั่งนั้น
// E/I ดูว่าฟังก์ชันที่แรงหันออกนอกหรือเข้าใน
// J/P ดูว่า "ฟังก์ชันที่หันออกนอก" เป็นแบบตัดสิน (Te/Fe) หรือแบบรับรู้ (Se/Ne)
const LETTER_FUNCTIONS: Record<string, FunctionCode[]> = {
  E: ["Ne", "Se", "Te", "Fe"],
  I: ["Ni", "Si", "Ti", "Fi"],
  S: ["Si", "Se"],
  N: ["Ni", "Ne"],
  T: ["Ti", "Te"],
  F: ["Fi", "Fe"],
  J: ["Te", "Fe"],
  P: ["Se", "Ne"],
};

/**
 * แปลงคะแนนฟังก์ชันเป็นแถบ 4 มิติ โดยยึดตัวอักษรของชนิดที่คำนวณได้เป็นฝั่งที่ชนะ
 * strength = สัดส่วนหลักฐานฝั่งนั้น (50 = ก้ำกึ่งสนิท, 100 = ชัดสุดขั้ว)
 * ตรึงขั้นต่ำไว้ที่ 50 เพื่อไม่ให้แถบขัดกับชนิดที่แสดงอยู่ข้าง ๆ
 */
export function dimensionsFromFunctions(
  scores: Partial<Record<FunctionCode, number>>,
  type: MbtiType,
): { axis: string; pick: string; strength: number }[] {
  const avg = (fs: FunctionCode[]) =>
    fs.reduce((a, f) => a + (scores[f] ?? 0), 0) / fs.length;

  return DIMENSION_AXES.map((ax, i) => {
    const pick = type[i];
    const other = pick === ax.left ? ax.right : ax.left;
    const mine = avg(LETTER_FUNCTIONS[pick] ?? []);
    const theirs = avg(LETTER_FUNCTIONS[other] ?? []);
    const total = mine + theirs;
    const pct = total > 0 ? (mine / total) * 100 : 50;
    return {
      axis: ax.axis,
      pick,
      strength: Math.min(100, Math.max(50, Math.round(pct))),
    };
  });
}
