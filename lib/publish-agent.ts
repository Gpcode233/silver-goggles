import fs from "node:fs/promises";

import { applyPublishResult, getAgentById, getUserById, listAgents } from "@/lib/agent-service";
import type { AgentManifest, AgentRecord } from "@/lib/types";
import {
  getRealStorageConfigError,
  uploadKnowledge,
  uploadManifest,
  type UploadResult,
} from "@/lib/zero-g/storage";

type PublishAgentOptions = {
  requireRealStorageProof?: boolean;
};

export async function publishAgent(agentId: number): Promise<{
  agent: AgentRecord;
  manifest: AgentManifest;
  storageMode: "real" | "mock";
  uploadProof: {
    manifest: UploadResult;
    knowledge: UploadResult | null;
  };
}> {
  return publishAgentWithOptions(agentId, {});
}

export async function publishAgentWithOptions(
  agentId: number,
  options: PublishAgentOptions,
): Promise<{
  agent: AgentRecord;
  manifest: AgentManifest;
  storageMode: "real" | "mock";
  uploadProof: {
    manifest: UploadResult;
    knowledge: UploadResult | null;
  };
}> {
  const requireRealStorageProof = options.requireRealStorageProof ?? true;
  if (requireRealStorageProof) {
    const configError = getRealStorageConfigError();
    if (configError) {
      throw new Error(configError);
    }
  }

  const agent = await getAgentById(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }

  const creator = await getUserById(agent.creatorId);
  if (!creator) {
    throw new Error("Creator not found");
  }

  let knowledgeUri: string | null = null;
  let knowledgeUpload: UploadResult | null = null;
  let mode: "real" | "mock" = "mock";

  if (agent.knowledgeLocalPath) {
    const bytes = await fs.readFile(agent.knowledgeLocalPath);
    knowledgeUpload = await uploadKnowledge(bytes, { requireReal: requireRealStorageProof });
    if (requireRealStorageProof && (knowledgeUpload.mode !== "real" || !knowledgeUpload.transactionHash)) {
      throw new Error("Knowledge file was not uploaded to real 0G Storage with a transaction hash");
    }
    knowledgeUri = knowledgeUpload.uri;
    mode = knowledgeUpload.mode;
  }

  const manifest: AgentManifest = {
    name: agent.name,
    description: agent.description,
    system_prompt: agent.systemPrompt,
    category: agent.category,
    model: agent.model,
    knowledge_uri: knowledgeUri,
    creator: creator.walletAddress,
    price_per_run: agent.pricePerRun,
  };

  const manifestUpload = await uploadManifest(manifest, { requireReal: requireRealStorageProof });
  if (requireRealStorageProof && (manifestUpload.mode !== "real" || !manifestUpload.transactionHash)) {
    throw new Error("Manifest was not uploaded to real 0G Storage with a transaction hash");
  }
  mode = manifestUpload.mode;

  const updatedAgent = await applyPublishResult({
    agentId,
    storageHash: manifestUpload.rootHash,
    manifestUri: manifestUpload.uri,
    manifestTxHash: manifestUpload.transactionHash,
    knowledgeUri,
    knowledgeTxHash: knowledgeUpload?.transactionHash ?? null,
  });

  return {
    agent: updatedAgent,
    manifest,
    storageMode: mode,
    uploadProof: {
      manifest: manifestUpload,
      knowledge: knowledgeUpload,
    },
  };
}

function hasStorageProof(agent: AgentRecord): boolean {
  return Boolean(agent.storageHash && agent.manifestUri && agent.manifestTxHash);
}

export async function publishAgentsMissingStorageProof(): Promise<{
  checked: number;
  published: number;
  failed: Array<{ agentId: number; error: string }>;
}> {
  const agents = await listAgents({ includeDrafts: true });
  const failed: Array<{ agentId: number; error: string }> = [];
  let published = 0;

  for (const agent of agents) {
    if (hasStorageProof(agent)) {
      continue;
    }
    try {
      await publishAgentWithOptions(agent.id, { requireRealStorageProof: true });
      published += 1;
    } catch (error) {
      failed.push({
        agentId: agent.id,
        error: error instanceof Error ? error.message : "Failed to publish agent to 0G Storage",
      });
    }
  }

  return {
    checked: agents.length,
    published,
    failed,
  };
}
