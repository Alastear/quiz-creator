// e2e payment (mock): buy credits -> donate -> publish -> extend (หัก credit)
// pnpm exec tsx --env-file=.env.local scripts/e2e-billing.ts  (ต้องมี dev server :3100)
import { chromium } from "playwright";
import { readFileSync, statSync } from "node:fs";
import postgres from "postgres";

const BASE = "http://localhost:3100";
const LOG = "/tmp/quibby-dev.log";
const email = `pwbill-${Date.now()}@example.com`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

function latestMagicLink(): string | null {
  const m = [
    ...readFileSync(LOG, "utf8").matchAll(
      /http:\/\/localhost:3100\/api\/auth\/callback\/nodemailer[^\s]*/g,
    ),
  ];
  return m.length ? m[m.length - 1][0] : null;
}
async function credits(): Promise<number> {
  const [r] = await sql`select quiz_credits from users where lower(email)=lower(${email})`;
  return Number(r?.quiz_credits ?? -1);
}
async function waitCredits(target: number): Promise<void> {
  for (let i = 0; i < 30; i++) {
    if ((await credits()) === target) return;
    await sleep(400);
  }
  throw new Error(`credits ไม่ถึง ${target} (ได้ ${await credits()})`);
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
  for (let i = 0; i < 80; i++) {
    if (statSync(LOG).size > before) { link = latestMagicLink(); if (link) break; }
    await sleep(500);
  }
  if (!link) throw new Error("no magic link");
  await page.context().request.get(link);
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /ยอมรับและเริ่มใช้งาน/ }).click();
  await page.waitForURL(/\/dashboard/);
  log("signed in + consent ✓");

  // buy 1-credit pack
  await page.goto(`${BASE}/dashboard/billing`);
  await page.locator("form").filter({ hasText: "1เครดิต" }).first().getByRole("button").click();
  await waitCredits(1);
  log("ซื้อแพ็ก 1 เครดิต → credits=1 ✓");

  // buy 5-credit pack
  await page.goto(`${BASE}/dashboard/billing`);
  await page.locator("form").filter({ hasText: "5เครดิต" }).first().getByRole("button").click();
  await waitCredits(6);
  log("ซื้อแพ็ก 5 เครดิต → credits=6 ✓");

  // donate 50
  await page.goto(`${BASE}/dashboard/billing`);
  await page.getByRole("button", { name: "50 ฿" }).click();
  await page.waitForTimeout(1500);
  const [{ n: dn }] = await sql`
    select count(*)::int n from transactions t join users u on u.id=t.user_id
    where lower(u.email)=lower(${email}) and t.kind='donation'`;
  if (Number(dn) < 1) throw new Error("donation not recorded");
  log("โดเนท 50 ฿ → บันทึก transaction ✓");

  // create + publish a quiz
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /สร้าง quiz ใหม่/ }).click();
  await page.waitForURL(/\/create\//);
  await page.getByRole("button", { name: "เผยแพร่", exact: true }).click();
  await page.waitForTimeout(2000);
  log("สร้าง + เผยแพร่ quiz ✓");

  // extend (หัก 1 credit: 6 -> 5)
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /ต่ออายุ \+30/ }).first().click();
  await waitCredits(5);
  log("ต่ออายุ +30 → หัก 1 credit (เหลือ 5) ✓");

  await page.goto(`${BASE}/dashboard/billing`);
  await page.screenshot({ path: "/tmp/quibby-billing.png", fullPage: true });

  await browser.close();
  await sql.end();
  console.log("\n✅ billing e2e ผ่านทั้งหมด");
  process.exit(0);
}
main().catch(async (e) => {
  console.error("❌ billing e2e:", e.message);
  await sql.end().catch(() => {});
  process.exit(1);
});
