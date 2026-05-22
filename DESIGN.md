# Quibby — เอกสารออกแบบระบบ (Design Doc)

> **Quibby** = แพลตฟอร์มสร้าง quiz สนุก ๆ สำหรับคนทั่วไป (repo: `quiz-creator`)
> เอกสารนี้เป็น "พิมพ์เขียว" — เขียนไว้ให้ครบก่อนเริ่ม code แล้วจึงลงมือทำเป็น phase
>
> สถานะ: **DRAFT v2** · อัปเดต: 2026-05-22 · แบรนด์ที่เลือก: **Quibby**

---

## 1. วิสัยทัศน์ (Vision)

แพลตฟอร์มให้คนทั่วไปเข้ามา **สร้าง quiz ของตัวเอง** ได้ง่าย ๆ แล้วแชร์ให้คนอื่นเล่น
แนวเดียวกับ [OOOPEN Lab](https://ooopenlab.cc/) — เน้น "quiz ทายผล / ทายนิสัย" (personality / result-based quiz)
เช่น ตัวอย่าง *"คุณตื่นมาแล้วกลายเป็นกระต่าย"* → ตอบคำถามไปเรื่อย ๆ → ได้ผลลัพธ์เป็น "แพทเทิร์น/ตัวละคร" ที่ตรงกับคำตอบ

เป้าหมายของเจ้าของระบบ: ทำเป็น **passive income เล็ก ๆ**
- ฟรี **3 quiz มาตรฐานที่ active พร้อมกัน** ต่อ user (ดูข้อ 10.3)
- เกินจากนั้น / ต่ออายุ / ปลดฟีเจอร์พิเศษ → จ่ายเงิน (microtransaction) หรือรับ donate

หลักการออกแบบ 4 ข้อ:
1. **สร้างง่าย** — คนไม่เขียนโค้ดก็ทำได้ใน 10 นาที (drag, พิมพ์, อัปโหลด)
2. **เล่นสนุก แชร์ง่าย** — มือถือเป็นหลัก, ผลลัพธ์น่าแชร์ลง social
3. **ประหยัดต้นทุน** — รันบน free tier ของ Vercel + marketplace ให้นานที่สุด
4. **ปลอดภัยตั้งแต่วันแรก** — auth, payment, PDPA, ป้องกันช่องโหว่ระดับ production

---

## 2. สรุปผลการ Research

### 2.1 แพลตฟอร์มอ้างอิง (OOOPEN Lab)
เป็น no-code gamification platform ทำ quiz ทายนิสัยแนวไวรัล (MBTI, Love Language, Attachment Style ฯลฯ)
- ใช้ **template + drag & drop** คล้าย Canva
- มี analytics หลังบ้าน: conversion rate, traffic, สัดส่วนผลลัพธ์แต่ละแบบ
- มี free tier ให้ลองสร้าง
- บทเรียนที่เอามาใช้: **เริ่มจาก template, โฟกัส quiz ทายผล, มีสถิติให้เจ้าของ quiz**

### 2.2 มาตรฐาน UX ของ personality quiz (ปี 2025–2026)
จากข้อมูล Interact / Typeform / NN Group:
- จำนวนคำถามเฉลี่ยที่ conversion ดี = **~13 ข้อ** (เพิ่มจาก 7 ข้อในปี 2019)
- โครงสร้างมาตรฐาน = **single-select (radio) 3–5 ตัวเลือกต่อข้อ**
- ระบบให้คะแนนที่เชื่อถือได้ที่สุดสำหรับ quiz สั้น = **single-axis scoring**
  → แต่ละตัวเลือก "+คะแนน" ให้ผลลัพธ์ 1 แบบขึ้นไป → จบแล้วผลที่คะแนนสูงสุดชนะ
- จำนวนผลลัพธ์ (archetype) ที่จัดการง่าย = **3–6 แบบ**
- ผลลัพธ์แต่ละแบบควรมี **หน้าเฉพาะของตัวเอง**: รูป + คำบรรยาย + ปุ่มแชร์

### 2.3 Storage ฟรีบน Vercel (ผ่าน Marketplace)
| ใช้ทำอะไร | บริการแนะนำ | Free tier (โดยประมาณ) |
|---|---|---|
| ฐานข้อมูลหลัก (relational) | **Neon Postgres** | scale-to-zero, หลาย project, เหมาะ dev/เริ่มต้นที่สุด |
| Cache / rate-limit / session | **Upstash Redis** | ~500k commands/เดือน, 256MB |
| ไฟล์ media (รูป/เสียง/วิดีโอ) | **Vercel Blob** | public + private, client upload ได้ |

> หมายเหตุ: `@vercel/postgres` และ `@vercel/kv` แบบเดิม **ถูกยกเลิกแล้ว** ใช้ Neon + Upstash ผ่าน Marketplace แทน
> ค่าใช้ตัวเลขจริงต้องเช็คหน้า pricing อีกครั้งก่อน launch เพราะ free tier เปลี่ยนได้

### 2.4 ระบบชำระเงิน (Thailand-friendly)
| ตัวเลือก | จุดเด่น | ค่าธรรมเนียม PromptPay |
|---|---|---|
| **Stripe** (แนะนำ) | DX ดีที่สุด, Stripe Checkout ทำเสร็จเร็ว, รองรับ PromptPay + บัตร + Apple/Google Pay, webhook security ดี | ~1.65% |
| Opn Payments (เดิม Omise) | บริษัทไทย, รองรับทุกธนาคาร, QR ในประเทศ | ~1.65% |

**แนะนำ Stripe + Stripe Checkout (hosted page)** เพราะ:
- ไม่ต้องเก็บข้อมูลบัตรเอง (PCI ลดภาระมาก)
- รองรับ **PromptPay QR** สำหรับคนไทย และบัตรสำหรับต่างชาติ
- ใช้กับ donation / จ่ายครั้งเดียว / subscription ในตัวเดียว
- webhook + signature verification กันการปลอมยอด

---

## 3. ขอบเขตฟีเจอร์ (Scope)

### 3.1 MVP (Phase 1–3)
- สมัคร/เข้าสู่ระบบด้วย **Google OAuth** หรือ **Email magic link**
- **PDPA consent** ก่อนใช้งานครั้งแรก
- สร้าง quiz: ตั้งชื่อ, รูปปก, คำถามหลายข้อ
- คำถาม + ตัวเลือก รองรับ **text / รูป / เสียง / วิดีโอ**
- กำหนด **ผลลัพธ์ (result patterns)** 3–6 แบบ + map คะแนน
- หน้าเล่น quiz (public) + หน้าแสดงผล + ปุ่มแชร์
- quiz มีอายุ **7 วัน** แล้วหมดอายุ
- ฟรี **3 quiz ต่อ user**
- Dashboard ผู้สร้าง: รายการ quiz, สถานะ, สถิติพื้นฐาน
- Admin dashboard: สถิติรวม, จัดการ user/quiz

### 3.2 Phase ถัดไป
- ชำระเงิน: ซื้อ quiz เพิ่ม / ต่ออายุ quiz / ปลดฟีเจอร์พิเศษ
- ระบบ **donate** (tip jar) + แลกเป็น credit
- archive quiz หมดอายุเป็น JSON + กู้คืน
- template สำเร็จรูป, theme ปรับแต่ง, ลบ branding
- analytics ขั้นสูง + export
- (อนาคต) subscription รายเดือน "Pro"

### 3.3 ยังไม่ทำใน v1 (Non-goals)
- quiz แบบให้คะแนนสอบ/เฉลยถูกผิด (trivia/exam) — เก็บไว้เป็น mode เสริมภายหลัง
- ทำงานร่วมหลายคน (team), custom domain
- mobile app native

---

## 4. โมเดล Quiz & ระบบให้คะแนน (หัวใจของระบบ)

### 4.1 ประเภท quiz & ตรรกะผลลัพธ์ (เลือกได้ตอนสร้าง)

1 quiz = **1 flow ใหญ่** ที่มีหลายคำถาม–หลายตัวเลือก จบด้วยหน้าผลลัพธ์ 1 หน้า
ผู้สร้างเลือก **"โหมดตรรกะผลลัพธ์" (result logic)** ได้ 3 แบบ:

| โหมด | ทำงานยังไง | เหมาะกับ |
|---|---|---|
| **`archetype`** (default) | แต่ละตัวเลือก +คะแนนให้ result หลายแบบ → ผลที่คะแนนสูงสุดชนะ | ทายนิสัย/ทายตัวละคร (แบบตัวอย่าง) |
| **`range`** | แต่ละตัวเลือกมี "แต้ม" → รวมแต้มทั้งหมด → ช่วงคะแนนไหน = ผลลัพธ์นั้น | แบบทดสอบให้คะแนน เช่น 0–10 = แบบ A, 11–20 = แบบ B |
| **`branching`** (if-else) | คำถามที่เลือกไว้ใส่เงื่อนไขได้: ตอบช้อยนี้ → กระโดดไปคำถาม X หรือล็อกผลลัพธ์เลย | quiz มีเส้นทางเฉพาะเจาะจง / decision tree |

> ผู้สร้างเลือกได้ว่าจะใช้โหมดไหน และใน `branching` สามารถใส่เงื่อนไข if-else เฉพาะ
> "บางคำถาม" ได้ (คำถามอื่น ๆ ไหลตามลำดับปกติ) — ยืดหยุ่นแต่ไม่บังคับให้ตั้งทุกข้อ

### 4.2 โครงสร้าง 1 quiz
```
Quiz
 ├─ Cover (ชื่อ, รูปปก, คำโปรย)
 ├─ Questions[]            // เรียงลำดับได้
 │    ├─ prompt (text + media: image/audio/video)
 │    └─ Choices[]         // 2–6 ตัวเลือก
 │         ├─ label (text + media)
 │         └─ scoreMap     // { resultKey: points } เช่น {"rabbit": 2, "cat": 1}
 └─ Results[]              // 2–6 แพทเทิร์น
      ├─ key, title, description
      ├─ media (รูปผลลัพธ์)
      └─ shareText (ข้อความตอนแชร์)
```

### 4.3 เครื่องมือคิดผลลัพธ์ (Scoring engine)

**โหมด `archetype` (default):**
1. แต่ละตัวเลือกถือ `scoreMap` เช่น เลือกข้อ A → `rabbit +2, cat +1`
2. รวมคะแนนทุกข้อต่อ `resultKey`
3. ผลที่คะแนนสูงสุด = ผลลัพธ์ที่แสดง · เสมอ → ใช้ลำดับ result เป็น tie-break (deterministic)

**โหมด `range`:**
1. แต่ละตัวเลือกมีค่าแต้ม `points` (เช่น 0, 1, 2 …)
2. รวมแต้มทั้ง quiz เป็นคะแนนรวม
3. แต่ละ result กำหนด **ช่วง `scoreMin`–`scoreMax`** → คะแนนรวมตกในช่วงไหน = result นั้น
4. validation: ช่วงต้องครอบคลุมคะแนนต่ำสุด–สูงสุดที่เป็นไปได้ และไม่ทับซ้อนกัน (builder เช็คให้)

**โหมด `branching` (if-else):**
1. แต่ละ choice ตั้ง `next` ได้ (optional): `"q:<questionId>"` (ไปคำถามถัดที่ระบุ) หรือ `"r:<resultKey>"` (จบทันทีด้วยผลลัพธ์นี้)
2. ถ้า choice ไม่ตั้ง `next` → ไหลไปคำถามถัดไปตามลำดับปกติ
3. ป้องกัน loop/ตันด้วยการตรวจ graph ตอน publish (ทุกเส้นทางต้องไปจบที่ result)
4. (อาจรวมกับการให้คะแนนได้ — branching คุมเส้นทาง, archetype/range คุมผลปลายทาง)

**โหมดขั้นสูง — Multi-axis (MBTI style, เก็บไว้ทำทีหลัง):**
- มีหลายแกน เช่น E/I, S/N → แต่ละตัวเลือกบวกคะแนนในแกน → ประกอบเป็น type เช่น "INFP"

> Engine ออกแบบเป็น strategy เดียวที่รับ `resultLogic` เป็น parameter → เพิ่มโหมดใหม่ได้โดยไม่แตะส่วนอื่น
> **ลำดับการทำ:** `archetype` + `range` ทำใน MVP (โค้ดร่วมกันได้), `branching` ทำหลังจากนั้น (ต้องมี flow editor)

### 4.4 จุดเด่นที่อยากให้ต่างจากคู่แข่ง (Differentiators)
- **"Result Probability Bar"** — ตอนแสดงผลโชว์ % ความใกล้เคียงของผลลัพธ์อื่น ๆ ด้วย (เช่น กระต่าย 60% / แมว 30%) ทำให้รู้สึก personalized
- **Media-rich choices** — ตัวเลือกเป็นรูป/เสียง/วิดีโอได้เต็มที่ (หลายเจ้าจำกัดแค่ text)
- **Shareable result card** — auto-generate รูปการ์ดผลลัพธ์สำหรับแชร์ลง social (ดูข้อ 4.6)
- **One-link play** — public URL สั้น เล่นได้เลยไม่ต้องสมัคร (เฉพาะ "สร้าง" ที่ต้องสมัคร)

### 4.5 หน้าออกแบบผลลัพธ์ (Result Page Designer)

จัดวาง element ได้เอง โดยแบ่งเป็น 2 ระดับตาม free/paid:

**โหมด Template (ทุกคน รวม free):**
- เลือก layout สำเร็จรูป (เช่น รูปบน-ข้อความล่าง, รูปพื้นหลังเต็มจอ + ข้อความทับ)
- แก้ได้เฉพาะ "ช่อง" ที่กำหนด: รูปผลลัพธ์, หัวข้อ, คำบรรยาย, สี, ฟอนต์ (จาก 5 ฟอนต์, ดูข้อ 6.1)
- ใช้งานง่าย เหมาะคนทั่วไป จบใน 1 นาที

**โหมด Free-form Canvas (ผู้จ่ายเงิน / ปลดฟีเจอร์):**
- canvas แบบ drag/resize/หมุน/จัดเลเยอร์ (z-index) วาง element ได้อิสระ:
  รูป, กล่องข้อความ, สติกเกอร์/ไอคอน, รูปทรง, สีพื้นหลัง/gradient
- คุมตำแหน่ง/ขนาด/สี/ฟอนต์ของแต่ละชิ้นได้เต็มที่ (ใกล้เคียง Canva ขนาดเล็ก)
- เก็บ layout เป็น JSON (`results.layout`) แล้วเรนเดอร์เหมือนกันทั้งบนเว็บและตอน export เป็นรูป

> สรุปคำถามที่ถาม: **ใช่ — ออกแบบจัดวาง element เองได้** โดย free ใช้ template ปรับช่องได้,
> ส่วน free-form canvas (ลากวางอิสระสุด) เป็นฟีเจอร์ของคนจ่ายเงิน

### 4.6 การแชร์ผลลัพธ์ & บันทึกเป็นรูป (Share & Capture)

ที่หน้าผลลัพธ์มี:
- **ปุ่มแชร์ตรงไปแต่ละแพลตฟอร์ม**: LINE, Facebook, X (Twitter), Discord, คัดลอกลิงก์
  + **Web Share API** บนมือถือ (เปิด sheet แชร์ของระบบไปได้ทุกแอป รวม IG/Messenger)
- **บันทึกผลลัพธ์เป็นรูปภาพ** (แคปเฉพาะส่วนการ์ดผลลัพธ์):
  - **ดาวน์โหลดรูป** — ใช้ client-side capture (เช่น `html-to-image`) แคปเฉพาะ DOM ของการ์ดผลลัพธ์เป็น PNG ให้ผู้เล่นเซฟ/แชร์เอง
  - **OG preview image** — สร้างรูปการ์ดด้วย `next/og` (Satori) ฝั่ง server สำหรับ social preview เวลาแชร์ลิงก์ (แสดง quiz + ผลลัพธ์สวย ๆ ตอน paste ลง LINE/FB/X)
- การแชร์ทุกช่องทางแนบ `shareText` ที่เจ้าของ quiz ตั้งไว้ + ลิงก์ quiz (ชวนคนอื่นมาเล่นต่อ = loop ไวรัล)
- (ถ้าผู้สร้างเปิดไว้) กล่อง **"สนับสนุนผู้สร้าง"** แสดง QR/เลขบัญชี/ลิงก์โดเนทของผู้สร้างเอง พร้อม disclaimer (ดูข้อ 10.5)

> หมายเหตุเทคนิค: free-form canvas เก็บเป็น JSON layout → ใช้ render engine เดียวกันทั้ง
> หน้าเว็บ, การ์ดดาวน์โหลด และ OG image เพื่อให้ภาพออกมาตรงกันทุกที่

---

## 5. UX การสร้าง quiz (Builder)

แนวทาง: **wizard 4 ขั้น + live preview มือถือ** (เลียนความง่ายแบบ Canva/Typeform)

1. **Setup** — ชื่อ quiz, รูปปก, คำโปรย, ประเภท (result)
2. **Results** — สร้างแพทเทิร์นผลลัพธ์ 2–6 แบบ (ตั้งชื่อ + รูป + คำบรรยาย) ก่อน เพื่อให้ map คะแนนได้
3. **Questions** — เพิ่มคำถามทีละข้อ (เรียงลำดับด้วย drag), แต่ละตัวเลือกเลือก media + map คะแนนเข้า result
4. **Review & Publish** — พรีวิวเล่นจริง, เช็ก validation (ทุก result ต้องมีโอกาสได้อย่างน้อย 1 ทาง), กด publish → ได้ลิงก์

UX สำคัญ:
- auto-save draft ตลอด (ไม่กดเซฟก็ไม่หาย)
- preview แบบมือถือ real-time ข้างขวา
- validation เตือนก่อน publish: คำถาม ≥ 1, ตัวเลือก ≥ 2, result ≥ 2, ทุก result มีทางได้คะแนน

---

## 6. Tech Stack & สถาปัตยกรรม

| ชั้น | เทคโนโลยี |
|---|---|
| Framework | **Next.js 16 (App Router, Server Components)** |
| ภาษา | TypeScript |
| UI | **Tailwind CSS** + **shadcn/ui** (component สวย, เข้าถึงง่าย) |
| ฟอนต์ | **next/font** + ฟอนต์ไทย 5 แบบจาก Google Fonts (ดูข้อ 6.1) |
| รูปแชร์/capture | **next/og** (Satori) สำหรับ OG image + **html-to-image** สำหรับดาวน์โหลดการ์ดผลลัพธ์ |
| Auth | **Auth.js v5 (NextAuth)** — Google + Email magic link (ผ่าน Resend) |
| DB | **Neon Postgres** + **Drizzle ORM** |
| Cache/Rate-limit | **Upstash Redis** (prod) / in-memory (local) — ผ่าน adapter (ข้อ 6.2) |
| Media | **Vercel Blob** (prod) / filesystem (local) — ผ่าน adapter (ข้อ 6.2) |
| Validation | **Zod** (ทุก input ฝั่ง server) |
| Payment | **Stripe Checkout + Webhook** (PromptPay + card) |
| Email | **Resend** (magic link, ใบเสร็จ, แจ้งเตือนหมดอายุ) |
| Background jobs | **Vercel Cron** (จัดการหมดอายุ/archive รายวัน) |
| Bot/abuse | **Vercel BotID** + Upstash rate limit |
| Hosting | **Vercel** (Fluid Compute, Node.js runtime) |

หลักการ Next.js:
- ใช้ Server Components เป็นหลัก, `'use client'` เฉพาะส่วน interactive (builder, player)
- Mutation ผ่าน **Server Actions** (มี auth check + Zod ทุกตัว) หรือ Route Handlers สำหรับ webhook/upload
- ใช้ `proxy.ts` (ชื่อใหม่ของ middleware ใน Next 16) สำหรับ auth gate
- รูปใช้ `next/image`, ฟอนต์ `next/font`

### 6.1 ฟอนต์ไทย (Font Picker)

ผู้สร้าง quiz เลือกฟอนต์ได้ **5 แบบ** (เน้นไทยก่อน, อังกฤษไว้ทำทีหลัง) โหลดทั้งหมดผ่าน `next/font/google`
(self-host อัตโนมัติ → เร็ว + ไม่มี layout shift) แต่ละ quiz เก็บค่า `theme.fontFamily`

| # | ฟอนต์ | คาแรกเตอร์ | เหมาะกับ |
|---|---|---|---|
| 1 | **Sarabun** | อ่านง่าย เป็นทางการ (ฟอนต์ราชการ) | ค่าเริ่มต้น / body / quiz จริงจัง |
| 2 | **Kanit** | geometric ทันสมัย คมชัด | หัวข้อ / quiz แนวป็อป |
| 3 | **Prompt** | sans-serif เป็นมิตร เข้ากับ Latin | ทั่วไป สมดุล |
| 4 | **Bai Jamjuree** | สดใส มีชีวิตชีวา | quiz สนุก ๆ วัยรุ่น |
| 5 | **Mitr** | มีคาแรกเตอร์ นุ่มนวล | quiz ไลฟ์สไตล์ / อบอุ่น |

- **Default = Sarabun** (อ่านง่ายสุด), fallback ระบบ = Noto Sans Thai
- โหลดเฉพาะ weight ที่ใช้ (เช่น 400/600/700) + `subsets: ['thai','latin']` เพื่อไม่ให้ bundle ใหญ่
- ฟอนต์เดียวกันนี้ใช้ตอน render **OG image / การ์ดดาวน์โหลด** ด้วย (Satori โหลดไฟล์ฟอนต์ .ttf) ให้ภาพตรงกับหน้าเว็บ
- (ฟรี vs จ่าย) เลือกได้ครบทั้ง 5 ฟอนต์ทุก tier — ฟอนต์ไม่ใช่ตัวจำกัด; ตัวจำกัดอยู่ที่ free-form designer (ข้อ 4.5)

### 6.2 กลยุทธ์ Local-first → Vercel (สลับด้วย env ไม่แก้โค้ด)

**แผน:** เดือนนี้ dev/ทดสอบบน **local 100% (ไม่เสียค่า cloud)** → พอพร้อมค่อยซื้อโดเมน + Vercel Pro ($20)
+ สลับ storage เป็นของ Vercel ทีหลัง โดย **เปลี่ยนแค่ environment variables**

หัวใจคือ **ออกแบบทุก external dependency เป็น adapter ที่เลือก driver ตาม env** ตั้งแต่วันแรก:

| Component | Local (เดือนนี้, ฟรี) | Vercel (ภายหลัง) | สลับด้วย env |
|---|---|---|---|
| Database | **Postgres ใน Docker** (หรือ Neon free) | Neon Postgres | `DATABASE_URL` |
| Media (รูป/เสียง/วิดีโอ) | **filesystem** (`./.uploads`, serve ผ่าน `/api/media/[...]`) | Vercel Blob | `STORAGE_DRIVER=local\|blob` |
| Cache / rate-limit | **in-memory** (Map ในโปรเซส) | Upstash Redis | `RATELIMIT_DRIVER=memory\|upstash` |
| Email (magic link/ใบเสร็จ) | **log ใน console** หรือ Mailpit | Resend | `EMAIL_DRIVER=console\|resend` |
| Payment | **Stripe test mode** + `stripe listen` (forward webhook มา localhost) | Stripe live | สลับ key (test↔live) |
| Cron (หมดอายุ/archive) | **npm script รันมือ** (`pnpm cron:lifecycle`) | Vercel Cron | — (เรียก handler เดียวกัน) |

**หลักการ implement:**
- **DB ใช้ Postgres ทั้ง local และ prod** (Drizzle + Postgres) → schema/SQL เหมือนกันเป๊ะ ย้ายขึ้น Neon = แค่เปลี่ยน `DATABASE_URL` ไม่มี migration พิเศษ
  - แนะนำ `docker-compose.yml` มี Postgres (+ Redis ถ้าอยากใกล้ prod) สำหรับ dev
  - ทางเลือก: ใช้ **Neon free tier** ตั้งแต่แรกก็ได้ (ฟรี ไม่ต้องมี Vercel Pro) → dev ตรงกับ prod 100%
- **Media adapter** — interface เดียว `MediaStorage { put(), delete(), getUrl() }`; `local` เซฟไฟล์ลงดิสก์, `blob` เรียก Vercel Blob → โค้ดที่เรียกใช้ไม่รู้ว่าใช้ตัวไหน
- **Rate-limit adapter** — dev ใช้ in-memory พอ; prod ค่อยต่อ Upstash (กันลืม: in-memory ใช้ได้แค่ instance เดียว เหมาะ dev เท่านั้น)
- เก็บ **`.env.example`** ระบุครบทุก key + ค่าตัวอย่างสำหรับ local

**ข้อควรรู้เรื่องค่าใช้จ่าย/แพลน (กันเข้าใจผิด):**
- **Local dev = ฟรีสนิท** ไม่ต้องมีบัญชี cloud เลย (ถ้าใช้ Docker Postgres + filesystem)
- **Neon / Upstash มี free tier** ใช้ทดสอบบน cloud ได้ก่อน แม้ยังไม่จ่าย Vercel Pro
- **Vercel Pro ($20) จำเป็นตอน "เปิดใช้จริงเชิงพาณิชย์"** (Hobby ห้ามพาณิชย์) — ก่อนหน้านั้น deploy preview/ทดสอบบน Hobby ฟรีได้
- **Vercel Blob** ค่อยเปิดใช้ตอนขึ้น prod (ดู cost ข้อ 12.1); ระหว่าง local ใช้ filesystem ไปก่อน

### 6.3 Ad Slots — พื้นที่โฆษณาของเรา (จองไว้ก่อน, ซ่อนได้, admin คุม)

จองพื้นที่ layout ไว้รองรับโฆษณา (ของเราเอง/ภายหลังต่อ AdSense ได้) แบบ **responsive ไม่ทับเนื้อหา**
และ **ถ้าไม่มีโฆษณา → ยุบทิ้ง เนื้อหากินพื้นที่เต็ม** (ไม่เหลือช่องว่าง)

**ตำแหน่ง (placement) ที่เตรียมไว้:**
| Slot | พฤติกรรม | แสดงเมื่อ |
|---|---|---|
| `footer` | แถบล่างแบบ sticky, มีปุ่มปิด (✕), จองความสูงเฉพาะตอนมีโฆษณา (content เพิ่ม padding-bottom กันทับ) | ทุกขนาดจอ |
| `rail_left` / `rail_right` | แถบข้าง (skyscraper) ในช่อง gutter ข้างคอลัมน์เนื้อหาที่จัดกึ่งกลาง | **เฉพาะจอกว้าง ≥ 1280px** เท่านั้น |
| `inline` (option) | คั่นระหว่างบล็อกเนื้อหา (เช่น ระหว่างคำถาม/ก่อนผลลัพธ์) | ทุกขนาด |

**กฎ responsive & UX (ไม่ให้พังจอ):**
- ใช้ **CSS grid** `[rail-left] [content] [rail-right]` — rail เป็นคอลัมน์ที่ **ยุบเป็น 0 อัตโนมัติ** ถ้าปิด/ไม่มีโฆษณา หรือจอแคบ → content เต็มความกว้างทันที (ไม่มี layout shift)
- จอเล็ก/มือถือ: **ซ่อน rail ทั้งหมด** เหลือแต่ footer (ที่ปิดได้)
- ผู้ใช้ **กดซ่อนได้** (จำค่าใน localStorage), โฆษณาห้าม overlay ทับปุ่ม/เนื้อหาสำคัญ
- **หน้า builder ไม่แสดงโฆษณา** (กันรบกวนตอนสร้าง); แสดงบนหน้า public เป็นหลัก (เล่น quiz, ผลลัพธ์, marketing) — admin เลือกได้ว่าหน้าไหนบ้าง
- ถ้าผู้เล่นมาจาก quiz ของผู้ใช้ **Pro/จ่ายเงิน** → ตัวเลือก "ปิดโฆษณา" ได้ (ผูกเป็น perk การจ่ายเงิน — ดูข้อ 10.1)

**Admin จัดการได้ (ในหน้า System ข้อ 11.2 G):**
- เปิด/ปิดแต่ละ slot, ใส่เนื้อหา (รูป + ลิงก์ปลายทาง สำหรับโฆษณาเราเอง / หรือ embed code สำหรับ AdSense ภายหลัง)
- เลือกหน้าที่จะแสดง, ตั้งช่วงเวลา (เริ่ม–สิ้นสุด), หมุนหลายชิ้น (weight), ดูจำนวน impression/click เบื้องต้น

**Data model (เพิ่ม):**
```
ad_slots
  id
  placement   enum('footer','rail_left','rail_right','inline')
  enabled     bool default false
  kind        enum('image','embed')          // image+link (เราเอง) | embed (AdSense ฯลฯ)
  media_id    fk media nullable              // หรือ
  image_url, target_url   text nullable       // โฆษณาของเราเอง
  embed_html  text nullable                  // โค้ดฝัง (sanitize/whitelist domain)
  pages       text[]                         // ['play','result','home',...]
  weight      int default 1                  // หมุนหลายชิ้น
  starts_at, ends_at  nullable
  impressions, clicks  int default 0
  updated_by (fk users), updated_at
```
> โครงสร้างนี้รองรับทั้ง "โฆษณาของเราเอง" ตอนนี้ และต่อ ad network ภายหลังโดยไม่ต้องรื้อ layout
> ระหว่างยังไม่มีโฆษณา: ทุก slot `enabled=false` → จอแสดงเต็มพื้นที่ปกติ

---

## 7. Data Model (ร่าง Schema)

> ใช้ Postgres + Drizzle · `internal id` เป็น sequential/UUID (ใช้ภายใน) · `public_id` เป็น nanoid สั้น (ใช้ใน URL กัน IDOR)

```
users
  id (uuid, pk)
  email (unique)
  name, image
  role            enum('user','support','admin')  default 'user'
  status          enum('active','suspended')       default 'active'
  created_at
  -- entitlement
  quiz_credits    int default 0          // ซื้อ/donate แล้วได้เพิ่ม
  plan            enum('free','pro')     default 'free'

consents                                  // PDPA log (เก็บทุกครั้งที่ยอมรับ)
  id, user_id (fk)
  policy_version  text
  accepted_at, ip, user_agent

quizzes
  id (uuid, pk)
  public_id       text unique            // nanoid ใช้ใน URL
  owner_id (fk users)
  title, cover_media_id, description
  result_logic    enum('archetype','range','branching') default 'archetype'
  status          enum('draft','published','expired','archived')
  theme           jsonb                  // { fontFamily, colors, ... }
  settings        jsonb                  // เช่น showProbabilityBar
  view_count, play_count   int default 0
  created_at, published_at
  expires_at                             // = published_at + 7 วัน (หรือ +extend)

questions
  id, quiz_id (fk), order_index
  prompt_text
  media_id (fk media, nullable)

choices
  id, question_id (fk), order_index
  label_text
  media_id (fk media, nullable)
  score_map       jsonb                  // archetype: { "<result_key>": points }
  points          int default 0          // range: แต้มของช้อยนี้
  next            text  nullable          // branching: "q:<id>" | "r:<key>" | null=ไหลปกติ

results
  id, quiz_id (fk), order_index
  result_key      text                   // unique ภายใน quiz
  title, description
  media_id (fk media, nullable)
  layout          jsonb                  // free-form designer (ดูข้อ 4.5)
  score_min, score_max  int nullable      // ใช้เฉพาะโหมด range
  share_text

media                                     // รองรับทั้งอัปโหลด และลิงก์ภายนอก
  id, owner_id (fk)
  type            enum('image','audio','video')
  source          enum('upload','link')  default 'upload'
  blob_url, blob_pathname  nullable        // กรณี upload (อยู่บน Vercel Blob)
  external_url    text nullable            // กรณี link (โฮสต์ที่อื่น เช่น URL รูป/YouTube)
  mime, size_bytes nullable                // size = 0 ถ้าเป็น link
  created_at

plays                                     // บันทึกการเล่น (ทำสถิติ; anonymized)
  id, quiz_id (fk)
  result_id (fk, nullable)
  answers         jsonb                  // ไม่ผูกตัวตนผู้เล่นถ้าไม่ login
  session_hash    text                   // hash กัน double-count
  created_at

quiz_archives                             // quiz หมดอายุ → เก็บ JSON กู้คืนได้
  id, original_quiz_id, owner_id
  archive_blob_url                       // ไฟล์ JSON บน Vercel Blob
  stats_snapshot  jsonb
  archived_at
  restorable_until                       // เช่น +90 วัน

transactions                              // ทุกการจ่ายเงิน/โดเนท
  id, user_id (fk)
  kind            enum('extra_quiz','extend','feature','donation','pro')
  amount, currency
  provider        text default 'stripe'
  provider_ref    text                   // stripe session/payment id
  status          enum('pending','paid','failed','refunded')
  metadata        jsonb                  // เช่น quiz_id ที่ต่ออายุ
  created_at

reports                                   // moderation: ผู้เล่น/ผู้ใช้รายงาน quiz
  id, quiz_id (fk), reporter_user_id (nullable)
  reason          text
  status          enum('open','reviewing','resolved','dismissed') default 'open'
  resolved_by (fk users, nullable), resolved_at, created_at

audit_logs                                // ทุกการกระทำของ admin/support
  id, actor_user_id (fk)
  action          text                   // เช่น 'user.suspend','txn.refund','credit.adjust'
  target_type     text                   // 'user' | 'quiz' | 'transaction' | ...
  target_id       text
  detail          jsonb                  // ค่าก่อน/หลัง + เหตุผล
  ip, created_at

app_config                                // ตั้งค่าระบบจากหลังบ้าน (ราคา/โควตา/flags)
  key             text pk                 // เช่น 'pricing','quota','feature_flags'
  value           jsonb
  updated_by (fk users), updated_at
```

> `app_config` ทำให้ปรับ ราคา/โควตา/feature flag ได้จากหน้า admin โดยไม่ต้อง deploy ใหม่
> (อ่านค่าผ่าน cache เช่น Upstash/Edge Config เพื่อความเร็ว)

---

## 8. Authentication & PDPA

### 8.1 Auth (Auth.js v5)
- **Google OAuth** + **Email magic link** (passwordless, ส่งผ่าน Resend)
- Session: ใช้ database session (เก็บใน Neon ผ่าน Drizzle adapter) เพื่อ revoke ได้
- `proxy.ts` ป้องกันเส้นทาง `/dashboard`, `/create`, `/admin`
- `/admin` ตรวจ `role === 'admin'` ซ้ำที่ server ทุกครั้ง

### 8.2 PDPA Consent Flow
- หลัง login ครั้งแรก (หรือเมื่อ policy version เปลี่ยน) → แสดงหน้า/โมดัล **consent**
- เนื้อหาอธิบายชัด: เก็บอะไร (email, ชื่อ, รูปโปรไฟล์, สถิติการใช้งาน), เอาไปทำอะไร (**สถิติหลังบ้าน admin เท่านั้น ไม่เผยแพร่/ไม่ขายต่อ**), เก็บนานแค่ไหน, สิทธิ์ผู้ใช้
- ต้องกด **ยอมรับ** ก่อนถึงใช้งานได้ → บันทึกลง `consents` (version + เวลา + ip + ua)
- ให้สิทธิ์ผู้ใช้: **ขอ export ข้อมูล** และ **ขอลบบัญชี** (right to access / erasure) ในหน้า settings
- เก็บข้อมูลแบบ **data minimization** — เก็บเท่าที่จำเป็น
- มีหน้า **Privacy Policy** และ **Terms** แยก พร้อม version

---

## 9. วงจรชีวิต Quiz & การ Archive (ประหยัด DB)

### 9.1 สถานะ
`draft → published → expired → archived` (+ `restored` กลับเป็น published ได้)

### 9.2 อายุ 7 วัน
- ตอน publish: `expires_at = now + 7 วัน`
- ก่อนหมดอายุ ~1 วัน: ส่งอีเมลเตือนเจ้าของ ("ต่ออายุหรือปล่อยให้หมดอายุ?")

### 9.3 Cron รายวัน (Vercel Cron → `/api/cron/lifecycle`)
1. **หา quiz ที่ `expires_at < now` และ status='published'** → ตั้งเป็น `expired` (ยังไม่ลบ, แสดงหน้า "quiz นี้หมดอายุแล้ว")
2. **หา quiz ที่ expired เกิน X วัน (เช่น 3 วัน)** → ทำ **archive**:
   - รวม quiz + questions + choices + results + `stats_snapshot` เป็น **JSON ก้อนเดียว**
   - อัปขึ้น **Vercel Blob** (`archive_blob_url`)
   - บันทึกแถวใน `quiz_archives` (พร้อม `restorable_until = now + 90 วัน`)
   - **ลบ rows หนัก** (questions/choices/results/plays) ออกจาก DB เหลือแถว `quizzes` แบบ light เป็น pointer
3. **media**: ถ้า quiz archived และไม่มีที่อื่นอ้างถึง → ย้าย/ลบ blob ตาม policy (เก็บ url ไว้ใน JSON เพื่อ reference)

> Cron ต้องป้องกันด้วย secret header (`CRON_SECRET`) ไม่ให้เรียกจากภายนอกได้

### 9.4 กู้คืน (Restore)
- เจ้าของกด "กู้คืน" ภายใน `restorable_until` → อ่าน JSON จาก Blob → re-insert กลับเข้า DB → status กลับเป็น `published` (อาจคิดเป็น 1 quiz slot หรือคิดเงินตาม policy)
- หลัง `restorable_until` → ลบ archive ถาวร (หรือเก็บเป็น cold storage ตามต้องการ)

---

## 10. Monetization (Payment & Plan)

### 10.1 โมเดลราคา (อ้างอิงตลาดไทย — ตั้งให้ "ไม่สูง" ตามที่ต้องการ)

**บริบทราคา:** quiz maker ต่างชาติคิด ~$8–34/เดือน (≈ 280–1,200 บาท/เดือน) ซึ่ง "สูงเกินไป" สำหรับกลุ่ม
คนทั่วไป/ทำเล่นสนุกในไทย กลยุทธ์ของเราคือ **microtransaction จิ๋ว ๆ ราคาระดับ "กาแฟแก้วเดียว"**
เพื่อลดแรงต้านการจ่าย + เน้น volume

| รายการ | Free | ราคาเสนอ (บาท) |
|---|---|---|
| จำนวน quiz active | 3 อัน | ซื้อ slot เพิ่ม **19 ฿/อัน** · แพ็ก 5 อัน **79 ฿** (เฉลี่ย ~16 ฿) |
| ต่ออายุ quiz | 7 วัน | +30 วัน **19 ฿** · +90 วัน **39 ฿** |
| ปลด free-form designer + ลบ branding (ต่อ quiz) | — | **29 ฿** |
| แพ็กฟีเจอร์พิเศษรวม (analytics export + media โควตาเพิ่ม + designer) | — | **49 ฿/quiz** |
| Donate (tip jar) | — | ตั้งเอง แนะนำปุ่มลัด **20 / 50 / 100 ฿** |
| (อนาคต) Pro รายเดือน | — | **99 ฿/เดือน** หรือ **890 ฿/ปี** (quiz เยอะขึ้น + ฟีเจอร์ครบ + อายุยาว) |

**ข้อควรระวังเรื่องค่าธรรมเนียม (สำคัญกับของถูก):**
- Stripe/PromptPay มีค่าธรรมเนียม % + อาจมีขั้นต่ำต่อรายการ → ของชิ้นเล็กมาก ๆ (เช่น 19 ฿) ค่าธรรมเนียมจะกินสัดส่วนสูง
- ทางแก้: **ดันให้ซื้อเป็น credit/แพ็ก** (เช่น เติม credit 100 ฿ ครั้งเดียว แล้วค่อยใช้แลก slot/extend ทีละนิด) → ลดจำนวนครั้งที่ต้องรูดจริง = ประหยัดค่าธรรมเนียม
- ตรวจขั้นต่ำของ PromptPay บน Stripe ก่อน launch แล้วตั้งราคาให้อยู่เหนือขั้นต่ำ

> **Credit model:** การจ่าย/โดเนท → เพิ่ม `quiz_credits` ใช้แลก slot/ต่ออายุ/ปลดฟีเจอร์ได้
> ทำให้ logic ฝั่ง entitlement เป็นระบบเดียว และลดจำนวนธุรกรรมจริง (ประหยัดค่าธรรมเนียม)

> ตัวเลขข้างบนเป็น **จุดตั้งต้นที่แนะนำ** ปรับได้ตอน launch — แนะนำเริ่มถูกไว้ก่อนเพื่อสร้างฐานผู้ใช้

### 10.2 Flow การจ่ายเงิน (Stripe Checkout)
1. ผู้ใช้กด "ซื้อ slot / ต่ออายุ / donate"
2. Server Action สร้าง **Stripe Checkout Session** (กำหนดราคา/สกุล/เมทาดาทา `user_id`, `kind`, `quiz_id`) → redirect ไปหน้า Stripe (รองรับ **PromptPay QR** + บัตร)
3. ผู้ใช้จ่ายเสร็จ → Stripe ส่ง **webhook** มาที่ `/api/stripe/webhook`
4. Webhook handler:
   - **verify signature** (กันปลอม)
   - ใช้ **idempotency** (กันยิงซ้ำ)
   - อัปเดต `transactions` เป็น `paid` + เพิ่ม entitlement (credit / ต่ออายุ quiz / ปลดฟีเจอร์)
   - ส่งอีเมลใบเสร็จ
5. **ห้ามเชื่อ client เรื่องยอด/สถานะ** — ยึดจาก webhook ที่ verify แล้วเท่านั้น

### 10.3 กฎ entitlement & นิยาม "3 quiz ฟรี" (ตรวจฝั่ง server เสมอ)

**นิยาม Free tier:** ผู้ใช้สร้าง quiz **มาตรฐานแบบฟรีได้สูงสุด 3 อันที่ active พร้อมกัน**
- 1 quiz = **1 flow ใหญ่** สร้างคำถาม–ตัวเลือก–ผลลัพธ์ได้ตามปกติ (ไม่จำกัดจำนวนคำถามแบบฮาร์ด แต่มี soft cap กัน abuse เช่น ≤ 50 คำถาม/quiz)
- "active" = quiz สถานะ `published` ที่ยังไม่หมดอายุ
- quiz ที่ **หมดอายุ/archived ไม่นับ** → ผู้ใช้ปล่อยให้อันเก่าหมดอายุแล้วสร้างใหม่ได้เรื่อย ๆ ฟรี (กระตุ้นให้กลับมาใช้)
- "มาตรฐาน" = ฟีเจอร์พื้นฐาน (text/รูป/เสียง/วิดีโอ, ทั้ง 3 result logic, template designer, ฟอนต์ครบ 5)
  ส่วน free-form canvas designer + ลบ branding + analytics export = ฟีเจอร์เสียเงิน

**กฎตรวจสิทธิ์:**
- publish quiz ใหม่: ถ้า active quiz ≥ 3 และ `quiz_credits == 0` → บล็อก + เสนอซื้อ slot/credit
- ต่ออายุ: ตัด credit หรือสร้าง checkout
- ทุกการตรวจทำใน Server Action / Route Handler **ไม่ทำแค่ที่ UI**

### 10.4 จุดคุ้มทุน (Break-even) — เพื่อให้เป็น passive income จริง

ต้นทุนคงที่หลัก = **Vercel Pro ~$20/เดือน (~700 บาท)** (จำเป็นเพราะใช้เชิงพาณิชย์, ดูข้อ 12.1) + ค่า egress แปรผัน
- Neon/Upstash มี free tier ใช้ช่วงแรกได้, ค่อยอัปเกรดเมื่อโต
- **คุ้มทุนเดือนละ ~700 บาทต้องการประมาณ:** ขาย slot 19฿ ~37 ครั้ง, หรือ donate 50฿ ~14 คน, หรือ Pro 99฿ ~7 คน/เดือน → เป้าหมายที่ทำได้ไม่ยากถ้ามี quiz ไวรัลบ้าง
- กำไรเริ่มหลังครอบ ~700 บาท + egress; egress ถูกคุมด้วยกลยุทธ์ข้อ 12.1 ให้ต่ำ
- แนะนำตั้ง **billing alert** บน Vercel กันค่าใช้จ่ายพุ่งจาก quiz วิดีโอไวรัล

> หมายเหตุ: "Donate (tip jar)" ในข้อ 10.1 = โดเนทให้ **แพลตฟอร์ม (เจ้าของระบบ)** ผ่าน Stripe ของเรา
> ส่วนข้อ 10.5 ด้านล่าง = โดเนทให้ **ผู้สร้าง quiz โดยตรง** ซึ่งแพลตฟอร์มไม่ยุ่งกับเงินเลย — คนละอย่างกัน

### 10.5 Creator Tip Jar — โดเนทตรงถึงผู้สร้าง (แพลตฟอร์มไม่ยุ่งกับเงิน)

ผู้สร้าง quiz **แปะช่องทางรับเงินโดเนทส่วนตัว** ของตัวเองได้ (PromptPay QR / เลขบัญชี / ลิงก์ Ko-fi ฯลฯ)
**แพลตฟอร์มเป็นแค่ "ที่แปะ" — ไม่ประมวลผลเงิน ไม่หักค่าธรรมเนียม ไม่รับผิดชอบธุรกรรม**
เงินไหลตรงจากผู้เล่น → ผู้สร้าง ไม่ผ่านระบบเรา

**ตั้งค่าอะไรได้ (ผู้สร้างเลือกเอง, ทุกอย่าง optional):**
- อัปโหลด **รูป QR code** (PromptPay/ธนาคาร/พร้อมเพย์) — เป็นรูปภาพ ผ่าน media adapter เดิม
- กรอก **เลขบัญชี / ชื่อบัญชี / ธนาคาร** เป็นข้อความ
- ใส่ **ลิงก์ภายนอก** (Ko-fi, Buy Me a Coffee, PayPal.me, ฯลฯ)
- ข้อความเชิญชวนสั้น ๆ (เช่น "ถ้าชอบ quiz นี้ เลี้ยงกาแฟผมได้นะ ☕")
- toggle **เปิด/ปิด** การแสดง และเลือกตำแหน่ง (หน้าผลลัพธ์ / หน้าปก)

**ขอบเขต & ระดับการตั้งค่า:**
- เก็บที่ **โปรไฟล์ผู้สร้าง** เป็นค่าเริ่มต้น (ตั้งครั้งเดียว ใช้ได้ทุก quiz) + override ราย quiz ได้
- แสดงบน **หน้าผลลัพธ์** เป็นกล่อง "สนับสนุนผู้สร้าง" (ดูข้อ 4.6) แยกชัดจาก UI ของแพลตฟอร์ม

**Legal / ความปลอดภัย (สำคัญ — กันแพลตฟอร์มโดนลากเข้าไปเกี่ยว):**
- แสดง **disclaimer ชัดเจน**: "ช่องทางนี้เป็นของผู้สร้าง quiz เอง Quibby ไม่เกี่ยวข้องกับการโอนเงิน ไม่รับประกัน และไม่รับผิดชอบใด ๆ โปรดตรวจสอบก่อนโอน"
- เราจึง **ไม่ใช่ตัวกลางชำระเงิน (payment intermediary)** → ลดภาระด้านกฎหมาย/ใบอนุญาต
- QR/เลขบัญชีเป็นข้อมูลที่ผู้สร้าง **เลือกเปิดเผยเอง** (ยินยอมตาม PDPA) — ใส่หมายเหตุตอนตั้งค่า
- กัน abuse/สแกม: QR เป็นรูป → ผ่าน validation media เดิม, เลขบัญชี = sanitize ข้อความ, มีปุ่ม **report** (เข้า moderation ข้อ 11.2 F); ถ้าถูกรายงานว่าหลอกลวง admin ระงับได้
- rate-limit การแก้ช่องทางรับเงิน + log ไว้ (กันบัญชีถูก hijack แล้วสับเปลี่ยน QR)

**Data model (เพิ่ม):**
```
users.creator_payout   jsonb   // { enabled, qrMediaId, bankName, bankAccount,
                                //   accountName, externalUrl, message, placement }
quizzes.payout_override jsonb nullable  // ถ้าตั้งเฉพาะ quiz นี้ (ทับค่าโปรไฟล์)
```

> แพลตฟอร์มได้ประโยชน์: เป็นแรงจูงใจให้ครีเอเตอร์ทำ quiz ดี ๆ (มีรายได้ตรง) โดยเราไม่ต้องแบกเรื่องเงินเขา

---

## 11. การจัดการ User & Admin

### 11.1 บทบาท
- `user` — สร้าง/จัดการ quiz ตัวเอง, ดูสถิติ quiz ตัวเอง, จัดการบัญชี/ความยินยอม
- `admin` — (เจ้าของระบบ) เข้าถึงหลังบ้านครบวงจร: ดูแล user, ดู transaction, สถิติ, จัดการเนื้อหา/ระบบ
- (เผื่ออนาคต) `support` — สิทธิ์จำกัดสำหรับผู้ช่วยดูแล (ดูได้ จัดการได้บางอย่าง ไม่เห็นข้อมูลการเงินละเอียด)

### 11.2 Admin Console (หลังบ้านครบวงจร) — `/admin`

ออกแบบให้ **ดูง่าย จัดการง่ายในที่เดียว** เป็นเมนูด้านข้าง (sidebar) แยกเป็นหน้า ๆ:

**A) Overview (หน้าแรก — สรุปสุขภาพระบบ)**
- การ์ดตัวเลขสำคัญ: user ทั้งหมด / ใหม่วันนี้-7วัน, quiz active/expired/archived, การเล่นรวม, รายได้เดือนนี้, credit คงเหลือในระบบ
- กราฟเทรนด์: user ใหม่, การเล่น, รายได้ (รายวัน/สัปดาห์/เดือน — เลือกช่วงเวลาได้)
- แจ้งเตือน: รายการที่ต้องสนใจ (quiz ถูกรายงาน, payment ค้าง/ล้มเหลว, ใกล้ชน billing alert)

