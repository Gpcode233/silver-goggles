import Link from "next/link";
import { notFound } from "next/navigation";

import { cardBackgroundImage } from "@/lib/agent-card-visual";
import { PublishAgentButton } from "@/components/publish-agent-button";
import { VerifyStorageButton } from "@/components/verify-storage-button";
import { getAgentById, listRunsForAgent } from "@/lib/agent-service";
import { formatDate, formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
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

  const runs = await listRunsForAgent(agent.id);

  return (
    <main className="space-y-6">
      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-3 overflow-hidden rounded-2xl border border-ink/15">
              <div
                className="h-40 w-full bg-cover bg-center"
                style={{
                  backgroundImage: cardBackgroundImage(agent.cardImageDataUrl, agent.cardGradient),
                }}
              />
            </div>
            <p className="mb-2 inline-block rounded-full bg-ink/5 px-2 py-1 text-xs font-semibold">
              {agent.category}
            </p>
            <h1 className="text-3xl font-black">{agent.name}</h1>
            <p className="muted mt-2 max-w-3xl">{agent.description}</p>
          </div>
          <p className="font-[var(--font-mono)] text-sm">{formatUsd(agent.pricePerRun)} / run</p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-ink/15 bg-white/70 p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold">Status:</span>{" "}
            {agent.published ? "Published" : "Draft"}
          </p>
          <p>
            <span className="font-semibold">Created:</span> {formatDate(agent.createdAt)}
          </p>
          <p className="truncate">
            <span className="font-semibold">Model:</span> {agent.model}
          </p>
          <p className="truncate">
            <span className="font-semibold">Manifest URI:</span> {agent.manifestUri ?? "Not published"}
          </p>
          <p className="truncate">
            <span className="font-semibold">Storage Hash:</span>{" "}
            {agent.storageHash ?? "Not published"}
          </p>
          <p className="truncate">
            <span className="font-semibold">Manifest Tx Hash:</span>{" "}
            {agent.manifestTxHash ?? "Not available"}
          </p>
          <p className="truncate">
            <span className="font-semibold">Knowledge URI:</span> {agent.knowledgeUri ?? "None"}
          </p>
          <p className="truncate">
            <span className="font-semibold">Knowledge Tx Hash:</span>{" "}
            {agent.knowledgeTxHash ?? "Not available"}
          </p>
          <p>
            <span className="font-semibold">Card Gradient:</span> {agent.cardGradient}
          </p>
          <p>
            <span className="font-semibold">Custom Card Image:</span>{" "}
            {agent.cardImageDataUrl ? "Uploaded" : "Not uploaded"}
          </p>
          <p>
            <span className="font-semibold">Knowledge file:</span>{" "}
            {agent.knowledgeFilename ?? "None attached"}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/agents/${agent.id}/chat`}
            className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold transition hover:bg-ink/5"
          >
            Open Chat
          </Link>
          {agent.published ? <VerifyStorageButton agentId={agent.id} /> : null}
          {agent.published ? null : <PublishAgentButton agentId={agent.id} />}
        </div>
      </section>

      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <h2 className="mb-3 text-xl font-bold">System Prompt</h2>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-ink/15 bg-white/70 p-4 text-sm">
          {agent.systemPrompt}
        </pre>
      </section>

      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <h2 className="mb-3 text-xl font-bold">Recent Runs</h2>
        {runs.length === 0 ? (
          <p className="muted text-sm">No runs yet.</p>
        ) : (
          <div className="space-y-3">
            {runs.slice(0, 8).map((run) => (
              <article key={run.id} className="rounded-2xl border border-ink/15 bg-white/70 p-3 text-sm">
                <p className="mb-1 font-semibold">{formatDate(run.createdAt)}</p>
                <p className="mb-1">
                  <span className="font-semibold">Input:</span> {run.input}
                </p>
                <p className="mb-1">
                  <span className="font-semibold">Output:</span> {run.output}
                </p>
                <p className="font-[var(--font-mono)] text-xs uppercase">
                  Cost {formatUsd(run.cost)} | Mode {run.computeMode}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
