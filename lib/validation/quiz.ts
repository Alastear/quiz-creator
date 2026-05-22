import { z } from "zod";

// payload ที่ builder ส่งมาเซฟ (DESIGN.md ข้อ 5) — soft caps กัน abuse (ข้อ 16)
const mediaTypeSchema = z.enum(["none", "image", "audio", "video"]);
const mediaUrlSchema = z.string().trim().max(2000).optional();

export const choiceDraftSchema = z.object({
  labelText: z.string().trim().min(1, "ใส่ข้อความตัวเลือก").max(500),
  mediaType: mediaTypeSchema.default("none"),
  mediaUrl: mediaUrlSchema,
  // archetype: { "<result_key>": points }
  scoreMap: z.record(z.string(), z.number().int().min(0).max(100)).default({}),
  // range
  points: z.number().int().min(0).max(1000).default(0),
});

export const questionDraftSchema = z.object({
  promptText: z.string().trim().min(1, "ใส่คำถาม").max(1000),
  mediaType: mediaTypeSchema.default("none"),
  mediaUrl: mediaUrlSchema,
  choices: z.array(choiceDraftSchema).min(1).max(6),
});

export const resultDraftSchema = z.object({
  resultKey: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1, "ใส่ชื่อผลลัพธ์").max(200),
  description: z.string().trim().max(2000).optional(),
  mediaType: mediaTypeSchema.default("none"),
  mediaUrl: mediaUrlSchema,
  shareText: z.string().trim().max(500).optional(),
  scoreMin: z.number().int().nullable().optional(),
  scoreMax: z.number().int().nullable().optional(),
});

export const quizDraftSchema = z.object({
  title: z.string().trim().min(1, "ใส่ชื่อ quiz").max(200),
  description: z.string().trim().max(2000).optional(),
  coverImageUrl: z.string().trim().max(2000).optional(),
  resultLogic: z.enum(["archetype", "range"]),
  theme: z.object({ fontFamily: z.string().optional() }).default({}),
  settings: z
    .object({ showProbabilityBar: z.boolean().optional() })
    .default({}),
  results: z.array(resultDraftSchema).min(1).max(10),
  questions: z.array(questionDraftSchema).max(50),
});

export type ChoiceDraft = z.infer<typeof choiceDraftSchema>;
export type QuestionDraft = z.infer<typeof questionDraftSchema>;
export type ResultDraft = z.infer<typeof resultDraftSchema>;
export type QuizDraft = z.infer<typeof quizDraftSchema>;
