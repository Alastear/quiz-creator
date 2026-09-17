// อินเทอร์เฟซเดียวสำหรับ AI วิเคราะห์คำตอบ (DESIGN.md ข้อ 6.2)
// โค้ดที่เรียกใช้ไม่ต้องรู้ว่าเบื้องหลังเป็นผู้ให้บริการเจ้าไหน

export type AnalyzeInput = {
  quizTitle: string;
  /** ผลลัพธ์ที่ระบบคำนวณได้ — AI ต่อยอดจากตรงนี้ ไม่ใช่คำนวณใหม่ */
  resultTitle: string;
  resultDescription: string | null;
  /** คำตอบแบบพิมพ์เอง (ส่วนที่ AI อ่านจริง) */
  textAnswers: { question: string; answer: string }[];
  /** คำตอบแบบเลือกตอบ ใส่เป็นบริบทประกอบ */
  choiceAnswers: { question: string; answer: string }[];
};

export interface Analyzer {
  /** คืนข้อความวิเคราะห์ภาษาไทย — โยน error เมื่อเรียกไม่สำเร็จ */
  analyze(input: AnalyzeInput): Promise<string>;
  /** ให้ AI ตัดสิน MBTI จากคำตอบทั้งชุด — โยน error เมื่อเรียกไม่สำเร็จ */
  classify(input: ClassifyInput): Promise<ClassifyOutput>;
  /** driver นี้พร้อมใช้จริงไหม (มี key ครบ) */
  readonly enabled: boolean;
}

// ── โหมดให้ AI ตัดสินผลลัพธ์เอง (MBTI) ──────────────────────────
// ต่างจาก analyze() ตรงที่ AI เป็นคนเลือกว่าผู้เล่นได้ผลลัพธ์ไหน
// ไม่ใช่แค่เขียนบรรยายต่อจากผลที่ระบบคำนวณมาแล้ว

export type ClassifyInput = {
  quizTitle: string;
  /** ประโยค Likert + ระดับที่ผู้เล่นเลือก + มิติย่อยที่ประโยคนั้นวัด */
  ratings: { statement: string; answer: string; facet: string | null }[];
  /** คำตอบแบบพิมพ์เอง */
  textAnswers: { question: string; answer: string }[];
};

export type ClassifyOutput = {
  /** คะแนนครบทั้ง 8 ฟังก์ชัน (0-100) วัดแยกกันอิสระ — ไม่ได้เรียงมาก่อน */
  functions: { code: string; strength: number; note: string }[];
  /** บทวิเคราะห์ภาษาไทย (พูดถึงฟังก์ชัน ไม่ระบุรหัส MBTI) */
  analysis: string;
};
