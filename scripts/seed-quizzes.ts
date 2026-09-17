// ประกอบเนื้อหา JSON + รูปการ์ด → quiz ที่เผยแพร่แล้วใน DB
// รัน: pnpm tsx --env-file=.env.local scripts/seed-quizzes.ts <contentDir> <urls.json> [ownerEmail]
//
// รันซ้ำได้: ลบ quiz เดิมที่ publicId ตรงกันก่อนเสมอ แล้วสร้างใหม่ทั้งชุด
// (ลบ quiz → questions/choices/results/plays หายตาม cascade)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";

// quiz อายุยาวกว่าค่ามาตรฐาน 30 วัน เพราะเป็นชุดตั้งต้นของเว็บ
// ไม่งั้น cron lifecycle จะ archive ทิ้งภายในเดือนเดียว
const LIFESPAN_DAYS = 365;

type Spec = {
  slug: string;
  title: string;
  description: string;
  category: string;
  resultLogic: "archetype" | "range";
  mode: "archetype" | "range" | "mbti";
  font: string;
  ai: boolean;
  /** ให้ AI ตัดสินผลลัพธ์แทนเครื่องคิดคะแนน */
  aiScoring?: boolean;
  questionFiles: string[];
  aiQuestionFile?: string;
};

type RawChoice = {
  labelText: string;
  scores?: Record<string, number>;
  points?: number;
  pole?: string;
  weight?: number;
};
type RawQuestion = {
  kind?: string;
  promptText: string;
  choices?: RawChoice[];
  /** โหมด mbti: cognitive function ที่ประโยคนี้วัด (ระบบสร้าง 5 ตัวเลือกให้เอง) */
  functionCode?: string;
};
type RawResult = {
  resultKey: string;
  title: string;
  description?: string;
  shareText?: string;
  scoreMin?: number | null;
  scoreMax?: number | null;
};

// ลำดับฟังก์ชันของแต่ละชนิด: หลัก → รอง → ตติยะ → ด้อย
const FUNCTION_STACK: Record<string, string[]> = {
  INTJ: ["Ni", "Te", "Fi", "Se"], INTP: ["Ti", "Ne", "Si", "Fe"],
  ENTJ: ["Te", "Ni", "Se", "Fi"], ENTP: ["Ne", "Ti", "Fe", "Si"],
  INFJ: ["Ni", "Fe", "Ti", "Se"], INFP: ["Fi", "Ne", "Si", "Te"],
  ENFJ: ["Fe", "Ni", "Se", "Ti"], ENFP: ["Ne", "Fi", "Te", "Si"],
  ISTJ: ["Si", "Te", "Fi", "Ne"], ISFJ: ["Si", "Fe", "Ti", "Ne"],
  ESTJ: ["Te", "Si", "Ne", "Fi"], ESFJ: ["Fe", "Si", "Ne", "Ti"],
  ISTP: ["Ti", "Se", "Ni", "Fe"], ISFP: ["Fi", "Se", "Ni", "Te"],
  ESTP: ["Se", "Ti", "Fe", "Ni"], ESFP: ["Se", "Fi", "Te", "Ni"],
};

// มาตรวัด 5 ระดับ — ทุกประโยคเขียนทางบวกต่อฟังก์ชันของตัวเอง
// ตอบ "ใช่" = ฟังก์ชันนั้นแข็งแรง จึงไม่มีฝั่งตรงข้ามให้แต้ม
const LIKERT: { label: string; weight: number }[] = [
  { label: "ใช่เลย ตรงกับฉันมาก", weight: 2 },
  { label: "ค่อนข้างใช่", weight: 1 },
  { label: "กลาง ๆ แล้วแต่สถานการณ์", weight: 0 },
  { label: "ค่อนข้างไม่ใช่", weight: 0 },
  { label: "ไม่เลย ไม่ใช่ฉัน", weight: 0 },
];

