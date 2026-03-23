import { NextResponse } from "next/server";

import { publishAgent } from "@/lib/publish-agent";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const agentId = Number(id);

  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  try {
    const result = await publishAgent(agentId);
    return NextResponse.json({
      agent: result.agent,
      manifest: result.manifest,
      published: true,
      storageMode: result.storageMode,
      uploadProof: result.uploadProof,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish agent" },
      { status: 500 },
    );
  }
}
