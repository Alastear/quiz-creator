// รัน lifecycle cron ด้วยมือบน local (prod ใช้ Vercel Cron)
// pnpm cron
import { expirePublished, archiveExpired } from "@/lib/lifecycle";

async function main() {
  const now = new Date();
  const expired = await expirePublished(now);
  const archived = await archiveExpired(now);
  console.log(`✓ lifecycle: expired=${expired} archived=${archived}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("cron failed:", e);
  process.exit(1);
});
