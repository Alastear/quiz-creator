import type { AnalyzeInput } from "./types";

// prompt กลาง — ใช้ร่วมกันทุก driver เพื่อให้เปลี่ยนเจ้าแล้วผลลัพธ์ยังหน้าตาเดิม
export const SYSTEM_PROMPT = [
  "คุณคือผู้ช่วยเขียนบทวิเคราะห์บุคลิกภาพให้เว็บ quiz ภาษาไทยชื่อ Quibby",
  "",
  "กติกา:",
  "- เขียนภาษาไทยล้วน น้ำเสียงเป็นกันเอง อบอุ่น อ่านสนุก ไม่ใช่ภาษาตำรา",
  "- ความยาว 3-5 ย่อหน้าสั้น ๆ รวมไม่เกิน 250 คำ",
  "- อ้างอิงสิ่งที่ผู้เล่นพิมพ์มาจริง ๆ อย่างน้อย 1 จุด ให้เขารู้สึกว่าอ่านของเขาจริง",
  "- ต่อยอดจากผลลัพธ์ที่ระบบคำนวณมาแล้ว ห้ามบอกว่าผลลัพธ์นั้นผิดหรือเปลี่ยนผลลัพธ์",
  "- ปิดท้ายด้วยข้อสังเกตเชิงบวก 1 ข้อที่นำไปใช้ได้จริง",
  "- ห้ามวินิจฉัยโรค ห้ามให้คำแนะนำทางการแพทย์/กฎหมาย/การเงิน",
  "- ห้ามเดาเพศ อายุ เชื้อชาติ ศาสนา หรือรสนิยมทางเพศของผู้เล่น",
  "- ถ้าคำตอบสั้นหรือกวน ๆ ให้เล่นด้วยอย่างมีอารมณ์ขัน ไม่ตำหนิ",
  "- ตอบเป็นข้อความล้วน ห้ามใส่ markdown heading หรือ JSON",
].join("\n");

export function buildUserPrompt(input: AnalyzeInput): string {
  const lines: string[] = [
    `quiz: ${input.quizTitle}`,
    `ผลลัพธ์ที่ระบบคำนวณได้: ${input.resultTitle}`,
  ];
  if (input.resultDescription) {
    lines.push(`คำบรรยายผลลัพธ์: ${input.resultDescription}`);
  }

  if (input.textAnswers.length) {
    lines.push("", "สิ่งที่ผู้เล่นพิมพ์มาเอง:");
    for (const a of input.textAnswers) {
      lines.push(`- ถาม: ${a.question}`, `  ตอบ: ${a.answer}`);
    }
  }

  if (input.choiceAnswers.length) {
    lines.push("", "ตัวเลือกที่ผู้เล่นเลือก (บริบทประกอบ):");
    for (const a of input.choiceAnswers.slice(0, 20)) {
      lines.push(`- ${a.question} → ${a.answer}`);
    }
  }

  lines.push(
    "",
    "เขียนบทวิเคราะห์ให้ผู้เล่นคนนี้ตามกติกาข้างต้น",
  );
  return lines.join("\n");
}

// ── prompt สำหรับโหมดให้ AI ตัดสิน MBTI เอง ──────────────────────
import { FUNCTION_CODES, FUNCTION_INFO } from "@/lib/mbti";
import type { ClassifyInput } from "./types";

