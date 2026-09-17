"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitPlay, type PlayResult } from "@/lib/actions/play";
import { QUIZ_FONTS, type QuizFontKey } from "@/lib/fonts";
import { DIMENSION_AXES } from "@/lib/mbti";
import { Button } from "@/components/ui/button";

type PlayChoice = { id: string; labelText: string; mediaUrl: string | null };
type PlayQuestion = {
  id: string;
  kind: "choice" | "text" | "story";
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
  // เก็บคำตอบ: choice → {choiceId}, text → {text}
  const [answers, setAnswers] = useState<
    Record<string, { choiceId?: string; text?: string }>
  >({});
  const [textVal, setTextVal] = useState("");
  // ข้อความผิดพลาดตอนส่งคำตอบ (quiz แนว MBTI พึ่ง AI จึงพลาดได้จริง)
  const [submitError, setSubmitError] = useState<string | null>(null);
  // เก็บคำตอบชุดล่าสุดไว้ให้กด "ลองอีกครั้ง" ได้โดยไม่ต้องเล่นใหม่
  const [lastPayload, setLastPayload] = useState<
    { questionId: string; choiceId?: string; text?: string }[] | null
  >(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [pending, startTransition] = useTransition();

  const font =
    QUIZ_FONTS[(fontKey as QuizFontKey) in QUIZ_FONTS ? (fontKey as QuizFontKey) : "sarabun"];

  // บันทึกคำตอบ (ถ้ามี) แล้วไปต่อ; ถ้าเป็นข้อสุดท้าย → ส่ง
  function advance(answer?: { choiceId?: string; text?: string }) {
    const q = questions[index];
    const next = answer ? { ...answers, [q.id]: answer } : answers;
    setAnswers(next);
    setTextVal("");
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      const payload = Object.entries(next).map(([qid, a]) => ({
        questionId: qid,
        ...a,
      }));
      setLastPayload(payload);
      send(payload);
    }
  }

  function send(payload: { questionId: string; choiceId?: string; text?: string }[]) {
    startTransition(async () => {
      setSubmitError(null);
      try {
        const r = await submitPlay(publicId, payload);
        if (!r.ok) {
          setSubmitError(r.error);
          return;
        }
        setResult(r.result);
        setPhase("result");
      } catch {
        setSubmitError("ส่งคำตอบไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10"
      style={{ fontFamily: font.varName }}
    >
      {/* ปุ่มกลับหน้าแรก (อยู่ทุกหน้าของการเล่น) */}
      <div className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← หน้าแรก
        </Link>
      </div>

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
          <h2 className="whitespace-pre-line text-xl font-semibold">
            {questions[index].promptText}
          </h2>
          {questions[index].mediaUrl && (
            <img
              src={questions[index].mediaUrl!}
              alt=""
              className="max-h-56 w-auto self-center rounded-lg object-cover"
            />
          )}

          {/* choice */}
          {questions[index].kind === "choice" && (
            <div className="flex flex-col gap-2">
              {questions[index].choices.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal py-3 text-left"
                  disabled={pending}
                  onClick={() => advance({ choiceId: c.id })}
                >
                  {c.mediaUrl && (
                    <img src={c.mediaUrl} alt="" className="mr-2 h-10 w-10 rounded object-cover" />
                  )}
                  {c.labelText}
                </Button>
              ))}
            </div>
          )}

          {/* text */}
          {questions[index].kind === "text" && (
            <div className="flex flex-col gap-3">
              <textarea
                className="min-h-24 w-full rounded-md border bg-background p-3 text-base"
                placeholder="พิมพ์คำตอบของคุณ…"
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
              />
              <Button
                size="lg"
                disabled={pending}
                onClick={() => advance(textVal.trim() ? { text: textVal.trim() } : undefined)}
              >
                {index + 1 < questions.length ? "ถัดไป" : "ดูผลลัพธ์"}
              </Button>
            </div>
          )}

          {/* story */}
          {questions[index].kind === "story" && (
            <Button size="lg" disabled={pending} onClick={() => advance()}>
              {index + 1 < questions.length ? "ถัดไป" : "ดูผลลัพธ์"}
            </Button>
          )}

          {/* ส่งคำตอบไม่สำเร็จ — ให้กดซ้ำได้โดยไม่ต้องตอบใหม่ทั้งชุด */}
          {submitError && (
            <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-left">
              <p className="text-sm text-destructive">{submitError}</p>
              {lastPayload && (
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={pending}
                  onClick={() => send(lastPayload)}
                >
                  {pending ? "กำลังส่ง…" : "ลองอีกครั้ง"}
                </Button>
              )}
            </div>
          )}

          {pending && !submitError && (
            <p className="text-sm text-muted-foreground">กำลังประมวลผล…</p>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <ResultScreen
          publicId={publicId}
          quizTitle={title}
          result={result}
          onRestart={() => {
            setPhase("cover");
            setIndex(0);
            setAnswers({});
            setTextVal("");
            setResult(null);
          }}
        />
      )}
    </main>
  );
}

function ResultScreen({
  publicId,
  quizTitle,
  result,
  onRestart,
}: {
  publicId: string;
  quizTitle: string;
  result: PlayResult;
  onRestart: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // โหลดการ์ดผลลัพธ์เป็น PNG ที่ render ฝั่ง server (ไม่มีปัญหา CORS)
  const cardUrl = `/api/result-card?quiz=${encodeURIComponent(publicId)}&r=${encodeURIComponent(result.resultKey)}`;

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

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {result.mbti ? "ใกล้เคียงคุณมากที่สุด" : "ผลลัพธ์ของคุณคือ"}
        </p>
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
        <p className="pt-2 text-xs text-muted-foreground">เล่นที่ Quibby</p>
      </div>

      {/* รายละเอียด MBTI — เฉพาะ quiz ที่ให้ AI ตัดสินผล */}
      {result.mbti && (
        <section className="w-full rounded-xl border bg-background p-5 text-left">
          <h2 className="mb-1 text-sm font-semibold">
            MBTI ที่เข้ากับคุณ เรียงตามความใกล้เคียง
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            AI ให้คะแนน cognitive function ทั้ง 8 ตัวจากคำตอบของคุณ แล้วระบบคำนวณว่า
            โปรไฟล์นี้ใกล้กับ MBTI แบบไหนบ้าง — คนส่วนใหญ่คาบเกี่ยวหลายแบบ
            ไม่ได้เป็นแบบใดแบบหนึ่งเต็มร้อย
          </p>

          <ol className="mb-6 space-y-2">
            {result.mbti.ranking.map((m, i) => (
              <li key={m.type}>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className={i === 0 ? "font-bold" : "font-medium"}>
                    {m.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {m.title}
                  </span>
                  <span
                    className={
                      i === 0 ? "text-sm font-semibold" : "text-xs text-muted-foreground"
                    }
                  >
                    {m.fit}%
                  </span>
                </div>
                <div className="mt-1 ml-6 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${m.fit}%`, opacity: i === 0 ? 1 : 0.45 }}
                  />
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mb-3 text-sm font-semibold">รายมิติของอันดับ 1</h3>

          {/* 4 มิติ — แถบเอนไปทางฝั่งที่ชนะตามน้ำหนักที่ AI ให้ */}
          <div className="space-y-3">
            {result.mbti.dimensions.map((d) => {
              const ax = DIMENSION_AXES.find((a) => a.axis === d.axis);
              if (!ax) return null;
              const leftWins = d.pick === ax.left;
              const leftPct = leftWins ? d.strength : 100 - d.strength;
              return (
                <div key={d.axis}>
                  <div className="flex justify-between text-xs">
                    <span className={leftWins ? "font-semibold" : "text-muted-foreground"}>
                      {ax.left} · {ax.leftName}
                    </span>
                    <span className={!leftWins ? "font-semibold" : "text-muted-foreground"}>
                      {ax.rightName} · {ax.right}
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${leftPct}%` }} />
                    <div className="h-full bg-primary/25" style={{ width: `${100 - leftPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* cognitive function เรียงจากเด่นสุด */}
          <h3 className="mt-6 mb-1 text-sm font-semibold">
            คะแนน cognitive function ทั้ง 8 ตัว
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            วัดแยกกันอิสระ ไม่ได้บังคับให้เข้ารูป stack ของชนิดใดชนิดหนึ่ง
          </p>
          <ol className="space-y-2">
            {result.mbti.functions.map((f, i) => (
              <li
                key={f.code}
                className="flex gap-3 rounded-lg border bg-muted/30 p-3"
              >
                <span className="w-7 shrink-0 text-center text-base font-bold">
                  {f.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{f.nick || f.thai}</span>
                    {f.stackLabel && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {f.stackLabel}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {f.strength}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${f.strength}%`, opacity: 1 - i * 0.08 }}
                    />
                  </div>
                  {f.note && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{f.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            ป้าย &ldquo;ฟังก์ชันหลัก/รอง/ตติยะ/ด้อย&rdquo; คือตำแหน่งตามทฤษฎีของ{" "}
            {result.mbti.type} ส่วนตัวเลขคือคะแนนที่ AI ให้จากคำตอบจริงของคุณ —
            อ่านสนุก ๆ ไม่ใช่เครื่องมือวินิจฉัย
          </p>
        </section>
      )}

      {/* บทวิเคราะห์ AI — โผล่เฉพาะ quiz ที่เปิดไว้และเรียกสำเร็จ */}
      {result.aiAnalysis && (
        <section className="w-full rounded-xl border bg-background p-5 text-left">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden>✨</span>
            บทวิเคราะห์เพิ่มเติมจาก AI
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {result.aiAnalysis}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            เขียนโดย AI จากคำตอบที่คุณพิมพ์ — อ่านสนุก ๆ ไม่ใช่คำวินิจฉัย
          </p>
        </section>
      )}

      {toast && <p className="text-sm text-muted-foreground">{toast}</p>}

      <div className="mt-2 flex items-center gap-2">
        <Button render={<a href={cardUrl} download />}>บันทึกรูปผลลัพธ์</Button>

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

      {/* ทำอีกครั้ง / กลับหน้าแรก */}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onRestart}>
          ↻ ทำอีกครั้ง
        </Button>
        <Button variant="ghost" render={<Link href="/" />}>
          หาแบบทดสอบอื่น
        </Button>
      </div>

      {/* Creator Tip Jar (DESIGN.md ข้อ 10.5) — QR อย่างเดียว, แพลตฟอร์มไม่ยุ่งกับเงิน */}
      {result.creatorTip && (
        <div className="mt-4 w-full max-w-sm rounded-xl border p-4 text-center">
          <p className="font-medium">สนับสนุนผู้สร้าง</p>
          <img
            src={result.creatorTip.qrUrl}
            alt="QR donate"
            className="mx-auto mt-3 h-48 w-48 rounded object-contain"
          />
          <p className="mt-3 text-[11px] text-muted-foreground">
            QR นี้เป็นของผู้สร้าง quiz เอง Quibby ไม่เกี่ยวข้องกับการโอนเงิน
            โปรดตรวจสอบก่อนโอน
          </p>
        </div>
      )}
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
