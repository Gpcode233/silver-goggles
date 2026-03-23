import type { ComputeResult } from "@/lib/types";
import type { InferenceServingRequestHeaders } from "@0glabs/0g-serving-broker";

type ServiceResponse = {
  endpoint: string;
  model: string;
};

type OpenRouterPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenRouterMessageContent = NonNullable<
  NonNullable<NonNullable<OpenRouterPayload["choices"]>[number]["message"]>["content"]
>;

type ComputeServiceSummary = {
  provider: string;
  teeSignerAcknowledged?: boolean;
};

type ComputeInferenceClient = {
  listService: (offset: number, limit: number, onlyActive: boolean) => Promise<ComputeServiceSummary[]>;
  acknowledgeProviderSigner: (providerAddress: string) => Promise<void>;
  getServiceMetadata: (providerAddress: string) => Promise<ServiceResponse>;
  getRequestHeaders: (
    providerAddress: string,
    userInput: string,
  ) => Promise<InferenceServingRequestHeaders>;
};

type ComputeBroker = {
  inference: ComputeInferenceClient;
};

let computeBrokerPromise: Promise<{ broker: ComputeBroker }> | null = null;

function realComputeEnabled(): boolean {
  return (
    process.env.ZERO_G_COMPUTE_MODE === "real" &&
    Boolean(process.env.ZERO_G_EVM_RPC) &&
    Boolean(process.env.ZERO_G_PRIVATE_KEY)
  );
}

function openRouterEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function resolveOpenRouterModel(requestedModel?: string): string {
  const fallbackModel =
    process.env.OPENROUTER_DEFAULT_MODEL?.trim() || "meta-llama/llama-3.2-3b-instruct:free";
  const model = requestedModel?.trim() || fallbackModel;
  const imageOnlyModels = new Set([
    "google/gemini-2.5-flash-image",
    "google/gemini-3-pro-image-preview",
    "openai/gpt-5-image",
    "openai/gpt-5-image-mini",
  ]);

  if (model === "openrouter/free") {
    return fallbackModel;
  }

  if (imageOnlyModels.has(model)) {
    return fallbackModel;
  }

  return model;
}

function extractMessageContent(content: OpenRouterMessageContent | null | undefined): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part?.type === "text" ? part.text ?? "" : ""))
      .join("")
      .trim();
  }

  return "";
}

function toFetchHeaders(headers: InferenceServingRequestHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function getComputeClient() {
  if (!computeBrokerPromise) {
    computeBrokerPromise = (async () => {
      const [{ createZGComputeNetworkBroker }, { JsonRpcProvider, Wallet }] = await Promise.all([
        import("@0glabs/0g-serving-broker"),
        import("ethers"),
      ]);
      const provider = new JsonRpcProvider(process.env.ZERO_G_EVM_RPC!);
      const wallet = new Wallet(process.env.ZERO_G_PRIVATE_KEY!, provider);
      const broker = await createZGComputeNetworkBroker(wallet);
      return { broker };
    })();
  }
  return computeBrokerPromise;
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

async function runOpenRouterInference(params: {
  systemPrompt: string;
  knowledge: string;
  userInput: string;
  model?: string;
}): Promise<ComputeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const selectedModel = resolveOpenRouterModel(params.model);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
      "X-Title": "Ajently",
    },
    body: JSON.stringify({
      model: selectedModel,
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
    const detail = (await response.json().catch(() => null)) as OpenRouterPayload | null;
    const message = detail?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`OpenRouter call failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as OpenRouterPayload;
  const output = extractMessageContent(payload.choices?.[0]?.message?.content);

  if (!output) {
    throw new Error("OpenRouter returned an empty response payload.");
  }

  return {
    output,
    mode: "openrouter",
    model: selectedModel,
    providerAddress: "openrouter",
  };
}

function runMockInference(
  systemPrompt: string,
  knowledge: string,
  userInput: string,
  requestedModel?: string,
): ComputeResult {
  const context = [systemPrompt, knowledge].filter(Boolean).join("\n\n");
  const trimmedContext = context.slice(0, 240);

  return {
    output: [
      "Mock 0G Compute response",
      `User request: ${userInput}`,
      requestedModel ? `Requested model: ${requestedModel}` : "Requested model: default",
      trimmedContext ? `Context used: ${trimmedContext}` : "Context used: none",
      "Switch ZERO_G_COMPUTE_MODE=real to use decentralized inference.",
    ].join("\n"),
    mode: "mock",
    model: requestedModel ?? "mock/qwen-2.5-7b-instruct",
    providerAddress: "mock-provider",
  };
}

export async function runInference(params: {
  systemPrompt: string;
  knowledge: string;
  userInput: string;
  model?: string;
}): Promise<ComputeResult> {
  if (realComputeEnabled()) {
    const { providerAddress, endpoint, model: serviceModel, broker } = await resolveService();
    const selectedModel = params.model?.trim() || serviceModel;
    const requestHeaders = toFetchHeaders(
      await broker.inference.getRequestHeaders(providerAddress, params.userInput),
    );

    const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...requestHeaders,
      },
      body: JSON.stringify({
        model: selectedModel,
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
      model: selectedModel,
      providerAddress,
    };
  }

  if (openRouterEnabled()) {
    return runOpenRouterInference(params);
  }

  return runMockInference(params.systemPrompt, params.knowledge, params.userInput, params.model);
}

export function computeMode(): "real" | "openrouter" | "mock" {
  if (realComputeEnabled()) {
    return "real";
  }

  if (openRouterEnabled()) {
    return "openrouter";
  }

  return "mock";
}
