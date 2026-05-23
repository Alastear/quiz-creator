import { getAnnouncement } from "@/lib/config";

// แถบประกาศหน้าเว็บ — คุมจาก /admin/settings
export async function Announcement() {
  const a = await getAnnouncement();
  if (!a.enabled || !a.text) return null;
  return (
    <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
      {a.text}
    </div>
  );
}
