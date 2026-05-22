// Seed quiz เผยแพร่ 1 อันสำหรับทดสอบ play path
// รัน: node --env-file=.env.local --experimental-strip-types scripts/seed-demo.ts
import postgres from "postgres";
import { nanoid } from "nanoid";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const publicId = "demo" + nanoid(6);
const r1 = nanoid(6);
const r2 = nanoid(6);

const [owner] = await sql`
  insert into users (email, name) values (${"seed-owner@example.com"}, ${"Seed Owner"})
  on conflict (email) do update set name = excluded.name
  returning id`;

const expires = new Date(Date.now() + 7 * 86400_000);
const [quiz] = await sql`
  insert into quizzes (public_id, owner_id, title, description, result_logic, status, settings, published_at, expires_at)
  values (${publicId}, ${owner.id}, ${"คุณเป็นสัตว์อะไร?"}, ${"ตอบ 2 ข้อแล้วรู้เลย"}, 'archetype', 'published',
          ${sql.json({ showProbabilityBar: true })}, now(), ${expires})
  returning id`;

await sql`insert into results (quiz_id, order_index, result_key, title, description) values
  (${quiz.id}, 0, ${r1}, ${"กระต่าย 🐰"}, ${"ขี้อาย น่ารัก"}),
  (${quiz.id}, 1, ${r2}, ${"แมว 🐱"}, ${"อิสระ เท่"})`;

for (const [qi, prompt] of [["วันหยุดชอบทำอะไร?"], ["ชอบกินอะไร?"]].entries()) {
  const [q] = await sql`
    insert into questions (quiz_id, order_index, prompt_text)
    values (${quiz.id}, ${qi}, ${prompt[0]}) returning id`;
  await sql`insert into choices (question_id, order_index, label_text, score_map) values
    (${q.id}, 0, ${"อยู่บ้านเงียบ ๆ"}, ${sql.json({ [r1]: 2 })}),
    (${q.id}, 1, ${"ออกไปผจญภัย"}, ${sql.json({ [r2]: 2 })})`;
}

console.log("SEEDED_PUBLIC_ID=" + publicId);
await sql.end();
