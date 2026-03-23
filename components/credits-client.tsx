"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useChains,
  usePublicClient,
  useSendTransaction,
} from "wagmi";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

type PaymentRail = "native" | "stablecoin" | "fiat";

const QUICK_ADD_AMOUNTS = ["5", "10", "25", "50"] as const;
const TOPUP_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TOPUP_TREASURY_ADDRESS?.trim() as
  | `0x${string}`
  | undefined;

export function CreditsClient() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fundingOnchain, setFundingOnchain] = useState(false);
  const [simulatingId, setSimulatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState<CreditsPayload | null>(null);
  const [amount, setAmount] = useState("5");
  const [rail, setRail] = useState<PaymentRail>("native");
  const [offchainCurrency, setOffchainCurrency] = useState("USDC");
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const publicClient = usePublicClient({ chainId });
  const { sendTransactionAsync } = useSendTransaction();
  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: Boolean(address) },
  });

  const activeChain = useMemo(
    () => chains.find((chain) => chain.id === chainId),
    [chainId, chains],
  );
  const nativeSymbol = activeChain?.nativeCurrency.symbol ?? "NATIVE";

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
    void loadCredits();
  }, []);

  const pendingTopups = useMemo(
    () => state?.topups.filter((topup) => topup.status === "pending") ?? [],
    [state?.topups],
  );

  async function createOffchainTopup() {
    if (rail === "native") {
      return;
    }

    setSubmitting(true);
    setError("");
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        rail,
        currency: offchainCurrency,
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

  async function addFundsFromWallet() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount to top up.");
      return;
    }

    if (!isConnected || !address) {
      setError("Connect your wallet before topping up onchain.");
      return;
    }

    if (!TOPUP_TREASURY_ADDRESS) {
      setError("Onchain top-up is not configured. Missing NEXT_PUBLIC_TOPUP_TREASURY_ADDRESS.");
      return;
    }

    if (!publicClient) {
      setError("No RPC client available for the active chain.");
      return;
    }

    setFundingOnchain(true);
    setError("");

    try {
      const hash = await sendTransactionAsync({
        to: TOPUP_TREASURY_ADDRESS,
        chainId,
        value: parseEther(amount),
      });
      setPendingTxHash(hash);

      await publicClient.waitForTransactionReceipt({ hash });

      const response = await fetch("/api/credits/onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: hash,
          chainId,
          fromAddress: address,
          currency: nativeSymbol.toUpperCase(),
          expectedAmount: amount,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to verify onchain top-up");
      }

      await Promise.all([loadCredits(), refetchNativeBalance()]);
      setPendingTxHash(null);
    } catch (onchainError) {
      setError(onchainError instanceof Error ? onchainError.message : "Failed to process onchain top-up");
    } finally {
      setFundingOnchain(false);
    }
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
      <div className="rounded-2xl border border-ink/15 bg-white/70 p-5">
        <h1 className="text-3xl font-black">Credits</h1>
        <p className="muted mt-2 text-sm">
          Fund your account from your connected chain wallet, or continue with stablecoin/fiat checkout.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <span className="font-semibold">Remaining:</span>{" "}
            {formatCredits(state?.stats.remaining ?? 0)}
          </p>
          <p>
            <span className="font-semibold">Used:</span> {formatCredits(state?.stats.used ?? 0)}
          </p>
          <p>
            <span className="font-semibold">Topped Up:</span> {formatCredits(state?.stats.toppedUp ?? 0)}
          </p>
        </div>
      </div>

      <Separator />

      <section className="rounded-2xl border border-ink/15 bg-white/70 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Add Funds</h2>
          <div className="inline-flex rounded-xl border border-ink/15 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => setRail("native")}
              className={`rounded-lg px-3 py-1.5 ${rail === "native" ? "bg-ink text-white" : "hover:bg-ink/5"}`}
            >
              Onchain
            </button>
            <button
              type="button"
              onClick={() => {
                setRail("stablecoin");
                setOffchainCurrency("USDC");
              }}
              className={`rounded-lg px-3 py-1.5 ${rail === "stablecoin" ? "bg-ink text-white" : "hover:bg-ink/5"}`}
            >
              Stablecoin
            </button>
            <button
              type="button"
              onClick={() => {
                setRail("fiat");
                setOffchainCurrency("USD");
              }}
              className={`rounded-lg px-3 py-1.5 ${rail === "fiat" ? "bg-ink text-white" : "hover:bg-ink/5"}`}
            >
              Fiat
            </button>
          </div>
        </div>

        {rail === "native" ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {QUICK_ADD_AMOUNTS.map((quickAmount) => (
                  <button
                    key={quickAmount}
                    type="button"
                    onClick={() => setAmount(quickAmount)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      amount === quickAmount
                        ? "border-ink bg-ink text-white"
                        : "border-ink/20 bg-white hover:bg-ink/5"
                    }`}
                  >
                    {quickAmount} {nativeSymbol}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-ink/20 bg-white p-3">
                <label className="mb-1 block text-sm font-semibold">Custom Amount</label>
                <div className="flex items-center gap-2">
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.currentTarget.value)}
                    type="number"
                    min={0}
                    step="0.0001"
                    className="w-full rounded-xl border border-ink/20 px-3 py-2 text-sm"
                    placeholder="Enter amount"
                  />
                  <span className="text-sm font-semibold">{nativeSymbol}</span>
                </div>
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={fundingOnchain || !isConnected}
                onClick={addFundsFromWallet}
              >
                {fundingOnchain ? "Confirming onchain top-up..." : `Add ${amount || "0"} ${nativeSymbol}`}
              </Button>
            </div>

            <aside className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              <p className="mb-2 font-semibold">How it works</p>
              <p className="mb-1">1. We send a native-token transfer from your wallet to the top-up treasury.</p>
              <p className="mb-1">2. The backend verifies the tx hash on your active chain before crediting.</p>
              <p>3. Credits are added immediately after onchain confirmation.</p>
              <div className="mt-3 space-y-1 rounded-xl bg-white/80 p-3 text-xs">
                <p>
                  <span className="font-semibold">Active chain:</span> {activeChain?.name ?? "Not detected"}
                </p>
                <p>
                  <span className="font-semibold">Wallet:</span> {address ?? "Not connected"}
                </p>
                <p>
                  <span className="font-semibold">Balance:</span>{" "}
                  {nativeBalance ? `${Number(nativeBalance.formatted).toFixed(4)} ${nativeBalance.symbol}` : "-"}
                </p>
                <p className="break-all">
                  <span className="font-semibold">Treasury:</span> {TOPUP_TREASURY_ADDRESS ?? "Not configured"}
                </p>
                {pendingTxHash ? (
                  <p className="break-all">
                    <span className="font-semibold">Pending tx:</span> {pendingTxHash}
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
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
              value={offchainCurrency}
              onChange={(event) => setOffchainCurrency(event.currentTarget.value.toUpperCase())}
              className="rounded-xl border border-ink/20 px-3 py-2 text-sm"
            >
              {rail === "stablecoin" ? (
                <>
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="DAI">DAI</option>
                </>
              ) : (
                <>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                </>
              )}
            </select>
            <div className="rounded-xl border border-ink/20 bg-ink/5 px-3 py-2 text-sm">
              Rail: {rail}
            </div>
            <Button type="button" disabled={submitting} onClick={createOffchainTopup}>
              {submitting ? "Creating..." : "Create Top-Up Order"}
            </Button>
          </div>
        )}
      </section>

      <Separator />

      <div>
        <h2 className="text-xl font-bold">Pending Reconciliation</h2>
        {pendingTopups.length === 0 ? (
          <p className="muted mt-2 text-sm">No pending top-ups.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingTopups.map((topup) => (
              <article key={topup.id} className="rounded-xl border border-ink/20 px-3 py-2 text-sm">
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
      </div>

      <Separator />

      <div>
        <h2 className="text-xl font-bold">Credit Ledger</h2>
        {state?.ledger.length ? (
          <div className="mt-3 space-y-2">
            {state.ledger.slice(0, 25).map((entry) => (
              <article key={entry.id} className="rounded-xl border border-ink/20 px-3 py-2 text-sm">
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
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
