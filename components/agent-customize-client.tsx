"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Camera,
  FileText,
  Fingerprint,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";

import { cardBackgroundImage } from "@/lib/agent-card-visual";
import { AGENT_CARD_GRADIENTS, AGENT_CATEGORIES, type AgentRecord } from "@/lib/types";

type AgentCustomizeClientProps = {
  agent: AgentRecord;
};

function capabilityTags(category: string) {
  const map: Record<string, string[]> = {
    Marketing: ["COPYWRITING", "CONVERSION"],
    Coding: ["DEV ASSIST", "DEBUGGING"],
    Research: ["RESEARCH", "SYNTHESIS"],
    Design: ["VISUALS", "BRANDING"],
    Productivity: ["AUTOMATION", "EXECUTION"],
  };
  return map[category] ?? ["AGENT", "WORKFLOW"];
}

export function AgentCustomizeClient({ agent }: AgentCustomizeClientProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [category, setCategory] = useState(agent.category);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [cardGradient, setCardGradient] = useState(agent.cardGradient);
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreviewUrl, setCardImagePreviewUrl] = useState<string | null>(null);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const previewBackground = useMemo(
    () => cardBackgroundImage(cardImagePreviewUrl ?? agent.cardImageDataUrl, cardGradient),
    [agent.cardImageDataUrl, cardGradient, cardImagePreviewUrl],
  );

  const files = useMemo(() => {
    const current = agent.knowledgeFilename
      ? [
          {
            name: agent.knowledgeFilename,
            subtitle: "Current knowledge file",
            pending: false,
          },
        ]
      : [];

    if (knowledgeFile) {
      return [
        {
          name: knowledgeFile.name,
          subtitle: "Will replace current knowledge on save",
          pending: true,
        },
        ...current,
      ];
    }

    return current;
  }, [agent.knowledgeFilename, knowledgeFile]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("category", category);
    formData.set("system_prompt", systemPrompt);
    formData.set("card_gradient", cardGradient);

    if (cardImageFile) {
      formData.set("card_image", cardImageFile);
    }

    if (knowledgeFile) {
      formData.set("knowledge_file", knowledgeFile);
    }

    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        body: formData,
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to save agent changes");
        setSaving(false);
        return;
      }

      setStatus("Agent preferences updated successfully.");
      setKnowledgeFile(null);
      setSaving(false);
    } catch {
      setError("Failed to save agent changes");
      setSaving(false);
    }
  }

  function handleReset() {
    setName(agent.name);
    setDescription(agent.description);
    setCategory(agent.category);
    setSystemPrompt(agent.systemPrompt);
    setCardGradient(agent.cardGradient);
    setCardImageFile(null);
    setCardImagePreviewUrl(null);
    setKnowledgeFile(null);
    setStatus("");
    setError("");
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <form onSubmit={handleSave} className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-12">
          <div>
            <h1 className="text-[48px] font-black tracking-[-0.04em] text-slate-950">Agent Identity</h1>
            <p className="mt-3 text-[18px] text-slate-600">
              Define the core personality and visual representation of your agent.
            </p>
          </div>

          <section className="rounded-[28px] bg-slate-50 px-8 py-8">
            <div className="grid gap-7 lg:grid-cols-[128px_minmax(0,1fr)]">
              <div>
                <label
                  htmlFor="card_image"
                  className="flex h-28 w-28 cursor-pointer items-center justify-center rounded-[28px] border-2 border-dashed border-slate-300 bg-white text-slate-300 transition hover:border-slate-400 hover:text-slate-500"
                >
                  <Camera className="h-10 w-10" />
                </label>
                <input
                  id="card_image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    setCardImageFile(file);
                    if (!file) {
                      setCardImagePreviewUrl(null);
                      return;
                    }
                    setCardImagePreviewUrl(URL.createObjectURL(file));
                  }}
                />
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Icon Uploader</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600" htmlFor="name">
                    Agent Name
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    className="mt-3 w-full rounded-2xl bg-slate-200 px-5 py-4 text-[18px] text-slate-900 outline-none"
                    placeholder="e.g. Nexus Prime"
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600"
                    htmlFor="description"
                  >
                    Description
                  </label>
                  <input
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.currentTarget.value)}
                    className="mt-3 w-full rounded-2xl bg-slate-200 px-5 py-4 text-[18px] text-slate-900 outline-none"
                    placeholder="Briefly describe what this agent does..."
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600"
                      htmlFor="category"
                    >
                      Category
                    </label>
                    <select
                      id="category"
                      value={category}
                      onChange={(event) => setCategory(event.currentTarget.value)}
                      className="mt-3 w-full rounded-2xl bg-slate-200 px-5 py-4 text-[18px] text-slate-900 outline-none"
                    >
                      {AGENT_CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600"
                      htmlFor="card_gradient"
                    >
                      Card Gradient
                    </label>
                    <select
                      id="card_gradient"
                      value={cardGradient}
                      onChange={(event) =>
                        setCardGradient(event.currentTarget.value as (typeof AGENT_CARD_GRADIENTS)[number])
                      }
                      className="mt-3 w-full rounded-2xl bg-slate-200 px-5 py-4 text-[18px] text-slate-900 outline-none"
                    >
                      {AGENT_CARD_GRADIENTS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[42px] font-black tracking-[-0.04em] text-slate-950">Intelligence</h2>
            <p className="mt-3 text-[18px] text-slate-600">
              Configure the reasoning engine and core system behavioral guidelines.
            </p>

            <div className="mt-7 rounded-[28px] bg-slate-50 px-8 py-8">
              <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-600">
                <BrainCircuit className="h-5 w-5" />
                System Prompt
              </p>
              <textarea
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.currentTarget.value)}
                rows={10}
                className="mt-6 w-full rounded-[24px] bg-slate-200 px-5 py-5 text-[18px] leading-8 text-slate-700 outline-none"
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
                <span>Token Estimate: ~{Math.max(120, Math.round(systemPrompt.length / 4.2))} tokens</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 font-bold text-sky-700 transition hover:text-sky-800"
                >
                  <Sparkles className="h-4 w-4" />
                  Optimize with AI
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[42px] font-black tracking-[-0.04em] text-slate-950">Knowledge Base &amp; Skills</h2>
            <p className="mt-3 text-[18px] text-slate-600">
              Equip your agent with specific documentation or procedural skillsets.
            </p>

            <div className="mt-7 rounded-[28px] bg-slate-50 px-8 py-8">
              <label
                htmlFor="knowledge_file"
                className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-slate-400"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="mt-7 text-[28px] font-black text-slate-950">
                  Upload Skills or Knowledge
                  <span className="block text-[20px] font-semibold text-slate-700">
                    (e.g., skills.md, agents.md)
                  </span>
                </p>
                <p className="mt-3 text-[18px] text-slate-500">Drag and drop markdown files here</p>
              </label>
              <input
                id="knowledge_file"
                type="file"
                className="hidden"
                onChange={(event) => setKnowledgeFile(event.currentTarget.files?.[0] ?? null)}
              />

              <div className="mt-8">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600">Uploaded Files</p>
                <div className="mt-5 space-y-4">
                  {files.length > 0 ? (
                    files.map((file) => (
                      <div key={`${file.name}-${file.subtitle}`} className="flex items-center justify-between rounded-[20px] bg-white px-5 py-5 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-1 rounded-full bg-sky-700" />
                          <div>
                            <p className="text-[18px] font-bold text-slate-900">{file.name}</p>
                            <p className="text-sm text-slate-500">{file.subtitle}</p>
                          </div>
                        </div>
                        {file.pending ? (
                          <button
                            type="button"
                            onClick={() => setKnowledgeFile(null)}
                            className="text-slate-400 transition hover:text-slate-700"
                            aria-label="Remove pending file"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        ) : (
                          <Trash2 className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] bg-white px-5 py-6 text-[16px] text-slate-500 shadow-sm">
                      No knowledge files attached yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {status ? <p className="text-sm font-semibold text-emerald-600">{status}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        </section>

        <aside className="space-y-6 xl:pt-6">
          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
            <div className="h-32 bg-cover bg-center" style={{ backgroundImage: previewBackground }} />
            <div className="px-6 pb-7">
              <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-[24px] border-4 border-white bg-white shadow-sm">
                <div
                  className="h-14 w-14 rounded-[18px] bg-cover bg-center"
                  style={{ backgroundImage: previewBackground }}
                />
              </div>

              <h3 className="mt-5 text-[22px] font-black text-slate-950">{name}</h3>
              <p className="mt-1 text-sm text-slate-500">v2.4.0-stable • Deployable</p>

              <div className="mt-6 rounded-[20px] bg-slate-100 px-5 py-5 text-[16px] leading-8 text-slate-700">
                &ldquo;Hello! I am {name}. {description || "I am ready to adapt to your preferences and execute your workflows."}&rdquo;
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {capabilityTags(category).map((tag) => (
                  <span key={tag} className="rounded-full bg-sky-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-slate-50 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-600">Agent Status</p>
              <span className="rounded-full bg-sky-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-sky-700">
                {agent.published ? "Published" : "Draft"}
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-7 flex w-full items-center justify-center rounded-2xl bg-[#081323] px-5 py-4 text-[18px] font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-slate-200 px-5 py-4 text-[18px] font-bold text-slate-800 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset to Default
            </button>

            <div className="mt-8 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
              Last synced just now
            </div>
          </section>

          <nav className="space-y-4">
            {[
              { label: "Identity", icon: Fingerprint, active: true },
              { label: "Intelligence", icon: BrainCircuit, active: false },
              { label: "Knowledge", icon: Bot, active: false },
              { label: "Tools", icon: Wrench, active: false },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-4 rounded-2xl px-4 py-4 text-[18px] ${
                    item.active ? "bg-white text-sky-700 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </div>
              );
            })}
          </nav>
        </aside>
      </form>
    </main>
  );
}
