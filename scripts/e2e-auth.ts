// e2e: register -> (login ก่อน verify = ล้มเหลว) -> verify -> login -> consent -> dashboard
// + suspend ผ่าน DB แล้วโดนเด้ง /suspended (พิสูจน์ JWT ดึง status สดได้)
import { chromium } from "playwright";
import { readFileSync, statSync } from "node:fs";
import postgres from "postgres";

const BASE = "http://localhost:3100";
const LOG = "/tmp/quibby-dev.log";
const email = `pwauth-${Date.now()}@example.com`;
const password = "test1234";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

function verifyLink(): string | null {
  const m = [
    ...readFileSync(LOG, "utf8").matchAll(
      /http:\/\/localhost:3100\/api\/auth\/verify-email[^\s]*/g,
    ),
  ];
  return m.length ? m[m.length - 1][0] : null;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const log = (s: string) => console.log(`• ${s}`);

  // 1) register
  await page.goto(`${BASE}/register`);
  const before = statSync(LOG).size;
  await page.fill("#r-name", "PW Auth");
  await page.fill("#r-email", email);
  await page.fill("#r-password", password);
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await page.getByText("ส่งอีเมลยืนยันแล้ว").waitFor({ timeout: 15000 });
  log("สมัครสมาชิก + ส่งอีเมลยืนยัน ✓");

  // 2) login ก่อน verify → ต้องล้มเหลว
  await page.goto(`${BASE}/signin`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForTimeout(1500);
  if (!page.url().includes("/signin"))
    throw new Error("ล็อกอินก่อน verify ไม่ควรสำเร็จ");
  log("ล็อกอินก่อน verify ถูกบล็อก ✓");

  // 3) verify (อ่านลิงก์จาก log)
  let link: string | null = null;
  for (let i = 0; i < 40; i++) {
    if (statSync(LOG).size > before) {
      link = verifyLink();
      if (link) break;
    }
    await sleep(400);
  }
  if (!link) throw new Error("ไม่พบลิงก์ยืนยันใน log");
  await page.context().request.get(link);
  log("ยืนยันอีเมลแล้ว ✓");

  // 4) login -> consent -> dashboard
  await page.goto(`${BASE}/signin`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForTimeout(2000);
  // ควรหลุดจาก signin (ไป dashboard → consent)
  if (page.url().includes("/signin")) throw new Error("ล็อกอินหลัง verify ไม่สำเร็จ");
  await page.goto(`${BASE}/dashboard`);
  if (page.url().includes("/consent")) {
    await page.getByRole("button", { name: /ยอมรับและเริ่มใช้งาน/ }).click();
    await page.waitForURL(/\/dashboard/);
  }
  if (!page.url().includes("/dashboard"))
    throw new Error(`ไม่ถึง dashboard (อยู่ ${page.url()})`);
  log("ล็อกอิน + consent + เข้า dashboard ✓");

  // 5) suspend ผ่าน DB → /dashboard ต้องเด้ง /suspended
  await sql`update users set status='suspended' where lower(email)=lower(${email})`;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(800);
  if (!page.url().includes("/suspended"))
    throw new Error(`suspend ไม่มีผล (อยู่ ${page.url()}) — JWT ไม่ได้ดึง status สด`);
  log("suspend ผ่าน DB → เด้ง /suspended ทันที (JWT ดึง status สด) ✓");

  await browser.close();
  await sql.end();
  console.log("\n✅ auth e2e ผ่านทั้งหมด");
  process.exit(0);
}
main().catch(async (e) => {
  console.error("❌ auth e2e:", e.message);
  await sql.end().catch(() => {});
  process.exit(1);
});
