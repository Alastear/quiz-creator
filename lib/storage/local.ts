import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";
import type { MediaStorage, PutInput, PutResult } from "./types";

// เก็บไฟล์ลง filesystem (dev) — serve ผ่าน /api/media/[...path]
// pathname = "<yyyymm>/<nanoid>.<ext>" เพื่อไม่ให้ไฟล์กองในโฟลเดอร์เดียว

function safeExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

function baseDir(): string {
  return path.join(process.cwd(), env.LOCAL_UPLOAD_DIR);
}

export const localStorage: MediaStorage = {
  async put({ data, filename }: PutInput): Promise<PutResult> {
    const now = new Date();
    const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const pathname = `${folder}/${nanoid()}${safeExt(filename)}`;
    const full = path.join(baseDir(), pathname);

    await mkdir(path.dirname(full), { recursive: true });
    const buf =
      data instanceof ArrayBuffer ? Buffer.from(new Uint8Array(data)) : Buffer.from(data);
    await writeFile(full, buf);

    return { url: `/api/media/${pathname}`, pathname };
  },

  async delete(pathname: string): Promise<void> {
    // กัน path traversal: pathname ต้องไม่หลุดออกนอก baseDir
    const full = path.join(baseDir(), pathname);
    if (!full.startsWith(baseDir())) throw new Error("Invalid pathname");
    await rm(full, { force: true });
  },
};
