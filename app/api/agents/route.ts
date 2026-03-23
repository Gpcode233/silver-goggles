import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { createAgent, DEMO_USER_ID, listAgents, attachKnowledgeFile } from "@/lib/agent-service";
import { publishAgent } from "@/lib/publish-agent";
import { listAgentsSchema, createAgentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

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
    systemPrompt: formData.get("system_prompt"),
    pricePerRun: formData.get("price_per_run"),
    publishNow: formData.get("publish_now") ?? "true",
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid input", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const agent = await createAgent({
    name: payload.data.name,
    description: payload.data.description,
    category: payload.data.category,
    systemPrompt: payload.data.systemPrompt,
    pricePerRun: payload.data.pricePerRun,
    creatorId: DEMO_USER_ID,
  });

  const uploadedFile = formData.get("knowledge_file");
  if (uploadedFile instanceof File && uploadedFile.size > 0) {
    const knowledgeDir = path.join(process.cwd(), "data", "knowledge");
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
        agent,
        published: false,
        publishError: error instanceof Error ? error.message : "Failed to publish",
      },
      { status: 201 },
    );
  }
}
