import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { expirePublished, archiveExpired } from "@/lib/lifecycle";

// Cron รายวัน (DESIGN.md ข้อ 9.3) — ป้องกันด้วย CRON_SECRET
// Vercel Cron ส่ง Authorization: Bearer <CRON_SECRET>; local เรียกผ่าน ?secret= ได้
function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = req.headers.get("x-cron-secret");
  const query = url.searchParams.get("secret");
  return [bearer, header, query].includes(env.CRON_SECRET);
}

async function run(req: Request) {
  if (!authorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const expired = await expirePublished(now);
  const archived = await archiveExpired(now);

  return NextResponse.json({ ok: true, expired, archived, at: now.toISOString() });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
