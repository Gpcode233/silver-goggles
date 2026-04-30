import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  getOrCreateEmailSessionUser,
  getOrCreateWalletUser,
  getUserByEmail,
  getUserById,
  upsertGoogleUser,
} from "@/lib/agent-service";
import { authOptions } from "@/lib/next-auth";

export const SESSION_COOKIE = "ajently_session";
export const ONBOARDING_COOKIE = "ajently_onboarded";
export const AUTH_PROVIDER_COOKIE = "ajently_auth_provider";
export const AUTH_EMAIL_COOKIE = "ajently_auth_email";
export const AUTH_WALLET_COOKIE = "ajently_auth_wallet";
export const AUTH_NAME_COOKIE = "ajently_auth_name";
export const AUTH_AVATAR_COOKIE = "ajently_auth_avatar";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function getCurrentUserId() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  const userId = Number(raw);
  if (Number.isInteger(userId) && userId > 0) {
    const user = await getUserById(userId);
    if (user) {
      return userId;
    }
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    const provider = store.get(AUTH_PROVIDER_COOKIE)?.value;
    const storedEmail = store.get(AUTH_EMAIL_COOKIE)?.value?.trim().toLowerCase();
    const storedWallet = store.get(AUTH_WALLET_COOKIE)?.value?.trim();
    const displayName = store.get(AUTH_NAME_COOKIE)?.value?.trim() || null;
    const avatarUrl = store.get(AUTH_AVATAR_COOKIE)?.value?.trim() || null;

    if (provider === "wallet" && storedWallet) {
      const user = await getOrCreateWalletUser(storedWallet);
      return user.id;
    }

    if (storedEmail) {
      const user = await getOrCreateEmailSessionUser({
        email: storedEmail,
        displayName,
        avatarUrl,
      });
      return user.id;
    }

    return null;
  }

  const user = await upsertGoogleUser({
    email,
    displayName: session?.user?.name?.trim() || null,
    avatarUrl: session?.user?.image?.trim() || null,
  });
  return user.id;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}

export function applySessionCookies(
  response: NextResponse,
  userId: number,
  onboarded: boolean,
  identity?: {
    provider?: "demo" | "email" | "google" | "wallet";
    email?: string | null;
    walletAddress?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  },
) {
  response.cookies.set(SESSION_COOKIE, String(userId), COOKIE_OPTIONS);
  response.cookies.set(ONBOARDING_COOKIE, onboarded ? "1" : "0", COOKIE_OPTIONS);
  response.cookies.set(AUTH_PROVIDER_COOKIE, identity?.provider ?? "", COOKIE_OPTIONS);
  response.cookies.set(AUTH_EMAIL_COOKIE, identity?.email ?? "", COOKIE_OPTIONS);
  response.cookies.set(AUTH_WALLET_COOKIE, identity?.walletAddress ?? "", COOKIE_OPTIONS);
  response.cookies.set(AUTH_NAME_COOKIE, identity?.displayName ?? "", COOKIE_OPTIONS);
  response.cookies.set(AUTH_AVATAR_COOKIE, identity?.avatarUrl ?? "", COOKIE_OPTIONS);
  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(ONBOARDING_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_PROVIDER_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_EMAIL_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_WALLET_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_NAME_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_AVATAR_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
