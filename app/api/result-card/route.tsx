import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes, results } from "@/lib/db/schema";

export const runtime = "nodejs";

// สร้างการ์ดผลลัพธ์เป็น PNG ฝั่ง server (ไม่มีปัญหา CORS เหมือน html-to-image)
// GET /api/result-card?quiz=<publicId>&r=<resultKey>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicId = url.searchParams.get("quiz") ?? "";
  const resultKey = url.searchParams.get("r") ?? "";

  const [quiz] = await db
    .select({ id: quizzes.id, title: quizzes.title })
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);
  if (!quiz) return new Response("not found", { status: 404 });

  const [result] = await db
    .select()
    .from(results)
    .where(and(eq(results.quizId, quiz.id), eq(results.resultKey, resultKey)))
    .limit(1);
  if (!result) return new Response("not found", { status: 404 });

  // รูปผลลัพธ์: แปลงเป็น absolute URL ให้ Satori ดึงได้ (server-side, ไม่มี CORS)
  let imgSrc: string | null = null;
  if (result.mediaUrl) {
    imgSrc = result.mediaUrl.startsWith("http")
      ? result.mediaUrl
      : `${url.origin}${result.mediaUrl}`;
  }

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
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 64,
          textAlign: "center",
          background: "linear-gradient(135deg, #fdf2f8 0%, #ede9fe 100%)",
          fontFamily: "Sarabun",
        }}
      >
        <div style={{ fontSize: 30, color: "#7c3aed", fontWeight: 700 }}>
          ✨ Quibby
        </div>
        <div style={{ fontSize: 28, color: "#6b7280" }}>ผลลัพธ์ของคุณคือ</div>
        {imgSrc && (
          <img
            src={imgSrc}
            width={300}
            height={300}
            style={{ borderRadius: 24, objectFit: "cover" }}
          />
        )}
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {result.title}
        </div>
        {result.description && (
          <div style={{ display: "flex", fontSize: 30, color: "#4b5563" }}>
            {result.description}
          </div>
        )}
        <div style={{ fontSize: 24, color: "#9ca3af", marginTop: 12 }}>
          {`${quiz.title} · เล่นที่ Quibby`}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: "Sarabun", data: regular, weight: 400 },
        { name: "Sarabun", data: bold, weight: 700 },
      ],
      headers: {
        "Content-Disposition": `attachment; filename="quibby-${resultKey}.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
