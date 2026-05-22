import assert from "node:assert";
import {
  scoreArchetype,
  scoreRange,
  validateForPublish,
  type ScoringResult,
} from "../lib/scoring.ts";

const results: ScoringResult[] = [
  { resultKey: "rabbit", orderIndex: 0, scoreMin: 0, scoreMax: 2 },
  { resultKey: "cat", orderIndex: 1, scoreMin: 3, scoreMax: 5 },
];

// archetype: rabbit ได้ 3 (2+1), cat ได้ 1 → rabbit ชนะ
const a = scoreArchetype(
  [
    { scoreMap: { rabbit: 2 }, points: 0 },
    { scoreMap: { rabbit: 1, cat: 1 }, points: 0 },
  ],
  results,
);
assert.equal(a.resultKey, "rabbit", "archetype winner");
assert.deepEqual(
  a.distribution?.map((d) => d.pct),
  [75, 25],
  "archetype distribution",
);

// archetype tie → orderIndex น้อยกว่า (rabbit) ชนะ
const tie = scoreArchetype(
  [{ scoreMap: { rabbit: 1, cat: 1 }, points: 0 }],
  results,
);
assert.equal(tie.resultKey, "rabbit", "archetype tie-break");

// range: รวมแต้ม 4 → อยู่ในช่วง cat (3-5)
const r = scoreRange(
  [
    { scoreMap: {}, points: 2 },
    { scoreMap: {}, points: 2 },
  ],
  results,
);
assert.equal(r.resultKey, "cat", "range in-range");
assert.equal(r.total, 4, "range total");

// range fallback: 99 สูงกว่าทุกช่วง → ช่วงสูงสุด (cat)
assert.equal(
  scoreRange([{ scoreMap: {}, points: 99 }], results).resultKey,
  "cat",
  "range fallback high",
);

// validation: archetype ที่ cat ไม่มีทางได้คะแนน → error
const errs = validateForPublish({
  logic: "archetype",
  questions: [{ choices: [{ scoreMap: { rabbit: 1 }, points: 0 }, { scoreMap: { rabbit: 2 }, points: 0 }] }],
  results,
});
assert.ok(
  errs.some((e) => e.includes("cat")),
  "validation catches unreachable result",
);

console.log("✓ scoring engine: all assertions passed");
