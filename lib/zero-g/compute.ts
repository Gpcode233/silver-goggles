import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

import type { ComputeResult } from "@/lib/types";

type ServiceResponse = {
  endpoint: string;
  model: string;
};

function realComputeEnabled(): boolean {
  return (
    process.env.ZERO_G_COMPUTE_MODE === "real" &&
    Boolean(process.env.ZERO_G_EVM_RPC) &&
    Boolean(process.env.ZERO_G_PRIVATE_KEY)
  );
}

async function getComputeClient() {
  const provider = new ethers.JsonRpcProvider(process.env.ZERO_G_EVM_RPC!);
  const wallet = new ethers.Wallet(process.env.ZERO_G_PRIVATE_KEY!, provider);
  const broker = await createZGComputeNetworkBroker(wallet);
  return { broker };
}

async function resolveService(): Promise<{
  providerAddress: string;
  endpoint: string;
  model: string;
  broker: Awaited<ReturnType<typeof getComputeClient>>["broker"];
}> {
  const { broker } = await getComputeClient();
  const overrideProvider = process.env.ZERO_G_COMPUTE_PROVIDER;

  let providerAddress = overrideProvider;
  if (!providerAddress) {
    const services = await broker.inference.listService(0, 20, true);
    const chosen = services.find((service) => service.teeSignerAcknowledged) ?? services[0];
    if (!chosen) {
      throw new Error("No 0G compute provider available");
    }
    providerAddress = chosen.provider;
  }

  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
  } catch {
    // no-op: provider may already be acknowledged
  }

  const service: ServiceResponse = await broker.inference.getServiceMetadata(providerAddress);
  return {
    providerAddress,
    endpoint: service.endpoint,
    model: process.env.ZERO_G_COMPUTE_MODEL ?? service.model,
    broker,
  };
}

function runMockInference(systemPrompt: string, knowledge: string, userInput: string): ComputeResult {
  const context = [systemPrompt, knowledge].filter(Boolean).join("\n\n");
  const trimmedContext = context.slice(0, 240);

  return {
    output: [
      "Mock 0G Compute response",
      `User request: ${userInput}`,
      trimmedContext ? `Context used: ${trimmedContext}` : "Context used: none",
      "Switch ZERO_G_COMPUTE_MODE=real to use decentralized inference.",
    ].join("\n"),
    mode: "mock",
    model: "mock/qwen-2.5-7b-instruct",
    providerAddress: "mock-provider",
  };
}

export async function runInference(params: {
  systemPrompt: string;
  knowledge: string;
  userInput: string;
}): Promise<ComputeResult> {
  if (!realComputeEnabled()) {
    return runMockInference(params.systemPrompt, params.knowledge, params.userInput);
  }

  const { providerAddress, endpoint, model, broker } = await resolveService();
  const requestHeaders = await broker.inference.getRequestHeaders(providerAddress, params.userInput);

  const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [params.systemPrompt, params.knowledge ? `Knowledge:\n${params.knowledge}` : ""]
            .filter(Boolean)
            .join("\n\n"),
        },
        { role: "user", content: params.userInput },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`0G compute call failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const output =
    payload.choices?.[0]?.message?.content?.trim() ??
    "0G compute returned an empty response payload.";

  return {
    output,
    mode: "real",
    model,
    providerAddress,
  };
}

export function computeMode(): "real" | "mock" {
  return realComputeEnabled() ? "real" : "mock";
}
