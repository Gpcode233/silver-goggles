import { NextResponse } from "next/server";

import { completeUserOnboarding } from "@/lib/agent-service";
import { applySessionCookies, requireCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const formData = await request.formData();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const avatarFile = formData.get("avatar");

    if (displayName.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    let avatarUrl: string | null = null;
    if (avatarFile instanceof File && avatarFile.size > 0) {
      if (!avatarFile.type.startsWith("image/")) {
        return NextResponse.json({ error: "Profile picture must be an image" }, { status: 400 });
      }
      if (avatarFile.size > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Profile picture must be 2MB or smaller" }, { status: 400 });
      }
      const bytes = Buffer.from(await avatarFile.arrayBuffer());
      avatarUrl = `data:${avatarFile.type || "image/png"};base64,${bytes.toString("base64")}`;
    }

    const user = await completeUserOnboarding({
      userId,
      displayName,
      email: email || null,
      avatarUrl,
    });
    return applySessionCookies(NextResponse.json({ user }), user.id, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete onboarding";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
