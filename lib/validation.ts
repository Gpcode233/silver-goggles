import { z } from "zod";

import { AGENT_CATEGORIES } from "@/lib/types";

export const createAgentSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(400),
  category: z.enum(AGENT_CATEGORIES),
  systemPrompt: z.string().trim().min(10).max(5000),
  pricePerRun: z.coerce.number().min(0).max(1000),
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