**B) Users (จัดการผู้ใช้)**
- ตารางค้นหา/กรอง/เรียง: email, ชื่อ, วันสมัคร, plan, จำนวน quiz, credit, สถานะ
- คลิกเข้าโปรไฟล์ user เห็น: quiz ที่สร้าง, ประวัติ transaction, ประวัติ consent (PDPA), การ login ล่าสุด
- **การกระทำ:** ระงับ/ปลดระงับบัญชี, ปรับ role, เพิ่ม/หัก credit ด้วยมือ (เช่น ชดเชย/โปรโมชัน — มี audit log), บังคับ logout, ลบบัญชี (ตาม PDPA + กระบวนการยืนยัน)

**C) Quizzes (จัดการเนื้อหา)**
- ตารางทุก quiz: เจ้าของ, สถานะ, ยอดเล่น, วันหมดอายุ, ถูกรายงานกี่ครั้ง
- พรีวิว quiz ได้ทันที, ระงับ/ลบ quiz ที่ผิดกฎ (soft-delete + เหตุผล), บังคับ archive/กู้คืน, ต่ออายุให้ด้วยมือ

**D) Transactions & Revenue (การเงิน)**
- ตาราง transaction ทั้งหมด: เวลา, user, ประเภท (slot/extend/feature/donation/pro), ยอด, สถานะ, provider_ref (ลิงก์ไป Stripe)
- กรองตามช่วงเวลา/ประเภท/สถานะ, สรุปยอดรวม + กราฟรายได้แยกตามประเภท
- จัดการเคส: ดู refund/dispute (ทำ refund ผ่าน Stripe dashboard, ระบบ sync สถานะกลับผ่าน webhook), export CSV สำหรับทำบัญชี/ภาษี

