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
  async send({ to, subject, body, html }) {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY ไม่ได้ตั้ง");
    // import แบบ dynamic เพื่อไม่ให้โหลด SDK ตอน dev ที่ใช้ console
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      ...(html ? { html: body } : { text: body }),
    });
    if (error) throw new Error(`ส่งอีเมลไม่สำเร็จ: ${error.message}`);
  },
};

export const emailer: Emailer =
  env.EMAIL_DRIVER === "resend" ? resendEmailer : consoleEmailer;
