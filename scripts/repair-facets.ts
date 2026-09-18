// เติมค่า questions.facet ที่หายไปกลับเข้า DB
// รัน: pnpm tsx --env-file=.env.local scripts/repair-facets.ts [publicId]
//
// ใช้ตอน facet ถูกล้าง (เช่นกดบันทึกจาก builder เวอร์ชันที่ยังไม่ส่ง facet กลับ)
// กู้จาก score_map ของตัวเลือกแรก ซึ่งตอน seed เข้ารหัสฟังก์ชันไว้อยู่แล้ว:
// ฟังก์ชันหนึ่งตัวจะให้แต้มกับ 8 ชนิดที่มีมันอยู่ใน stack ด้วยค่าตามลำดับที่มันอยู่
// ชุดคีย์+ค่าจึงชี้กลับไปยังฟังก์ชันต้นทางได้ตัวเดียวเสมอ
//
// ซ่อมเฉพาะคอลัมน์นี้ ไม่แตะชื่อ/ปก/คำถาม จึงไม่ทับงานที่แก้ไว้ในหน้า builder
import postgres from "postgres";
import { FUNCTION_CODES, FUNCTION_STACK, MBTI_TYPES } from "@/lib/mbti";

const POSITION_POINTS = [4, 3, 2, 1];

/** สร้าง score_map ที่ seed เคยเขียนไว้สำหรับฟังก์ชันนี้ที่น้ำหนักหนึ่ง ๆ */
function expectedMap(code: string, weight: number): Record<string, number> {
  const map: Record<string, number> = {};
  for (const type of MBTI_TYPES) {
    const at = FUNCTION_STACK[type].indexOf(code as never);
    if (at >= 0) map[type] = weight * POSITION_POINTS[at];
  }
  return map;
}

function sameMap(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** หาว่า score_map นี้มาจากฟังก์ชันไหน — คืน null ถ้าไม่ตรงกับตัวไหนเลย */
function facetFromScoreMap(map: Record<string, number>): string | null {
  if (!map || Object.keys(map).length !== 8) return null;
  for (const code of FUNCTION_CODES) {
    for (const weight of [2, 1]) {
      if (sameMap(map, expectedMap(code, weight))) return code;
    }
  }
  return null;
}

async function main() {
  const publicId = process.argv[2] ?? "mbti";
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const [quiz] = await sql`
    select id, title from quizzes where public_id = ${publicId} limit 1`;
  if (!quiz) throw new Error(`ไม่พบ quiz "${publicId}"`);

  const rows = await sql`
    select id, kind, facet from questions
    where quiz_id = ${quiz.id} order by order_index`;

  let fixed = 0;
  let already = 0;
  let unknown = 0;

  for (const r of rows) {
    if (r.kind !== "choice") continue;
    const cs = await sql`
      select score_map from choices
      where question_id = ${r.id} order by order_index limit 1`;
    const code = facetFromScoreMap(cs[0]?.score_map ?? {});
    if (!code) {
      unknown++;
      continue;
    }
    if (r.facet === code) {
      already++;
      continue;
    }
    await sql`update questions set facet = ${code} where id = ${r.id}`;
    fixed++;
  }

  const after = await sql`
    select facet, count(*)::int n from questions
    where quiz_id = ${quiz.id} and facet is not null group by facet order by facet`;

  console.log(`ซ่อม ${fixed} ข้อ · ถูกอยู่แล้ว ${already} ข้อ · อ่านไม่ออก ${unknown} ข้อ`);
  console.log("สรุปใน DB:", after.map((a) => `${a.facet}=${a.n}`).join(" ") || "(ว่าง)");

  await sql.end();
  process.exit(unknown > 0 ? 1 : 0);
}

main();
