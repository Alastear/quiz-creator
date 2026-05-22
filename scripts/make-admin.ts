// ตั้ง user เป็น admin ด้วยอีเมล
// pnpm dlx tsx --env-file=.env.local scripts/make-admin.ts you@example.com
import postgres from "postgres";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: make-admin.ts <email>");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await sql`
    update users set role = 'admin' where lower(email) = lower(${email}) returning id, email`;
  console.log(rows.length ? `✓ ${rows[0].email} เป็น admin แล้ว` : "ไม่พบ user (ต้องล็อกอินอย่างน้อย 1 ครั้งก่อน)");
  await sql.end();
  process.exit(0);
}
main();
