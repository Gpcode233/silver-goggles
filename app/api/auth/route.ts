import { NextResponse } from "next/server";

import {
  authenticateEmailUser,
  getOrCreateWalletUser,
  registerEmailUser,
} from "@/lib/agent-service";
import { applySessionCookies, clearSessionCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    provider?: "google" | "email" | "wallet";
    mode?: "login" | "signup";
    email?: string;
    password?: string;
    walletAddress?: string;
  };

  try {
    if (body.provider === "wallet") {
      if (!body.walletAddress?.trim()) {
        return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
      }
      const user = await getOrCreateWalletUser(body.walletAddress.trim());
      return applySessionCookies(NextResponse.json({ user }), user.id, user.onboardingCompleted, {
        provider: user.authProvider,
        email: user.email,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      });
    }

    if (body.provider === "email") {
      if (!body.email?.trim() || !body.password?.trim()) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
      }
      const user =
        body.mode === "signup"
          ? await registerEmailUser({ email: body.email, password: body.password })
          : await authenticateEmailUser({ email: body.email, password: body.password });
      return applySessionCookies(NextResponse.json({ user }), user.id, user.onboardingCompleted, {
        provider: user.authProvider,
        email: user.email,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      });
    }

    return NextResponse.json({ error: "Unsupported login method" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    if (message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    if (message === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  return clearSessionCookies(NextResponse.json({ ok: true }));
}