export const CLASSIFY_SYSTEM_PROMPT = [
  "คุณคือผู้เชี่ยวชาญ cognitive function (ทฤษฎีจิตวิทยาแบบยุง) ที่เขียนบทอ่านผลให้เว็บ quiz ภาษาไทยชื่อ Quibby",
  "",
  "การแบ่งงาน — อ่านให้ดี:",
  "- คะแนนของฟังก์ชันทั้ง 8 ตัว **ระบบคำนวณมาให้แล้ว** จากคำตอบที่ผู้เล่นกดจริง",
  "- คุณไม่ต้องให้คะแนนใหม่ ไม่ต้องแก้คะแนน และห้ามเถียงกับคะแนนที่ให้มา",
  "- หน้าที่ของคุณคือ (1) เขียนว่าเห็นแต่ละฟังก์ชันจากคำตอบตรงไหน (2) เขียนบทวิเคราะห์รวม",
  "",
  "ความหมายของแต่ละฟังก์ชัน:",
  ...FUNCTION_CODES.map(
    (c) => `- ${c} (${FUNCTION_INFO[c].thai}): ${FUNCTION_INFO[c].blurb}`,
  ),
  "",
  "กติกาผลลัพธ์:",
  `- "functions" ต้องมีครบ 8 รายการ ใช้รหัสเหล่านี้ตัวละครั้ง: ${FUNCTION_CODES.join(", ")}`,
  '  "note" = 1 ประโยคสั้น ๆ ว่าเห็นฟังก์ชันนี้จากคำตอบไหน อ้างเนื้อหาประโยคที่เขาตอบจริง',
  "  ฟังก์ชันที่คะแนนต่ำ ให้เขียนว่าเขาไม่ค่อยเห็นด้วยกับเรื่องแบบไหน (ไม่ใช่เว้นว่าง)",
  '- "analysis" เขียนภาษาไทย 4-6 ย่อหน้าสั้น ๆ รวมไม่เกิน 350 คำ:',
  "  เปิดด้วยฟังก์ชันที่คะแนนสูงสุด 2 ตัวว่าทำงานร่วมกันยังไงในชีวิตประจำวันของเขา",
  "  อ้างคำตอบจริงอย่างน้อย 1 จุดให้เขารู้สึกว่าอ่านของเขาจริง",
  "  บอกจุดที่ฟังก์ชันคะแนนต่ำสุดมักทำให้สะดุด",
  "  ปิดท้ายด้วยข้อสังเกตเชิงบวกที่นำไปใช้ได้จริง",
  "  น้ำเสียงเป็นกันเอง อบอุ่น อ่านสนุก ไม่ใช่ภาษาตำรา",
  "",
  "ห้ามเด็ดขาด: เขียนรหัส MBTI 4 ตัวอักษร (เช่น INTJ, ENFP) ลงในคำตอบไม่ว่าช่องไหน",
  "ระบบเป็นคนคำนวณและแสดงชนิดเอง ถ้าคุณเดาแล้วไม่ตรง หน้าผลลัพธ์จะขัดกันเอง",
  "",
  "ห้าม: วินิจฉัยโรค ให้คำแนะนำทางการแพทย์ หรือเดาลักษณะส่วนบุคคลที่ไม่ได้อยู่ในคำตอบ",
].join("\n");

export function buildClassifyPrompt(input: ClassifyInput): string {
  const lines: string[] = [`quiz: ${input.quizTitle}`, ""];

  if (input.functionScores.length) {
    lines.push("คะแนนที่ระบบคำนวณไว้แล้ว (เรียงจากสูงไปต่ำ):");
    for (const f of [...input.functionScores].sort(
      (a, b) => b.strength - a.strength,
    )) {
      lines.push(`  ${f.code} = ${f.strength}`);
    }
    lines.push("");
  }

  lines.push("คำตอบแบบให้คะแนน (วงเล็บเหลี่ยม = ฟังก์ชันที่ประโยคนั้นวัด):");
  // จัดกลุ่มตามฟังก์ชัน เพื่อให้เห็นภาพรวมของแต่ละตัวได้ในทีเดียว
  const byFacet = new Map<string, string[]>();
  for (const r of input.ratings) {
    const key = r.facet ?? "อื่น ๆ";
    const arr = byFacet.get(key) ?? [];
    arr.push(`  - "${r.statement}" → ${r.answer}`);
    byFacet.set(key, arr);
  }
  for (const [facet, rows] of byFacet) {
    lines.push("", `[${facet}] (${rows.length} ข้อ)`, ...rows);
  }
  if (input.textAnswers.length) {
    lines.push("", "คำตอบแบบพิมพ์เอง (ถ่วงน้ำหนักเป็นพิเศษ):");
    for (const a of input.textAnswers) {
      lines.push(`- ถาม: ${a.question}`, `  ตอบ: ${a.answer}`);
    }
  }
  lines.push(
    "",
    "เขียน note ของฟังก์ชันทั้ง 8 ตัว และบทวิเคราะห์ ตามกติกาข้างต้น",
  );
  return lines.join("\n");
}
