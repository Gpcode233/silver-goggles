import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { upsertGoogleUser } from "@/lib/agent-service";
import { applySessionCookies } from "@/lib/auth";
import { authOptions } from "@/lib/next-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Google sign-in session not found" }, { status: 401 });
  }

  const user = await upsertGoogleUser({
    email,
    displayName: session.user?.name?.trim() || null,
    avatarUrl: session.user?.image?.trim() || null,
  });

  return applySessionCookies(NextResponse.json({ user }), user.id, user.onboardingCompleted);
}
