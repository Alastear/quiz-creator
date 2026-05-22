import type { MediaStorage } from "./types";

// Vercel Blob driver — เปิดใช้ตอนขึ้น prod (Phase 0.5, DESIGN.md ข้อ 6.2/12.1)
// ตอนนั้น: pnpm add @vercel/blob แล้วใช้ put()/del() ของ @vercel/blob
// (ต้องตั้ง env BLOB_READ_WRITE_TOKEN)

export const blobStorage: MediaStorage = {
  async put() {
    throw new Error(
      "Blob storage ยังไม่ได้ติดตั้ง — ติดตั้งตอน Phase 0.5 (pnpm add @vercel/blob)",
    );
  },
  async delete() {
    throw new Error("Blob storage ยังไม่ได้ติดตั้ง — ติดตั้งตอน Phase 0.5");
  },
};
