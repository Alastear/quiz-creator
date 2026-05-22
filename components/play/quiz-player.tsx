"use client";

import { useState, useTransition } from "react";
import { submitPlay, type PlayResult } from "@/lib/actions/play";
import { QUIZ_FONTS, type QuizFontKey } from "@/lib/fonts";
import { Button } from "@/components/ui/button";

type PlayChoice = { id: string; labelText: string; mediaUrl: string | null };
type PlayQuestion = {
  id: string;
  promptText: string;
  mediaUrl: string | null;
  choices: PlayChoice[];
};

type Props = {
  publicId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  fontKey: string;
  questions: PlayQuestion[];
};

export function QuizPlayer({
  publicId,
  title,
  description,
  coverImageUrl,
  fontKey,
  questions,
}: Props) {
  const [phase, setPhase] = useState<"cover" | "playing" | "result">("cover");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PlayResult | null>(null);
  const [pending, startTransition] = useTransition();

  const font =
    QUIZ_FONTS[(fontKey as QuizFontKey) in QUIZ_FONTS ? (fontKey as QuizFontKey) : "sarabun"];

  function choose(questionId: string, choiceId: string) {
    const next = { ...answers, [questionId]: choiceId };
    setAnswers(next);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      // ข้อสุดท้าย → ส่งคำตอบ
      const payload = Object.entries(next).map(([qid, cid]) => ({
        questionId: qid,
        choiceId: cid,
      }));
      startTransition(async () => {
        const r = await submitPlay(publicId, payload);
        setResult(r);
        setPhase("result");
      });
    }
  }

  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10"
      style={{ fontFamily: font.varName }}
    >
      {phase === "cover" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt=""
              className="max-h-64 w-auto rounded-lg object-cover"
            />
          )}
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
          <Button size="lg" onClick={() => setPhase("playing")}>
            เริ่มทำแบบทดสอบ!
          </Button>
        </div>
      )}

      {phase === "playing" && questions[index] && (
        <div className="flex flex-1 flex-col gap-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(index / questions.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            ข้อ {index + 1} / {questions.length}
          </p>
          <h2 className="text-xl font-semibold">{questions[index].promptText}</h2>
          {questions[index].mediaUrl && (
            <img
              src={questions[index].mediaUrl!}
              alt=""
              className="max-h-56 w-auto self-center rounded-lg object-cover"
            />
          )}
          <div className="flex flex-col gap-2">
            {questions[index].choices.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                disabled={pending}
                onClick={() => choose(questions[index].id, c.id)}
              >
                {c.mediaUrl && (
                  <img src={c.mediaUrl} alt="" className="mr-2 h-10 w-10 rounded object-cover" />
                )}
                {c.labelText}
              </Button>
            ))}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <ResultScreen publicId={publicId} quizTitle={title} result={result} />
      )}
    </main>
  );
}

function ResultScreen({
  publicId,
  quizTitle,
  result,
}: {
  publicId: string;
  quizTitle: string;
  result: PlayResult;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/quiz/${publicId}`
      : "";
  const shareText =
    result.shareText || `ฉันได้ผลลัพธ์ "${result.title}" จาก ${quizTitle}`;

  const enc = encodeURIComponent;
  const links = {
    line: `https://social-plugins.line.me/lineit/share?url=${enc(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`,
  };

  async function copyLink() {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function nativeShare() {
    if (navigator.share) {
      await navigator.share({ title: quizTitle, text: shareText, url: shareUrl });
    } else {
      await copyLink();
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">ผลลัพธ์ของคุณคือ</p>
      {result.mediaUrl && (
        <img
          src={result.mediaUrl}
          alt=""
          className="max-h-64 w-auto rounded-lg object-cover"
        />
      )}
      <h1 className="text-3xl font-bold">{result.title}</h1>
      {result.description && (
        <p className="max-w-md text-muted-foreground">{result.description}</p>
      )}

      {result.showProbabilityBar && result.distribution.length > 0 && (
        <div className="mt-2 w-full max-w-sm space-y-1.5 text-left">
          {result.distribution.map((d) => (
            <div key={d.title}>
              <div className="flex justify-between text-xs">
                <span>{d.title}</span>
                <span>{d.pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={nativeShare}>
          แชร์
        </Button>
        <ShareLink href={links.line} label="LINE" />
        <ShareLink href={links.facebook} label="Facebook" />
        <ShareLink href={links.x} label="X" />
        <Button variant="outline" size="sm" onClick={copyLink}>
          {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
        </Button>
      </div>
    </div>
  );
}

function ShareLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
    >
      {label}
    </a>
  );
}
