import { NextResponse } from "next/server";

import { DEMO_USER_ID, getUserById, listAgentsByCreator } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserById(DEMO_USER_ID);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const agents = await listAgentsByCreator(DEMO_USER_ID);
  return NextResponse.json({ user, agents });
}
