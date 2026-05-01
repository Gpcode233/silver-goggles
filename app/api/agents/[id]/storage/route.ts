import { NextResponse } from "next/server";

import { getAgentById } from "@/lib/agent-service";
import { downloadText } from "@/lib/zero-g/storage";

export const dynamic = "force-dynamic";

function rootHashFromUri(uri: string): string {
  return uri.startsWith("0g://") ? uri.slice("0g://".length) : uri;
}

function toPreview(content: string): string {
  return content.length <= 160 ? content : `${content.slice(0, 160)}...`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const agentId = Number(id);

  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.manifestUri || !agent.storageHash) {
    return NextResponse.json({ error: "Agent has not been published to storage" }, { status: 400 });
  }
  if (!agent.manifestTxHash) {
    return NextResponse.json(
      { error: "Agent is missing 0G manifest transaction proof" },
      { status: 400 },
    );
  }

  try {
    const manifestRaw = await downloadText(agent.manifestUri);
    const manifestRootHash = rootHashFromUri(agent.manifestUri);

    let manifestJson: Record<string, unknown> | null = null;
    try {
      manifestJson = JSON.parse(manifestRaw) as Record<string, unknown>;
    } catch {
      manifestJson = null;
    }

    let knowledgeProof: {
      uri: string;
      rootHash: string;
      transactionHash: string | null;
      bytes: number;
      preview: string;
    } | null = null;

    if (agent.knowledgeUri) {
      const knowledgeRaw = await downloadText(agent.knowledgeUri);
      knowledgeProof = {
        uri: agent.knowledgeUri,
        rootHash: rootHashFromUri(agent.knowledgeUri),
        transactionHash: agent.knowledgeTxHash,
        bytes: Buffer.byteLength(knowledgeRaw, "utf-8"),
        preview: toPreview(knowledgeRaw),
      };
    }

    return NextResponse.json({
      agentId: agent.id,
      retrievedAt: new Date().toISOString(),
      manifest: {
        uri: agent.manifestUri,
        rootHash: manifestRootHash,
        transactionHash: agent.manifestTxHash,
        storedHashMatches: manifestRootHash === agent.storageHash,
        bytes: Buffer.byteLength(manifestRaw, "utf-8"),
        preview: toPreview(manifestRaw),
        parsed: manifestJson,
      },
      knowledge: knowledgeProof,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to retrieve data from storage",
      },
      { status: 500 },
    );
  }
}
