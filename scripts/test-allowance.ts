// ทดสอบ effectiveAllowance ตามตัวอย่างผู้ใช้
// pnpm exec tsx --env-file=.env.local scripts/test-allowance.ts
import assert from "node:assert";
import { effectiveAllowance, MAX_ALLOWANCE } from "@/lib/entitlements";

const mon = (s: string) => new Date(s); // วันจันทร์ไทย
const w0 = mon("2024-01-01T00:00:00+07:00"); // จันทร์
const w1 = mon("2024-01-08T00:00:00+07:00"); // +1 สัปดาห์
const w3 = mon("2024-01-22T00:00:00+07:00"); // +3 สัปดาห์

// เหลือ 3 → ผ่านวันจันทร์ 1 ครั้ง → 5
assert.equal(effectiveAllowance(3, w0, w1), 5, "3 -> 5 หลัง 1 จันทร์");
// เหลือ 9 → จันทร์ → 10 (ไม่เกิน 10, ไม่ใช่ 11)
assert.equal(effectiveAllowance(9, w0, w1), 10, "9 -> 10 (cap)");
// เหลือ 3 → ผ่าน 3 จันทร์ → min(10, 3+6)=9
assert.equal(effectiveAllowance(3, w0, w3), 9, "3 -> 9 หลัง 3 จันทร์");
// สัปดาห์เดียวกัน ไม่เติม
assert.equal(effectiveAllowance(5, w0, w0), 5, "same week no refill");
// 10 อยู่แล้ว คงที่
assert.equal(effectiveAllowance(10, w0, w1), MAX_ALLOWANCE, "10 stays 10");
// 0 → จันทร์ → 2
assert.equal(effectiveAllowance(0, w0, w1), 2, "0 -> 2");

console.log("✓ allowance: ตรงตามตัวอย่างทั้งหมด (เติม +2 ทุกจันทร์ เพดาน 10)");
process.exit(0);
