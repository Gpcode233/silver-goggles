import { notFound, redirect } from "next/navigation";

import { ChatClient } from "@/components/chat-client";
import { getCurrentUserId } from "@/lib/auth";
import { getAgentById, getUserById } from "@/lib/agent-service";

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

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/auth");
  }

  const [agent, user] = await Promise.all([getAgentById(agentId), getUserById(userId)]);

  if (!agent) {
    notFound();
  }

  if (!user) {
    redirect("/auth");
  }

  return (
    <main>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <ChatClient
          agentId={agent.id}
          agentName={agent.name}
          agentDescription={agent.description}
          cardImageDataUrl={agent.cardImageDataUrl}
          cardGradient={agent.cardGradient}
          initialCredits={user.credits}
          pricePerRun={agent.pricePerRun}
        />
      </div>
    </main>
  );
}
