"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// ปุ่มสร้าง quiz ที่โชว์ "กำลังสร้าง…" ระหว่างรอ (useFormStatus ต้องอยู่ใน <form>)
export function CreateQuizButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          กำลังสร้าง…
        </>
      ) : (
        "+ สร้าง quiz ใหม่"
      )}
    </Button>
  );
}
