// สร้างการ์ดรูปผลลัพธ์ (neon glass) ด้วย Chromium แล้วเซฟเป็น PNG
// รัน: pnpm tsx scripts/gen-result-cards.ts <contentDir> <outDir>
//
// อ่าน results-*.json ที่ agent เขียนไว้ แล้วเรนเดอร์ 1 ใบต่อ 1 ผลลัพธ์
// ธีมสี/glyph กำหนดไว้ใน CARD_THEME ด้านล่าง — ไม่ได้ดึงจากเนื้อหา
// เพื่อให้คุมหน้าตาได้แน่นอนและ regenerate แล้วได้เหมือนเดิมทุกครั้ง
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

// การ์ดผลลัพธ์เป็นจัตุรัส (หน้าเว็บแสดงด้วย max-h-64 w-auto จึงไม่โดนครอบตัด)
// ส่วนรูปปกต้องเป็น 16:9 เพราะการ์ดหน้าแรกใช้ aspect-video + object-cover
// ถ้าปกเป็นจัตุรัสจะโดนครอบตัดบน-ล่างจนแผงชื่อหาย
const SQUARE = { w: 1000, h: 1000, wide: false };
const WIDE = { w: 1600, h: 900, wide: true };
type Layout = typeof SQUARE;

type Theme = { glyph: string; a: string; b: string };

