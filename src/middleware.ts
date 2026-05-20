// Edge middleware: keep unauthenticated users out of /dashboard, /playlists,
// /assets, /activity, and /admin. We only check for the *presence* of the
// session cookie here — full JWT verification happens server-side in each
// route. This avoids a heavy verification on every request.

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/playlists", "/assets", "/activity", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const hasCookie = req.cookies.has("cdm_session");
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/playlists/:path*", "/assets/:path*", "/activity/:path*", "/admin/:path*"],
};
