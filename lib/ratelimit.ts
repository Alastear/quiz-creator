import { env } from "@/lib/env";

// Rate limit adapter (DESIGN.md ข้อ 6.2 / 12)
//   memory  = in-process fixed-window (dev เท่านั้น — ใช้ได้กับ instance เดียว)
//   upstash = ต่อ Upstash Redis ตอน prod (Phase 0.5)

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  /** epoch ms ที่ window จะรีเซ็ต */
  reset: number;
};

export interface RateLimiter {
  /** จำกัด `limit` ครั้งต่อหน้าต่างเวลา `windowMs` ต่อ 1 key */
  limit(
    key: string,
    opts?: { limit?: number; windowMs?: number },
  ): Promise<RateLimitResult>;
}

const buckets = new Map<string, { count: number; reset: number }>();

const memoryLimiter: RateLimiter = {
  async limit(key, opts) {
    const limit = opts?.limit ?? 10;
    const windowMs = opts?.windowMs ?? 60_000;
    const now = Date.now();
    const b = buckets.get(key);

    if (!b || now >= b.reset) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return { success: true, remaining: limit - 1, reset: now + windowMs };
    }

    b.count += 1;
    return {
      success: b.count <= limit,
      remaining: Math.max(0, limit - b.count),
      reset: b.reset,
    };
  },
};

const upstashLimiter: RateLimiter = {
  async limit() {
    throw new Error(
      "Upstash rate limiter ยังไม่ได้ติดตั้ง — ติดตั้งตอน Phase 0.5 (@upstash/ratelimit + @upstash/redis)",
    );
  },
};

export const ratelimit: RateLimiter =
  env.RATELIMIT_DRIVER === "upstash" ? upstashLimiter : memoryLimiter;
