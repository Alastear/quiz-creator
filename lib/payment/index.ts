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

// Stripe provider อยู่ในไฟล์แยก (lib/payment/stripe.ts) — import แบบ lazy ผ่าน getter
// เพื่อไม่ให้ stripe SDK ถูกโหลด/สร้าง client ตอน dev ที่ใช้ mock
import { stripeProvider } from "./stripe";

export const payment: PaymentProvider =
  env.PAYMENT_DRIVER === "stripe" ? stripeProvider : mockProvider;
