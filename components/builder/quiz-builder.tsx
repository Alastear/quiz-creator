"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nanoid } from "nanoid";
import { saveQuiz, publishQuiz, unpublishQuiz } from "@/lib/actions/quiz";
import type { QuizDraft } from "@/lib/validation/quiz";
import { QUIZ_FONTS, type QuizFontKey } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  quizId: string;
  publicId: string;
  status: string;
  initial: QuizDraft;
};

export function QuizBuilder({ quizId, publicId, status, initial }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuizDraft>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const isRange = draft.resultLogic === "range";

  function update(fn: (d: QuizDraft) => void) {
    setDraft((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });
  }

  async function doSave() {
    setMsg(null);
    setErrors([]);
    const res = await saveQuiz(quizId, draft);
    setMsg(res.ok ? "บันทึกแล้ว ✓" : `บันทึกไม่สำเร็จ: ${res.error}`);
    return res.ok;
  }

  function onSave() {
    startTransition(async () => {
      await doSave();
    });
  }

  function onPublish() {
    startTransition(async () => {
      if (!(await doSave())) return;
      const res = await publishQuiz(quizId);
      if (res.ok) {
        setMsg("เผยแพร่แล้ว 🎉");
        router.refresh();
      } else {
        setErrors(res.errors ?? []);
      }
    });
  }

  function onUnpublish() {
    startTransition(async () => {
      await unpublishQuiz(quizId);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      {/* top bar */}
      <div className="sticky top-0 z-10 -mx-6 mb-6 flex items-center gap-3 border-b bg-background/90 px-6 py-3 backdrop-blur">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← แดชบอร์ด
        </Link>
        <span className="ml-auto rounded-full border px-2 py-0.5 text-xs">
          {status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
        </span>
        {status === "published" && (
          <Button variant="outline" size="sm" render={<Link href={`/quiz/${publicId}`} target="_blank" />}>
            เปิดดู
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onSave} disabled={pending}>
          บันทึก
        </Button>
        {status === "published" ? (
          <Button size="sm" variant="secondary" onClick={onUnpublish} disabled={pending}>
            ยกเลิกเผยแพร่
          </Button>
        ) : (
          <Button size="sm" onClick={onPublish} disabled={pending}>
            เผยแพร่
          </Button>
        )}
      </div>

      {msg && <p className="mb-3 text-sm text-muted-foreground">{msg}</p>}
      {errors.length > 0 && (
        <ul className="mb-4 list-disc rounded-md border border-destructive/40 bg-destructive/5 p-3 pl-8 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {/* ---- Setup ---- */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">ตั้งค่า quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="ชื่อ quiz">
            <Input
              value={draft.title}
              onChange={(e) => update((d) => void (d.title = e.target.value))}
            />
          </Field>
          <Field label="คำโปรย (ไม่บังคับ)">
            <Input
              value={draft.description ?? ""}
              onChange={(e) =>
                update((d) => void (d.description = e.target.value))
              }
            />
          </Field>
          <Field label="รูปปก (URL, ไม่บังคับ)">
            <Input
              value={draft.coverImageUrl ?? ""}
              placeholder="https://..."
              onChange={(e) =>
                update((d) => void (d.coverImageUrl = e.target.value))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="โหมดผลลัพธ์">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={draft.resultLogic}
                onChange={(e) =>
                  update(
                    (d) =>
                      void (d.resultLogic = e.target.value as "archetype" | "range"),
                  )
                }
              >
                <option value="archetype">ทายนิสัย (คะแนนสูงสุดชนะ)</option>
                <option value="range">ช่วงคะแนน (รวมแต้ม)</option>
              </select>
            </Field>
            <Field label="ฟอนต์">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={draft.theme.fontFamily ?? "sarabun"}
                onChange={(e) =>
                  update((d) => void (d.theme.fontFamily = e.target.value))
                }
              >
                {Object.entries(QUIZ_FONTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.settings.showProbabilityBar ?? false}
              onChange={(e) =>
                update(
                  (d) => void (d.settings.showProbabilityBar = e.target.checked),
                )
              }
            />
            แสดงแถบ % ความใกล้เคียงผลลัพธ์อื่น (probability bar)
          </label>
        </CardContent>
      </Card>

      {/* ---- Results ---- */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">ผลลัพธ์ ({draft.results.length})</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={draft.results.length >= 10}
            onClick={() =>
              update((d) =>
                void d.results.push({
                  resultKey: nanoid(6),
                  title: `ผลลัพธ์ใหม่`,
                  mediaType: "none",
                  scoreMin: 0,
                  scoreMax: 0,
                }),
              )
            }
          >
            + เพิ่มผลลัพธ์
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.results.map((r, i) => (
            <div key={r.resultKey} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={r.title}
                  placeholder="ชื่อผลลัพธ์"
                  onChange={(e) =>
                    update((d) => void (d.results[i].title = e.target.value))
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={draft.results.length <= 2}
                  onClick={() =>
                    update((d) => void d.results.splice(i, 1))
                  }
                >
                  ลบ
                </Button>
              </div>
              <Input
                value={r.description ?? ""}
                placeholder="คำบรรยายผลลัพธ์"
                onChange={(e) =>
                  update((d) => void (d.results[i].description = e.target.value))
                }
              />
              <Input
                value={r.mediaUrl ?? ""}
                placeholder="รูปผลลัพธ์ (URL)"
                onChange={(e) =>
                  update((d) => {
                    d.results[i].mediaUrl = e.target.value;
                    d.results[i].mediaType = e.target.value ? "image" : "none";
                  })
                }
              />
              {isRange && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">ช่วงคะแนน</span>
                  <Input
                    type="number"
                    className="w-20"
                    value={r.scoreMin ?? 0}
                    onChange={(e) =>
                      update(
                        (d) =>
                          void (d.results[i].scoreMin = Number(e.target.value)),
                      )
                    }
                  />
                  <span>–</span>
                  <Input
                    type="number"
                    className="w-20"
                    value={r.scoreMax ?? 0}
                    onChange={(e) =>
                      update(
                        (d) =>
                          void (d.results[i].scoreMax = Number(e.target.value)),
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---- Questions ---- */}
      <Card className="mb-10">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">คำถาม ({draft.questions.length})</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={draft.questions.length >= 50}
            onClick={() =>
              update((d) =>
                void d.questions.push({
                  promptText: "คำถามใหม่",
                  mediaType: "none",
                  choices: [
                    { labelText: "ตัวเลือก 1", mediaType: "none", scoreMap: {}, points: 0 },
                    { labelText: "ตัวเลือก 2", mediaType: "none", scoreMap: {}, points: 0 },
                  ],
                }),
              )
            }
          >
            + เพิ่มคำถาม
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {draft.questions.map((q, qi) => (
            <div key={qi} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">ข้อ {qi + 1}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" disabled={qi === 0}
                    onClick={() => update((d) => { const [m] = d.questions.splice(qi, 1); d.questions.splice(qi - 1, 0, m); })}>↑</Button>
                  <Button size="sm" variant="ghost" disabled={qi === draft.questions.length - 1}
                    onClick={() => update((d) => { const [m] = d.questions.splice(qi, 1); d.questions.splice(qi + 1, 0, m); })}>↓</Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => update((d) => void d.questions.splice(qi, 1))}>ลบ</Button>
                </div>
              </div>
              <Input
                value={q.promptText}
                placeholder="คำถาม"
                onChange={(e) =>
                  update((d) => void (d.questions[qi].promptText = e.target.value))
                }
              />
              <Input
                value={q.mediaUrl ?? ""}
                placeholder="รูปประกอบคำถาม (URL, ไม่บังคับ)"
                onChange={(e) =>
                  update((d) => {
                    d.questions[qi].mediaUrl = e.target.value;
                    d.questions[qi].mediaType = e.target.value ? "image" : "none";
                  })
                }
              />

              <div className="space-y-2 pl-3">
                {q.choices.map((c, ci) => (
                  <div key={ci} className="rounded border bg-muted/30 p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.labelText}
                        placeholder={`ตัวเลือก ${ci + 1}`}
                        onChange={(e) =>
                          update(
                            (d) =>
                              void (d.questions[qi].choices[ci].labelText =
                                e.target.value),
                          )
                        }
                      />
                      <Button size="sm" variant="ghost" disabled={q.choices.length <= 2}
                        onClick={() => update((d) => void d.questions[qi].choices.splice(ci, 1))}>ลบ</Button>
                    </div>
                    {/* scoring */}
                    {isRange ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">แต้ม</span>
                        <Input type="number" className="w-24" value={c.points}
                          onChange={(e) => update((d) => void (d.questions[qi].choices[ci].points = Number(e.target.value)))} />
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {draft.results.map((r) => (
                          <label key={r.resultKey} className="flex items-center gap-1 text-xs">
                            <span className="text-muted-foreground">{r.title}</span>
                            <Input
                              type="number"
                              className="h-7 w-16"
                              value={c.scoreMap[r.resultKey] ?? 0}
                              onChange={(e) =>
                                update(
                                  (d) =>
                                    void (d.questions[qi].choices[ci].scoreMap[
                                      r.resultKey
                                    ] = Number(e.target.value)),
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" disabled={q.choices.length >= 6}
                  onClick={() => update((d) => void d.questions[qi].choices.push({ labelText: `ตัวเลือก ${q.choices.length + 1}`, mediaType: "none", scoreMap: {}, points: 0 }))}>
                  + ตัวเลือก
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
