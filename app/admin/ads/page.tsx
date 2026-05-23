import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { adSlots } from "@/lib/db/schema";
import { createAdSlot, toggleAdSlot, deleteAdSlot } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLACEMENT_LABEL: Record<string, string> = {
  footer: "แถบล่าง",
  rail_left: "ข้างซ้าย",
  rail_right: "ข้างขวา",
  inline: "คั่นเนื้อหา",
};

export default async function AdminAds() {
  const slots = await db.select().from(adSlots).orderBy(desc(adSlots.updatedAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">โฆษณา</h1>
      <p className="text-sm text-muted-foreground">
        จัดการพื้นที่โฆษณาของเราเอง · ถ้าไม่มีหรือปิดอยู่ จอจะแสดงเต็มพื้นที่ปกติ
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">เพิ่มโฆษณา (รูป + ลิงก์)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAdSlot} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="flex flex-col gap-1.5">
              <Label>URL รูปโฆษณา</Label>
              <Input name="imageUrl" placeholder="https://..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ลิงก์ปลายทาง</Label>
              <Input name="targetUrl" placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">เพิ่ม + เปิดใช้</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {slots.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีโฆษณา</p>
        )}
        {slots.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
            {s.imageUrl && (
              <img src={s.imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{PLACEMENT_LABEL[s.placement] ?? s.placement}</p>
              <p className="truncate text-xs text-muted-foreground">
                {s.pages.join(", ")} · {s.targetUrl ?? "—"}
              </p>
            </div>
            <span className={`text-xs ${s.enabled ? "text-green-600" : "text-muted-foreground"}`}>
              {s.enabled ? "เปิด" : "ปิด"}
            </span>
            <form action={toggleAdSlot.bind(null, s.id, !s.enabled)}>
              <Button size="xs" variant="outline" type="submit">
                {s.enabled ? "ปิด" : "เปิด"}
              </Button>
            </form>
            <form action={deleteAdSlot.bind(null, s.id)}>
              <Button size="xs" variant="ghost" type="submit">
                ลบ
              </Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
