import { NextResponse } from "next/server";

import { publishAgent } from "@/lib/publish-agent";

export const dynamic = "force-dynamic";

function toPublishErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Failed to publish agent";
  const looksLikeRevert =
    message.includes("execution reverted") ||
    message.includes("CALL_EXCEPTION") ||
    message.includes("estimateGas");

  if (!looksLikeRevert) {
    return message;
  }

  return (
    "0G Storage transaction reverted for the server signer wallet. " +
    "Fund the ZERO_G_PRIVATE_KEY address on 0G testnet and verify ZERO_G_EVM_RPC / ZERO_G_STORAGE_INDEXER_RPC."
  );
}

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
      { error: toPublishErrorMessage(error) },
      { status: 500 },
    );
  }
}
