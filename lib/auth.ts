import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "ajently_session";
export const ONBOARDING_COOKIE = "ajently_onboarded";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function getCurrentUserId() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  const userId = Number(raw);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}

export function applySessionCookies(response: NextResponse, userId: number, onboarded: boolean) {
  response.cookies.set(SESSION_COOKIE, String(userId), COOKIE_OPTIONS);
  response.cookies.set(ONBOARDING_COOKIE, onboarded ? "1" : "0", COOKIE_OPTIONS);
  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(ONBOARDING_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
