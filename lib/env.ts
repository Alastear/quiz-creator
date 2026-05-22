import { z } from "zod";

// ตรวจ environment variables ตอน boot (fail fast ถ้าตั้งค่าผิด)
// adapter เลือก driver จากค่าตรงนี้ (DESIGN.md ข้อ 6.2)

const schema = z.object({
  DATABASE_URL: z.url(),

  STORAGE_DRIVER: z.enum(["local", "blob"]).default("local"),
  LOCAL_UPLOAD_DIR: z.string().default(".uploads"),

  RATELIMIT_DRIVER: z.enum(["memory", "upstash"]).default("memory"),
  EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),

  // prod-only — ปล่อยว่างได้ตอน local
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Quibby <noreply@quibby.app>"),

  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  CRON_SECRET: z.string().min(1).default("dev-cron-secret-change-me"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Environment variables ไม่ถูกต้อง:",
    z.flattenError(parsed.error).fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