// ── ธีมต่อผลลัพธ์ ────────────────────────────────────────────────
const CARD_THEME: Record<string, Theme> = {
  // MBTI — จัดกลุ่มสีตาม temperament (NT ม่วง / NF เขียว / SJ ฟ้า / SP ส้ม)
  INTJ: { glyph: "♟️", a: "#7c5cff", b: "#c4b5fd" },
  INTP: { glyph: "🔬", a: "#8b5cf6", b: "#ddd6fe" },
  ENTJ: { glyph: "👑", a: "#6d28d9", b: "#a78bfa" },
  ENTP: { glyph: "🎭", a: "#a855f7", b: "#f0abfc" },
  INFJ: { glyph: "🕯️", a: "#14b8a6", b: "#99f6e4" },
  INFP: { glyph: "🌙", a: "#10b981", b: "#a7f3d0" },
  ENFJ: { glyph: "🫶", a: "#059669", b: "#6ee7b7" },
  ENFP: { glyph: "🎨", a: "#34d399", b: "#d9f99d" },
  ISTJ: { glyph: "📐", a: "#2563eb", b: "#93c5fd" },
  ISFJ: { glyph: "🧺", a: "#3b82f6", b: "#bfdbfe" },
  ESTJ: { glyph: "📊", a: "#1d4ed8", b: "#7dd3fc" },
  ESFJ: { glyph: "🎂", a: "#0ea5e9", b: "#bae6fd" },
  ISTP: { glyph: "🔧", a: "#f97316", b: "#fed7aa" },
  ISFP: { glyph: "🎸", a: "#fb923c", b: "#fde68a" },
  ESTP: { glyph: "🏍️", a: "#ea580c", b: "#fdba74" },
  ESFP: { glyph: "🎤", a: "#f59e0b", b: "#fef08a" },

  // ออร่า — ใช้สีจริงของออร่านั้น
  aura_red: { glyph: "🔥", a: "#ff2d55", b: "#ff8a6b" },
  aura_orange: { glyph: "🧡", a: "#ff8c2b", b: "#ffc14d" },
  aura_yellow: { glyph: "🌟", a: "#ffd93d", b: "#fff59a" },
  aura_green: { glyph: "🌿", a: "#2bd97c", b: "#9cffc4" },
  aura_blue: { glyph: "🌊", a: "#2b9dff", b: "#8ad9ff" },
  aura_indigo: { glyph: "🔭", a: "#4b5cff", b: "#a3b0ff" },
  aura_violet: { glyph: "🔮", a: "#a855f7", b: "#e0b6ff" },
  aura_pink: { glyph: "🌸", a: "#ff5fa2", b: "#ffb8d6" },
  aura_gold: { glyph: "👑", a: "#f5c518", b: "#ffeaa0" },
  aura_white: { glyph: "🕊️", a: "#cbd5ff", b: "#ffffff" },

  // อาชีพต่างโลก
  job_hero: { glyph: "⚔️", a: "#ffd43b", b: "#ff8c2b" },
  job_mage: { glyph: "🔮", a: "#7c5cff", b: "#c9b6ff" },
  job_healer: { glyph: "✨", a: "#34d399", b: "#d1fae5" },
  job_knight: { glyph: "🛡️", a: "#38bdf8", b: "#bae6fd" },
  job_rogue: { glyph: "🗡️", a: "#8b5cf6", b: "#4c1d95" },
  job_merchant: { glyph: "💰", a: "#f5c518", b: "#ffe08a" },
  job_blacksmith: { glyph: "🔨", a: "#ff6b3d", b: "#ffb37a" },
  job_beastmaster: { glyph: "🐺", a: "#4ade80", b: "#bbf7d0" },
  job_bard: { glyph: "🎻", a: "#ff5fa2", b: "#ffc2dd" },
  job_alchemist: { glyph: "⚗️", a: "#22d3ee", b: "#a5f3fc" },
  job_summoner: { glyph: "🌀", a: "#c084fc", b: "#f0d9ff" },
  job_farmer: { glyph: "🌾", a: "#84cc16", b: "#e4f7a1" },

  // เกย์มิเตอร์ — ไล่ความเข้มขึ้นเรื่อย ๆ จนเป็นสีรุ้ง
  lvl1: { glyph: "🌤️", a: "#64748b", b: "#cbd5e1" },
  lvl2: { glyph: "🎶", a: "#60a5fa", b: "#c4b5fd" },
  lvl3: { glyph: "🪩", a: "#a78bfa", b: "#f9a8d4" },
  lvl4: { glyph: "🌈", a: "#f472b6", b: "#fdba74" },
  lvl5: { glyph: "💅", a: "#ff2d92", b: "#ffd93d" },

  // อายุความคิด
  age_kid: { glyph: "🧃", a: "#ffd93d", b: "#ff9f43" },
  age_teen: { glyph: "🎧", a: "#ff5fa2", b: "#a855f7" },
  age_20s: { glyph: "🛵", a: "#22d3ee", b: "#60a5fa" },
  age_30s: { glyph: "☕", a: "#f59e0b", b: "#fcd34d" },
  age_40s: { glyph: "🪴", a: "#10b981", b: "#6ee7b7" },
  age_elder: { glyph: "🍵", a: "#94a3b8", b: "#e2e8f0" },

  // รูปปกของแต่ละ quiz (ไฟล์ results-covers.json)
  cover_gaymeter: { glyph: "🌈", a: "#ff2d92", b: "#ffd93d" },
  cover_mbti: { glyph: "🧠", a: "#7c5cff", b: "#22d3ee" },
  cover_aura: { glyph: "🔮", a: "#a855f7", b: "#ff5fa2" },
  cover_isekai: { glyph: "🗺️", a: "#ffd43b", b: "#ff6b3d" },
  cover_mentalage: { glyph: "⏳", a: "#22d3ee", b: "#ffd93d" },
};

const FALLBACK: Theme = { glyph: "✨", a: "#7c5cff", b: "#22d3ee" };

/** แยก "ชื่อหลัก — คำขยาย" ออกจากกัน (ตัวคั่นเป็น em dash หรือ hyphen) */
function splitTitle(raw: string): { main: string; sub: string } {
  const m = raw.split(/\s+[—–-]\s+/);
  const main = (m[0] ?? raw).trim();
  const sub = m.slice(1).join(" — ").trim();
  return { main, sub };
}

