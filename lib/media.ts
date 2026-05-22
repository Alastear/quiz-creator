import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";

// ขนาด/ชนิดไฟล์ + โควตา (DESIGN.md ข้อ 12.1)
const MB = 1024 * 1024;

export type MediaKind = "image" | "audio" | "video";

export const ALLOWED_MIME: Record<MediaKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  audio: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg"],
  video: ["video/mp4", "video/webm"],
};

// เพดานต่อไฟล์ (free / paid) เป็น bytes
const PER_FILE: Record<MediaKind, { free: number; paid: number }> = {
  image: { free: 10 * MB, paid: 10 * MB },
  audio: { free: 15 * MB, paid: 30 * MB },
  video: { free: 50 * MB, paid: 200 * MB },
};

export const QUOTA_BYTES = { free: 200 * MB, pro: 2 * 1024 * MB };

export function kindFromMime(mime: string): MediaKind | null {
  for (const k of Object.keys(ALLOWED_MIME) as MediaKind[]) {
    if (ALLOWED_MIME[k].includes(mime)) return k;
  }
  return null;
}

export function maxFileSize(kind: MediaKind, plan: string): number {
  const tier = plan === "pro" ? "paid" : "free";
  return PER_FILE[kind][tier];
}

export function quotaFor(plan: string): number {
  return plan === "pro" ? QUOTA_BYTES.pro : QUOTA_BYTES.free;
}

/** พื้นที่ที่ใช้ไปแล้วของ user (เฉพาะไฟล์อัปโหลด) */
export async function usedBytes(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${media.sizeBytes}), 0)::bigint` })
    .from(media)
    .where(eq(media.ownerId, ownerId));
  return Number(row?.total ?? 0);
}

export function humanSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
