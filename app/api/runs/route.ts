import { NextResponse } from "next/server";

import { listRecentRuns, listRunsForAgent } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentIdParam = searchParams.get("agentId");

  if (agentIdParam) {
    const agentId = Number(agentIdParam);
    if (!Number.isInteger(agentId) || agentId <= 0) {
      return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
    }
    const runs = await listRunsForAgent(agentId);
    return NextResponse.json({ runs });
  }

  const runs = await listRecentRuns();
  return NextResponse.json({ runs });
}
