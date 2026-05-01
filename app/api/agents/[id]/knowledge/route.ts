import { NextResponse } from "next/server";

import { getAgentById, readKnowledgeFromLocal } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

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

  const knowledgeText = await readKnowledgeFromLocal(agent);

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      category: agent.category,
      systemPrompt: agent.systemPrompt,
      knowledgeFilename: agent.knowledgeFilename,
      hasKnowledgeFile: Boolean(agent.knowledgeFilename),
    },
    knowledge: {
      filename: agent.knowledgeFilename,
      text: knowledgeText,
      status: agent.knowledgeFilename
        ? knowledgeText
          ? "loaded"
          : "attached_but_unavailable"
        : "not_attached",
    },
  });
}
