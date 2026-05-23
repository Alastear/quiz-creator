import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adSlots } from "@/lib/db/schema";
import { getFlags } from "@/lib/config";

// พื้นที่โฆษณา (DESIGN.md ข้อ 6.3) — ไม่มี/ปิดอยู่ = render null → จอเต็มปกติ
export async function AdZone({
  placement,
  page,
  className,
}: {
  placement: "footer" | "rail_left" | "rail_right" | "inline";
  page: string;
  className?: string;
}) {
  const flags = await getFlags();
  if (!flags.adsEnabled) return null;

  const slots = await db
    .select()
    .from(adSlots)
    .where(and(eq(adSlots.placement, placement), eq(adSlots.enabled, true)));
  const slot = slots.find((s) => s.pages.includes(page));
  if (!slot || !slot.imageUrl) return null;

  return (
    <a
      href={slot.targetUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      aria-label="โฆษณา"
    >
      <img src={slot.imageUrl} alt="โฆษณา" className="h-full w-full rounded-lg object-cover" />
    </a>
  );
}
