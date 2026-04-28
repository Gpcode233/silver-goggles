"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Brain,
  Briefcase,
  Globe,
  NotebookText,
  Plus,
  Search,
  Sparkles,
  Upload,
  WalletCards,
  Zap,
} from "lucide-react";

import { cardBackgroundImage } from "@/lib/agent-card-visual";
import { AGENT_CARD_GRADIENTS, AGENT_CATEGORIES, AGENT_MODELS } from "@/lib/types";

type CreateResponse = {
  agent?: { id: number };
  published?: boolean;
  storageMode?: "real";
  agentId?: number;
  error?: string;
};

const TOOL_OPTIONS = [
  { label: "Search", icon: Search },
  { label: "Browser", icon: Globe },
  { label: "Python", icon: Brain },
  { label: "Notion", icon: NotebookText },
] as const;

function inferCapabilities(systemPrompt: string, selectedTools: string[]) {
  const capabilities: string[] = [];
  const lowerPrompt = systemPrompt.toLowerCase();

  if (selectedTools.includes("Search")) {
    capabilities.push("SEARCH ENABLED");
  }
  if (selectedTools.includes("Browser")) {
    capabilities.push("RAG ENGINE");
  }
  if (selectedTools.includes("Python")) {
    capabilities.push("CODE EXECUTION");
  }
  if (selectedTools.includes("Notion")) {
    capabilities.push("KNOWLEDGE SYNC");
  }
  if (lowerPrompt.includes("analy")) {
    capabilities.push("ANALYSIS");
  }

  return capabilities.slice(0, 3);
}

