import Link from "next/link";
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
    <main className="space-y-4">
      <Link
        href={`/agents/${agent.id}`}
        className="inline-flex rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold hover:bg-ink/5"
      >
        Back to agent
      </Link>
      <ChatClient agentId={agent.id} agentName={agent.name} initialCredits={user.credits} />
    </main>
  );
}