**E) Analytics (สถิติเชิงลึก ครบวงจร)**
- funnel: เปิดหน้า quiz → เริ่มเล่น → เล่นจบ → แชร์ (conversion แต่ละขั้น)
- quiz ยอดนิยม / มาแรง (7 วัน), สัดส่วนผลลัพธ์แต่ละแบบต่อ quiz
- ช่องทางแชร์ที่ใช้มากสุด (LINE/FB/X/Discord), อัตราการกลับมาเล่นซ้ำ
- การใช้ media (อัปโหลด vs ลิงก์), การใช้แต่ละ result logic, ภาพรวมการใช้ storage/egress (คุม cost)

**F) Moderation (ดูแลเนื้อหา)**
- คิวรายการที่ถูก **รายงาน** (report) จากผู้เล่น/ผู้ใช้ → review → อนุมัติ/ระงับ/ลบ พร้อมเหตุผล
- คำต้องห้าม/กรองคำหยาบเบื้องต้น, blacklist เจ้าของที่ทำผิดซ้ำ

**G) System & Settings (ตั้งค่าระบบ)**
- ปรับ **ราคา/แพ็ก/โควตา** ได้จากหลังบ้าน (ไม่ต้อง deploy ใหม่ — เก็บใน config table/Edge Config)
- **จัดการ Ad Slots** (ข้อ 6.3): เปิด/ปิดแต่ละตำแหน่ง, ใส่รูป+ลิงก์/embed, เลือกหน้า, ตั้งเวลา, ดู impression/click
- เปิด/ปิดฟีเจอร์ (feature flags), ตั้ง billing alert threshold
- ตรวจสุขภาพ cron (lifecycle/archive รันล่าสุดเมื่อไร สำเร็จไหม), ปุ่มสั่งรัน cron ด้วยมือ
- ดู **Audit Log**: ทุกการกระทำของ admin (ใคร ทำอะไร เมื่อไร กับใคร) — โปร่งใส ตรวจสอบย้อนหลังได้

