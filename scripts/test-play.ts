// ทดสอบ submitPlay จริง (scoring ฝั่ง server + บันทึก play + playCount++)
// รัน: pnpm dlx tsx --env-file=.env.local scripts/test-play.ts <publicId>
import assert from "node:assert";
import postgres from "postgres";
import { submitPlay } from "@/lib/actions/play";

async function main() {
  const publicId = process.argv[2];
  if (!publicId) throw new Error("usage: test-play.ts <publicId>");

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const [quiz] =
    await sql`select id, play_count from quizzes where public_id = ${publicId}`;
  const qs =
    await sql`select id from questions where quiz_id = ${quiz.id} order by order_index`;
  const cs =
    await sql`select id, question_id, order_index from choices where question_id in ${sql(qs.map((q) => q.id))} order by order_index`;

  // เลือก "ช้อยแรก" ของทุกข้อ (map กระต่าย +2) → กระต่ายต้องชนะ 100%
  const answers = qs.map((q) => ({
    questionId: q.id,
    choiceId: cs.find((c) => c.question_id === q.id && c.order_index === 0)!.id,
  }));

  const before = Number(quiz.play_count);
  const result = await submitPlay(publicId, answers);

  assert.ok(
    result.title.includes("กระต่าย"),
    `expected rabbit, got ${result.title}`,
  );
  const rabbit = result.distribution.find((d) => d.title.includes("กระต่าย"));
  assert.equal(rabbit?.pct, 100, "rabbit should be 100%");

  const [after] =
    await sql`select play_count from quizzes where public_id = ${publicId}`;
  assert.equal(Number(after.play_count), before + 1, "playCount should increment");

  const [playRow] =
    await sql`select count(*)::int as n from plays where quiz_id = ${quiz.id}`;
  assert.ok(playRow.n >= 1, "play recorded");

  console.log(
    `✓ submitPlay: result="${result.title}" dist=${JSON.stringify(result.distribution)} playCount ${before}->${before + 1}`,
  );
  await sql.end();
  process.exit(0);
}

main();
