// e2e 7b: announcement flag, ad slot render, report -> moderation
// pnpm exec tsx --env-file=.env.local scripts/e2e-7b.ts  (ต้องมี dev server :3100)
import { chromium } from "playwright";
import { readFileSync, statSync } from "node:fs";
import postgres from "postgres";
import { nanoid } from "nanoid";

const BASE = "http://localhost:3100";
const LOG = "/tmp/quibby-dev.log";
const email = `pw7b-${Date.now()}@example.com`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC";

function magicLink(): string | null {
  const m = [...readFileSync(LOG, "utf8").matchAll(/http:\/\/localhost:3100\/api\/auth\/callback\/nodemailer[^\s]*/g)];
  return m.length ? m[m.length - 1][0] : null;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const log = (s: string) => console.log(`• ${s}`);

  // signin + consent
  await page.goto(`${BASE}/signin`);
  await page.fill("input[name=email]", email);
  const before = statSync(LOG).size;
  await page.getByRole("button", { name: /ส่งลิงก์เข้าสู่ระบบ/ }).click();
  let link: string | null = null;
  for (let i = 0; i < 80; i++) { if (statSync(LOG).size > before) { link = magicLink(); if (link) break; } await sleep(500); }
  if (!link) throw new Error("no magic link");
  await page.context().request.get(link);
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /ยอมรับและเริ่มใช้งาน/ }).click();
  await page.waitForURL(/\/dashboard/);
  await sql`update users set role='admin' where lower(email)=lower(${email})`;
  const [me] = await sql`select id from users where lower(email)=lower(${email})`;
  log("admin พร้อม ✓");

  // seed published quiz (เจ้าของ = ตัวเอง)
  const pid = "p7b" + nanoid(6);
  await sql`insert into quizzes (public_id, owner_id, title, status, published_at, expires_at)
    values (${pid}, ${me.id}, ${"7b ทดสอบ"}, 'published', now(), ${new Date(Date.now() + 7 * 86400_000)})`;

  // --- announcement ---
  await page.goto(`${BASE}/admin/settings`);
  await page.check("input[name=enabled]");
  await page.fill("input[name=text]", "ประกาศทดสอบ 7b");
  await page.getByRole("button", { name: "บันทึกประกาศ" }).click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/`);
  if (!(await page.getByText("ประกาศทดสอบ 7b").isVisible().catch(() => false)))
    throw new Error("announcement ไม่แสดงบนหน้าแรก");
  log("ประกาศแสดงบนหน้าแรก ✓");

  // --- ad slot ---
  await page.goto(`${BASE}/admin/ads`);
  await page.fill("input[name=imageUrl]", PNG);
  await page.fill("input[name=targetUrl]", "https://example.com");
  await page.getByRole("button", { name: "เพิ่ม + เปิดใช้" }).click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/`);
  if (!(await page.locator('a[aria-label="โฆษณา"]').first().isVisible().catch(() => false)))
    throw new Error("โฆษณา footer ไม่แสดง");
  log("โฆษณา footer แสดงบนหน้าแรก ✓");

  // --- report ---
  await page.goto(`${BASE}/quiz/${pid}`);
  await page.getByText("รายงาน quiz นี้").click();
  await page.fill('input[name=reason]', "เนื้อหาไม่เหมาะสม (ทดสอบ)");
  await page.getByRole("button", { name: "ส่งรายงาน" }).click();
  await page.waitForTimeout(800);
  const [{ n: rn }] = await sql`select count(*)::int n from reports where quiz_id in (select id from quizzes where public_id=${pid})`;
  if (Number(rn) < 1) throw new Error("report ไม่ถูกบันทึก");
  log(`report บันทึกแล้ว (${rn}) ✓`);

  // --- moderation: dismiss ---
  await page.goto(`${BASE}/admin/moderation`);
  if (!(await page.getByText("เนื้อหาไม่เหมาะสม (ทดสอบ)").isVisible().catch(() => false)))
    throw new Error("report ไม่โผล่ในหน้า moderation");
  await page.getByRole("button", { name: "ปิด" }).first().click();
  await page.waitForTimeout(800);
  const [{ n: openN }] = await sql`select count(*)::int n from reports r join quizzes q on q.id=r.quiz_id where q.public_id=${pid} and r.status in ('open','reviewing')`;
  if (Number(openN) !== 0) throw new Error("report ยังไม่ถูกปิด");
  log("admin ปิด report สำเร็จ ✓");

  await page.screenshot({ path: "/tmp/quibby-7b.png", fullPage: true });
  await browser.close();
  await sql.end();
  console.log("\n✅ 7b e2e ผ่านทั้งหมด");
  process.exit(0);
}
main().catch(async (e) => { console.error("❌ 7b:", e.message); await sql.end().catch(() => {}); process.exit(1); });