> หลักความปลอดภัยของ `/admin`: ตรวจ `role` ที่ server ทุก request (ดูข้อ 12), ทุก action ที่กระทบ user/เงิน
> ต้องบันทึก **audit log**, การกระทำอันตราย (ลบบัญชี/refund/หัก credit) ต้องมีขั้นยืนยัน (confirm + เหตุผล)

### 11.3 หน้า settings ของ user
- โปรไฟล์, การเชื่อมต่อ (Google/email)
- ประวัติการจ่ายเงิน/credit คงเหลือ
- **ช่องทางรับโดเนทส่วนตัว (Creator Tip Jar)** — อัปโหลด QR / กรอกเลขบัญชี / ลิงก์โดเนท + เปิด-ปิด (ดูข้อ 10.5)
- **Export ข้อมูล / ลบบัญชี** (PDPA)
- ดู/ถอนความยินยอม

---

## 12. Security (ออกแบบให้ไม่มีช่องโหว่)

ครอบคลุม OWASP Top 10 + จุดเสี่ยงเฉพาะของแพลตฟอร์ม UGC + payment:

**Authn/Authz**
- Auth.js v5, session ใน DB (revoke ได้), CSRF protection ในตัว
- **ตรวจสิทธิ์เจ้าของทุก mutation** (owner check) — กัน IDOR
- public URL ใช้ **nanoid ที่เดาไม่ได้**, แยกจาก internal id
- `/admin` ตรวจ role ที่ server ทุก request (ไม่เชื่อ UI)

