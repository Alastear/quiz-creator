// ตรวจ quiz ที่ seed ไปแล้วว่าคิดคะแนนถูกจริง (อ่านอย่างเดียว ไม่เขียน DB)
// รัน: pnpm tsx --env-file=.env.local scripts/verify-quizzes.ts
//
// เช็ค 3 อย่างที่พังเงียบได้ง่ายสุด:
//   1. scoreMap อ้าง resultKey ที่ไม่มีอยู่จริง → ผลลัพธ์นั้นไม่มีทางออก
//   2. โหมด range: ช่วงคะแนนขาด/ทับ หรือแต้มเต็มเกินช่วงสูงสุด
//   3. สุ่มเล่นเยอะ ๆ แล้วผลลัพธ์กระจุกอยู่แบบเดียว
import postgres from "postgres";
import { computeResult, type ScoringChoice, type ScoringResult } from "../lib/scoring";

const ROUNDS = 3000;

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const quizzes = await sql`
    select id, public_id, title, result_logic, settings
    from quizzes where status = 'published' order by public_id`;

  let failures = 0;

  for (const q of quizzes) {
    const results = await sql`
      select result_key, order_index, title, score_min, score_max, media_url
      from results where quiz_id = ${q.id} order by order_index`;
    const questions = await sql`
      select id, kind from questions where quiz_id = ${q.id} order by order_index`;
    const choiceQs = questions.filter((x) => x.kind === "choice");

    const choicesByQ = new Map<string, { scoreMap: Record<string, number>; points: number }[]>();
    for (const qq of choiceQs) {
      const cs = await sql`
        select score_map, points from choices
        where question_id = ${qq.id} order by order_index`;
      choicesByQ.set(
        qq.id,
        cs.map((c) => ({ scoreMap: c.score_map, points: c.points })),
      );
    }

    const keys = new Set(results.map((r) => r.result_key));
    const problems: string[] = [];

    // 1. key ที่ scoreMap อ้างถึงแต่ไม่มีใน results
    const referenced = new Set<string>();
    for (const list of choicesByQ.values())
      for (const c of list)
        for (const [k, v] of Object.entries(c.scoreMap ?? {}))
          if (v > 0) referenced.add(k);
    for (const k of referenced)
      if (!keys.has(k)) problems.push(`scoreMap อ้าง key ที่ไม่มีอยู่: ${k}`);

    // 2. รูปการ์ดครบทุกผลลัพธ์
    const noMedia = results.filter((r) => !r.media_url).map((r) => r.result_key);
    if (noMedia.length) problems.push(`ไม่มีรูป: ${noMedia.join(", ")}`);

    // 3. โหมด range: แต้มเต็มต้องอยู่ในช่วงสูงสุดพอดี และช่วงต้องต่อเนื่อง
    if (q.result_logic === "range") {
      let maxTotal = 0;
      for (const list of choicesByQ.values())
        maxTotal += Math.max(...list.map((c) => c.points));
      const sorted = [...results].sort((a, b) => a.score_min - b.score_min);
      const top = sorted[sorted.length - 1];
      if (maxTotal !== top.score_max)
        problems.push(`แต้มเต็ม ${maxTotal} ไม่ตรงขอบบน ${top.score_max}`);
      if (sorted[0].score_min !== 0)
        problems.push(`ช่วงต่ำสุดไม่ได้เริ่มที่ 0 (เริ่มที่ ${sorted[0].score_min})`);
      for (let i = 1; i < sorted.length; i++)
        if (sorted[i].score_min !== sorted[i - 1].score_max + 1)
          problems.push(
            `ช่วงไม่ต่อเนื่องระหว่าง ${sorted[i - 1].result_key} และ ${sorted[i].result_key}`,
          );
    }

    // 4. สุ่มเล่น — ใช้ได้เฉพาะโหมด archetype
    //    โหมด range ใช้วิธีนี้ไม่ได้: สุ่มตอบแบบกระจายเท่ากันทำให้คะแนนรวมกองกลาง ๆ
    //    (central limit) ช่วงหัวท้ายเลยแทบไม่ออกเลยทั้งที่คนตอบจริงไปถึงได้
    //    โหมด range พิสูจน์ความครอบคลุมด้วยข้อ 3 ไปแล้ว (เริ่มที่ 0 + ต่อเนื่อง + จบที่แต้มเต็ม)
    const scoringResults = results.map<ScoringResult>((r) => ({
      resultKey: r.result_key,
      orderIndex: r.order_index,
      scoreMin: r.score_min,
      scoreMax: r.score_max,
    }));
    const hits = new Map<string, number>();
    const rounds = q.result_logic === "range" ? 0 : ROUNDS;
    for (let i = 0; i < rounds; i++) {
      const chosen: ScoringChoice[] = [];
      for (const list of choicesByQ.values())
        chosen.push(list[Math.floor(Math.random() * list.length)]);
      const out = computeResult(
        q.result_logic === "range" ? "range" : "archetype",
        chosen,
        scoringResults,
      );
      hits.set(out.resultKey, (hits.get(out.resultKey) ?? 0) + 1);
    }
    if (rounds > 0) {
      const never = results.filter((r) => !hits.has(r.result_key));
      if (never.length)
        problems.push(
          `สุ่ม ${rounds} รอบแล้วไม่เคยออก: ${never.map((r) => r.result_key).join(", ")}`,
        );
    }

    const top3 =
      rounds === 0
        ? "ช่วงคะแนนครอบคลุมครบ (ไม่สุ่มทดสอบ)"
        : [...hits.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, n]) => `${k} ${((n / rounds) * 100).toFixed(1)}%`)
            .join(" · ");

    const ok = problems.length === 0;
    if (!ok) failures++;
    console.log(
      `${ok ? "✓" : "✗"} ${String(q.public_id).padEnd(11)} ${String(questions.length).padStart(3)} ข้อ · ${String(results.length).padStart(2)} ผล · AI ${q.settings?.aiAnalysis ? "เปิด" : "ปิด"} · ออกบ่อย: ${top3}`,
    );
    for (const p of problems) console.log(`    ! ${p}`);
  }

  await sql.end();
  console.log(failures === 0 ? "\nผ่านทั้งหมด" : `\nมีปัญหา ${failures} quiz`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
