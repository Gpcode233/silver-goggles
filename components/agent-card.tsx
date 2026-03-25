import Link from "next/link";
import { Star } from "lucide-react";

import { cardBackgroundImage } from "@/lib/agent-card-visual";
import type { AgentRecord } from "@/lib/types";

const CREATOR_NAMES = [
  "Lumina Labs",
  "DevFlow AI",
  "Aura Studio",
  "Nexus Intel",
  "Zenith Apps",
  "Polyglot AI",
  "Nexus Code",
  "CleanData Inc",
  "CineAI",
  "Ledger Labs",
  "GrowthEngine",
  "EduTech AI",
] as const;

const BADGE_BY_CATEGORY: Record<string, string[]> = {
  Marketing: ["WRITING", "VERIFIED"],
  Coding: ["AUTOMATION", "NEW"],
  Education: ["LLMS", "VERIFIED"],
  Productivity: ["AUTOMATION"],
  Research: ["LLMS"],
  Design: ["DESIGN", "VERIFIED"],
  Finance: ["LLMS", "VERIFIED"],
  General: ["WRITING"],
};

const BADGE_STYLES: Record<string, string> = {
  VERIFIED: "bg-sky-50 text-sky-700",
  NEW: "bg-indigo-50 text-indigo-700",
  DESIGN: "bg-slate-100 text-slate-500",
  AUTOMATION: "bg-indigo-50 text-slate-500",
  WRITING: "bg-slate-100 text-slate-500",
  LLMS: "bg-slate-100 text-slate-500",
};

function getCreatorName(agent: AgentRecord) {
  return CREATOR_NAMES[(agent.id - 1) % CREATOR_NAMES.length];
}

function getRating(agent: AgentRecord) {
  return (4.3 + ((agent.id * 7) % 8) * 0.1).toFixed(1);
}

function getBadges(agent: AgentRecord) {
  return BADGE_BY_CATEGORY[agent.category] ?? ["LLMS"];
}

function truncateDescription(description: string) {
  return description.length > 78 ? `${description.slice(0, 78).trimEnd()}...` : description;
}

export function AgentCard({ agent }: { agent: AgentRecord }) {
  const creatorName = getCreatorName(agent);
  const rating = getRating(agent);
  const badges = getBadges(agent);

  return (
    <article className="rounded-[24px] border border-slate-100 bg-white p-6 transition hover:border-slate-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <Link href={`/agents/${agent.id}`} className="block">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div
            className="h-12 w-12 rounded-2xl bg-cover bg-center"
            style={{
              backgroundImage: cardBackgroundImage(agent.cardImageDataUrl, agent.cardGradient),
            }}
          />
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {rating}
          </div>
        </div>

        <div className="min-h-[122px]">
          <h3 className="text-[20px] font-bold leading-tight text-slate-900">{agent.name}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{truncateDescription(agent.description)}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] ${BADGE_STYLES[badge] ?? "bg-slate-100 text-slate-500"}`}
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-end justify-between gap-3 text-sm">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-slate-500">Creator</p>
              <p className="font-semibold text-slate-900">{creatorName}</p>
            </div>
            <p className="font-bold text-slate-900">{Math.max(1, Math.round(agent.pricePerRun * 400))} credits/use</p>
          </div>
        </div>
      </Link>

      <div className="mt-5 flex gap-3">
        <Link
          href={`/agents/${agent.id}/chat`}
          className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-900 transition hover:bg-slate-200"
        >
          Try Agent
        </Link>
        <Link
          href={`/agents/${agent.id}`}
          className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Details
        </Link>
      </div>
    </article>
  );
}
