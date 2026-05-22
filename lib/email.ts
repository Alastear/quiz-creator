import { env } from "@/lib/env";

// Email adapter (DESIGN.md ข้อ 6.2)
//   console = log ออก terminal (dev — เห็น magic link ได้เลย)
//   resend  = ส่งจริงผ่าน Resend ตอน prod (Phase 0.5)

export type SendEmailInput = {
  to: string;
  subject: string;
  /** เนื้อหา (plain text หรือ html) */
  body: string;
  html?: boolean;
};

export interface Emailer {
  send(input: SendEmailInput): Promise<void>;
}

const consoleEmailer: Emailer = {
  async send({ to, subject, body }) {
    console.log(
      [
        "",
        "📧 ───────── EMAIL (console driver) ─────────",
        `  to:      ${to}`,
        `  from:    ${env.EMAIL_FROM}`,
        `  subject: ${subject}`,
        "  body:",
        body
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
        "────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  },
};

const resendEmailer: Emailer = {
  async send() {
    throw new Error(
      "Resend emailer ยังไม่ได้ติดตั้ง — ติดตั้งตอน Phase 0.5 (pnpm add resend, ตั้ง RESEND_API_KEY)",
    );
  },
};

export const emailer: Emailer =
  env.EMAIL_DRIVER === "resend" ? resendEmailer : consoleEmailer;
