"use client";

import Link from "next/link";
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
  paymentProvider?: {
    name: string;
    configured: boolean;
    environment: "sandbox" | "live";
  };
  stats: {
    remaining: number;
    used: number;
    toppedUp: number;
  };
  ledger: CreditLedgerRecord[];
  topups: TopupOrderRecord[];
  error?: string;
};

type PaymentRail = "native" | "fiat";

type CheckoutSession = {
  actionUrl: string;
  environment: "sandbox" | "live";
  fields: Record<string, string>;
};

const QUICK_ADD_AMOUNTS = ["5", "10", "25", "50"] as const;
const QUICK_FIAT_AMOUNTS = ["1000", "2500", "5000", "10000"] as const;
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
  const [nativeAmount, setNativeAmount] = useState("5");
  const [fiatAmount, setFiatAmount] = useState("1000");
  const [rail, setRail] = useState<PaymentRail>("native");
  const [offchainCurrency] = useState("NGN");
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

  function submitHostedCheckout(session: CheckoutSession) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = session.actionUrl;

    for (const [name, value] of Object.entries(session.fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  async function createOffchainTopup() {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(fiatAmount),
        rail: "fiat",
        currency: offchainCurrency,
      }),
    });

    const payload = (await response.json()) as { error?: string; checkout?: CheckoutSession };
    if (!response.ok) {
      setError(payload.error ?? "Failed to create top-up");
      setSubmitting(false);
      return;
    }

    if (!payload.checkout) {
      setError("Checkout session was not returned.");
      setSubmitting(false);
      return;
    }

    submitHostedCheckout(payload.checkout);
  }

  async function addFundsFromWallet() {
    const parsedAmount = Number(nativeAmount);
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
        value: parseEther(nativeAmount),
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
          expectedAmount: nativeAmount,
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
        <p className="muted mt-2 text-sm">Fund Ajently with your wallet or a Nigerian card/bank payment via Interswitch.</p>
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
                setRail("fiat");
              }}
              className={`rounded-lg px-3 py-1.5 ${rail === "fiat" ? "bg-ink text-white" : "hover:bg-ink/5"}`}
            >
              Interswitch
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
                    onClick={() => setNativeAmount(quickAmount)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      nativeAmount === quickAmount
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
                    value={nativeAmount}
                    onChange={(event) => setNativeAmount(event.currentTarget.value)}
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
                {fundingOnchain
                  ? "Confirming onchain top-up..."
                  : `Add ${nativeAmount || "0"} ${nativeSymbol}`}
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-semibold">Ajently x Interswitch checkout</p>
              <p className="mt-1">
                Buy credits in NGN using cards, transfers, USSD, or other methods supported by Interswitch Web
                Checkout.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-800/70">
                {state?.paymentProvider?.configured
                  ? `Environment: ${state.paymentProvider.environment}`
                  : "Set INTERSWITCH_MERCHANT_CODE and INTERSWITCH_PAY_ITEM_ID to enable checkout"}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_FIAT_AMOUNTS.map((quickAmount) => (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => setFiatAmount(quickAmount)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    fiatAmount === quickAmount
                      ? "border-ink bg-ink text-white"
                      : "border-ink/20 bg-white hover:bg-ink/5"
                  }`}
                >
                  NGN {Number(quickAmount).toLocaleString()}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <input
                value={fiatAmount}
                onChange={(event) => setFiatAmount(event.currentTarget.value)}
                type="number"
                min={1}
                step="0.01"
                className="rounded-xl border border-ink/20 px-3 py-2 text-sm"
                placeholder="Amount"
              />
              <div className="rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm font-semibold">
                {offchainCurrency}
              </div>
              <div className="rounded-xl border border-ink/20 bg-ink/5 px-3 py-2 text-sm">
                Credits received: {Number(fiatAmount || 0).toLocaleString()}
              </div>
              <Button
                type="button"
                disabled={submitting || !state?.paymentProvider?.configured}
                onClick={createOffchainTopup}
              >
                {submitting ? "Redirecting..." : "Pay with Interswitch"}
              </Button>
            </div>
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/credits/confirm?orderId=${topup.id}`}>Confirm with Interswitch</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={simulatingId === topup.id}
                    onClick={() => {
                      void simulateWebhook(topup.id);
                    }}
                  >
                    {simulatingId === topup.id ? "Reconciling..." : "Simulate Webhook"}
                  </Button>
                </div>
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
