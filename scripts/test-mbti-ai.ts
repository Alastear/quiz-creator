// ทดสอบเส้นทาง AI ตัดสิน MBTI จริง (เรียก Gemini จริง เขียน play ลง DB จริง)
// รัน: pnpm tsx --env-file=.env.local scripts/test-mbti-ai.ts [TYPE]
//
// จำลองคนที่ตอบชัดเจนไปทาง TYPE ที่ระบุ แล้วดูว่า AI ตัดสินตรงไหม
// (ตอบ "ใช่เลย" เมื่อประโยคชี้ไปทางขั้วของ TYPE, "ไม่เลย" เมื่อชี้ไปทางตรงข้าม)
import postgres from "postgres";
import { submitPlay } from "@/lib/actions/play";

import { FUNCTION_STACK, type MbtiType } from "@/lib/mbti";

// จำลองคนของชนิดนั้นตามลำดับ stack จริง: ถนัดฟังก์ชันหลัก/รอง อ่อนฟังก์ชันด้อย/เงา
// index ของตัวเลือก: 0=ใช่เลย 1=ค่อนข้างใช่ 2=กลาง ๆ 3=ค่อนข้างไม่ใช่ 4=ไม่เลย
const ANSWER_BY_POSITION = [0, 1, 2, 3];
const ANSWER_SHADOW = 4;

function answerIndexFor(type: MbtiType, facet: string | null): number {
  if (!facet) return 2;
  const at = FUNCTION_STACK[type].indexOf(facet as never);
  return at >= 0 ? ANSWER_BY_POSITION[at] : ANSWER_SHADOW;
}

async function main() {
  const target = (process.argv[2] ?? "INTJ").toUpperCase();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const [quiz] = await sql`
    select id, public_id, title from quizzes where public_id = 'mbti' limit 1`;
  if (!quiz) throw new Error("ไม่พบ quiz mbti");

  const questions = await sql`
    select id, kind, prompt_text, facet from questions
    where quiz_id = ${quiz.id} order by order_index`;

  const answers: { questionId: string; choiceId?: string; text?: string }[] = [];
  const spread = [0, 0, 0, 0, 0];

  for (const q of questions) {
    if (q.kind === "text") {
      answers.push({
        questionId: q.id,
        text: "ชอบวางแผนล่วงหน้าเป็นขั้นเป็นตอน คิดเงียบ ๆ คนเดียวจนตกผลึกก่อนค่อยลงมือ และให้เหตุผลนำความรู้สึกเสมอ",
      });
      continue;
    }
    const cs = await sql`
      select id from choices
      where question_id = ${q.id} order by order_index`;
    const idx = answerIndexFor(target as MbtiType, q.facet);
    answers.push({ questionId: q.id, choiceId: cs[idx].id });
    spread[idx]++;
  }

  const LABELS = ["ใช่เลย", "ค่อนข้างใช่", "กลาง ๆ", "ค่อนข้างไม่", "ไม่เลย"];
  console.log(
    `จำลองคนแบบ ${target} ตาม stack ${FUNCTION_STACK[target as MbtiType].join("-")} — ` +
      spread.map((n, i) => `${LABELS[i]} ${n}`).join(" · "),
  );
  console.log("กำลังเรียก Gemini…\n");

  const t0 = Date.now();
  const res = await submitPlay(quiz.public_id, answers);
  const ms = Date.now() - t0;

  if (!res.ok) {
    console.error(`✗ ไม่สำเร็จ (${ms}ms): ${res.error}`);
    await sql.end();
    process.exit(1);
  }

  const r = res.result;
  console.log(`✓ สำเร็จใน ${(ms / 1000).toFixed(1)}s`);
  console.log(`ผลลัพธ์: ${r.title}`);
  console.log(`ตรงเป้า: ${r.mbti?.type === target ? "ใช่ ✓" : "ไม่ตรง ✗"} (จำลอง ${target})`);
  console.log("\nอันดับความเข้ากัน:");
  for (const [i, m] of (r.mbti?.ranking ?? []).entries())
    console.log(`  ${i + 1}. ${m.type}  ${String(m.fit).padStart(3)}%  ${m.title}`);
  console.log(`รูปการ์ด: ${r.mediaUrl ? "มี" : "ไม่มี"}`);

  console.log("\nมิติ:");
  for (const d of r.mbti?.dimensions ?? [])
    console.log(`  ${d.axis.padEnd(5)} → ${d.pick}  ${d.strength}%`);

  console.log("\nCognitive function:");
  for (const f of r.mbti?.functions ?? [])
    console.log(
      `  ${f.code}  ${String(f.strength).padStart(3)}%  ${(f.stackLabel ?? "-").padEnd(14)} ${f.nick}`,
    );

  console.log("\nบทวิเคราะห์:");
  console.log((r.aiAnalysis ?? "(ไม่มี)").split("\n").map((l) => "  " + l).join("\n"));

  const [play] = await sql`
    select ai_verdict is not null as has_verdict, ai_analysis is not null as has_text
    from plays where quiz_id = ${quiz.id} order by created_at desc limit 1`;
  console.log(
    `\nบันทึกลง DB: ai_verdict=${play.has_verdict} ai_analysis=${play.has_text}`,
  );

  await sql.end();
  process.exit(0);
}

main();
