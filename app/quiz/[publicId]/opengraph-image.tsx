import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";
import { QUIZ_CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";
export const alt = "Quibby quiz";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** กันหน้า OG ค้างเพราะรอรูปปก — scraper ส่วนใหญ่รอไม่เกินไม่กี่วินาที */
const FETCH_TIMEOUT_MS = 4000;

/** โหลดรูปปกมาเป็น data URI ให้ satori ใช้ — คืน null เมื่อโหลดไม่ได้ */
async function loadCover(url: string | null): Promise<string | null> {
  if (!url) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const [quiz] = await db
    .select({
      title: quizzes.title,
      category: quizzes.category,
      coverImageUrl: quizzes.coverImageUrl,
    })
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);

  const cover = await loadCover(quiz?.coverImageUrl ?? null);

  // มีรูปปก → ใช้รูปนั้นเลย เพราะมันมีชื่อ quiz กับแบรนด์อยู่ในรูปแล้ว
  // ใช้ contain ไม่ใช่ cover: ปกเป็น 16:9 ส่วน OG เป็น 1.91:1
  // ถ้าครอบตัดจะกินแถบ QUIBBY ด้านบนพอดี เลยยอมให้มีขอบซ้ายขวาแทน
  if (cover) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#07070e",
          }}
        >
          <img
            src={cover}
            width={size.width}
            height={size.height}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      ),
      size,
    );
  }

  // ไม่มีรูปปก → วาดการ์ดจากชื่อ quiz แทน
  const title = quiz?.title ?? "Quibby";
  const emoji =
    QUIZ_CATEGORIES.find((c) => c.key === quiz?.category)?.emoji ?? "✨";

  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/Sarabun-Regular.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Sarabun-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #fdf2f8 0%, #ede9fe 100%)",
          fontFamily: "Sarabun",
        }}
      >
        <div style={{ fontSize: 44, color: "#7c3aed" }}>{`${emoji} Quibby`}</div>
        <div
          style={{
            display: "flex",
            fontSize: 80,
            fontWeight: 700,
            color: "#111827",
            marginTop: 24,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 34, color: "#6b7280", marginTop: 28 }}>
          มาเล่นแบบทดสอบนี้กันเถอะ →
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Sarabun", data: regular, weight: 400 },
        { name: "Sarabun", data: bold, weight: 700 },
      ],
    },
  );
}
