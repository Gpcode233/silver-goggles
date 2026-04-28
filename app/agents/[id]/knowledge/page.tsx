import Link from "next/link";
import { notFound } from "next/navigation";

import { getAgentById, readKnowledgeFromLocal } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export default async function AgentKnowledgePage({
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

  const knowledgeText = await readKnowledgeFromLocal(agent);

  return (
    <main>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-block rounded-full bg-ink/5 px-2 py-1 text-xs font-semibold">
              {agent.category}
            </p>
            <h1 className="text-3xl font-black">Knowledge &amp; Skills Parameters</h1>
            <p className="muted mt-2 max-w-3xl">
              Review the instructions and training material attached to {agent.name}.
            </p>
          </div>
          <Link
            href={`/agents/${agent.id}`}
            className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold transition hover:bg-ink/5"
          >
            Back to Agent
          </Link>
        </div>

        <section className="grid gap-3 rounded-2xl border border-ink/15 p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold">Agent:</span> {agent.name}
          </p>
          <p>
            <span className="font-semibold">Model:</span> {agent.model}
          </p>
          <p>
            <span className="font-semibold">Knowledge file:</span>{" "}
            {agent.knowledgeFilename ?? "None attached"}
          </p>
          <p>
            <span className="font-semibold">Training data status:</span>{" "}
            {agent.knowledgeFilename
              ? knowledgeText
                ? "Loaded"
                : "Attached but unavailable to preview"
              : "No file attached"}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Instruction Parameters</h2>
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-ink/15 p-4 text-sm">
            {agent.systemPrompt}
          </pre>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Knowledge File Contents</h2>
          {knowledgeText ? (
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-ink/15 p-4 text-sm">
              {knowledgeText}
            </pre>
          ) : (
            <div className="rounded-2xl border border-ink/15 p-4 text-sm text-ink/70">
              {agent.knowledgeFilename
                ? "A knowledge file is attached, but its contents are not available for preview in this environment."
                : "No training data or knowledge file was attached to this agent."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
