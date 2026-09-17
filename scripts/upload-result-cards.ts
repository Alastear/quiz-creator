// อัปการ์ดผลลัพธ์ขึ้น Vercel Blob แล้วเขียน manifest (slug/resultKey -> url)
// รัน: pnpm tsx --env-file=.env.local scripts/upload-result-cards.ts <cardsDir>
//
// ใช้ addRandomSuffix:false + allowOverwrite เพื่อให้ path คงที่
// รันซ้ำแล้วรูปถูกทับที่เดิม ไม่งอกไฟล์ขยะและ URL ใน DB ไม่เน่า
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: tsx scripts/upload-result-cards.ts <cardsDir>");
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort();

  const manifest: Record<string, string> = {};
  let done = 0;

  for (const f of files) {
    // ชื่อไฟล์รูปแบบ "<slug>__<resultKey>.jpg"
    const [slug, resultKey] = f.replace(/\.jpg$/, "").split("__");
    if (!slug || !resultKey) {
      console.warn(`ข้าม ${f} — ชื่อไฟล์ไม่ตรงรูปแบบ`);
      continue;
    }

    const blob = await put(
      `quiz-cards/${slug}/${resultKey}.jpg`,
      fs.readFileSync(path.join(dir, f)),
      {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31536000,
      },
    );

    manifest[`${slug}/${resultKey}`] = blob.url;
    done++;
    if (done % 10 === 0) console.log(`  อัปแล้ว ${done}/${files.length}`);
  }

  const out = path.join(dir, "urls.json");
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(`\nอัปครบ ${done} ใบ → manifest: ${out}`);
}

main();
