import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "ajently_session";
const ONBOARDING_COOKIE = "ajently_onboarded";

const PUBLIC_PATHS = ["/auth", "/auth/google-complete"];
const ONBOARDING_PATH = "/onboarding";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const onboarded = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (hasSession && !onboarded && pathname !== ONBOARDING_PATH) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
  }

  if (hasSession && onboarded && (pathname === "/auth" || pathname === ONBOARDING_PATH)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (hasSession && !onboarded && pathname === "/auth") {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
