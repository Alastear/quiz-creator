// วัดว่า AI ให้คะแนนฟังก์ชัน "ตรงกับคำตอบที่ผู้เล่นกดจริง" แค่ไหน
// รัน: pnpm tsx --env-file=.env.local scripts/test-mbti-fidelity.ts [TYPE...]
//
// จำลองผู้เล่นที่ตอบตามลำดับ stack ของชนิดนั้นเป๊ะ ๆ แล้วเทียบ
// คะแนนที่ AI ให้ กับคะแนนที่ "ควรจะเป็น" ถ้านับจากคำตอบตรง ๆ
// ค่าคลาดเคลื่อนสูง = AI ไม่ได้อ่านคำตอบ แต่เดาจากภาพจำของชนิดที่คิดว่าใช่
import postgres from "postgres";
import { submitPlay } from "@/lib/actions/play";
import { FUNCTION_STACK, FUNCTION_CODES, type MbtiType } from "@/lib/mbti";

// ผู้เล่นจำลองตอบตามตำแหน่งใน stack: หลัก=ใช่เลย รอง=ค่อนข้างใช่ ตติยะ=กลาง ๆ ด้อย=ค่อนข้างไม่ใช่ เงา=ไม่เลย
const ANSWER_INDEX_BY_POSITION = [0, 1, 2, 3];
const ANSWER_INDEX_SHADOW = 4;
// คะแนน 0-100 ที่ "ควรได้" เมื่อทั้ง 10 ข้อของฟังก์ชันนั้นถูกตอบด้วยระดับเดียวกัน
const EXPECTED_BY_ANSWER = [92, 72, 50, 28, 8];

function answerIndexFor(type: MbtiType, facet: string | null): number {
  if (!facet) return 2;
  const at = FUNCTION_STACK[type].indexOf(facet as never);
  return at >= 0 ? ANSWER_INDEX_BY_POSITION[at] : ANSWER_INDEX_SHADOW;
}

async function main() {
  const targets = (
    process.argv.slice(2).length ? process.argv.slice(2) : ["INTJ", "ISTP", "ESFJ"]
  ).map((t) => t.toUpperCase() as MbtiType);

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [quiz] = await sql`
    select id, public_id from quizzes where public_id = 'mbti' limit 1`;
  const questions = await sql`
    select id, kind, facet from questions
    where quiz_id = ${quiz.id} order by order_index`;

  const choiceIds = new Map<string, string[]>();
  for (const q of questions) {
    if (q.kind !== "choice") continue;
    const cs = await sql`
      select id from choices where question_id = ${q.id} order by order_index`;
    choiceIds.set(
      q.id,
      cs.map((c) => c.id),
    );
  }

  const rows: string[] = [];
  let hit = 0;
  let totalErr = 0;
  let n = 0;

  for (const target of targets) {
    const answers = questions.map((q) => {
      if (q.kind === "text")
        return { questionId: q.id, text: "เล่าตามที่เป็นจริงในชีวิตประจำวันของฉัน ไม่ได้คิดอะไรมาก" };
      const idx = answerIndexFor(target, q.facet);
      return { questionId: q.id, choiceId: choiceIds.get(q.id)![idx] };
    });

    const res = await submitPlay(quiz.public_id, answers);
    if (!res.ok) {
      rows.push(`${target}: เรียกไม่สำเร็จ — ${res.error}`);
      continue;
    }
    const got = new Map(
      (res.result.mbti?.functions ?? []).map((f) => [f.code, f.strength]),
    );

    const diffs = FUNCTION_CODES.map((code) => {
      const idx = answerIndexFor(target, code);
      const expected = EXPECTED_BY_ANSWER[idx];
      const actual = got.get(code) ?? 0;
      return { code, expected, actual, err: Math.abs(actual - expected) };
    });

    const avgErr = diffs.reduce((a, d) => a + d.err, 0) / diffs.length;
    const worst = [...diffs].sort((a, b) => b.err - a.err)[0];
    const ok = res.result.mbti?.type === target;
    if (ok) hit++;
    totalErr += avgErr;
    n++;

    rows.push(
      `${ok ? "✓" : "✗"} ${target} → ${res.result.mbti?.type}  ` +
        `คลาดเคลื่อนเฉลี่ย ${avgErr.toFixed(0)} คะแนน · ` +
        `หนักสุด ${worst.code} (ควร ${worst.expected} ได้ ${worst.actual})`,
    );
    for (const d of diffs.filter((d) => d.err >= 25)) {
      rows.push(`      ${d.code}: ควร ${d.expected} แต่ได้ ${d.actual}`);
    }
  }

  console.log("\n── ความตรงระหว่างคำตอบที่กด กับคะแนนที่ AI ให้ ──");
  rows.forEach((r) => console.log(r));
  console.log(
    `\nทายชนิดถูก ${hit}/${n} · คลาดเคลื่อนเฉลี่ยรวม ${(totalErr / Math.max(1, n)).toFixed(0)} คะแนนต่อฟังก์ชัน`,
  );

  await sql.end();
  process.exit(0);
}

main();
