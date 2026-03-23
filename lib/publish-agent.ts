import fs from "node:fs/promises";

import { applyPublishResult, getAgentById, getUserById } from "@/lib/agent-service";
import type { AgentManifest, AgentRecord } from "@/lib/types";
import { uploadKnowledge, uploadManifest, type UploadResult } from "@/lib/zero-g/storage";

export async function publishAgent(agentId: number): Promise<{
  agent: AgentRecord;
  manifest: AgentManifest;
  storageMode: "real" | "mock";
  uploadProof: {
    manifest: UploadResult;
    knowledge: UploadResult | null;
  };
}> {
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
    knowledgeUpload = await uploadKnowledge(bytes);
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

  const manifestUpload = await uploadManifest(manifest);
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
