import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { upsertGoogleUser } from "@/lib/agent-service";
import { applySessionCookies } from "@/lib/auth";
import { authOptions } from "@/lib/next-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const email = sessionUser?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Google sign-in session not found" }, { status: 401 });
  }

  const user = await upsertGoogleUser({
    email,
    displayName: sessionUser?.name?.trim() || null,
    avatarUrl: sessionUser?.image?.trim() || null,
  });

  return applySessionCookies(NextResponse.json({ user }), user.id, user.onboardingCompleted, {
    provider: user.authProvider,
    email: user.email,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  });
}
