"use client";

import { useState } from "react";
import { createAdSlot } from "@/lib/actions/admin";
import { MediaInput } from "@/components/builder/media-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ฟอร์มเพิ่มโฆษณา — ใช้อัปโหลดรูป (MediaInput) แทนการวาง URL รูปภายนอก
// รูปจะถูกอัปโหลดไปที่ /api/upload แล้วเก็บ URL ลง hidden input ให้ createAdSlot อ่านได้เหมือนเดิม
export function AdCreateForm() {
  const [imageUrl, setImageUrl] = useState("");

  return (
    <form
      action={async (fd) => {
        await createAdSlot(fd);
        setImageUrl("");
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1.5">
        <Label>ตำแหน่ง</Label>
        <select name="placement" className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="footer">แถบล่าง (footer)</option>
          <option value="rail_left">ข้างซ้าย</option>
          <option value="rail_right">ข้างขวา</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>หน้าที่แสดง (คั่นด้วย ,)</Label>
        <Input name="pages" defaultValue="home" placeholder="home,play" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>รูปโฆษณา</Label>
        <MediaInput value={imageUrl} onChange={setImageUrl} />
        <input type="hidden" name="imageUrl" value={imageUrl} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>ลิงก์ปลายทาง</Label>
        <Input name="targetUrl" placeholder="https://..." />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={!imageUrl}>
          เพิ่ม + เปิดใช้
        </Button>
      </div>
    </form>
  );
}
