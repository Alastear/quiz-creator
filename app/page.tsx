import Link from "next/link";
import { and, desc, eq, gt, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";
import { kanit } from "@/lib/fonts";
import { QUIZ_CATEGORIES, CATEGORY_LABEL } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Announcement } from "@/components/site/announcement";
import { AdZone } from "@/components/ads/ad-zone";

export const metadata = {
  title: "Quibby — สร้างและเล่น quiz สนุก ๆ",
  description: "ค้นหา quiz ทายผล/ทายนิสัย มาเล่น หรือสร้างของคุณเอง",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q = "", cat = "" } = await searchParams;

  const filters: SQL[] = [
    eq(quizzes.status, "published"),
    or(isNull(quizzes.expiresAt), gt(quizzes.expiresAt, new Date()))!,
  ];
  if (q.trim()) filters.push(ilike(quizzes.title, `%${q.trim()}%`));
  if (cat && QUIZ_CATEGORIES.some((c) => c.key === cat))
    filters.push(eq(quizzes.category, cat as typeof quizzes.category.enumValues[number]));

  const list = await db
    .select({
      publicId: quizzes.publicId,
      title: quizzes.title,
      description: quizzes.description,
      coverImageUrl: quizzes.coverImageUrl,
      category: quizzes.category,
      playCount: quizzes.playCount,
    })
    .from(quizzes)
    .where(and(...filters))
    .orderBy(desc(quizzes.playCount), desc(quizzes.createdAt))
    .limit(48);

  return (
    <main className="flex-1">
      <Announcement />

      {/* rails โฆษณา — โผล่เฉพาะจอกว้าง ≥xl และเมื่อมีโฆษณา (ไม่มี = ไม่ดันเนื้อหา) */}
      <AdZone
        placement="rail_left"
        page="home"
        className="fixed left-3 top-1/2 hidden h-96 w-40 -translate-y-1/2 xl:block"
      />
      <AdZone
        placement="rail_right"
        page="home"
        className="fixed right-3 top-1/2 hidden h-96 w-40 -translate-y-1/2 xl:block"
      />

      {/* nav */}
      <header className="flex items-center gap-3 px-6 py-4">
        <Link href="/" className={`${kanit.className} text-xl font-bold`}>
          Quibby
        </Link>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/signin" />}>
            เข้าสู่ระบบ
          </Button>
          <Button size="sm" render={<Link href="/dashboard" />}>
            + สร้าง quiz
          </Button>
        </div>
      </header>

      {/* hero + search */}
      <section className="px-6 pb-6 pt-8 text-center">
        <h1 className={`${kanit.className} text-4xl font-bold sm:text-5xl`}>
          เล่น quiz สนุก ๆ
        </h1>
        <p className="mt-3 text-muted-foreground">
          ค้นหาแบบทดสอบที่อยากเล่น หรือสร้างของคุณเองแล้วแชร์
        </p>
        <form action="/" className="mx-auto mt-6 flex max-w-md gap-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาแบบทดสอบ…"
            className="h-10"
          />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <Button type="submit" className="h-10">
            ค้นหา
          </Button>
        </form>

        {/* category chips */}
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          <CategoryChip label="ทั้งหมด" href={buildHref(q, "")} active={!cat} />
          {QUIZ_CATEGORIES.map((c) => (
            <CategoryChip
              key={c.key}
              label={`${c.emoji} ${c.label}`}
              href={buildHref(q, c.key)}
              active={cat === c.key}
            />
          ))}
        </div>
      </section>

      {/* grid */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        {list.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            ยังไม่มีแบบทดสอบที่ตรงกับการค้นหา
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((quiz) => (
              <li key={quiz.publicId}>
                <Link
                  href={`/quiz/${quiz.publicId}`}
                  className="block overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
                >
                  <div className="aspect-video w-full bg-muted">
                    {quiz.coverImageUrl ? (
                      <img
                        src={quiz.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">
                        {QUIZ_CATEGORIES.find((c) => c.key === quiz.category)?.emoji ?? "✨"}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 font-medium">{quiz.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {CATEGORY_LABEL[quiz.category]} · เล่น {quiz.playCount} ครั้ง
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* footer โฆษณา (ถ้ามี) */}
        <AdZone placement="footer" page="home" className="mx-auto mt-10 block h-24 max-w-3xl" />
      </section>
    </main>
  );
}

function buildHref(q: string, cat: string) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (cat) p.set("cat", cat);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

function CategoryChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
