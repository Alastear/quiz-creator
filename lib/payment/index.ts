import { nanoid } from "nanoid";
import { env } from "@/lib/env";
import { fulfillCreditPack, fulfillDonation } from "@/lib/fulfillment";

// Payment adapter (DESIGN.md ข้อ 6.2/10) — mock จ่ายเสร็จทันที, stripe ใช้ Checkout+webhook
// คืน url ให้ action redirect ผู้ใช้ไป (mock = กลับ billing เลย, stripe = หน้า Stripe)
export interface PaymentProvider {
  checkoutCreditPack(userId: string, packId: string): Promise<{ url: string }>;
  checkoutDonation(userId: string, amount: number): Promise<{ url: string }>;
}

const mockProvider: PaymentProvider = {
  async checkoutCreditPack(userId, packId) {
    const ref = `mock_${nanoid(16)}`;
    const res = await fulfillCreditPack(userId, packId, "mock", ref);
    if (!res.ok) throw new Error(res.error ?? "จ่ายไม่สำเร็จ");
    return { url: "/dashboard/billing?paid=credit" };
  },
  async checkoutDonation(userId, amount) {
    const ref = `mock_${nanoid(16)}`;
    const res = await fulfillDonation(userId, amount, "mock", ref);
    if (!res.ok) throw new Error(res.error ?? "โดเนทไม่สำเร็จ");
    return { url: "/dashboard/billing?paid=donation" };
  },
};

// Stripe (Phase prod): pnpm add stripe, สร้าง Checkout Session แล้ว fulfill ผ่าน webhook
const stripeProvider: PaymentProvider = {
  async checkoutCreditPack() {
    throw new Error("Stripe ยังไม่ได้ตั้งค่า — ใส่ STRIPE_SECRET_KEY แล้วสลับ PAYMENT_DRIVER=stripe");
  },
  async checkoutDonation() {
    throw new Error("Stripe ยังไม่ได้ตั้งค่า");
  },
};

export const payment: PaymentProvider =
  env.PAYMENT_DRIVER === "stripe" ? stripeProvider : mockProvider;
