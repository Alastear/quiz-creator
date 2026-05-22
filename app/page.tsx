import Link from "next/link";
import { kanit } from "@/lib/fonts";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-sm text-muted-foreground">
        🚧 กำลังพัฒนา · Phase 0
      </span>

      <h1
        className={`${kanit.className} text-5xl font-bold tracking-tight sm:text-6xl`}
      >
        Quibby
      </h1>

      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        แพลตฟอร์มสร้าง quiz ทายผล/ทายนิสัยแบบง่าย ๆ
        <br />
        สร้างเสร็จ แชร์ได้ทันที
      </p>

      <div className="mt-8 flex gap-3">
        <Button size="lg" disabled>
          สร้าง quiz (เร็ว ๆ นี้)
        </Button>
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/api/health" />}
        >
          ตรวจสถานะระบบ
        </Button>
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        ฟรี 3 quiz · รองรับ รูป/เสียง/วิดีโอ · แชร์ผลลัพธ์เป็นรูปได้
      </p>
    </main>
  );
}
