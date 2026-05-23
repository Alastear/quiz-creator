import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripeClient } from "@/lib/payment/stripe";
import { fulfillCreditPack, fulfillDonation } from "@/lib/fulfillment";

// Stripe webhook (DESIGN.md ข้อ 10.2) — verify signature + fulfill (idempotent ด้วย session.id)
// PromptPay เป็น async → fulfill เมื่อ payment_status='paid' ทั้งจาก completed และ async_payment_succeeded
export async function POST(req: Request) {
  if (env.PAYMENT_DRIVER !== "stripe" || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe ยังไม่ได้ตั้งค่า" }, { status: 501 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const body = await req.text(); // ต้องเป็น raw body
  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "signature invalid" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === "paid") {
      const m = s.metadata ?? {};
      const ref = s.id; // idempotency key
      if (m.kind === "credit_pack" && m.userId && m.packId) {
        await fulfillCreditPack(m.userId, m.packId, "stripe", ref);
      } else if (m.kind === "donation" && m.userId && m.amount) {
        await fulfillDonation(m.userId, Number(m.amount), "stripe", ref);
      }
    }
  }

  return NextResponse.json({ received: true });
}
