import type { NextConfig } from "next";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

// CSP เชิงปฏิบัติ (DESIGN.md ข้อ 12): อนุญาตรูปจากภายนอก (ผู้ใช้วาง URL ได้),
// embed YouTube, และ inline ของ Next. ลด vector คลิกแจ็ก/injection ด้วย frame-ancestors/object-src
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // ตรึง workspace root ที่โฟลเดอร์นี้ (มี lockfile อื่นบนเครื่องทำให้ Next เดา root ผิด)
  turbopack: {
    root: path.join(__dirname),
  },
  // bundle ฟอนต์ไทยเข้า serverless function ของ OG image (อ่านด้วย fs ตอน runtime)
  // ไม่งั้นบน Vercel ไฟล์ .ttf จะไม่ถูก trace → OG image พัง
  outputFileTracingIncludes: {
    "/quiz/[publicId]/opengraph-image": ["./assets/fonts/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
