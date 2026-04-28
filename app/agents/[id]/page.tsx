import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import {
  Bookmark,
  Bolt,
  Bot,
  CheckCircle2,
  Globe,
  Mail,
  MessageSquareCode,
  Radar,
  Sparkles,
  Star,
  Workflow,
} from "lucide-react";

import { cardBackgroundImage } from "@/lib/agent-card-visual";
import { PublishAgentButton } from "@/components/publish-agent-button";
import { getAgentById, listAgents } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

type AgentFeature = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

type UseCase = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const FEATURE_LIBRARY: Record<string, AgentFeature[]> = {
  Marketing: [
    {
      title: "Psychological Analysis",
      description: "Analyzes audience pain points to craft messaging with stronger conversion intent.",
      icon: Radar,
    },
    {
      title: "Multi-Format Output",
      description: "Turns one campaign angle into ads, landing copy, email copy, and social variants.",
      icon: Workflow,
    },
    {
      title: "Global Localization",
      description: "Adapts persuasive messaging for markets with different cultural and language nuance.",
      icon: Globe,
    },
    {
      title: "API Integration",
      description: "Fits into existing content operations and outbound systems with lightweight automation.",
      icon: MessageSquareCode,
    },
  ],
  Coding: [
    {
      title: "Root Cause Analysis",
      description: "Interprets broken flows and noisy logs to isolate the most likely failure point.",
      icon: Radar,
    },
    {
      title: "Patch Suggestions",
      description: "Generates edits, tests, and implementation notes you can apply immediately.",
      icon: Workflow,
    },
    {
      title: "Tool-Aware Reasoning",
      description: "Works with structured prompts, repo context, and execution feedback loops.",
      icon: Bot,
    },
    {
      title: "Integration Ready",
      description: "Designed to plug into CI review flows, internal copilots, or support tooling.",
      icon: MessageSquareCode,
    },
  ],
};

const USE_CASE_LIBRARY: Record<string, UseCase[]> = {
  Marketing: [
    {
      title: "Ad Campaigns",
      description: "Generate multiple high-performing ad variations for paid acquisition in seconds.",
      icon: Sparkles,
    },
    {
      title: "Drip Sequences",
      description: "Create nurture emails and persuasion flows that stay on-brand across the funnel.",
      icon: Mail,
    },
  ],
  Coding: [
    {
      title: "Code Review Support",
      description: "Summarize diffs, flag regressions, and propose concise patches for developers.",
      icon: Workflow,
    },
    {
      title: "Bug Triage",
      description: "Turn bug reports into probable causes, repro steps, and prioritized next actions.",
      icon: Bot,
    },
  ],
};

function getFeatures(category: string): AgentFeature[] {
  return FEATURE_LIBRARY[category] ?? [
    {
      title: "Specialized Intelligence",
      description: "Optimized to execute repeatable workflows with high precision and clear structure.",
      icon: Sparkles,
    },
    {
      title: "Structured Output",
      description: "Delivers consistent outputs that are easier to review, use, and automate downstream.",
      icon: Workflow,
    },
    {
      title: "Cross-Context Support",
      description: "Works across research, planning, execution, and communication-oriented tasks.",
      icon: Globe,
    },
    {
      title: "Composable by Design",
      description: "Can be embedded into larger multi-agent or human-in-the-loop workflows.",
      icon: MessageSquareCode,
    },
  ];
}

function getUseCases(category: string): UseCase[] {
  return USE_CASE_LIBRARY[category] ?? [
    {
      title: "Workflow Assistance",
      description: "Supports day-to-day task execution with consistent reasoning and adaptable outputs.",
      icon: Sparkles,
    },
    {
      title: "Operational Scale",
      description: "Helps teams handle more requests and repetitive work without quality dropping off.",
      icon: Workflow,
    },
  ];
}

function getTags(agentName: string, category: string) {
  const slug = agentName.toLowerCase();
  if (category === "Marketing") {
    return ["#Automation", "#Copywriting", slug.includes("hook") ? "#Hooks" : "#GPT4"];
  }
  if (category === "Coding") {
    return ["#Automation", "#DeveloperTools", "#CodeOps"];
  }
  if (category === "Design") {
    return ["#Design", "#CreativeOps", "#Branding"];
  }
  return [`#${category.replace(/\s+/g, "")}`, "#Automation", "#AI"];
}

