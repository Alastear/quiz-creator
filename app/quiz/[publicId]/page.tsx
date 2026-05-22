import type { Metadata } from "next";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes, questions, choices } from "@/lib/db/schema";
import { QuizPlayer } from "@/components/play/quiz-player";

async function loadQuiz(publicId: string) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.publicId, publicId))
    .limit(1);
  return quiz ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const quiz = await loadQuiz(publicId);
  if (!quiz) return { title: "ไม่พบ quiz · Quibby" };
  return {
    title: `${quiz.title} · Quibby`,
    description: quiz.description ?? undefined,
    openGraph: {
      title: quiz.title,
      description: quiz.description ?? undefined,
      images: quiz.coverImageUrl ? [quiz.coverImageUrl] : undefined,
    },
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const quiz = await loadQuiz(publicId);

  const expired = quiz?.expiresAt ? quiz.expiresAt < new Date() : false;
  if (!quiz || quiz.status !== "published" || expired) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">ไม่พบ quiz นี้</h1>
        <p className="text-muted-foreground">
          quiz อาจยังไม่เผยแพร่ หมดอายุ หรือถูกลบไปแล้ว
        </p>
      </main>
    );
  }

  // นับยอดเข้าชม (best-effort)
  await db
    .update(quizzes)
    .set({ viewCount: sql`${quizzes.viewCount} + 1` })
    .where(eq(quizzes.id, quiz.id));

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.orderIndex));

  const cs = qs.length
    ? await db
        .select()
        .from(choices)
        .where(
          inArray(
            choices.questionId,
            qs.map((q) => q.id),
          ),
        )
        .orderBy(asc(choices.orderIndex))
    : [];

  // ส่งเฉพาะข้อมูลที่ปลอดภัยต่อ public (ไม่ส่ง scoreMap/points)
  const playQuestions = qs.map((q) => ({
    id: q.id,
    promptText: q.promptText,
    mediaUrl: q.mediaUrl,
    choices: cs
      .filter((c) => c.questionId === q.id)
      .map((c) => ({ id: c.id, labelText: c.labelText, mediaUrl: c.mediaUrl })),
  }));

  return (
    <QuizPlayer
      publicId={quiz.publicId}
      title={quiz.title}
      description={quiz.description}
      coverImageUrl={quiz.coverImageUrl}
      fontKey={quiz.theme?.fontFamily ?? "sarabun"}
      questions={playQuestions}
    />
  );
}
