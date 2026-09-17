import { env } from "@/lib/env";
import { FUNCTION_CODES, isFunctionCode } from "@/lib/mbti";
import type { Analyzer, AnalyzeInput, ClassifyInput, ClassifyOutput } from "./types";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  CLASSIFY_SYSTEM_PROMPT,
  buildClassifyPrompt,
} from "./prompt";

// Google Generative Language API — เรียกผ่าน REST ตรง ๆ ไม่ต้องเพิ่ม SDK
// ชื่อรุ่น/endpoint มาจาก env จึงเปลี่ยนรุ่นได้โดยไม่ต้อง deploy โค้ดใหม่
const TIMEOUT_MS = 20_000;
// จัดผลทั้งชุด 80 ข้อใช้เวลานานกว่าเขียนบรรยายเฉย ๆ
const CLASSIFY_TIMEOUT_MS = 45_000;

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

/** ยิงคำขอไป Gemini แล้วคืนข้อความล้วนจาก candidate แรก */
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  opts: {
    timeoutMs: number;
    maxOutputTokens: number;
    temperature: number;
    responseSchema?: object;
  },
): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ไม่ได้ตั้ง");

  const url = `${env.GEMINI_BASE_URL.replace(/\/$/, "")}/models/${encodeURIComponent(
    env.GEMINI_MODEL,
  )}:generateContent`;

  // กันค้าง — ผู้เล่นรอผลอยู่หน้าจอ
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
          ...(opts.responseSchema
            ? {
                responseMimeType: "application/json",
                responseSchema: opts.responseSchema,
              }
            : {}),
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json().catch(() => ({}))) as GeminiResponse;

  if (!res.ok) {
    throw new Error(
      `Gemini ตอบกลับ ${res.status}: ${json.error?.message ?? "ไม่ทราบสาเหตุ"}`,
    );
  }
  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini บล็อกคำขอ: ${json.promptFeedback.blockReason}`);
  }

  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini ไม่ได้คืนข้อความ");
  return text;
}

// schema บังคับรูปร่างผลลัพธ์ (subset ของ OpenAPI ที่ Gemini รองรับ)
// ไม่มีช่อง type/dimensions โดยตั้งใจ — AI ให้แค่คะแนนฟังก์ชัน ระบบคำนวณชนิดเอง
const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    functions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string", enum: [...FUNCTION_CODES] },
          strength: { type: "number" },
          note: { type: "string" },
        },
        required: ["code", "strength", "note"],
      },
    },
    analysis: { type: "string" },
  },
  required: ["functions", "analysis"],
} as const;

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(hi, Math.max(lo, Math.round(n)))
    : fallback;

/** ตรวจคำตอบของ AI ก่อนเอาไปใช้ — responseSchema กันรูปร่างได้ แต่ไม่กันของขาด/ซ้ำ */
function parseClassify(raw: string): ClassifyOutput {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Gemini คืน JSON ที่อ่านไม่ได้");
  }
  const o = data as Record<string, unknown>;

  const rawFns = Array.isArray(o.functions) ? o.functions : [];
  const seen = new Set<string>();
  const functions = rawFns
    .map((f) => f as Record<string, unknown>)
    .filter((f) => {
      if (!isFunctionCode(f?.code) || seen.has(f.code as string)) return false;
      seen.add(f.code as string);
      return true;
    })
    .map((f) => ({
      code: f.code as string,
      strength: clamp(f.strength, 0, 100, 50),
      note: typeof f.note === "string" ? f.note.slice(0, 300) : "",
    }));

  // ต้องครบทั้ง 8 — ขาดตัวเดียวการคำนวณชนิดก็เพี้ยนทันที
  if (functions.length !== FUNCTION_CODES.length)
    throw new Error(
      `Gemini ให้คะแนนฟังก์ชันไม่ครบ (ได้ ${functions.length}/${FUNCTION_CODES.length})`,
    );

  const analysis = typeof o.analysis === "string" ? o.analysis.trim() : "";
  if (!analysis) throw new Error("Gemini ไม่ได้คืนบทวิเคราะห์");

  return { functions, analysis };
}

export const geminiAnalyzer: Analyzer = {
  get enabled() {
    return Boolean(env.GEMINI_API_KEY);
  },

  async analyze(input: AnalyzeInput): Promise<string> {
    return callGemini(SYSTEM_PROMPT, buildUserPrompt(input), {
      timeoutMs: TIMEOUT_MS,
      maxOutputTokens: 800,
      temperature: 0.9,
    });
  },

  async classify(input: ClassifyInput): Promise<ClassifyOutput> {
    const raw = await callGemini(
      CLASSIFY_SYSTEM_PROMPT,
      buildClassifyPrompt(input),
      {
        timeoutMs: CLASSIFY_TIMEOUT_MS,
        maxOutputTokens: 3000,
        // ตัดสินผลควรนิ่ง — คนเดิมตอบเหมือนเดิมควรได้ผลเดิม
        temperature: 0.3,
        responseSchema: CLASSIFY_SCHEMA,
      },
    );
    return parseClassify(raw);
  },
};
