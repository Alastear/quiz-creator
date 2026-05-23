import { getFlags, getAnnouncement } from "@/lib/config";
import { updateFlags, updateAnnouncement } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSettings() {
  const [flags, announcement] = await Promise.all([
    getFlags(),
    getAnnouncement(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ตั้งค่าระบบ</h1>
      <p className="text-sm text-muted-foreground">
        ปรับได้ทันทีโดยไม่ต้อง deploy ใหม่
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature flags</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFlags} className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="adsEnabled" defaultChecked={flags.adsEnabled} />
              เปิดแสดงโฆษณาทั้งเว็บ
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="signupsOpen" defaultChecked={flags.signupsOpen} />
              เปิดรับสมัครสมาชิกใหม่
            </label>
            <Button type="submit" size="sm">บันทึก flags</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประกาศ (banner หน้าแรก)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAnnouncement} className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={announcement.enabled} />
              แสดงประกาศ
            </label>
            <Input name="text" defaultValue={announcement.text} placeholder="ข้อความประกาศ…" />
            <Button type="submit" size="sm">บันทึกประกาศ</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