function getCreator(agentId: number, category: string) {
  const creators = {
    Marketing: ["Nexus Systems", "Lumina Labs", "Growth Engine"],
    Coding: ["DevFlow Systems", "CodeGrid Labs", "InfraForge"],
    Design: ["Aura Studio", "Pixel Orbit", "Brand Atlas"],
  } as const;
  const pool = creators[category as keyof typeof creators] ?? ["Ajently Labs", "AgentWorks", "Studio One"];
  return pool[(agentId - 1) % pool.length];
}

function getRelativeUpdatedLabel(createdAt: string) {
  const now = Date.now();
  const then = new Date(createdAt).getTime();
  const diffDays = Math.max(1, Math.round((now - then) / (1000 * 60 * 60 * 24)));
  return diffDays === 1 ? "Last updated 1 day ago" : `Last updated ${diffDays} days ago`;
}

function getReviewCount(agentId: number) {
  return `${(1 + (agentId % 4) * 0.4).toFixed(1)}k reviews`;
}

function getRating(agentId: number) {
  return (4.6 + (agentId % 4) * 0.1).toFixed(1);
}

function ProvenanceCard({
  label,
  primary,
  rows,
  href,
}: {
  label: string;
  primary: string;
  rows: Array<[string, string]>;
  href: string | null;
}) {
  const inner = (
    <article className="rounded-[20px] border border-slate-200 bg-slate-50/65 p-6 transition hover:border-slate-300">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-2 break-all font-mono text-[18px] font-bold text-slate-900">{primary}</p>
      <dl className="mt-4 space-y-2 text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold text-slate-500">{k}</dt>
            <dd className="mt-0.5 break-all font-mono text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

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

  const relatedAgents = (await listAgents({ category: agent.category, includeDrafts: false }))
    .filter((candidate) => candidate.id !== agent.id)
    .slice(0, 2);

  const creator = getCreator(agent.id, agent.category);
  const tags = getTags(agent.name, agent.category);
  const features = getFeatures(agent.category);
  const useCases = getUseCases(agent.category);
  const rating = getRating(agent.id);
  const reviewCount = getReviewCount(agent.id);
  const costPerRequest = Math.max(1, Math.round(agent.pricePerRun * 400));

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_520px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 items-start gap-6">
              <div
                className="h-32 w-32 shrink-0 rounded-[20px] bg-cover bg-center"
                style={{ backgroundImage: cardBackgroundImage(agent.cardImageDataUrl, agent.cardGradient) }}
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-[58px] sm:leading-[0.95]">
                    {agent.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-3 py-1 text-sm font-bold uppercase tracking-[0.06em] text-sky-700">
                    <CheckCircle2 className="h-4 w-4 fill-sky-700 text-sky-700" />
                    Verified Creator
                  </span>
                </div>

                <p className="mt-3 text-[17px] text-slate-600">
                  By {creator} <span className="px-2">•</span> {getRelativeUpdatedLabel(agent.createdAt)}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                <Bookmark className="h-5 w-5" />
                Save
              </button>
              <Link
                href={`/agents/${agent.id}/chat`}
                className="inline-flex items-center gap-2 rounded-2xl bg-black px-7 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Try Agent
                <Bolt className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="mt-14">
            <h2 className="text-[28px] font-black tracking-[-0.03em] text-slate-950">Description</h2>
            <p className="mt-4 max-w-4xl text-[17px] leading-10 text-slate-600">{agent.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                Model: {agent.model}
              </span>
              <Link
                href={`/agents/${agent.id}/knowledge`}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Knowledge &amp; Skills Parameters
              </Link>
              {!agent.published ? <PublishAgentButton agentId={agent.id} /> : null}
            </div>
          </div>

          {agent.inftTokenId !== null || agent.manifestUri ? (
            <div className="mt-14">
              <h2 className="text-[28px] font-black tracking-[-0.03em] text-slate-950">On-chain provenance</h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
                Every Ajently agent is a content-addressed manifest on 0G Storage and an ERC-7857 iNFT on the
                0G Galileo testnet. The proofs below are independently verifiable.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {agent.inftTokenId !== null ? (
                  <ProvenanceCard
                    label="iNFT (ERC-7857)"
                    primary={`Token #${agent.inftTokenId}`}
                    rows={[
                      ["Contract", agent.inftContractAddress ?? "—"],
                      ["Owner", agent.inftOwnerAddress ?? "—"],
                      ["Mint tx", agent.inftMintTxHash ?? "—"],
                    ]}
                    href={
                      agent.inftMintTxHash
                        ? `${process.env.NEXT_PUBLIC_ZERO_G_EXPLORER_URL ?? "https://chainscan-galileo.0g.ai"}/tx/${agent.inftMintTxHash}`
                        : null
                    }
                  />
                ) : null}
                {agent.manifestUri ? (
                  <ProvenanceCard
                    label="0G Storage manifest"
                    primary={agent.storageHash ? `${agent.storageHash.slice(0, 10)}…${agent.storageHash.slice(-8)}` : "—"}
                    rows={[
                      ["URI", agent.manifestUri],
                      ["Manifest tx", agent.manifestTxHash ?? "—"],
                      ...(agent.knowledgeUri ? [["Knowledge URI", agent.knowledgeUri] as [string, string]] : []),
                    ]}
                    href={null}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-14">
            <h2 className="text-[28px] font-black tracking-[-0.03em] text-slate-950">Key Features</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-[20px] border border-slate-200 bg-slate-50/65 p-6">
                    <Icon className="h-6 w-6 text-sky-700" />
                    <h3 className="mt-8 text-[18px] font-bold text-slate-900">{feature.title}</h3>
                    <p className="mt-3 text-[16px] leading-8 text-slate-600">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-14">
            <h2 className="text-[28px] font-black tracking-[-0.03em] text-slate-950">Use Cases</h2>
            <div className="mt-7 space-y-8">
              {useCases.map((useCase) => {
                const Icon = useCase.icon;
                return (
                  <div key={useCase.title} className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                      <Icon className="h-5 w-5 text-slate-900" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-slate-900">{useCase.title}</h3>
                      <p className="mt-1 text-[16px] leading-8 text-slate-600">{useCase.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-[28px] font-black tracking-[-0.03em] text-slate-950">Reviews</h2>
              <div className="flex items-center gap-3 text-slate-700">
                <span className="text-[19px] font-black">{rating}</span>
                <div className="flex items-center gap-1 text-sky-500">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-6 w-6 fill-current" />
                  ))}
                </div>
                <span className="text-sm text-slate-500">({reviewCount})</span>
              </div>
            </div>

            <article className="mt-8 rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                    MC
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-slate-900">Marcus Chen</p>
                    <p className="text-sm text-slate-500">Marketing Lead @ TechFlow</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500">3 days ago</p>
              </div>
              <p className="mt-8 text-[16px] leading-8 text-slate-600">
                &ldquo;The ability to maintain brand voice while scaling output is unparalleled. We&apos;ve cut our
                drafting time by nearly 70%.&rdquo;
              </p>
            </article>
          </div>
        </section>

        <aside className="space-y-8 xl:pt-28">
          <section className="overflow-hidden rounded-[24px] bg-[#14233c] p-8 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Usage Cost</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-6xl font-black">{costPerRequest}</span>
                  <span className="pb-2 text-[18px] text-slate-400">Credits / Request</span>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 p-4 text-slate-500">
                <Bot className="h-14 w-14" />
              </div>
            </div>

            <div className="mt-8 space-y-4 text-[17px] text-slate-400">
              <p className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                No monthly recurring fee
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                Bulk generation discount available
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                Pay as you go billing
              </p>
            </div>

            <Link
              href="/credits"
              className="mt-8 flex rounded-2xl bg-white px-6 py-5 text-center text-xl font-bold text-slate-950 transition hover:bg-slate-100"
            >
              <span className="mx-auto">Purchase Credits</span>
            </Link>
          </section>

          <section>
            <h2 className="text-[28px] font-black tracking-[-0.03em] text-slate-950">Related Agents</h2>
            <div className="mt-5 space-y-4">
              {relatedAgents.length > 0 ? (
                relatedAgents.map((relatedAgent) => (
                  <Link
                    key={relatedAgent.id}
                    href={`/agents/${relatedAgent.id}`}
                    className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div
                      className="h-14 w-14 shrink-0 rounded-2xl bg-cover bg-center"
                      style={{
                        backgroundImage: cardBackgroundImage(
                          relatedAgent.cardImageDataUrl,
                          relatedAgent.cardGradient,
                        ),
                      }}
                    />
                    <div>
                      <p className="text-[18px] font-bold text-slate-900">{relatedAgent.name}</p>
                      <p className="text-sm text-slate-500">{relatedAgent.category}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5 text-slate-500">
                  More agents in this category will appear here as the marketplace grows.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-20 flex flex-wrap items-center justify-between gap-6 border-t border-slate-200 py-10 text-sm text-slate-500">
        <p className="text-[18px] font-black text-slate-950">
          Ajently <span className="text-sm font-medium text-slate-500">© 2024 Intellectual Platforms Inc.</span>
        </p>
        <div className="flex flex-wrap items-center gap-10">
          <span>Documentation</span>
          <span>Safety Guidelines</span>
          <span>Support</span>
          <span>Privacy</span>
        </div>
      </div>
    </main>
  );
}
