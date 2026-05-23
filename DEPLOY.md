# คู่มือ Deploy ขึ้น Vercel (ทดสอบ Stripe test mode บน URL จริง)

> เป้าหมาย: deploy บน **Vercel Hobby (ฟรี)** + Stripe **test mode** เพื่อทดสอบทั้งระบบบน URL จริง
> ⚠️ Hobby ห้ามใช้เชิงพาณิชย์จริง — test mode (เงินปลอม) โอเค · พอรับเงินจริงค่อยอัป **Pro ($20)**

ทำตามลำดับ 1 → 8 (✅ = ผมทำให้แล้ว, 👤 = คุณต้องทำเอง เพราะต้องล็อกอินบัญชีคุณ)

---

## 1. Push โค้ดขึ้น GitHub ✅
ผม push ให้แล้ว (repo: `Alastear/quiz-creator`, branch `main`)

## 2. สร้าง Vercel project 👤
1. ไป **vercel.com** → Add New → **Project**
2. Import repo **Alastear/quiz-creator**
3. **อย่าเพิ่งกด Deploy** — ไปตั้ง storage + env ก่อน (ข้อ 3–5) ไม่งั้น build จะ fail เพราะไม่มี `DATABASE_URL`

## 3. ผูก Database + Blob (Vercel Marketplace) 👤
ในหน้า project → แท็บ **Storage** → Create / Connect:
- **Neon** (Postgres) → จะ inject `DATABASE_URL` ให้อัตโนมัติ
- **Blob** → จะ inject `BLOB_READ_WRITE_TOKEN` ให้อัตโนมัติ
- (ข้าม Upstash ได้ — เราใช้ rate-limit แบบ memory ไปก่อน)

## 4. รัน migration ใส่ฐานข้อมูล Neon 👤
Vercel ไม่รัน migration ให้ ต้องรันเองครั้งเดียว:
1. คัดลอก connection string ของ Neon (Vercel → Storage → Neon → `.env.local` tab หรือ Neon dashboard)
2. ที่เครื่องคุณ:
   ```bash
   DATABASE_URL="<neon-connection-string>" pnpm db:migrate
   ```
   (ใช้ connection string แบบ direct/pooled ที่ Neon ให้ก็ได้)

## 5. ตั้ง Environment Variables บน Vercel 👤
project → **Settings → Environment Variables** → ใส่ทั้งหมดนี้ (Production + Preview):

| Key | ค่า | หมายเหตุ |
|---|---|---|
| `DATABASE_URL` | (auto จาก Neon) | ข้อ 3 |
| `BLOB_READ_WRITE_TOKEN` | (auto จาก Blob) | ข้อ 3 |
| `AUTH_SECRET` | สร้างใหม่: `openssl rand -base64 32` | คนละตัวกับ local |
| `ADMIN_EMAILS` | `miraistorm@gmail.com` | คุณเป็น admin |
| `NEXT_PUBLIC_APP_URL` | `https://<โปรเจกต์>.vercel.app` | URL ที่ Vercel ให้ (ใส่หลัง deploy ครั้งแรกได้) |
| `CRON_SECRET` | สุ่มสตริงอะไรก็ได้ | กัน cron ถูกเรียกมั่ว |
| `STORAGE_DRIVER` | `blob` | |
| `EMAIL_DRIVER` | `resend` | (ดูข้อ 5.1) |
| `RESEND_API_KEY` | จาก resend.com | (ดูข้อ 5.1) |
| `EMAIL_FROM` | `Quibby <onboarding@resend.dev>` | หรือโดเมนที่ verify แล้ว |
| `PAYMENT_DRIVER` | `stripe` | |
| `STRIPE_SECRET_KEY` | `sk_test_...` | จาก Stripe sandbox |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ได้จากข้อ 7 (ใส่ทีหลัง) |
| `RATELIMIT_DRIVER` | `memory` | |

### 5.1 เรื่อง Email (เลือกทางใดทางหนึ่ง)
- **ง่ายสุดสำหรับทดสอบ:** สมัคร resend.com → เอา `RESEND_API_KEY` → ตั้ง `EMAIL_FROM="Quibby <onboarding@resend.dev>"`
  → แบบนี้ส่ง magic link ได้เฉพาะไป**อีเมลที่สมัคร Resend** (พอสำหรับทดสอบด้วยตัวเอง)
- **ส่งหาใครก็ได้:** ต้อง verify โดเมนใน Resend ก่อน แล้วใช้ `EMAIL_FROM` เป็นโดเมนนั้น
- **ทางเลี่ยง:** เปิด Google OAuth (ใส่ `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` + เพิ่ม redirect URI `https://<โดเมน>/api/auth/callback/google` ใน Google Cloud Console) → ล็อกอินด้วย Google ไม่ต้องพึ่งอีเมล

## 6. Deploy 👤
กด **Deploy** → รอ build เสร็จ → ได้ URL `https://<โปรเจกต์>.vercel.app`
- ถ้ายังไม่ได้ใส่ `NEXT_PUBLIC_APP_URL` → ใส่ตอนนี้ (= URL ที่ได้) แล้ว **Redeploy**

## 7. ตั้ง Stripe Webhook (ชี้มา URL Vercel) 👤
1. Stripe (sandbox/test) → **Developers → Webhooks → Add endpoint**
2. URL: `https://<โปรเจกต์>.vercel.app/api/stripe/webhook`
3. Events: `checkout.session.completed` + `checkout.session.async_payment_succeeded`
4. สร้าง → คัดลอก **Signing secret `whsec_...`**
5. เอาไปใส่ env `STRIPE_WEBHOOK_SECRET` บน Vercel → **Redeploy**

## 8. ทดสอบ 👤
1. เข้า `https://<โปรเจกต์>.vercel.app`
2. ล็อกอิน (Google หรือ magic link) ด้วย **miraistorm@gmail.com** → ยอมรับ PDPA
3. เข้า `/admin` → ต้องเข้าได้ (auto-promote เป็น admin)
4. สร้าง quiz → เผยแพร่ → เล่น → ดูผลลัพธ์ + แชร์ (OG image ขึ้น)
5. `/dashboard/billing` → ซื้อเครดิต → จ่ายด้วยบัตร **`4242 4242 4242 4242`** (หรือ PromptPay test)
   → กลับมาเครดิตเพิ่ม (webhook fulfill) ✅

---

## หมายเหตุ
- **Cron**: `vercel.json` ตั้ง `/api/cron/lifecycle` รันรายวันแล้ว — Vercel ส่ง `Authorization: Bearer $CRON_SECRET` ให้อัตโนมัติ (Hobby รันได้วันละครั้ง)
- **OG image**: ฟอนต์ถูก bundle ผ่าน `outputFileTracingIncludes` แล้ว
- **อัป Pro เมื่อไร**: ตอนจะรับเงินจริง (สลับ Stripe เป็น live keys) — Hobby ห้ามพาณิชย์
- **ทุก secret อยู่บน Vercel env เท่านั้น** ไม่ commit ลง git (`.env.local` ถูก gitignore)