export default function CreateAgentFormPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof AGENT_CATEGORIES)[number]>("Productivity");
  const [pricePerRun, setPricePerRun] = useState("12");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [knowledgeFileName, setKnowledgeFileName] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>(["Search"]);
  const [cardGradient, setCardGradient] = useState<(typeof AGENT_CARD_GRADIENTS)[number]>("ocean");
  const [cardImagePreviewUrl, setCardImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (cardImagePreviewUrl) {
        URL.revokeObjectURL(cardImagePreviewUrl);
      }
    };
  }, [cardImagePreviewUrl]);

  const capabilities = useMemo(
    () => inferCapabilities(systemPrompt, selectedTools),
    [selectedTools, systemPrompt],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setStatus("");

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const response = await fetch("/api/agents", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as CreateResponse;

    if (!response.ok) {
      setError(data.error ?? "Failed to create agent");
      setSubmitting(false);
      return;
    }

    const created = data.agent;
    const published = data.published;
    if (created) {
      setStatus(
        published
          ? "Agent created and published to 0G Storage."
          : "Agent created as draft. Publish it from the agent details page.",
      );
      if (cardImagePreviewUrl) {
        URL.revokeObjectURL(cardImagePreviewUrl);
      }
      setCardImagePreviewUrl(null);
      setKnowledgeFileName(null);
      router.push(`/agents/${created.id}`);
      router.refresh();
    } else {
      setError("Invalid response from server");
    }

    setSubmitting(false);
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <form onSubmit={onSubmit} className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <section className="min-w-0 pr-0 xl:pr-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-[56px] sm:leading-[0.95]">
                Create New Agent
              </h1>
              <p className="mt-4 text-[18px] text-slate-600">
                Define the intelligence, capabilities, and personality of your AI assistant.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start">
              <button
                type="button"
                onClick={() => setPublishNow(false)}
                disabled={submitting}
                className="rounded-2xl px-4 py-3 text-[18px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Draft
              </button>
              <button
                type="submit"
                onClick={() => setPublishNow(true)}
                disabled={submitting}
                className="rounded-2xl bg-black px-6 py-3 text-[18px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Publishing..." : "Publish Agent"}
              </button>
            </div>
          </div>

          <div className="mt-10 space-y-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600" htmlFor="name">
                  Agent Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  minLength={3}
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-[18px] text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="e.g. Research Analyst Pro"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600" htmlFor="category">
                  Category
                </label>
                <div className="relative">
                  <select
                    id="category"
                    name="category"
                    value={category}
                    onChange={(event) => setCategory(event.currentTarget.value as (typeof AGENT_CATEGORIES)[number])}
                    className="w-full appearance-none rounded-2xl bg-slate-100 px-4 py-4 pr-12 text-[18px] text-slate-900 outline-none"
                  >
                    {AGENT_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
                    v
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600" htmlFor="description">
                Short Description
              </label>
              <input
                id="description"
                name="description"
                required
                minLength={10}
                maxLength={400}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
                className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-[18px] text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="A brief hook for the marketplace..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600" htmlFor="system_prompt">
                System Prompt
              </label>
              <textarea
                id="system_prompt"
                name="system_prompt"
                required
                minLength={10}
                maxLength={5000}
                rows={7}
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.currentTarget.value)}
                className="w-full rounded-[24px] bg-slate-100 px-4 py-4 text-[18px] leading-8 text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Define the core logic, personality, and behavioral constraints of your agent..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600" htmlFor="knowledge_file">
                  Knowledge Base
                </label>
                <span className="text-xs text-slate-400">Supports .md, .txt, .pdf</span>
              </div>

              <label
                htmlFor="knowledge_file"
                className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-slate-400"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-sky-700">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-5 text-[22px] font-bold text-slate-900">Upload Knowledge Files</p>
                <p className="mt-2 text-[16px] text-slate-500">
                  {knowledgeFileName ? knowledgeFileName : "Drag and drop or click to browse"}
                </p>
              </label>
              <input
                id="knowledge_file"
                name="knowledge_file"
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  setKnowledgeFileName(file?.name ?? null);
                }}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600">Tools &amp; Integrations</p>
              <div className="flex flex-wrap gap-3">
                {TOOL_OPTIONS.map((tool) => {
                  const Icon = tool.icon;
                  const active = selectedTools.includes(tool.label);
                  return (
                    <button
                      key={tool.label}
                      type="button"
                      onClick={() => {
                        setSelectedTools((current) =>
                          current.includes(tool.label)
                            ? current.filter((item) => item !== tool.label)
                            : [...current, tool.label],
                        );
                      }}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-[18px] transition ${
                        active ? "bg-black text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {tool.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[18px] text-slate-600"
                >
                  <Plus className="h-5 w-5" />
                  Add Tool
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600">Economics</p>
              <div className="flex items-center justify-between gap-4 rounded-[24px] bg-slate-100 px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-slate-900">
                    <WalletCards className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[22px] font-bold text-slate-950">Usage Credits</p>
                    <p className="text-[16px] text-slate-500">Cost per 1k tokens</p>
                  </div>
                </div>
                <input
                  id="price_per_run"
                  name="price_per_run"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerRun}
                  onChange={(event) => setPricePerRun(event.currentTarget.value)}
                  className="w-32 rounded-2xl bg-white px-4 py-3 text-right text-[28px] font-black text-slate-950 outline-none"
                />
              </div>
            </div>

            <div className="hidden">
              <input
                type="checkbox"
                name="publish_now"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.currentTarget.checked)}
              />
              <input type="hidden" name="model" value={AGENT_MODELS[0]} />
              <select
                name="card_gradient"
                value={cardGradient}
                onChange={(event) => setCardGradient(event.currentTarget.value as (typeof AGENT_CARD_GRADIENTS)[number])}
              >
                {AGENT_CARD_GRADIENTS.map((gradient) => (
                  <option key={gradient} value={gradient}>
                    {gradient}
                  </option>
                ))}
              </select>
              <input
                id="card_image"
                name="card_image"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (cardImagePreviewUrl) {
                    URL.revokeObjectURL(cardImagePreviewUrl);
                  }
                  if (!file) {
                    setCardImagePreviewUrl(null);
                    return;
                  }
                  setCardImagePreviewUrl(URL.createObjectURL(file));
                }}
              />
            </div>

            {status ? <p className="text-sm font-semibold text-emerald-600">{status}</p> : null}
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          </div>
        </section>

        <aside className="border-t border-slate-200 pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-600">Agent Preview</p>
            <span className="rounded-full bg-sky-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-sky-700">
              Live Draft
            </span>
          </div>

          <article className="mt-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div
              className="h-32 bg-cover bg-center"
              style={{
                backgroundImage: cardBackgroundImage(cardImagePreviewUrl, cardGradient),
              }}
            />

            <div className="relative px-6 pb-8">
              <div className="-mt-8 flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-white bg-slate-100 text-slate-900 shadow-sm">
                <Bot className="h-8 w-8" />
              </div>

              <h2 className="mt-5 text-[22px] font-black text-slate-950">{name || "Agent Name"}</h2>
              <p className="mt-2 text-[16px] text-slate-500">
                {description || "Waiting for description..."}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Category</p>
                  <p className="mt-2 text-[18px] font-bold text-slate-950">{category || "Unassigned"}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Pricing</p>
                  <p className="mt-2 text-[18px] font-bold text-slate-950">{pricePerRun || "12"} Credits</p>
                </div>
              </div>

              <div className="mt-7">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
                  <Sparkles className="h-4 w-4 text-sky-700" />
                  Capabilities
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(capabilities.length ? capabilities : ["SEARCH ENABLED", "RAG ENGINE"]).map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-7 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 px-5 py-4 text-[18px] font-bold text-slate-900"
                >
                  <Zap className="h-5 w-5" />
                  Run Test Simulation
                </button>
              </div>
            </div>
          </article>

          <aside className="mt-8 rounded-[24px] bg-sky-100 px-6 py-6 text-slate-800">
            <p className="flex items-center gap-3 text-[22px] font-black">
              <Briefcase className="h-6 w-6" />
              Pro Tip
            </p>
            <p className="mt-3 text-[16px] leading-8 text-slate-700">
              Detailed system prompts lead to more consistent responses. Try to specify the
              &quot;Tone of Voice&quot; and &quot;Forbidden Topics&quot;.
            </p>
          </aside>
        </aside>
      </form>
    </main>
  );
}
