import { NextResponse } from "next/server";

import {
  DEMO_USER_ID,
  getAgentById,
  readKnowledgeFromLocal,
  runAgentForUser,
} from "@/lib/agent-service";
import { runAgentSchema } from "@/lib/validation";
import { runInference } from "@/lib/zero-g/compute";
import { downloadText } from "@/lib/zero-g/storage";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const agentId = Number(id);

  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const payload = runAgentSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid message", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let knowledge = "";
  try {
    if (agent.knowledgeUri) {
      knowledge = await downloadText(agent.knowledgeUri, agent.knowledgeLocalPath);
    } else if (agent.knowledgeLocalPath) {
      knowledge = await readKnowledgeFromLocal(agent);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load knowledge from storage",
      },
      { status: 500 },
    );
  }

  let inference;
  try {
    inference = await runInference({
      systemPrompt: agent.systemPrompt,
      knowledge,
      userInput: payload.data.message,
      model: agent.model,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "0G compute call failed" },
      { status: 500 },
    );
  }

  try {
    const { run, user } = await runAgentForUser({
      userId: DEMO_USER_ID,
      agentId,
      input: payload.data.message,
      output: inference.output,
      computeMode: inference.mode,
    });

    return NextResponse.json({
      output: inference.output,
      run,
      remainingCredits: user.credits,
      compute: {
        mode: inference.mode,
        model: inference.model,
        providerAddress: inference.providerAddress,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save run" },
      { status: 500 },
    );
  }
}
