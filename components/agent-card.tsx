import Link from "next/link";

import { cardBackgroundImage } from "@/lib/agent-card-visual";
import { formatUsd } from "@/lib/format";
import type { AgentRecord } from "@/lib/types";

export function AgentCard({ agent }: { agent: AgentRecord }) {
  return (
    <article className="glass animate-rise rounded-2xl p-5 shadow-panel">
      <div className="mb-4 overflow-hidden rounded-xl border border-ink/15">
        <div
          className="h-32 w-full bg-cover bg-center"
          style={{
            backgroundImage: cardBackgroundImage(agent.cardImageDataUrl, agent.cardGradient),
          }}
        />
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-ink/5 px-2 py-1 text-xs font-semibold">{agent.category}</span>
        <span className="font-[var(--font-mono)] text-xs">
          {formatUsd(agent.pricePerRun)} / run
        </span>
      </div>
      <p className="mb-2 font-[var(--font-mono)] text-[11px] uppercase text-ink/65">
        Model: {agent.model}
      </p>
      <h3 className="mb-2 text-xl font-bold leading-tight">{agent.name}</h3>
      <p className="muted mb-4 text-sm">{agent.description}</p>
      <div className="flex items-center gap-2">
        <Link
          href={`/agents/${agent.id}`}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          View Details
        </Link>
        <Link
          href={`/agents/${agent.id}/chat`}
          className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold transition hover:bg-ink/5"
        >
          Run Agent
        </Link>
      </div>
    </article>
  );
}
