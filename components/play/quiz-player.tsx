"use client";

import { useState, useTransition, useRef } from "react";
import { toPng } from "html-to-image";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savingImg, setSavingImg] = useState(false);

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

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 1600);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    flash("คัดลอกลิงก์แล้ว ✓");
    setShareOpen(false);
  }

  function openLink(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
    setShareOpen(false);
  }

  async function nativeShare() {
    setShareOpen(false);
    if (navigator.share) {
      await navigator
        .share({ title: quizTitle, text: shareText, url: shareUrl })
        .catch(() => {});
    } else {
      await copyLink();
    }
  }

  async function saveImage() {
    if (!cardRef.current) return;
    setSavingImg(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `quibby-${result.resultKey}.png`;
      a.click();
    } catch {
      flash("บันทึกรูปไม่สำเร็จ (รูปภายนอกบางรูปอาจติดข้อจำกัด)");
    } finally {
      setSavingImg(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      {/* ส่วนที่จะถูกแคปเป็นรูป */}
      <div
        ref={cardRef}
        className="flex w-full flex-col items-center gap-3 rounded-xl bg-background p-6 text-center"
      >
        <p className="text-sm text-muted-foreground">ผลลัพธ์ของคุณคือ</p>
        {result.mediaUrl && (
          <img
            src={result.mediaUrl}
            alt=""
            crossOrigin="anonymous"
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
        <p className="pt-2 text-xs text-muted-foreground">เล่นที่ Quibby</p>
      </div>

      {toast && <p className="text-sm text-muted-foreground">{toast}</p>}

      <div className="mt-2 flex items-center gap-2">
        <Button onClick={saveImage} disabled={savingImg}>
          {savingImg ? "กำลังบันทึก…" : "บันทึกรูปผลลัพธ์"}
        </Button>

        {/* ปุ่มแชร์เดียว → เลือกแพลตฟอร์ม */}
        <div className="relative">
          <Button variant="outline" onClick={() => setShareOpen((v) => !v)}>
            แชร์ ▾
          </Button>
          {shareOpen && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-label="ปิด"
                onClick={() => setShareOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border bg-background shadow-md">
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <MenuItem label="แชร์ผ่านระบบ…" onClick={nativeShare} />
                )}
                <MenuItem label="LINE" onClick={() => openLink(links.line)} />
                <MenuItem label="Facebook" onClick={() => openLink(links.facebook)} />
                <MenuItem label="X (Twitter)" onClick={() => openLink(links.x)} />
                <MenuItem label="Discord (คัดลอกลิงก์)" onClick={copyLink} />
                <MenuItem label="คัดลอกลิงก์" onClick={copyLink} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
    >
      {label}
    </button>
  );
}
