import Link from "next/link";
import { and, desc, eq, gt, ilike, isNull, or, type SQL } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";
import { kanit } from "@/lib/fonts";
import { QUIZ_CATEGORIES, CATEGORY_LABEL } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Announcement } from "@/components/site/announcement";
import { AdZone } from "@/components/ads/ad-zone";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

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
  const session = await auth();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

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
        <Link href="/">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <>
              <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
                แดชบอร์ด
              </Button>
              <form action={logout}>
                <Button variant="ghost" size="sm" type="submit">
                  ออกจากระบบ
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/signin" />}>
                เข้าสู่ระบบ
              </Button>
              <Button size="sm" render={<Link href="/dashboard" />}>
                + สร้าง quiz
              </Button>
            </>
          )}
        </div>
      </header>

      {/* hero + search */}
      <section className="relative overflow-hidden px-6 pb-10 pt-12 text-center">
        {/* แสงไล่เฉดประดับ (โทนโลโก้ ม่วง-ชมพู) */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-300/40 via-fuchsia-300/30 to-pink-300/40 blur-3xl" />
        </div>

        <h1 className={`${kanit.className} text-4xl font-bold tracking-tight sm:text-6xl`}>
          เล่น{" "}
          <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
            quiz
          </span>{" "}
          สนุก ๆ
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
          ค้นหาแบบทดสอบที่อยากเล่น ทายนิสัย ทายผล แล้วแชร์ให้เพื่อน
        </p>

        <form
          action="/"
          className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-full border bg-background p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-400/40"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาแบบทดสอบ…"
            className="h-10 flex-1 bg-transparent px-4 text-sm outline-none"
          />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <Button
            type="submit"
            className="h-10 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 text-white"
          >
            ค้นหา
          </Button>
        </form>

        {/* category chips */}
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
          <CategoryChip label="✨ ทั้งหมด" href={buildHref(q, "")} active={!cat} />
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
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((quiz) => (
              <li key={quiz.publicId}>
                <Link
                  href={`/quiz/${quiz.publicId}`}
                  className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-video w-full overflow-hidden">
                    {quiz.coverImageUrl ? (
                      <img
                        src={quiz.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-500 to-pink-500 text-5xl">
                        {QUIZ_CATEGORIES.find((c) => c.key === quiz.category)?.emoji ?? "✨"}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-1 font-semibold">{quiz.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {CATEGORY_LABEL[quiz.category]}
                      </span>
                      <span>· เล่น {quiz.playCount} ครั้ง</span>
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
        active
          ? "border-transparent bg-gradient-to-r from-violet-600 to-pink-600 text-white"
          : "hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
