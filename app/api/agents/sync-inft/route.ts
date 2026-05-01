import { NextResponse } from "next/server";

import { mintINFTsForAgentsMissingToken } from "@/lib/zero-g/inft";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await mintINFTsForAgentsMissingToken();
    const hasFailures = result.failed.length > 0;
    return NextResponse.json(result, { status: hasFailures ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mint iNFTs" },
      { status: 500 },
    );
  }
}
