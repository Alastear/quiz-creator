import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";
import type { MediaStorage, PutInput, PutResult } from "./types";

// Vercel Blob driver (DESIGN.md ข้อ 6.2/12.1) — ใช้เมื่อ STORAGE_DRIVER=blob
// ต้องตั้ง BLOB_READ_WRITE_TOKEN (Vercel inject ให้อัตโนมัติเมื่อผูก Blob store)

function safeExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

export const blobStorage: MediaStorage = {
  async put({ data, filename, contentType }: PutInput): Promise<PutResult> {
    const { put } = await import("@vercel/blob");
    const now = new Date();
    const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const key = `${folder}/${nanoid()}${safeExt(filename)}`;
    const body = Buffer.from(
      data instanceof ArrayBuffer ? new Uint8Array(data) : data,
    );
    const blob = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    // เก็บ url เป็น pathname ด้วย เพราะ del() ต้องใช้ url
    return { url: blob.url, pathname: blob.url };
  },

  async delete(pathnameOrUrl: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(pathnameOrUrl, { token: env.BLOB_READ_WRITE_TOKEN });
  },
};
