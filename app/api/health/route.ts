import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// ตรวจสุขภาพระบบ: เชื่อม DB ได้ไหม + แสดง driver ที่ใช้อยู่
export async function GET() {
  let dbOk = false;
  let dbError: string | undefined;

  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(
    {
      app: "quibby",
      status: dbOk ? "ok" : "degraded",
      db: { ok: dbOk, error: dbError },
      drivers: {
        storage: env.STORAGE_DRIVER,
        ratelimit: env.RATELIMIT_DRIVER,
        email: env.EMAIL_DRIVER,
      },
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
