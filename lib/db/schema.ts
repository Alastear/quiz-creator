import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// สคีมาเริ่มต้น (Phase 0/1) — ตารางหลักจะทยอยเพิ่มตาม DESIGN.md ข้อ 7
// DB เป็น Postgres ทั้ง local และ prod (Neon) → migration เดียวกัน

export const userRole = pgEnum("user_role", ["user", "support", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);
export const userPlan = pgEnum("user_plan", ["free", "pro"]);

// ---- ผู้ใช้ (ขยายจาก schema มาตรฐานของ Auth.js + ฟิลด์เฉพาะ Quibby) ----
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Quibby
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  plan: userPlan("plan").notNull().default("free"),
  quizCredits: integer("quiz_credits").notNull().default(0),
  // Creator Tip Jar (DESIGN.md ข้อ 10.5) — แพลตฟอร์มไม่ยุ่งกับเงิน แค่แปะให้
  creatorPayout: jsonb("creator_payout")
    .$type<{
      enabled?: boolean;
      qrUrl?: string;
      bankName?: string;
      bankAccount?: string;
      accountName?: string;
      externalUrl?: string;
      message?: string;
    }>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- ตารางที่ Auth.js Drizzle adapter ต้องใช้ ----
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---- PDPA consent log (DESIGN.md ข้อ 8.2) ----
export const consents = pgTable("consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  policyVersion: text("policy_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

// ---- Quiz core (DESIGN.md ข้อ 4, 7) ----
export const resultLogic = pgEnum("result_logic", [
  "archetype",
  "range",
  "branching",
]);
export const quizStatus = pgEnum("quiz_status", [
  "draft",
  "published",
  "expired",
  "archived",
]);
// ประเภท segment ในคำถาม (DESIGN.md) — choice=เลือกตอบ, text=พิมพ์ตอบ, story=เล่าเรื่อง
export const questionKind = pgEnum("question_kind", [
  "choice",
  "text",
  "story",
]);
// หมวดหมู่ quiz สำหรับหน้า discovery
export const quizCategory = pgEnum("quiz_category", [
  "personality",
  "love",
  "work",
  "knowledge",
  "popculture",
  "lifestyle",
  "other",
]);
// media แบบ inline (Phase 2 รองรับ url/ลิงก์ก่อน, Phase 3 เพิ่มอัปโหลด)
export const mediaType = pgEnum("media_type", [
  "none",
  "image",
  "audio",
  "video",
]);

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicId: text("public_id").notNull().unique(), // nanoid ใช้ใน URL
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  resultLogic: resultLogic("result_logic").notNull().default("archetype"),
  category: quizCategory("category").notNull().default("other"),
  status: quizStatus("status").notNull().default("draft"),
  theme: jsonb("theme")
    .$type<{ fontFamily?: string; accent?: string }>()
    .notNull()
    .default({}),
  settings: jsonb("settings")
    .$type<{ showProbabilityBar?: boolean }>()
    .notNull()
    .default({}),
  viewCount: integer("view_count").notNull().default(0),
  playCount: integer("play_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  kind: questionKind("kind").notNull().default("choice"),
  promptText: text("prompt_text").notNull(),
  mediaType: mediaType("media_type").notNull().default("none"),
  mediaUrl: text("media_url"),
});

export const choices = pgTable("choices", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  labelText: text("label_text").notNull(),
  mediaType: mediaType("media_type").notNull().default("none"),
  mediaUrl: text("media_url"),
  // archetype: { "<result_key>": points }
  scoreMap: jsonb("score_map").$type<Record<string, number>>().notNull().default({}),
  // range: แต้มของช้อยนี้
  points: integer("points").notNull().default(0),
  // branching (Phase 3.5): "q:<id>" | "r:<key>" | null=ไหลปกติ
  next: text("next"),
});

export const results = pgTable("results", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  resultKey: text("result_key").notNull(), // unique ภายใน quiz
  title: text("title").notNull(),
  description: text("description"),
  mediaType: mediaType("media_type").notNull().default("none"),
  mediaUrl: text("media_url"),
  shareText: text("share_text"),
  // free-form designer (Phase หลัง)
  layout: jsonb("layout"),
  // range เท่านั้น
  scoreMin: integer("score_min"),
  scoreMax: integer("score_max"),
});

export const plays = pgTable("plays", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  resultId: uuid("result_id").references(() => results.id, {
    onDelete: "set null",
  }),
  answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
  sessionHash: text("session_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- media ที่อัปโหลด (ติดตามโควตา/ความเป็นเจ้าของ; DESIGN.md ข้อ 7, 12.1) ----
export const mediaSource = pgEnum("media_source", ["upload", "link"]);

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: mediaType("kind").notNull(), // image | audio | video
  source: mediaSource("source").notNull().default("upload"),
  url: text("url").notNull(), // URL ที่เอาไปแสดง
  pathname: text("pathname"), // key ใน storage ไว้ลบ
  mime: text("mime"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- quiz ที่หมดอายุถูก archive (DESIGN.md ข้อ 9) ----
// เก็บเนื้อหาทั้งก้อนเป็น JSON + ลบ rows ลูก (questions/choices/results/plays) เพื่อประหยัดพื้นที่
// (prod ย้ายไป Blob ได้ภายหลัง; ตอนนี้เก็บใน jsonb เพื่อความเรียบง่าย)
export const quizArchives = pgTable("quiz_archives", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(), // { quiz, questions, choices, results }
  statsSnapshot: jsonb("stats_snapshot")
    .$type<{ viewCount: number; playCount: number; resultBreakdown?: Record<string, number> }>()
    .notNull()
    .default({ viewCount: 0, playCount: 0 }),
  archivedAt: timestamp("archived_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  restorableUntil: timestamp("restorable_until", { withTimezone: true }).notNull(),
});

// ---- audit log การกระทำของ admin/support (DESIGN.md ข้อ 11.2, 12) ----
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // เช่น 'user.suspend','user.role','credit.adjust','quiz.unpublish'
  targetType: text("target_type").notNull(), // 'user' | 'quiz' | ...
  targetId: text("target_id"),
  detail: jsonb("detail"), // ค่าก่อน/หลัง + เหตุผล
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- ธุรกรรมการจ่ายเงิน/โดเนท (DESIGN.md ข้อ 10) ----
export const txnKind = pgEnum("txn_kind", [
  "credit_pack",
  "donation",
  "pro",
]);
export const txnStatus = pgEnum("txn_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: txnKind("kind").notNull(),
  amount: integer("amount").notNull(), // บาท (จำนวนเต็ม)
  currency: text("currency").notNull().default("thb"),
  creditsGranted: integer("credits_granted").notNull().default(0),
  provider: text("provider").notNull().default("mock"),
  providerRef: text("provider_ref"),
  status: txnStatus("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Consent = typeof consents.$inferSelect;
export type Media = typeof media.$inferSelect;
export type QuizArchive = typeof quizArchives.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Choice = typeof choices.$inferSelect;
export type QuizResult = typeof results.$inferSelect;
export type Play = typeof plays.$inferSelect;