**Input & Output**
- **Zod validate** ทุก input ฝั่ง server (รวม payload ของ builder)
- เนื้อหา quiz เป็น UGC → **sanitize/escape** ก่อนเรนเดอร์ (กัน XSS), เก็บเป็น plain text/markdown ที่เรนเดอร์ปลอดภัย
- ตั้ง **Content-Security-Policy** + security headers (HSTS, X-Frame-Options, etc.)
- **Ad embed code** (ข้อ 6.3) ตั้งได้เฉพาะ admin + จำกัด domain ที่ฝังได้ (allowlist) และต้องไม่ขัด CSP — กัน script อันตราย

**Media upload / link**
- ใช้ **signed client upload** ของ Vercel Blob, ตรวจ **MIME + ขนาด whitelist** (ดูตารางข้อ 12.1)
- ตั้งชื่อไฟล์แบบสุ่ม, กัน path traversal
- **รองรับ 2 แหล่ง:** (1) อัปโหลดขึ้น Blob หรือ (2) ใส่ **ลิงก์ภายนอก** (URL รูป / YouTube สำหรับวิดีโอ)
- กฎความปลอดภัยของลิงก์ภายนอก (กัน SSRF/abuse):
  - รับเฉพาะ `https://`, ตรวจ content-type ว่าเป็นรูป/วิดีโอจริง
  - **บล็อก private/internal IP ranges** ถ้าฝั่ง server ต้อง fetch (กัน SSRF)
  - รูปลิงก์: เรนเดอร์ผ่าน `<img>` ฝั่ง client (เบราว์เซอร์เป็นคนโหลด ไม่ใช่ server) → ไม่มี SSRF, ไม่กิน egress ของเรา
  - ถ้าจะ optimize รูปลิงก์ผ่าน `next/image` ต้องตั้ง `remotePatterns` allowlist
  - วิดีโอลิงก์ = ฝัง **YouTube/Vimeo embed** เท่านั้น (ไม่ดึงไฟล์ดิบ)
