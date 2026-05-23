import Stripe from "stripe";
import { env } from "@/lib/env";
import { packById } from "@/lib/pricing";
import type { PaymentProvider } from "./index";

// สร้าง client แบบ lazy (จะไม่พังตอน dev ที่ไม่ได้ตั้ง STRIPE_SECRET_KEY)
let _stripe: Stripe | null = null;
export function stripeClient(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY ไม่ได้ตั้ง");
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

const appUrl = env.NEXT_PUBLIC_APP_URL;
// PromptPay + บัตร (DESIGN.md ข้อ 10.2) — THB เป็นสตางค์ (×100)
const methods = ["card", "promptpay"] as const;

export const stripeProvider: PaymentProvider = {
  async checkoutCreditPack(userId, packId) {
    const pack = packById(packId);
    if (!pack) throw new Error("ไม่พบแพ็ก");
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: [...methods],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "thb",
            unit_amount: pack.price * 100,
            product_data: { name: `Quibby ${pack.credits} เครดิต` },
          },
        },
      ],
      // metadata ใช้ตอน webhook fulfill (idempotent ด้วย session.id)
      metadata: { userId, kind: "credit_pack", packId },
      success_url: `${appUrl}/dashboard/billing?paid=credit`,
      cancel_url: `${appUrl}/dashboard/billing?error=cancel`,
    });
    return { url: session.url ?? `${appUrl}/dashboard/billing?error=stripe` };
  },

  async checkoutDonation(userId, amount) {
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: [...methods],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "thb",
            unit_amount: amount * 100,
            product_data: { name: "สนับสนุน Quibby" },
          },
        },
      ],
      metadata: { userId, kind: "donation", amount: String(amount) },
      success_url: `${appUrl}/dashboard/billing?paid=donation`,
      cancel_url: `${appUrl}/dashboard/billing?error=cancel`,
    });
    return { url: session.url ?? `${appUrl}/dashboard/billing?error=stripe` };
  },
};
