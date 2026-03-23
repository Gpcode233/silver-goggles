"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AGENT_CATEGORIES } from "@/lib/types";

type CreateResponse = {
  agent?: { id: number };
  published?: boolean;
  publishError?: string;
  error?: string;
};

export default function CreateAgentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

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
          ? "Agent created and published."
          : "Agent created as draft. Publish it from the agent details page.",
      );
      formElement.reset();
      router.push(`/agents/${created.id}`);
      router.refresh();
    } else {
      setError("Invalid response from server");
    }

    if (data.publishError) {
      setError(data.publishError);
    }

    setSubmitting(false);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-flare">
          Creator Studio
        </p>
        <h1 className="text-3xl font-black">Create New Agent</h1>
        <p className="muted mt-2">
          Define the agent behavior, attach optional knowledge, then publish to 0G Storage.
        </p>
      </section>

      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={3}
              maxLength={80}
              className="w-full rounded-xl border border-ink/20 px-3 py-2 outline-none ring-flare transition focus:ring-2"
              placeholder="Gen-Z Copywriter"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              required
              minLength={10}
              maxLength={400}
              rows={3}
              className="w-full rounded-xl border border-ink/20 px-3 py-2 outline-none ring-flare transition focus:ring-2"
              placeholder="Writes viral captions, hooks, and CTA copy."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                className="w-full rounded-xl border border-ink/20 px-3 py-2 outline-none ring-flare transition focus:ring-2"
                defaultValue="Marketing"
              >
                {AGENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="price_per_run">
                Price Per Run (credits)
              </label>
              <input
                id="price_per_run"
                name="price_per_run"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0.01"
                className="w-full rounded-xl border border-ink/20 px-3 py-2 outline-none ring-flare transition focus:ring-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="system_prompt">
              System Prompt
            </label>
            <textarea
              id="system_prompt"
              name="system_prompt"
              required
              minLength={10}
              maxLength={5000}
              rows={7}
              className="w-full rounded-xl border border-ink/20 px-3 py-2 outline-none ring-flare transition focus:ring-2"
              placeholder="You are a Gen-Z copywriter..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="knowledge_file">
              Knowledge File (optional)
            </label>
            <input
              id="knowledge_file"
              name="knowledge_file"
              type="file"
              className="w-full rounded-xl border border-ink/20 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-ink/20 bg-white/60 px-3 py-2 text-sm">
            <input type="checkbox" name="publish_now" value="true" defaultChecked />
            Publish immediately to marketplace
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Create Agent"}
          </button>
        </form>

        {status ? <p className="mt-4 text-sm font-semibold text-mint">{status}</p> : null}
        {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
      </section>
    </main>
  );
}
