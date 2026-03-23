"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/format";
import type { CreditLedgerRecord, TopupOrderRecord } from "@/lib/types";

type CreditsPayload = {
  stats: {
    remaining: number;
    used: number;
    toppedUp: number;
  };
  ledger: CreditLedgerRecord[];
  topups: TopupOrderRecord[];
  error?: string;
};

export function CreditsClient() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [simulatingId, setSimulatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState<CreditsPayload | null>(null);
  const [amount, setAmount] = useState("25");
  const [rail, setRail] = useState<"fiat" | "stablecoin">("fiat");
  const [currency, setCurrency] = useState("USD");

  async function loadCredits() {
    setLoading(true);
    const response = await fetch("/api/credits");
    const payload = (await response.json()) as CreditsPayload;
    if (!response.ok) {
      setError(payload.error ?? "Failed to load credits");
      setLoading(false);
      return;
    }
    setState(payload);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCredits();
  }, []);

  const pendingTopups = useMemo(
    () => state?.topups.filter((topup) => topup.status === "pending") ?? [],
    [state?.topups],
  );

  async function createTopup() {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        rail,
        currency,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to create top-up");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    await loadCredits();
  }

  async function simulateWebhook(topupId: number) {
    setSimulatingId(topupId);
    setError("");
    const response = await fetch(`/api/credits/${topupId}/simulate`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to reconcile top-up");
      setSimulatingId(null);
      return;
    }
    setSimulatingId(null);
    await loadCredits();
  }

  if (loading) {
    return <p className="text-sm">Loading credits...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-3xl border-2 border-ink/15 p-6">
        <h1 className="text-3xl font-black">Credits</h1>
        <p className="muted mt-2 text-sm">
          Buy credits with fiat or stablecoins. Credits are added after webhook reconciliation.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <span className="font-semibold">Remaining:</span> {formatCredits(state?.stats.remaining ?? 0)}
          </p>
          <p>
            <span className="font-semibold">Used:</span> {formatCredits(state?.stats.used ?? 0)}
          </p>
          <p>
            <span className="font-semibold">Topped Up:</span> {formatCredits(state?.stats.toppedUp ?? 0)}
          </p>
        </div>
      </section>

      <section className="glass rounded-3xl border-2 border-ink/15 p-6">
        <h2 className="text-xl font-bold">Create Top-Up</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
            type="number"
            min={1}
            step="0.01"
            className="rounded-xl border border-ink/20 px-3 py-2 text-sm"
            placeholder="Amount"
          />
          <select
            value={rail}
            onChange={(event) => setRail(event.currentTarget.value as "fiat" | "stablecoin")}
            className="rounded-xl border border-ink/20 px-3 py-2 text-sm"
          >
            <option value="fiat">Fiat</option>
            <option value="stablecoin">Stablecoin</option>
          </select>
          <input
            value={currency}
            onChange={(event) => setCurrency(event.currentTarget.value.toUpperCase())}
            className="rounded-xl border border-ink/20 px-3 py-2 text-sm"
            placeholder="Currency (USD, USDC)"
          />
          <Button type="button" disabled={submitting} onClick={createTopup}>
            {submitting ? "Creating..." : "Create Top-Up"}
          </Button>
        </div>
      </section>

      <section className="glass rounded-3xl border-2 border-ink/15 p-6">
        <h2 className="text-xl font-bold">Pending Reconciliation</h2>
        {pendingTopups.length === 0 ? (
          <p className="muted mt-2 text-sm">No pending top-ups.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingTopups.map((topup) => (
              <article key={topup.id} className="rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm">
                <p>
                  <span className="font-semibold">Order #{topup.id}</span> | {topup.rail} | {topup.currency}{" "}
                  {topup.amount}
                </p>
                <p className="font-[var(--font-mono)] text-xs">{topup.providerReference}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  disabled={simulatingId === topup.id}
                  onClick={() => {
                    void simulateWebhook(topup.id);
                  }}
                >
                  {simulatingId === topup.id ? "Reconciling..." : "Simulate Webhook Completion"}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-3xl border-2 border-ink/15 p-6">
        <h2 className="text-xl font-bold">Credit Ledger</h2>
        {state?.ledger.length ? (
          <div className="mt-3 space-y-2">
            {state.ledger.slice(0, 25).map((entry) => (
              <article key={entry.id} className="rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm">
                <p>
                  <span className="font-semibold">{entry.kind}</span> | {entry.amount > 0 ? "+" : ""}
                  {formatCredits(entry.amount)}
                </p>
                <p className="muted text-xs">{new Date(entry.createdAt).toLocaleString()}</p>
                {entry.note ? <p className="text-xs">{entry.note}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted mt-2 text-sm">No ledger entries yet.</p>
        )}
      </section>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
