// ทดสอบ lifecycle: expire -> archive -> restore
// pnpm dlx tsx --env-file=.env.local scripts/test-lifecycle.ts
import assert from "node:assert";
import postgres from "postgres";
import { nanoid } from "nanoid";
import {
  expirePublished,
  archiveExpired,
  restoreArchivedQuiz,
} from "@/lib/lifecycle";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const DAY = 86400_000;

async function main() {
  const [owner] = await sql`
    insert into users (email, name) values (${"lifecycle@example.com"}, ${"LC"})
    on conflict (email) do update set name = excluded.name returning id`;

  // A: published แต่เลยกำหนด 1 ชม. → ควรกลายเป็น expired
  const [a] = await sql`
    insert into quizzes (public_id, owner_id, title, status, published_at, expires_at)
    values (${"lc" + nanoid(6)}, ${owner.id}, ${"A หมดอายุเพิ่ง"}, 'published', now(), ${new Date(Date.now() - 3600_000)})
    returning id`;

  // B: expired มา 5 วันแล้ว → ควรถูก archive (grace 3 วัน)
  const r1 = nanoid(6);
  const r2 = nanoid(6);
  const [b] = await sql`
    insert into quizzes (public_id, owner_id, title, status, result_logic, published_at, expires_at, view_count, play_count)
    values (${"lc" + nanoid(6)}, ${owner.id}, ${"B เก่าควร archive"}, 'expired', 'archetype', now(), ${new Date(Date.now() - 5 * DAY)}, 10, 3)
    returning id`;
  await sql`insert into results (quiz_id, order_index, result_key, title) values
    (${b.id}, 0, ${r1}, ${"กระต่าย"}), (${b.id}, 1, ${r2}, ${"แมว"})`;
  const [q] = await sql`insert into questions (quiz_id, order_index, kind, prompt_text)
    values (${b.id}, 0, 'choice', ${"ข้อ 1"}) returning id`;
  await sql`insert into choices (question_id, order_index, label_text, score_map) values
    (${q.id}, 0, ${"ก"}, ${sql.json({ [r1]: 1 })}), (${q.id}, 1, ${"ข"}, ${sql.json({ [r2]: 1 })})`;
  const [res1] = await sql`select id from results where quiz_id = ${b.id} and result_key = ${r1}`;
  await sql`insert into plays (quiz_id, result_id) values (${b.id}, ${res1.id})`;

  // --- รัน cron ---
  const expired = await expirePublished();
  const archived = await archiveExpired();
  assert.ok(expired >= 1, "expirePublished ควร >= 1");
  assert.ok(archived >= 1, "archiveExpired ควร >= 1");

  const [aRow] = await sql`select status from quizzes where id = ${a.id}`;
  assert.equal(aRow.status, "expired", "A ควรเป็น expired");

  const [bRow] = await sql`select status from quizzes where id = ${b.id}`;
  assert.equal(bRow.status, "archived", "B ควรเป็น archived");

  // rows ลูกของ B ต้องถูกลบ
  const [{ n: qn }] = await sql`select count(*)::int n from questions where quiz_id = ${b.id}`;
  const [{ n: pn }] = await sql`select count(*)::int n from plays where quiz_id = ${b.id}`;
  assert.equal(qn, 0, "questions ของ B ต้องถูกลบ");
  assert.equal(pn, 0, "plays ของ B ต้องถูกลบ");

  // archive row + stats snapshot
  const [arch] = await sql`select stats_snapshot, restorable_until from quiz_archives where quiz_id = ${b.id}`;
  assert.equal(arch.stats_snapshot.playCount, 3, "snapshot playCount");
  assert.equal(arch.stats_snapshot.resultBreakdown[r1], 1, "breakdown กระต่าย=1");

  // --- restore ---
  const restored = await restoreArchivedQuiz(b.id, owner.id);
  assert.ok(restored.ok, "restore ควรสำเร็จ");
  const [bAfter] = await sql`select status from quizzes where id = ${b.id}`;
  assert.equal(bAfter.status, "draft", "B หลังกู้คืนควรเป็น draft");
  const [{ n: qn2 }] = await sql`select count(*)::int n from questions where quiz_id = ${b.id}`;
  assert.equal(qn2, 1, "questions ถูกกู้คืน");
  const [{ n: an }] = await sql`select count(*)::int n from quiz_archives where quiz_id = ${b.id}`;
  assert.equal(an, 0, "archive row ถูกลบหลังกู้คืน");

  console.log(
    `✓ lifecycle: A->expired, B->archived (children deleted, snapshot ok), restore->draft (children back)`,
  );
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
