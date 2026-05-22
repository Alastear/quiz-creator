import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes, questions, choices, results } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { QuizBuilder } from "@/components/builder/quiz-builder";
import type { QuizDraft } from "@/lib/validation/quiz";

export const metadata = { title: "สร้าง quiz · Quibby" };

export default async function CreatePage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const user = await requireUser(`/create/${quizId}`);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, user.id)))
    .limit(1);
  if (!quiz) notFound();

  const rs = await db
    .select()
    .from(results)
    .where(eq(results.quizId, quizId))
    .orderBy(asc(results.orderIndex));

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
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

  const initial: QuizDraft = {
    title: quiz.title,
    description: quiz.description ?? undefined,
    coverImageUrl: quiz.coverImageUrl ?? undefined,
    resultLogic: quiz.resultLogic === "range" ? "range" : "archetype",
    theme: quiz.theme ?? {},
    settings: quiz.settings ?? {},
    results: rs.map((r) => ({
      resultKey: r.resultKey,
      title: r.title,
      description: r.description ?? undefined,
      mediaType: r.mediaType,
      mediaUrl: r.mediaUrl ?? undefined,
      shareText: r.shareText ?? undefined,
      scoreMin: r.scoreMin,
      scoreMax: r.scoreMax,
    })),
    questions: qs.map((q) => ({
      promptText: q.promptText,
      mediaType: q.mediaType,
      mediaUrl: q.mediaUrl ?? undefined,
      choices: cs
        .filter((c) => c.questionId === q.id)
        .map((c) => ({
          labelText: c.labelText,
          mediaType: c.mediaType,
          mediaUrl: c.mediaUrl ?? undefined,
          scoreMap: c.scoreMap,
          points: c.points,
        })),
    })),
  };

  return (
    <main className="flex-1">
      <QuizBuilder
        quizId={quiz.id}
        publicId={quiz.publicId}
        status={quiz.status}
        initial={initial}
      />
    </main>
  );
}