// ฟังก์ชันอยู่ตำแหน่งไหนใน stack → ชนิดนั้นควรได้แต้มมากแค่ไหน
const POSITION_POINTS = [4, 3, 2, 1];

/**
 * ฟังก์ชันหนึ่งตัว → แต้มของแต่ละชนิด ตามว่าฟังก์ชันนั้นอยู่ลำดับที่เท่าไรของชนิดนั้น
 * (ใช้เป็นคะแนนสำรองในฐานข้อมูลเท่านั้น — ตอนเล่นจริง AI เป็นคนให้คะแนนฟังก์ชัน)
 */
function functionToScoreMap(code: string, weight: number): Record<string, number> {
  if (!code || weight <= 0) return {};
  const map: Record<string, number> = {};
  for (const [type, stack] of Object.entries(FUNCTION_STACK)) {
    const at = stack.indexOf(code);
    if (at >= 0) map[type] = weight * POSITION_POINTS[at];
  }
  return map;
}

function readJson<T>(dir: string, file: string): T {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as T;
}

async function main() {
  const [contentDir, urlsFile, ownerEmailArg] = process.argv.slice(2);
  if (!contentDir || !urlsFile) {
    console.error(
      "usage: tsx scripts/seed-quizzes.ts <contentDir> <urls.json> [ownerEmail]",
    );
    process.exit(1);
  }
  const ownerEmail = (ownerEmailArg ?? "miraistorm@gmail.com").toLowerCase();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const urls = JSON.parse(fs.readFileSync(urlsFile, "utf8")) as Record<
    string,
    string
  >;
  const { quizzes: specs } = readJson<{ quizzes: Spec[] }>(
    contentDir,
    "quizzes.json",
  );

  // ── เจ้าของ quiz ────────────────────────────────────────────────
  const [existingOwner] = await sql`
    select id, password_hash from users where email = ${ownerEmail} limit 1`;

  let ownerId: string;
  let tempPassword: string | null = null;

  if (existingOwner) {
    ownerId = existingOwner.id;
    await sql`update users set role = 'admin', status = 'active' where id = ${ownerId}`;
    console.log(`เจ้าของ: ${ownerEmail} (มีอยู่แล้ว) → ตั้งเป็น admin`);
  } else {
    // รหัสผ่านชั่วคราว — เจ้าของเปลี่ยนเองได้ที่หน้าตั้งค่าหลังล็อกอิน
    tempPassword = crypto.randomBytes(9).toString("base64url");
    const [created] = await sql`
      insert into users (email, name, password_hash, email_verified, role, quiz_credits)
      values (${ownerEmail}, ${"Quibby"}, ${await bcrypt.hash(tempPassword, 10)},
              now(), 'admin', 20)
      returning id`;
    ownerId = created.id;
    console.log(`เจ้าของ: ${ownerEmail} (สร้างใหม่, verified, admin)`);
  }

  const expires = new Date(Date.now() + LIFESPAN_DAYS * 86400_000);
  const summary: { title: string; url: string; q: number; r: number }[] = [];

  for (const spec of specs) {
    const publicId = spec.slug;

    // รันซ้ำ → ลบของเดิมทิ้งก่อน (ลูก ๆ หายตาม cascade)
    await sql`delete from quizzes where public_id = ${publicId}`;

    const { results } = readJson<{ results: RawResult[] }>(
      contentDir,
      `results-${spec.slug}.json`,
    );

    // คำถามแบบเลือกตอบเรียงตามไฟล์ แล้วต่อท้ายด้วยข้อพิมพ์ตอบสำหรับ AI
    const questions: RawQuestion[] = [];
    for (const f of spec.questionFiles) {
      questions.push(...readJson<{ questions: RawQuestion[] }>(contentDir, f).questions);
    }
    if (spec.aiQuestionFile) {
      questions.push(
        ...readJson<{ questions: RawQuestion[] }>(contentDir, spec.aiQuestionFile)
          .questions,
      );
    }

    const [quiz] = await sql`
      insert into quizzes
        (public_id, owner_id, title, description, cover_image_url,
         result_logic, category, status, theme, settings, published_at, expires_at)
      values
        (${publicId}, ${ownerId}, ${spec.title}, ${spec.description},
         ${urls[`covers/cover_${spec.slug}`] ?? null},
         ${spec.resultLogic}, ${spec.category}, 'published',
         ${sql.json({ fontFamily: spec.font })},
         ${sql.json({
           // quiz ที่ AI ตัดสินไม่มี distribution ให้โชว์ — ใช้แถบมิติ MBTI แทน
           showProbabilityBar: spec.resultLogic === "archetype" && !spec.aiScoring,
           aiAnalysis: spec.ai,
           aiScoring: Boolean(spec.aiScoring),
         })},
         now(), ${expires})
      returning id`;

    // ── ผลลัพธ์ + รูปการ์ด ──
    for (const [i, r] of results.entries()) {
      const media = urls[`${spec.slug}/${r.resultKey}`] ?? null;
      await sql`
        insert into results
          (quiz_id, order_index, result_key, title, description, share_text,
           media_type, media_url, score_min, score_max)
        values
          (${quiz.id}, ${i}, ${r.resultKey}, ${r.title}, ${r.description ?? null},
           ${r.shareText ?? null},
           ${media ? "image" : "none"}, ${media},
           ${r.scoreMin ?? null}, ${r.scoreMax ?? null})`;
    }

    // ── คำถาม + ตัวเลือก ──
    for (const [qi, q] of questions.entries()) {
      const kind = q.kind === "text" ? "text" : q.kind === "story" ? "story" : "choice";
      const [row] = await sql`
        insert into questions (quiz_id, order_index, kind, prompt_text, facet)
        values (${quiz.id}, ${qi}, ${kind}, ${q.promptText}, ${q.functionCode ?? null})
        returning id`;

      if (kind !== "choice") continue;

      // โหมด mbti: ไฟล์เก็บแค่ประโยค + ฟังก์ชันที่วัด → กาง 5 ระดับให้เหมือนกันทุกข้อ
      const built: { labelText: string; scoreMap: Record<string, number>; points: number }[] =
        spec.mode === "mbti"
          ? LIKERT.map((lv) => ({
              labelText: lv.label,
              scoreMap: functionToScoreMap(q.functionCode ?? "", lv.weight),
              points: 0,
            }))
          : (q.choices ?? []).map((c) => ({
              labelText: c.labelText,
              scoreMap: spec.mode === "archetype" ? (c.scores ?? {}) : {},
              points: spec.mode === "range" ? (c.points ?? 0) : 0,
            }));

      for (const [ci, c] of built.entries()) {
        await sql`
          insert into choices (question_id, order_index, label_text, score_map, points)
          values (${row.id}, ${ci}, ${c.labelText}, ${sql.json(c.scoreMap)}, ${c.points})`;
      }
    }

    summary.push({
      title: spec.title,
      url: `/quiz/${publicId}`,
      q: questions.length,
      r: results.length,
    });
    console.log(
      `  ✓ ${spec.slug.padEnd(11)} ${String(questions.length).padStart(3)} คำถาม · ${String(results.length).padStart(2)} ผลลัพธ์ · AI ${spec.ai ? "เปิด" : "ปิด"}`,
    );
  }

  console.log("\n── สรุป ──");
  for (const s of summary) console.log(`  ${s.url.padEnd(22)} ${s.title}`);
  if (tempPassword) {
    console.log(`\nบัญชี admin: ${ownerEmail}`);
    console.log(`รหัสผ่านชั่วคราว: ${tempPassword}`);
    console.log("→ ล็อกอินแล้วเปลี่ยนรหัสที่ /dashboard/settings ทันที");
  }

  await sql.end();
}

main();