- โควตา media ต่อ user (ดูข้อ 12.1) — **นับเฉพาะไฟล์ที่อัปโหลดบน Blob** ส่วนลิงก์ภายนอกไม่นับ (โฮสต์ที่อื่นออกค่าใช้จ่ายเอง)

### 12.1 ขนาดไฟล์ + โควตา media (พร้อมการคุม cost)

**เพดานต่อไฟล์ (อัปโหลด):**
| ชนิด | Free | จ่ายเงิน/Pro | MIME ที่รับ |
|---|---|---|---|
| รูป | **≤ 10 MB** | ≤ 10 MB | jpeg, png, webp, gif |
| เสียง | **≤ 15 MB** (~5–8 นาที mp3) | ≤ 30 MB | mp3, m4a/aac, ogg |
| วิดีโอ | **≤ 50 MB** (~30–60 วิ) | ≤ 200 MB | mp4 (H.264), webm |

**โควตาพื้นที่รวม (เฉพาะไฟล์อัปโหลด ไม่รวมลิงก์):**
| Tier | โควตารวมต่อ user | หมายเหตุ |
|---|---|---|
| **Free** | **200 MB** | พอสำหรับ 3 quiz มาตรฐาน (รูปเป็นหลัก + คลิปสั้น) |
| **Paid (ต่อแพ็ก/Pro)** | **2 GB** | ขยายได้ตาม pack ที่ซื้อ |

