// e2e admin: signin -> consent -> (ไม่ใช่ admin โดน redirect) -> promote -> เข้า admin -> ระงับ user
// pnpm exec tsx scripts/e2e-admin.ts  (ต้องมี dev server :3100)
import { chromium } from "playwright";
import { readFileSync, statSync } from "node:fs";
import postgres from "postgres";

const BASE = "http://localhost:3100";
const LOG = "/tmp/quibby-dev.log";
const email = `pwadmin-${Date.now()}@example.com`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function latestMagicLink(): string | null {
  const m = [
    ...readFileSync(LOG, "utf8").matchAll(
      /http:\/\/localhost:3100\/api\/auth\/callback\/nodemailer[^\s]*/g,
    ),
  ];
  return m.length ? m[m.length - 1][0] : null;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const log = (s: string) => console.log(`• ${s}`);

  // sign in
  await page.goto(`${BASE}/signin`);
  await page.fill("input[name=email]", email);
  const before = statSync(LOG).size;
  await page.getByRole("button", { name: /ส่งลิงก์เข้าสู่ระบบ/ }).click();
  let link: string | null = null;
  for (let i = 0; i < 80; i++) {
    if (statSync(LOG).size > before) {
      link = latestMagicLink();
      if (link) break;
    }
    await sleep(500);
  }
  if (!link) throw new Error("ไม่พบ magic link");
  await page.context().request.get(link);
  log("signed in ✓");

  // consent
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /ยอมรับและเริ่มใช้งาน/ }).click();
  await page.waitForURL(/\/dashboard/);

  // ยังไม่ใช่ admin → /admin ควรเด้งออก (ไม่เห็น "ภาพรวมระบบ")
  await page.goto(`${BASE}/admin`);
  if (await page.getByText("ภาพรวมระบบ").isVisible().catch(() => false))
    throw new Error("non-admin เข้า /admin ได้ (ไม่ควร)");
  log("non-admin ถูกกั้นออกจาก /admin ✓");

  // promote เป็น admin ผ่าน DB (session database strategy → มีผลทันที)
  await sql`update users set role='admin' where lower(email)=lower(${email})`;
  log("promoted to admin via DB ✓");

  await page.goto(`${BASE}/admin`);
  if (!(await page.getByText("ภาพรวมระบบ").isVisible().catch(() => false)))
    throw new Error("admin เข้า /admin ไม่ได้");
  log("admin เข้า overview ได้ ✓");
  await page.screenshot({ path: "/tmp/quibby-admin.png", fullPage: true });

  // users page → ระงับ user คนแรก
  await page.goto(`${BASE}/admin/users`);
  const suspendBtns = page.getByRole("button", { name: "ระงับ" });
  if ((await suspendBtns.count()) === 0) throw new Error("ไม่มีปุ่มระงับ");
  await suspendBtns.first().click();
  await page.waitForTimeout(800);
  if ((await page.getByRole("button", { name: "ปลดระงับ" }).count()) < 1)
    throw new Error("ระงับ user ไม่สำเร็จ");
  log("ระงับ user สำเร็จ (มีปุ่มปลดระงับ) ✓");

  // ตรวจ audit log ถูกบันทึก
  const [{ n }] = await sql`select count(*)::int n from audit_logs`;
  if (Number(n) < 1) throw new Error("ไม่มี audit log");
  log(`audit log บันทึกแล้ว (${n} รายการ) ✓`);

  await browser.close();
  await sql.end();
  console.log("\n✅ admin e2e ผ่านทั้งหมด");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ admin e2e:", e.message);
  process.exit(1);
});
