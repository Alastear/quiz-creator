import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// สคีมาเริ่มต้น (Phase 0/1) — ตารางหลักจะทยอยเพิ่มตาม DESIGN.md ข้อ 7
// DB เป็น Postgres ทั้ง local และ prod (Neon) → migration เดียวกัน

export const userRole = pgEnum("user_role", ["user", "support", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);
export const userPlan = pgEnum("user_plan", ["free", "pro"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  plan: userPlan("plan").notNull().default("free"),
  quizCredits: integer("quiz_credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
