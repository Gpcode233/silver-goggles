import { NextResponse } from "next/server";

import { publishAgentsMissingStorageProof } from "@/lib/publish-agent";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await publishAgentsMissingStorageProof();
    const hasFailures = result.failed.length > 0;
    return NextResponse.json(result, { status: hasFailures ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync agents to 0G Storage" },
      { status: 500 },
    );
  }
}

