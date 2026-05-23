import { NextResponse } from "next/server";
import { env } from "@/lib/env";
// import Stripe from "stripe";  // เปิดใช้ตอน prod: pnpm add stripe
// import { fulfillCreditPack, fulfillDonation } from "@/lib/fulfillment";

// Stripe webhook (DESIGN.md ข้อ 10.2) — scaffold สำหรับ prod
// ตอนตั้ง Stripe จริง:
//  1) pnpm add stripe
//  2) verify signature ด้วย STRIPE_WEBHOOK_SECRET (กันปลอม)
//  3) event 'checkout.session.completed' -> อ่าน metadata (userId, kind, packId/amount)
//     แล้วเรียก fulfillCreditPack / fulfillDonation (idempotent ด้วย event.id)
export async function POST(req: Request) {
  if (env.PAYMENT_DRIVER !== "stripe" || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe ยังไม่ได้ตั้งค่า" },
      { status: 501 },
    );
  }

  // const sig = req.headers.get("stripe-signature");
  // const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
  // const event = stripe.webhooks.constructEvent(await req.text(), sig!, env.STRIPE_WEBHOOK_SECRET!);
  // if (event.type === "checkout.session.completed") { ...fulfill... }
  void req;
  return NextResponse.json({ received: true });
}
