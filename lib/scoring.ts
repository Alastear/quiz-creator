// Scoring engine (DESIGN.md ข้อ 4.3) — pure functions, ไม่พึ่ง DB จึงเทสต์ง่าย
// รองรับ archetype + range (branching: Phase 3.5)

export type ResultLogic = "archetype" | "range" | "branching";

export type ScoringChoice = {
  /** archetype: { "<result_key>": points } */
  scoreMap: Record<string, number>;
  /** range: แต้มของช้อยนี้ */
  points: number;
};

export type ScoringResult = {
  resultKey: string;
  orderIndex: number;
  scoreMin: number | null;
  scoreMax: number | null;
};

export type ScoreOutcome = {
  resultKey: string;
  /** range เท่านั้น */
  total?: number;
  /** archetype: % ความใกล้เคียงของแต่ละ result (สำหรับ probability bar) */
  distribution?: { resultKey: string; pct: number }[];
};

/** archetype: รวมคะแนนต่อ result key → สูงสุดชนะ (เสมอ → orderIndex น้อยกว่าชนะ) */
export function scoreArchetype(
  chosen: ScoringChoice[],
  results: ScoringResult[],
): ScoreOutcome {
  const totals = new Map<string, number>();
  for (const r of results) totals.set(r.resultKey, 0);

  for (const c of chosen) {
    for (const [key, pts] of Object.entries(c.scoreMap ?? {})) {
      if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + pts);
    }
  }

  // หาผู้ชนะแบบ deterministic: คะแนนสูงสุด, เสมอใช้ orderIndex น้อยสุด
  const ordered = [...results].sort((a, b) => a.orderIndex - b.orderIndex);
  let winner = ordered[0];
  for (const r of ordered) {
    if ((totals.get(r.resultKey) ?? 0) > (totals.get(winner.resultKey) ?? 0)) {
      winner = r;
    }
  }

  const sum = [...totals.values()].reduce((a, b) => a + Math.max(0, b), 0);
  const distribution = ordered.map((r) => {
    const v = Math.max(0, totals.get(r.resultKey) ?? 0);
    return { resultKey: r.resultKey, pct: sum > 0 ? Math.round((v / sum) * 100) : 0 };
  });

  return { resultKey: winner.resultKey, distribution };
}

/** range: รวมแต้ม → result ที่ช่วง [min,max] ครอบคลุม (fallback: ใกล้สุด) */
export function scoreRange(
  chosen: ScoringChoice[],
  results: ScoringResult[],
): ScoreOutcome {
  const total = chosen.reduce((a, c) => a + (c.points ?? 0), 0);

  const ordered = [...results].sort((a, b) => a.orderIndex - b.orderIndex);
  const inRange = ordered.find(
    (r) => total >= (r.scoreMin ?? 0) && total <= (r.scoreMax ?? 0),
  );
  if (inRange) return { resultKey: inRange.resultKey, total };

  // fallback: ถ้าต่ำกว่าทุกช่วง → ช่วงต่ำสุด, สูงกว่า → ช่วงสูงสุด
  const byMin = [...ordered].sort(
    (a, b) => (a.scoreMin ?? 0) - (b.scoreMin ?? 0),
  );
  const lowest = byMin[0];
  const highest = byMin[byMin.length - 1];
  const pick =
    total < (lowest?.scoreMin ?? 0) ? lowest : highest ?? ordered[0];
  return { resultKey: pick.resultKey, total };
}

export function computeResult(
  logic: ResultLogic,
  chosen: ScoringChoice[],
  results: ScoringResult[],
): ScoreOutcome {
  if (results.length === 0) throw new Error("quiz ไม่มีผลลัพธ์");
  if (logic === "range") return scoreRange(chosen, results);
  // branching ยังไม่รองรับ → ใช้ archetype ไปก่อน
  return scoreArchetype(chosen, results);
}

// ---- validation ก่อน publish (DESIGN.md ข้อ 5) ----
export type QuestionKind = "choice" | "text" | "story";
export type ValidationInput = {
  logic: ResultLogic;
  questions: { kind: QuestionKind; choices: ScoringChoice[] }[];
  results: ScoringResult[];
};

export function validateForPublish(input: ValidationInput): string[] {
  const errors: string[] = [];
  const { logic, questions, results } = input;

  const choiceQuestions = questions.filter((q) => q.kind === "choice");

  if (choiceQuestions.length < 1)
    errors.push("ต้องมีคำถามแบบเลือกตอบอย่างน้อย 1 ข้อ");
  if (results.length < 2) errors.push("ต้องมีผลลัพธ์อย่างน้อย 2 แบบ");
  // เฉพาะ segment แบบ choice ที่ต้องมีตัวเลือก ≥ 2
  for (const [i, q] of questions.entries()) {
    if (q.kind === "choice" && q.choices.length < 2)
      errors.push(`คำถามข้อ ${i + 1} ต้องมีตัวเลือกอย่างน้อย 2 ตัว`);
  }

  if (logic === "archetype") {
    // ทุก result ต้องมีโอกาสได้คะแนนอย่างน้อย 1 ทาง
    const reachable = new Set<string>();
    for (const q of choiceQuestions)
      for (const c of q.choices)
        for (const [key, pts] of Object.entries(c.scoreMap ?? {}))
          if (pts > 0) reachable.add(key);
    for (const r of results)
      if (!reachable.has(r.resultKey))
        errors.push(`ผลลัพธ์ "${r.resultKey}" ไม่มีทางได้คะแนน`);
  }

  if (logic === "range") {
    for (const r of results) {
      // มองค่าว่างเป็น 0 — ผิดเฉพาะตอน "ต่ำสุด > สูงสุด" เท่านั้น
      const min = r.scoreMin ?? 0;
      const max = r.scoreMax ?? 0;
      if (min > max)
        errors.push(
          `ผลลัพธ์ "${r.resultKey}" ช่วงคะแนนไม่ถูกต้อง (ต่ำสุดมากกว่าสูงสุด)`,
        );
    }
  }

  return errors;
}
