export const AGENT_CATEGORIES = [
  "Marketing",
  "Coding",
  "Education",
  "Productivity",
  "Research",
  "Design",
  "Finance",
  "General",
] as const;

export type AgentCategory = (typeof AGENT_CATEGORIES)[number];

export type AgentRecord = {
  id: number;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  pricePerRun: number;
  creatorId: number;
  storageHash: string | null;
  manifestUri: string | null;
  manifestTxHash: string | null;
  knowledgeUri: string | null;
  knowledgeTxHash: string | null;
  knowledgeLocalPath: string | null;
  knowledgeFilename: string | null;
  published: boolean;
  createdAt: string;
};

export type RunRecord = {
  id: number;
  userId: number;
  agentId: number;
  input: string;
  output: string;
  cost: number;
  computeMode: string;
  createdAt: string;
};

export type UserRecord = {
  id: number;
  walletAddress: string;
  credits: number;
};

export type AgentManifest = {
  name: string;
  description: string;
  system_prompt: string;
  category: string;
  knowledge_uri: string | null;
  creator: string;
  price_per_run: number;
};

export type ComputeResult = {
  output: string;
  mode: "real" | "mock";
  model: string;
  providerAddress: string;
};
