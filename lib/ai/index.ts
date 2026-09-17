import { env } from "@/lib/env";
import type { Analyzer } from "./types";
import { geminiAnalyzer } from "./gemini";

// AI adapter (DESIGN.md ข้อ 6.2) — off = ปิดทั้งระบบ, gemini = เรียก Google
const offAnalyzer: Analyzer = {
  enabled: false,
  async analyze(): Promise<never> {
    throw new Error("AI_DRIVER ปิดอยู่");
  },
  async classify(): Promise<never> {
    throw new Error("AI_DRIVER ปิดอยู่");
  },
};

export const analyzer: Analyzer =
  env.AI_DRIVER === "gemini" ? geminiAnalyzer : offAnalyzer;

/** ระบบพร้อมให้ quiz เปิดใช้ AI ได้ไหม (มี driver + key ครบ) */
export const aiAvailable = () => analyzer.enabled;

export type {
  Analyzer,
  AnalyzeInput,
  ClassifyInput,
  ClassifyOutput,
} from "./types";
