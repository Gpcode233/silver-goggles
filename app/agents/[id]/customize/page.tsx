import { notFound } from "next/navigation";

import { AgentCustomizeClient } from "@/components/agent-customize-client";
import { getAgentById } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export default async function AgentCustomizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agentId = Number(id);

  if (!Number.isInteger(agentId) || agentId <= 0) {
    notFound();
  }

  const agent = await getAgentById(agentId);
  if (!agent) {
    notFound();
  }

  return <AgentCustomizeClient agent={agent} />;
}
