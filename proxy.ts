import { NextResponse, type NextRequest } from "next/server";

// Auth gate (Next.js 16 เปลี่ยนชื่อจาก middleware → proxy) — DESIGN.md ข้อ 8.1
// ตรงนี้เช็คแค่ "มี session cookie ไหม" แบบเบา ๆ (ไม่แตะ DB → รันได้ทุก runtime)
// การตรวจจริง + เช็ค status=suspended ทำใน layout ของแต่ละโซนด้วย auth() ฝั่ง server

export function proxy(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/create/:path*", "/admin/:path*"],
};