#### การคำนวณ cost (อิงราคา Vercel Blob, พ.ค. 2026)
ราคา Blob: **storage $0.023/GB-เดือน**, **data transfer (egress) $0.05/GB**, operations $0.40/1M
- **Storage แทบไม่ใช่ปัญหา:** เก็บ 200 MB หนึ่งเดือน ≈ $0.0046 (~0.16 บาท)/user · ผู้ใช้ฟรี 1,000 คนเต็มโควตา = 200 GB = **~$4.6/เดือน (~160 บาท)** เท่านั้น
- **egress คือ cost จริง:** ทุกครั้งที่มีคนเล่น quiz = โหลด media ออกไป
  - quiz รูปล้วน ~3 MB × เล่น 1,000 ครั้ง = 3 GB egress ≈ **$0.15 (~5 บาท)**
  - quiz มีวิดีโอ 50 MB × เล่น 1,000 ครั้ง = 50 GB egress ≈ **$2.5 (~88 บาท)** ← จุดอันตราย
- **กลยุทธ์คุม cost (ออกแบบไว้แล้ว):**
  1. **optimize รูปตอนอัปโหลด** — แปลง webp + ย่อด้าน ≤ 1600px อัตโนมัติ (รูป 10 MB เหลือไม่กี่ร้อย KB) → egress ลดมหาศาล
  2. **ตั้ง Cache-Control ยาว** บนไฟล์ Blob (immutable) → CDN cache, คนเล่นซ้ำ/ไวรัลไม่ตีกลับ origin บ่อย
  3. **วิดีโอดัน YouTube embed** — egress วิดีโอตกเป็นของ YouTube ไม่ใช่เรา (cost = 0); การอัปโหลดวิดีโอตรงให้เป็นของ Free แบบจำกัด + ของ Paid
  4. **ลิงก์รูปภายนอก = 0 cost** ทั้ง storage และ egress (โฮสต์อื่นจ่าย)
  5. quiz อายุ 7 วัน + archive ออก Blob → ไฟล์ไม่ค้างกินพื้นที่ระยะยาว