/** ตัดอิโมจิออกจากหัวเรื่อง — การ์ดมี glyph ใหญ่อยู่แล้ว ไม่ต้องซ้ำ */
function stripEmoji(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** ตัด "(INTJ)" ท้ายหัวเรื่อง — badge มุมขวาโชว์รหัสอยู่แล้ว */
function stripTypeCode(s: string): string {
  return s.replace(/\s*\(\s*[EI][NS][TF][JP]\s*\)\s*$/i, "").trim();
}

function fontFace(file: string, weight: number): string {
  const b64 = fs.readFileSync(file).toString("base64");
  return `@font-face{font-family:Sarabun;font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${b64}) format('truetype')}`;
}


function buildHtml(
  title: string,
  theme: Theme,
  fonts: string,
  badge: string,
  L: Layout,
): string {
  const { main, sub } = splitTitle(title);
  const mainClean = stripTypeCode(stripEmoji(main));
  const subClean = stripEmoji(sub);

  // หัวเรื่องยาว → ลดขนาดฟอนต์ลงเป็นขั้น ๆ กันล้นการ์ด
  // แบบ 16:9 มีที่ว่างแนวนอนน้อยกว่าเพราะต้องแบ่งครึ่งให้ glyph
  const steps = L.wide ? [58, 48, 40] : [74, 62, 52];
  const titleSize =
    mainClean.length > 34 ? steps[2] : mainClean.length > 22 ? steps[1] : steps[0];
  const subSize = L.wide ? 25 : 30;
  const glyphSize = L.wide ? 260 : 290;
  const discSize = L.wide ? 470 : 520;

  // จัตุรัส: glyph กลางบน + แผงชื่อล่างเต็มความกว้าง
  // 16:9: glyph ซ้าย + ข้อความขวา (แนวนอนมีที่ให้เรียงข้าง ๆ กัน)
  const frame = L.wide
    ? `.wrap{position:relative;height:100%;display:grid;
         grid-template-columns:43% 57%;align-items:center;
         padding:56px 64px 56px 40px}
       .disc{position:absolute;left:21.5%;top:50%;transform:translate(-50%,-50%)}
       .glyph{position:absolute;left:0;width:43%;top:50%;transform:translateY(-50%)}
       .brand{position:absolute;left:64px;top:44px}
       .panel{grid-column:2}`
    : `.wrap{position:relative;height:100%;display:flex;flex-direction:column;
         justify-content:space-between;padding:60px 62px 56px}
       .disc{position:absolute;left:50%;top:430px;transform:translate(-50%,-50%)}
       .glyph{position:absolute;left:0;right:0;top:430px;transform:translateY(-50%)}`;

  return `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${L.w}px;height:${L.h}px}
body{font-family:Sarabun,system-ui,sans-serif;
  background:#07070e;color:#fff;overflow:hidden;position:relative}
/* ── ดวงเรืองแสงพื้นหลัง ── */
.glow{position:absolute;border-radius:50%;filter:blur(90px)}
.g1{width:62%;height:68%;left:-9%;top:-18%;background:${theme.a};opacity:.55}
.g2{width:56%;height:62%;right:-10%;top:10%;background:${theme.b};opacity:.40}
.g3{width:68%;height:74%;left:18%;bottom:-36%;background:${theme.a};opacity:.32}
/* ── ตารางบาง ๆ ให้มีมิติ ── */
.grid{position:absolute;inset:0;opacity:.13;
  background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);
  background-size:56px 56px;
  -webkit-mask-image:radial-gradient(circle at 50% 42%,#000 20%,transparent 72%)}
/* ── เกรนกันภาพดูแบนเกินไป ── */
.noise{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay}
${frame}
.brand{display:flex;align-items:center;gap:12px;
  font-size:22px;font-weight:700;letter-spacing:.22em;color:rgba(255,255,255,.62);z-index:2}
.dot{width:12px;height:12px;border-radius:50%;background:${theme.b};
  box-shadow:0 0 18px 5px ${theme.b}}
/* จานรองเรืองแสง — ทำให้อิโมจิสีเข้ม (เช่น ♟️ 🗡️) ไม่จมไปกับพื้นมืด */
.disc{width:${discSize}px;height:${discSize}px;border-radius:50%;
  background:radial-gradient(circle,
    rgba(255,255,255,.26) 0%,
    rgba(255,255,255,.12) 38%,
    rgba(255,255,255,.04) 58%,
    transparent 72%);
  box-shadow:inset 0 0 70px ${theme.b}45}
.glyph{text-align:center;font-size:${glyphSize}px;line-height:1;z-index:1;
  filter:drop-shadow(0 0 3px rgba(255,255,255,.85))
         drop-shadow(0 0 55px ${theme.a})
         drop-shadow(0 0 110px ${theme.a}80)}
/* ── แผงกระจก ── */
.panel{position:relative;border-radius:34px;padding:38px 42px;z-index:2;
  background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.17);
  box-shadow:0 26px 70px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.28);
  backdrop-filter:blur(26px)}
.rule{width:76px;height:5px;border-radius:99px;margin-bottom:22px;
  background:linear-gradient(90deg,${theme.a},${theme.b});
  box-shadow:0 0 22px ${theme.a}}
/* line-height เผื่อสระบน/วรรณยุกต์ไทย — แน่นไปแล้วไม้เอก/ไม้โทโดนตัดหัว */
.title{font-size:${titleSize}px;font-weight:700;line-height:1.42;
  letter-spacing:-.01em;padding-top:4px}
.sub{margin-top:14px;font-size:${subSize}px;line-height:1.62;color:rgba(255,255,255,.74)}
.badge{position:absolute;right:42px;top:-19px;
  padding:9px 20px;border-radius:99px;font-size:20px;font-weight:700;
  color:#07070e;background:linear-gradient(90deg,${theme.a},${theme.b});
  box-shadow:0 8px 26px ${theme.a}70}
</style>
<div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
<div class="grid"></div>
<svg class="noise"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="disc"></div>
<div class="glyph">${theme.glyph}</div>
<div class="wrap">
  <div class="brand"><span class="dot"></span>QUIBBY</div>
  <div class="panel">
    ${badge ? `<div class="badge">${badge}</div>` : ""}
    <div class="rule"></div>
    <div class="title">${mainClean}</div>
    ${subClean ? `<div class="sub">${subClean}</div>` : ""}
  </div>
</div>`;
}

async function main() {
  const contentDir = process.argv[2];
  const outDir = process.argv[3];
  if (!contentDir || !outDir) {
    console.error("usage: tsx scripts/gen-result-cards.ts <contentDir> <outDir>");
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const fonts = [
    fontFace("assets/fonts/Sarabun-Regular.ttf", 400),
    fontFace("assets/fonts/Sarabun-Bold.ttf", 700),
  ].join("\n");

  const files = fs
    .readdirSync(contentDir)
    .filter((f) => f.startsWith("results-") && f.endsWith(".json"))
    .sort();

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  let made = 0;

  for (const file of files) {
    const slug = file.replace(/^results-|\.json$/g, "");
    const layout = slug === "covers" ? WIDE : SQUARE;
    const { results } = JSON.parse(
      fs.readFileSync(path.join(contentDir, file), "utf8"),
    ) as { results: { resultKey: string; title: string }[] };

    await page.setViewportSize({ width: layout.w, height: layout.h });

    for (const r of results) {
      const theme = CARD_THEME[r.resultKey] ?? FALLBACK;
      // MBTI โชว์รหัส 4 ตัวเป็น badge เพราะเป็นตัวระบุที่คนจำ
      const badge = /^[EI][NS][TF][JP]$/.test(r.resultKey) ? r.resultKey : "";

      await page.setContent(buildHtml(r.title, theme, fonts, badge, layout), {
        waitUntil: "load",
      });
      // ให้เวลา backdrop-filter/blur วาดจบก่อนแคป
      await page.waitForTimeout(120);

      // JPEG แทน PNG — การ์ดไล่เฉดสีทำให้ PNG โตถึง ~470KB/ใบ
      // ขณะที่แสดงจริงแค่ 256px บนหน้าเว็บ JPEG q92 เล็กกว่า 5-6 เท่าโดยตาแทบไม่เห็นต่าง
      const out = path.join(outDir, `${slug}__${r.resultKey}.jpg`);
      await page.screenshot({ path: out, type: "jpeg", quality: 92 });
      made++;
      if (!CARD_THEME[r.resultKey]) {
        console.warn(`  ! ไม่มีธีมของ ${r.resultKey} — ใช้ค่า fallback`);
      }
    }
    console.log(`${slug}: ${results.length} ใบ (${layout.w}×${layout.h})`);
  }

  await browser.close();
  console.log(`\nเสร็จ ${made} ใบ → ${outDir}`);
}

main();
