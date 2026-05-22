import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// serve ไฟล์ที่อัปโหลดแบบ local (STORAGE_DRIVER=local)
// prod ใช้ Vercel Blob ที่มี URL ของตัวเอง → route นี้ไม่ถูกเรียก

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const baseDir = path.join(process.cwd(), env.LOCAL_UPLOAD_DIR);
  const full = path.join(baseDir, ...segments);

  // กัน path traversal
  if (!full.startsWith(baseDir + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