> **⚠️ ข้อต้องรู้เรื่องแพลน Vercel:** Hobby (ฟรี) = **ใช้เชิงพาณิชย์ไม่ได้** ตาม ToS
> เนื่องจากนี่คือ passive income (เชิงพาณิชย์) ต้องใช้ **Pro ($20/เดือน ≈ 700 บาท)** เป็นต้นทุนคงที่
> → นี่คือ "จุดคุ้มทุน" ที่ต้องครอบด้วยรายได้: ดูข้อ 10.4

**Rate limiting & bot**
- **Upstash rate limit** ต่อ IP/ต่อ user บน: login, magic link, create/publish, play submit, upload, checkout
- **Vercel BotID** บน endpoint ที่เสี่ยง bot (เล่น quiz / สร้าง)

**Payment**
- ไม่เก็บข้อมูลบัตร (ใช้ Stripe Checkout)
- **verify webhook signature** + **idempotency key**
- ยึด state จาก webhook เท่านั้น, log ทุก transaction, รองรับ refund/dispute

**Data & secrets**
- secrets อยู่ใน **Vercel env vars** (ไม่ commit), แยก env: dev/preview/prod
- หลักการ least privilege กับ DB/Blob tokens
- PII เก็บเท่าที่จำเป็น (PDPA), เข้ารหัส in-transit (HTTPS บังคับ)
- `CRON_SECRET` ป้องกัน endpoint cron

**Operational**
- audit log สำหรับ action ของ admin
- error handling ไม่ leak stack/secret ออก client
- backup: Neon point-in-time recovery + archive JSON บน Blob

---

## 13. โครงสร้างโปรเจกต์ (ร่าง)

```
quiz-creator/
├─ app/
│  ├─ (marketing)/                 # landing, pricing, privacy, terms
│  ├─ (auth)/                      # sign-in, consent
│  ├─ dashboard/                   # quiz ของฉัน, billing, settings
│  ├─ create/[quizId]/             # builder (wizard)
│  ├─ quiz/[publicId]/             # หน้าเล่น quiz (public)
│  │   └─ result/                  # หน้าแสดงผล + share
│  ├─ admin/                       # admin console: overview, users, quizzes,
│  │                               #   transactions, analytics, moderation, settings
│  └─ api/
│     ├─ stripe/webhook/route.ts
│     ├─ upload/route.ts           # signed blob upload
│     └─ cron/lifecycle/route.ts   # หมดอายุ + archive
├─ lib/
│  ├─ auth.ts                      # Auth.js config
│  ├─ db/ (drizzle schema, client)
│  ├─ scoring.ts                   # scoring engine
│  ├─ entitlements.ts              # กฎ free/credit/plan
│  ├─ ratelimit.ts                 # adapter: memory | upstash
│  ├─ storage/                     # adapter: local(fs) | blob  (ข้อ 6.2)
│  ├─ email.ts                     # adapter: console | resend
│  └─ stripe.ts
├─ components/ (ui — shadcn, builder, player)
├─ scripts/cron-lifecycle.ts       # รัน cron ด้วยมือตอน local
├─ docker-compose.yml              # Postgres (+ Redis) สำหรับ local dev
├─ .env.example                    # คีย์ทั้งหมด + ค่าตัวอย่าง local
├─ proxy.ts                        # auth gate (Next 16)
├─ vercel.ts                       # config + crons (ใช้ตอนขึ้น prod)
└─ DESIGN.md
```

---

## 14. แผนการทำเป็น Phase

| Phase | ได้อะไร |
|---|---|
| **0. Setup (local-first)** | init Next.js 16 + Tailwind + shadcn, `docker-compose` (Postgres), **adapter: storage/cache/email สลับด้วย env** (ข้อ 6.2), `.env.example`, รันได้ครบบน local ฟรี |
| **0.5 ขึ้น Vercel (ภายหลัง)** | ซื้อโดเมน + Vercel Pro, สลับ env → Neon/Upstash/Blob/Resend, ตั้ง Vercel Cron, deploy prod |
| **1. Auth + PDPA** | Google/email login, consent flow, schema users/consents |
| **2. Quiz core** | schema quiz, builder wizard, scoring engine (`archetype` + `range`), หน้าเล่น + ผลลัพธ์ |
| **3. Media** | อัปโหลด/ลิงก์ รูป-เสียง-วิดีโอ (Blob + YouTube embed) + optimize + validation + โควตา |
| **3.5 Branching** | flow editor + result logic `branching` (if-else) |
| **4. Lifecycle** | อายุ 7 วัน, cron หมดอายุ + archive JSON + restore |
| **5. Dashboard + Admin Console** | dashboard ผู้สร้าง + **admin console ครบวงจร** (users, transactions, analytics, moderation, settings) + audit log (ข้อ 11.2) |
| **6. Payment** | Stripe Checkout (PromptPay), credit/extend/extra-slot, webhook |
| **7. Donation + polish** | tip jar, share OG image, theme, hardening, ทดสอบ security |

---

## 15. แบรนด์ (Brand) — ✅ เลือกแล้ว: **Quibby**

ควิบบี้ — สั้น จำง่าย น่ารัก ตั้งเป็นมาสคอตได้ ออกเสียงได้ทั้งไทย/อังกฤษ
- โดเมนที่จะลองเช็คตอนเริ่ม: `quibby.app`, `quibby.cc`, `quibby.io`, `getquibby.com`
- โทนแบรนด์: สนุก เป็นมิตร สีสันสดใส มีมาสคอตประจำแพลตฟอร์ม
- (เดี๋ยวเช็คโดเมนว่าง + ทำ logo/มาสคอตในช่วง polish)

---

## 16. คำถามที่ต้องเคาะก่อนเริ่ม (Open decisions)

ตอบแล้วทั้งหมด (บันทึกในเอกสารแล้ว):
- ✅ **แบรนด์** = Quibby (ข้อ 15)
- ✅ **ราคา** (ข้อ 10.1) + จุดคุ้มทุน (ข้อ 10.4)
- ✅ **ขนาดไฟล์ + โควตา media + cost** (ข้อ 12.1)
- ✅ **ฟอนต์** 5 แบบไทย (ข้อ 6.1) · ภาษา = ไทยก่อน EN ทีหลัง
- ✅ **"3 quiz ฟรี"** = active พร้อมกัน 3 อัน, อันที่หมดอายุไม่นับ (ข้อ 10.3)
- ✅ **quiz ให้คะแนน (scored)** = ทำ 2 โหมด `range` (ช่วงคะแนน) + `branching` (if-else), เลือกได้ตอนสร้าง (ข้อ 4.1)
- ✅ **archive** 90 วันก่อนลบถาวร

เหลือเป็นรายละเอียดเล็ก ๆ ที่เคาะตอนเริ่มได้:
1. ขั้นต่ำ PromptPay บน Stripe (เช็คจริงตอนตั้ง Stripe) → อาจขยับราคาขั้นต่ำเล็กน้อย
2. soft cap จำนวนคำถามต่อ quiz (เสนอ ≤ 50) และจำนวน result (เสนอ ≤ 8 archetype / ≤ 10 range)
3. โทนสี/มาสคอตของแบรนด์ Quibby (ทำช่วง polish)

---

> เอกสารพร้อมแล้ว เมื่อโอเคบอกได้เลยว่าจะเริ่ม Phase ไหนก่อน (แนะนำ Phase 0 → 1) เดี๋ยวลงมือต่อให้ครับ
