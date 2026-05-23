// ตรวจ Creator Tip Jar ไหลถึงผลลัพธ์: ตั้ง payout ให้เจ้าของ quiz แล้ว submitPlay
// pnpm dlx tsx --env-file=.env.local scripts/test-tip.ts <publicId>
import assert from "node:assert";
import postgres from "postgres";
import { submitPlay } from "@/lib/actions/play";

async function main() {
  const publicId = process.argv[2];
  if (!publicId) throw new Error("usage: test-tip.ts <publicId>");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const [quiz] = await sql`select id, owner_id from quizzes where public_id=${publicId}`;
  await sql`update users set creator_payout = ${sql.json({
    enabled: true,
    bankName: "กสิกรไทย",
    bankAccount: "123-4-56789-0",
    accountName: "ผู้สร้าง quiz",
    message: "ถ้าชอบ เลี้ยงกาแฟได้นะ ☕",
  })} where id = ${quiz.owner_id}`;

  const qs = await sql`select id from questions where quiz_id=${quiz.id} order by order_index`;
  const cs = await sql`select id, question_id, order_index from choices where question_id in ${sql(qs.map((q) => q.id))}`;
  const answers = qs.map((q) => ({
    questionId: q.id,
    choiceId: cs.find((c) => c.question_id === q.id && c.order_index === 0)!.id,
  }));

  const result = await submitPlay(publicId, answers);
  assert.ok(result.creatorTip, "creatorTip ควรไม่ null");
  assert.equal(result.creatorTip!.bankAccount, "123-4-56789-0", "bankAccount");
  console.log(`✓ tip jar: ${result.creatorTip!.bankName} ${result.creatorTip!.bankAccount} — "${result.creatorTip!.message}"`);
  await sql.end();
  process.exit(0);
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
