import { notFound } from "next/navigation";

import { ChatClient } from "@/components/chat-client";
import { DEMO_USER_ID, getAgentById, getUserById } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agentId = Number(id);

  if (!Number.isInteger(agentId) || agentId <= 0) {
    notFound();
  }

  const [agent, user] = await Promise.all([getAgentById(agentId), getUserById(DEMO_USER_ID)]);

  if (!agent || !user) {
    notFound();
  }

  return (
    <main>
      <div>
        <ChatClient agentId={agent.id} agentName={agent.name} initialCredits={user.credits} />
      </div>
    </main>
  );
}
