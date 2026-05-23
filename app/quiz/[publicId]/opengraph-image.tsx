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

export default async function OgImage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const [quiz] = await db
    .select({ title: quizzes.title, category: quizzes.category })
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);

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
