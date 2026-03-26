import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import {
  attachKnowledgeFile,
  getAgentById,
  listRunsForAgent,
  updateAgent,
} from "@/lib/agent-service";
import { resolveDataPath } from "@/lib/data-dir";
import { updateAgentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
const MAX_CARD_IMAGE_BYTES = 2 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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

  const runs = await listRunsForAgent(agentId);
  return NextResponse.json({ agent, runs });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const agentId = Number(id);

  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const existingAgent = await getAgentById(agentId);
  if (!existingAgent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const payload = updateAgentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    systemPrompt: formData.get("system_prompt"),
    cardGradient: formData.get("card_gradient") ?? existingAgent.cardGradient,
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid input", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const cardImageFile = formData.get("card_image");
  let cardImageDataUrl = existingAgent.cardImageDataUrl;

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

  const agent = await updateAgent({
    id: agentId,
    name: payload.data.name,
    description: payload.data.description,
    category: payload.data.category,
    systemPrompt: payload.data.systemPrompt,
    cardGradient: payload.data.cardGradient,
    cardImageDataUrl,
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

  const updatedAgent = await getAgentById(agentId);
  return NextResponse.json({ agent: updatedAgent ?? agent });
}
