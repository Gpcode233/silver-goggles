import { z } from "zod";

import { AGENT_CARD_GRADIENTS, AGENT_CATEGORIES, AGENT_MODELS } from "@/lib/types";

export const createAgentSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(400),
  category: z.enum(AGENT_CATEGORIES),
  model: z.enum(AGENT_MODELS).default("openrouter/free"),
  systemPrompt: z.string().trim().min(10).max(5000),
  pricePerRun: z.coerce.number().min(0).max(1000),
  cardGradient: z.enum(AGENT_CARD_GRADIENTS).default("aurora"),
  publishNow: z.coerce.boolean().default(true),
});

export const runAgentSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export const listAgentsSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  includeDrafts: z.coerce.boolean().default(false),
});

export const createTopupSchema = z.object({
  rail: z.enum(["fiat", "stablecoin"]),
  currency: z.string().trim().toUpperCase().min(2).max(12),
  amount: z.coerce.number().min(1).max(10000),
});

export const createOnchainTopupSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
  chainId: z.coerce.number().int().positive(),
  fromAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  currency: z.string().trim().toUpperCase().min(1).max(12),
  expectedAmount: z.string().trim().regex(/^\d+(\.\d{1,18})?$/).optional(),
});
