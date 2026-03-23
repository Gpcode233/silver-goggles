import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { createAgent, DEMO_USER_ID, listAgents, attachKnowledgeFile } from "@/lib/agent-service";
import { resolveDataPath } from "@/lib/data-dir";
import { publishAgent } from "@/lib/publish-agent";
import { listAgentsSchema, createAgentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
const MAX_CARD_IMAGE_BYTES = 2 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = listAgentsSchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    includeDrafts: searchParams.get("includeDrafts") ?? "false",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  const agents = await listAgents(parsed.data);
  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const payload = createAgentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    model: formData.get("model") ?? "openrouter/free",
    systemPrompt: formData.get("system_prompt"),
    pricePerRun: formData.get("price_per_run"),
    cardGradient: formData.get("card_gradient") ?? "aurora",
    publishNow: formData.get("publish_now") ?? "true",
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid input", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const cardImageFile = formData.get("card_image");
  let cardImageDataUrl: string | null = null;

  if (cardImageFile instanceof File && cardImageFile.size > 0) {
    if (!cardImageFile.type.startsWith("image/")) {
      return NextResponse.json({ error: "Card image must be a valid image file" }, { status: 400 });
    }

    if (cardImageFile.size > MAX_CARD_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Card image is too large. Max size is 2MB." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await cardImageFile.arrayBuffer());
    const mimeType = cardImageFile.type || "image/png";
    cardImageDataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  }

  const agent = await createAgent({
    name: payload.data.name,
    description: payload.data.description,
    category: payload.data.category,
    model: payload.data.model,
    systemPrompt: payload.data.systemPrompt,
    pricePerRun: payload.data.pricePerRun,
    cardImageDataUrl,
    cardGradient: payload.data.cardGradient,
    creatorId: DEMO_USER_ID,
  });

  const uploadedFile = formData.get("knowledge_file");
  if (uploadedFile instanceof File && uploadedFile.size > 0) {
    const knowledgeDir = resolveDataPath("knowledge");
    await fs.mkdir(knowledgeDir, { recursive: true });

    const filename = sanitizeFilename(uploadedFile.name || "knowledge.txt");
    const localPath = path.join(knowledgeDir, `${agent.id}-${Date.now()}-${filename}`);
    const bytes = Buffer.from(await uploadedFile.arrayBuffer());
    await fs.writeFile(localPath, bytes);
    await attachKnowledgeFile(agent.id, localPath, uploadedFile.name);
  }

  if (!payload.data.publishNow) {
    return NextResponse.json({ agent, published: false }, { status: 201 });
  }

  try {
    const result = await publishAgent(agent.id);
    return NextResponse.json(
      {
        agent: result.agent,
        manifest: result.manifest,
        published: true,
        storageMode: result.storageMode,
        uploadProof: result.uploadProof,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish agent to real 0G Storage",
        published: false,
        agentId: agent.id,
      },
      { status: 502 },
    );
  }
}
