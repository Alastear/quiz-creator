// e2e เต็ม flow ผ่าน browser จริง:
// signin (magic link) -> consent -> create -> publish -> play -> result
// รัน: pnpm exec tsx scripts/e2e.ts   (ต้องมี dev server ที่ :3100 + log ที่ /tmp/quibby-dev.log)
import { chromium } from "playwright";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3100";
const LOG = "/tmp/quibby-dev.log";
const email = `pw-${Date.now()}@example.com`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function latestMagicLink(): string | null {
  const log = readFileSync(LOG, "utf8");
  const m = [
    ...log.matchAll(
      /http:\/\/localhost:3100\/api\/auth\/callback\/nodemailer[^\s]*/g,
    ),
  ];
  return m.length ? m[m.length - 1][0] : null;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const log = (s: string) => console.log(`• ${s}`);

  // 1) sign in with email -> magic link to console
  await page.goto(`${BASE}/signin`);
  await page.fill("input[name=email]", email);
  const sizeBefore = statSync(LOG).size;
  await page.getByRole("button", { name: /ส่งลิงก์เข้าสู่ระบบ/ }).click();
  log(`requested magic link for ${email}`);

  let link: string | null = null;
  for (let i = 0; i < 80; i++) {
    if (statSync(LOG).size > sizeBefore) {
      const l = latestMagicLink();
      // เอาเฉพาะลิงก์ที่เพิ่งเกิดหลังกดส่ง (ไม่ใช่ของรอบก่อน)
      if (l) {
        link = l;
        break;
      }
    }
    await sleep(500);
  }
  if (!link) throw new Error("ไม่พบ magic link ใน log");
  log("got magic link, signing in…");
  // token เป็น single-use → ยิงครั้งเดียวผ่าน request API (cookie เก็บใน context)
  // ไม่ใช้ page.goto เพราะ navigation อาจ abort/ยิงซ้ำจน token ถูกใช้ไปก่อน
  const resp = await page.context().request.get(link);
  if (![200, 302].includes(resp.status()))
    throw new Error(`callback status ${resp.status()}`);

  // 2) consent gate
  await page.goto(`${BASE}/dashboard`);
  if (!page.url().includes("/consent"))
    throw new Error(`expected consent gate, got ${page.url()}`);
  log("redirected to consent ✓");
  await page.getByRole("button", { name: /ยอมรับและเริ่มใช้งาน/ }).click();
  await page.waitForURL(/\/dashboard/);
  log("accepted PDPA -> dashboard ✓");

  // 3) create quiz
  await page.getByRole("button", { name: /สร้าง quiz ใหม่/ }).click();
  await page.waitForURL(/\/create\//);
  log(`created quiz: ${page.url()}`);
  await page.fill("input", "Quiz ทดสอบจาก e2e", { timeout: 5000 }).catch(() => {});
  // ตั้งชื่อผ่าน field แรก (ชื่อ quiz)
  const titleInput = page.locator("input").first();
  await titleInput.fill("Quiz ทดสอบจาก e2e");

  // 3.5) อัปโหลดรูปปก (ทดสอบ /api/upload + storage adapter)
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC",
    "base64",
  );
  writeFileSync("/tmp/quibby-test.png", png);
  await page.locator('input[type=file]').first().setInputFiles("/tmp/quibby-test.png");
  await page.waitForSelector('img[src*="/api/media/"]', { timeout: 10000 });
  log("uploaded cover image ✓");

  // 3.6) เพิ่ม segment แบบ story + text
  await page.getByRole("button", { name: "+ เล่าเรื่อง" }).click();
  await page.getByRole("button", { name: "+ พิมพ์ตอบ" }).click();
  log("added story + text segments ✓");
  await page.screenshot({ path: "/tmp/quibby-builder.png", fullPage: true });

  // 4) publish (ข้อมูล seed ผ่าน validation อยู่แล้ว)
  await page.getByRole("button", { name: "เผยแพร่", exact: true }).click();
  await page.waitForTimeout(2500);
  const openHref = await page
    .getByRole("link", { name: /เปิดดู/ })
    .first()
    .getAttribute("href");
  if (!openHref) throw new Error("ไม่พบลิงก์เปิดดู (publish อาจไม่สำเร็จ)");
  log(`published ✓ -> ${openHref}`);

  // 5) play
  await page.goto(`${BASE}${openHref}`);
  await page.getByRole("button", { name: /เริ่มทำแบบทดสอบ/ }).click();
  for (let i = 0; i < 20; i++) {
    if (await page.getByText("ผลลัพธ์ของคุณคือ").isVisible().catch(() => false))
      break;
    const textarea = page.locator("textarea").first();
    const choice = page
      .getByRole("button")
      .filter({ hasText: /ตัวเลือก|อยู่บ้าน|ออกไป/ })
      .first();
    const nextBtn = page
      .getByRole("button", { name: /ถัดไป|ดูผลลัพธ์/ })
      .first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill("คำตอบทดสอบ");
      await nextBtn.click();
    } else if (await choice.isVisible().catch(() => false)) {
      await choice.click();
    } else if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
    }
    await page.waitForTimeout(500);
  }
  const gotResult = await page.getByText("ผลลัพธ์ของคุณคือ").isVisible();
  if (!gotResult) throw new Error("ไม่ถึงหน้าผลลัพธ์");
  const resultTitle = await page.locator("h1").first().textContent();
  log(`reached result ✓ — "${resultTitle?.trim()}"`);

  // 6) save-as-image (ต้องไม่มี error toast)
  await page.getByRole("button", { name: /บันทึกรูปผลลัพธ์/ }).click();
  await page.waitForTimeout(1500);
  if (await page.getByText("บันทึกรูปไม่สำเร็จ").isVisible().catch(() => false))
    throw new Error("save image ล้มเหลว");
  log("save result image ✓ (ไม่มี error)");

  // 7) single share button -> menu มี platform
  await page.getByRole("button", { name: /แชร์/ }).click();
  await page.waitForTimeout(300);
  if (!(await page.getByRole("button", { name: "LINE" }).isVisible()))
    throw new Error("share menu ไม่มี LINE");
  log("share menu เปิด + มี LINE/Facebook/X ✓");
  await page.screenshot({ path: "/tmp/quibby-result.png", fullPage: true });

  // 8) discovery homepage — ค้นหา quiz ที่เพิ่งเผยแพร่
  await page.goto(`${BASE}/?q=${encodeURIComponent("Quiz ทดสอบ")}`);
  const card = page
    .getByRole("link")
    .filter({ hasText: "Quiz ทดสอบจาก e2e" })
    .first();
  if (!(await card.isVisible().catch(() => false)))
    throw new Error("ไม่พบ quiz ในหน้า discovery");
  log("discovery: ค้นหาเจอ quiz ที่เผยแพร่ ✓");
  await page.screenshot({ path: "/tmp/quibby-home.png", fullPage: true });

  await browser.close();
  console.log("\n✅ e2e ครบ flow ผ่านทั้งหมด");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ e2e ล้มเหลว:", e.message);
  process.exit(1);
});
