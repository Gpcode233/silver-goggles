import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "ajently_session";
const ONBOARDING_COOKIE = "ajently_onboarded";
const PROVIDER_SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

const PUBLIC_PATHS = ["/auth", "/auth/google-complete"];
const ONBOARDING_PATH = "/onboarding";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const hasAppSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const hasProviderSession = PROVIDER_SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
  const hasSession = hasAppSession || hasProviderSession;
  const onboarded = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    const authUrl = new URL("/auth", request.url);
    const next = `${pathname}${search}`;
    if (next && next !== "/") {
      authUrl.searchParams.set("next", next);
    }
    return NextResponse.redirect(authUrl);
  }

  if (hasAppSession && !onboarded && pathname !== ONBOARDING_PATH) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
