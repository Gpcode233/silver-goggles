"use client";

import { useState } from "react";

import { formatCredits } from "@/lib/format";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type RunResult = {
  output: string;
  remainingCredits: number;
  compute: {
    mode: string;
    model: string;
    providerAddress: string;
  };
  error?: string;
};

export function ChatClient({
  agentId,
  agentName,
  initialCredits,
}: {
  agentId: number;
  agentName: string;
  initialCredits: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [lastComputeMeta, setLastComputeMeta] = useState<RunResult["compute"] | null>(null);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || submitting) {
      return;
    }

    const currentInput = input.trim();
    setInput("");
    setSubmitting(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: currentInput }]);

    const response = await fetch(`/api/agents/${agentId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: currentInput }),
    });

    const payload = (await response.json()) as RunResult;
    if (!response.ok) {
      setError(payload.error ?? "Failed to run agent");
      setSubmitting(false);
      return;
    }

    setMessages((prev) => [...prev, { role: "assistant", content: payload.output }]);
    setCredits(payload.remainingCredits);
    setLastComputeMeta(payload.compute);
    setSubmitting(false);
  }

  return (
    <section className="space-y-4">
      <div className="glass rounded-2xl p-4 shadow-panel">
        <h1 className="text-2xl font-black">{agentName}</h1>
        <p className="muted mt-1 text-sm">Chat with the agent and run inference through 0G Compute.</p>
        <p className="mt-3 font-[var(--font-mono)] text-xs uppercase">
          Remaining credits: {formatCredits(credits)}
        </p>
      </div>

      <div className="glass h-[55vh] overflow-auto rounded-2xl p-4 shadow-panel">
        {messages.length === 0 ? (
          <p className="muted text-sm">Send your first message to run this agent.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`rounded-2xl p-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto max-w-[85%] bg-ink text-white"
                    : "mr-auto max-w-[88%] border border-ink/15 bg-white/80"
                }`}
              >
                <p className="mb-1 text-xs font-bold uppercase tracking-wide">
                  {message.role === "user" ? "You" : "Agent"}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="glass rounded-2xl p-4 shadow-panel">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask this agent anything..."
            className="w-full rounded-xl border border-ink/20 px-3 py-2 text-sm outline-none ring-flare transition focus:ring-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            {submitting ? "Running..." : "Send"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        {lastComputeMeta ? (
          <p className="muted mt-2 font-[var(--font-mono)] text-xs uppercase">
            {lastComputeMeta.mode} | {lastComputeMeta.model} | {lastComputeMeta.providerAddress}
          </p>
        ) : null}
      </form>
    </section>
  );
}
