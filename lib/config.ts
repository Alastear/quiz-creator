import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appConfig } from "@/lib/db/schema";

// ตั้งค่าระบบจากหลังบ้าน (DESIGN.md ข้อ 11.2 G) — ปรับได้โดยไม่ต้อง deploy
export type Flags = { adsEnabled: boolean; signupsOpen: boolean };
export type Announcement = { enabled: boolean; text: string };

const DEFAULT_FLAGS: Flags = { adsEnabled: true, signupsOpen: true };
const DEFAULT_ANNOUNCEMENT: Announcement = { enabled: false, text: "" };

async function getConfig<T extends object>(key: string, fallback: T): Promise<T> {
  const [row] = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, key))
    .limit(1);
  return row ? ({ ...fallback, ...(row.value as object) } as T) : fallback;
}

export const getFlags = () => getConfig("flags", DEFAULT_FLAGS);
export const getAnnouncement = () =>
  getConfig("announcement", DEFAULT_ANNOUNCEMENT);

export async function setConfig(
  key: string,
  value: unknown,
  updatedBy: string,
) {
  await db
    .insert(appConfig)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}
