import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { getActor } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { ratelimit } from "@/lib/ratelimit";
import {
  kindFromMime,
  maxFileSize,
  quotaFor,
  usedBytes,
  humanSize,
} from "@/lib/media";

export async function POST(req: Request) {
  let user;
  try {
    user = await getActor();
  } catch {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบ" }, { status: 401 });
  }

  const rl = await ratelimit.limit(`upload:${user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success)
    return NextResponse.json({ error: "อัปโหลดถี่เกินไป ลองใหม่อีกครั้ง" }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });

  const kind = kindFromMime(file.type);
  if (!kind)
    return NextResponse.json(
      { error: `ชนิดไฟล์ไม่รองรับ (${file.type || "unknown"})` },
      { status: 415 },
    );

  // ตอนนี้เปิดให้อัปโหลดเฉพาะรูปภาพ (เสียง/วิดีโอจะเปิดให้ใช้ภายหลัง)
  if (kind !== "image")
    return NextResponse.json(
      { error: "ตอนนี้รองรับเฉพาะรูปภาพ (เสียง/วิดีโอจะเปิดให้ใช้ภายหลัง)" },
      { status: 415 },
    );

  const max = maxFileSize(kind, user.plan);
  if (file.size > max)
    return NextResponse.json(
      { error: `ไฟล์ใหญ่เกินไป (สูงสุด ${humanSize(max)})` },
      { status: 413 },
    );

  const used = await usedBytes(user.id);
  const quota = quotaFor(user.plan);
  if (used + file.size > quota)
    return NextResponse.json(
      {
        error: `พื้นที่เก็บไฟล์เต็ม (ใช้ ${humanSize(used)} / ${humanSize(quota)})`,
      },
      { status: 413 },
    );

  const data = await file.arrayBuffer();
  const put = await storage.put({
    data,
    filename: file.name,
    contentType: file.type,
  });

  await db.insert(media).values({
    ownerId: user.id,
    kind,
    source: "upload",
    url: put.url,
    pathname: put.pathname,
    mime: file.type,
    sizeBytes: file.size,
  });

  return NextResponse.json({ url: put.url, kind });
}
