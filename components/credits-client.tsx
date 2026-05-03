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
import {
  ArrowUpRight,
  Bell,
  CircleDollarSign,
  Info,
  Lock,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CreditLedgerRecord, TopupOrderRecord } from "@/lib/types";

type CreditsPayload = {
  user: {
    id: number;
    walletAddress: string;
    credits: number;
  };
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

type TransactionRow = {
  id: string;
  dateLabel: string;
  typeLabel: string;
  amountLabel: string;
  statusLabel: string;
  statusTone: "success" | "neutral" | "pending" | "failed";
  actionLabel: string;
};

const QUICK_ADD_AMOUNTS = ["5", "10", "25", "50"] as const;
const QUICK_FIAT_AMOUNTS = ["1000", "2500", "5000", "10000"] as const;
const FIAT_CURRENCIES = ["NGN", "USD", "KES", "GHS", "ZAR", "UGX"] as const;
const TOPUP_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TOPUP_TREASURY_ADDRESS?.trim() as
  | `0x${string}`
  | undefined;

function formatCompactNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatLedgerDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusClasses(tone: TransactionRow["statusTone"]) {
  if (tone === "success") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (tone === "failed") {
    return "bg-red-100 text-red-700";
  }
  if (tone === "neutral") {
    return "bg-slate-200 text-slate-600";
  }
  return "bg-amber-100 text-amber-700";
}

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
  const [offchainCurrency, setOffchainCurrency] = useState<(typeof FIAT_CURRENCIES)[number]>("NGN");
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const publicClient = usePublicClient({ chainId: selectedChainId ?? chainId });
  const { sendTransactionAsync } = useSendTransaction();
  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: Boolean(address) },
  });

  const activeChain = useMemo(
    () => chains.find((chain) => chain.id === (selectedChainId ?? chainId)),
    [chainId, chains, selectedChainId],
  );
  const nativeSymbol = activeChain?.nativeCurrency.symbol ?? "OG";

  useEffect(() => {
    if (!selectedChainId && chainId) {
      setSelectedChainId(chainId);
    }
  }, [chainId, selectedChainId]);

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

  const usageBars = useMemo(() => {
    const values = [36, 52, 40, 68, 56, 76, 79, 64, 45, 28, 48, 72];
    return values.map((value, index) => ({
      id: index,
      value,
      active: index === 6,
    }));
  }, []);

  const transactionRows = useMemo<TransactionRow[]>(() => {
    if (!state) {
      return [];
    }

    const ledgerRows = state.ledger.slice(0, 6).map((entry) => {
      const positive = entry.amount > 0;
      const typeLabel =
        entry.kind === "topup"
          ? entry.note?.toLowerCase().includes("interswitch")
            ? "Interswitch Top-up"
            : "Credits Top-up"
          : "Model Generation";

      return {
        id: `ledger-${entry.id}`,
        dateLabel: formatLedgerDate(entry.createdAt),
        typeLabel,
        amountLabel: positive ? `+${Math.abs(entry.amount).toFixed(2)} Cr` : `-${Math.abs(entry.amount).toFixed(2)} Cr`,
        statusLabel: positive ? "SUCCESS" : "UTILIZED",
        statusTone: positive ? ("success" as const) : ("neutral" as const),
        actionLabel: positive ? "Invoice" : "Receipt",
      };
    });

    const pendingRows = state.topups
      .filter((topup) => topup.status === "pending")
      .slice(0, 3)
      .map((topup) => ({
        id: `topup-${topup.id}`,
        dateLabel: formatLedgerDate(topup.createdAt),
        typeLabel: topup.rail === "fiat" ? "Interswitch Top-up" : "Onchain Top-up",
        amountLabel: `+${topup.amount.toFixed(2)} ${topup.currency}`,
        statusLabel: "PENDING",
        statusTone: "pending" as const,
        actionLabel: "Confirm",
      }));

    return [...pendingRows, ...ledgerRows].slice(0, 7);
  }, [state]);

  const firstPendingTopup = useMemo(
    () => state?.topups.find((topup) => topup.status === "pending") ?? null,
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

  async function createPaystackTopup() {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/credits/paystack/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(fiatAmount),
        rail: "fiat",
        currency: offchainCurrency,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      checkout?: { authorizationUrl?: string };
    };
    if (!response.ok || !payload.checkout?.authorizationUrl) {
      setError(payload.error ?? "Failed to start Paystack checkout");
      setSubmitting(false);
      return;
    }
    window.location.href = payload.checkout.authorizationUrl;
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
    const targetChainId = selectedChainId ?? chainId;

    setFundingOnchain(true);
    setError("");

    try {
      const hash = await sendTransactionAsync({
        to: TOPUP_TREASURY_ADDRESS,
        chainId: targetChainId,
        value: parseEther(nativeAmount),
      });
      setPendingTxHash(hash);

      await publicClient.waitForTransactionReceipt({ hash });

      const response = await fetch("/api/credits/onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: hash,
          chainId: targetChainId,
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
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 text-sm text-slate-600 sm:px-6 lg:px-8">
        Loading credits and billing...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-[56px] sm:leading-[0.95]">
          Credits &amp; Billing
        </h1>
        <p className="mt-4 text-[18px] text-slate-600">
          Manage your intelligent processing capacity and billing history.
        </p>
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_390px]">
        <section className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
            <article className="rounded-[24px] bg-[#14233c] p-8 text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Current Balance</p>
              <div className="mt-5 flex items-end gap-3">
                <span className="text-[58px] font-black leading-none">
                  {formatCompactNumber(state?.stats.remaining ?? 0)}
                </span>
                <span className="pb-2 text-[18px] text-slate-400">Credits</span>
              </div>
              <p className="mt-10 flex items-center gap-2 text-[16px] text-slate-400">
                <Info className="h-4 w-4" />
                Daily limit: 25,000 Credits
              </p>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-black text-slate-950">Usage Intensity</h2>
                  <p className="text-sm text-slate-500">Average 840 credits / day</p>
                </div>
                <span className="rounded-md bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">+12% VS LAST MO</span>
              </div>
              <div className="mt-8 flex h-[150px] items-end gap-2">
                {usageBars.map((bar) => (
                  <div
                    key={bar.id}
                    className={`flex-1 rounded-t-sm ${bar.active ? "bg-black" : "bg-slate-200"}`}
                    style={{ height: `${bar.value}%` }}
                  />
                ))}
              </div>
              <div className="mt-6 flex justify-between text-xs text-slate-500">
                <span>Aug 01</span>
                <span>Aug 14</span>
                <span>Today</span>
              </div>
            </article>
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-[22px] font-black text-slate-950">Add Funds</h2>
              <div className="inline-flex rounded-xl bg-slate-100 p-1.5">
                <button
                  type="button"
                  onClick={() => setRail("native")}
                  className={`rounded-lg px-5 py-2 text-sm font-bold ${
                    rail === "native" ? "bg-black text-white" : "text-slate-500"
                  }`}
                >
                  Onchain
                </button>
                <button
                  type="button"
                  onClick={() => setRail("fiat")}
                  className={`rounded-lg px-5 py-2 text-sm font-bold ${
                    rail === "fiat" ? "bg-black text-white" : "text-slate-500"
                  }`}
                >
                  Interswitch
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_280px]">
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(rail === "native" ? QUICK_ADD_AMOUNTS : QUICK_FIAT_AMOUNTS).map((quickAmount) => {
                    const selected = rail === "native" ? nativeAmount === quickAmount : fiatAmount === quickAmount;
                    return (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => {
                          if (rail === "native") {
                            setNativeAmount(quickAmount);
                            return;
                          }
                          setFiatAmount(quickAmount);
                        }}
                        className={`rounded-2xl border px-6 py-6 text-[18px] font-bold transition ${
                          selected
                            ? "border-black bg-white text-slate-950"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {quickAmount} {rail === "native" ? nativeSymbol : offchainCurrency}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-[20px] border border-slate-200 p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Custom Amount</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {rail === "native" ? (
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Select Chain</span>
                        <select
                          value={selectedChainId ?? ""}
                          onChange={(event) => setSelectedChainId(Number(event.currentTarget.value))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none"
                        >
                          {chains.map((chainOption) => (
                            <option key={chainOption.id} value={chainOption.id}>
                              {chainOption.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Currency</span>
                        <select
                          value={offchainCurrency}
                          onChange={(event) => setOffchainCurrency(event.currentTarget.value as (typeof FIAT_CURRENCIES)[number])}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none"
                        >
                          {FIAT_CURRENCIES.map((currency) => (
                            <option key={currency} value={currency}>
                              {currency}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="mt-4 flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-4">
                    <input
                      value={rail === "native" ? nativeAmount : fiatAmount}
                      onChange={(event) => {
                        if (rail === "native") {
                          setNativeAmount(event.currentTarget.value);
                          return;
                        }
                        setFiatAmount(event.currentTarget.value);
                      }}
                      type="number"
                      min={0}
                      step={rail === "native" ? "0.0001" : "0.01"}
                      className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none"
                      placeholder="Enter amount"
                    />
                    <span className="text-[18px] font-bold text-slate-600">
                      {rail === "native" ? nativeSymbol : offchainCurrency}
                    </span>
                  </div>
                </div>

                {rail === "native" ? (
                  <button
                    type="button"
                    onClick={addFundsFromWallet}
                    disabled={fundingOnchain || !isConnected}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-6 py-5 text-[18px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlusCircle className="h-5 w-5" />
                    {fundingOnchain ? `Confirming ${nativeAmount} ${nativeSymbol}` : `Add ${nativeAmount} ${nativeSymbol}`}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={createPaystackTopup}
                      disabled={submitting}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-6 py-5 text-[18px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <WalletCards className="h-5 w-5" />
                      {submitting
                        ? "Redirecting…"
                        : `Pay with card · ${Number(fiatAmount || 0).toLocaleString()} ${offchainCurrency}`}
                    </button>
                    <button
                      type="button"
                      onClick={createOffchainTopup}
                      disabled={submitting || !state?.paymentProvider?.configured}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-[16px] font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <WalletCards className="h-5 w-5" />
                      Pay with Interswitch (Nigeria)
                    </button>
                    <p className="text-center text-[12px] text-slate-500">
                      Card works globally via Paystack. Interswitch is optimized for Nigerian local payments.
                    </p>
                  </div>
                )}

                {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
              </div>

              <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
                <p className="flex items-center gap-2 text-[20px] font-bold text-slate-900">
                  <Info className="h-5 w-5 text-sky-700" />
                  How it works
                </p>
                <div className="mt-5 space-y-5 text-[16px] leading-8 text-slate-600">
                  {rail === "native" ? (
                    <>
                      <p><span className="mr-2 font-bold text-sky-700">1.</span>We send a native-token transfer from your wallet to the top-up treasury.</p>
                      <p><span className="mr-2 font-bold text-sky-700">2.</span>The backend verifies the tx hash on your active chain before crediting.</p>
                      <p><span className="mr-2 font-bold text-sky-700">3.</span>Credits are added immediately after onchain confirmation.</p>
                    </>
                  ) : (
                    <>
                      <p><span className="mr-2 font-bold text-sky-700">1.</span>Choose a naira amount and continue to Interswitch Web Checkout.</p>
                      <p><span className="mr-2 font-bold text-sky-700">2.</span>Pay with card, transfer, USSD, or other supported local rails.</p>
                      <p><span className="mr-2 font-bold text-sky-700">3.</span>Ajently confirms the payment before your credits are issued.</p>
                    </>
                  )}
                </div>

                <div className="mt-10 space-y-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Active Chain:</span>
                    <span className="font-bold text-sky-700">{activeChain?.name ?? "Not detected"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Funding Rail:</span>
                    <span className="font-semibold text-slate-700">
                      {rail === "native" ? "Onchain wallet balance and network routing" : "Hosted Interswitch checkout"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-bold uppercase tracking-[0.08em] text-slate-500">
                      {rail === "native" ? "Wallet Balance:" : "Selected Currency:"}
                    </span>
                    <span className="font-bold text-slate-900">
                      {rail === "native"
                        ? nativeBalance
                          ? `${Number(nativeBalance.formatted).toFixed(4)} ${nativeBalance.symbol}`
                          : "Connect wallet"
                        : offchainCurrency}
                    </span>
                  </div>
                  {pendingTxHash ? (
                    <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-600">
                      Pending tx: {pendingTxHash}
                    </div>
                  ) : null}
                  {rail === "native" ? (
                    <div className="rounded-xl bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      This panel explains how onchain wallet-funded top-ups work. Once you pick a network and sign a transfer, Ajently verifies the transaction before crediting your balance.
                    </div>
                  ) : null}
                  {rail === "fiat" ? (
                    <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-600">
                      {state?.paymentProvider?.configured
                        ? `Checkout environment: ${state.paymentProvider.environment}. You can top up with ${offchainCurrency} selected before redirecting into Interswitch.`
                        : "Set INTERSWITCH_MERCHANT_CODE and INTERSWITCH_PAY_ITEM_ID to enable checkout."}
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <h2 className="text-[18px] font-black text-slate-950">Transaction History</h2>
              <button type="button" className="text-sm font-bold text-sky-700">
                Download Invoices
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 text-[15px] text-slate-700">
                      <td className="px-6 py-5">{row.dateLabel}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                            <CircleDollarSign className="h-4 w-4 text-sky-700" />
                          </span>
                          {row.typeLabel}
                        </div>
                      </td>
                      <td className="px-6 py-5 font-semibold">{row.amountLabel}</td>
                      <td className="px-6 py-5">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(row.statusTone)}`}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {row.statusLabel === "PENDING" ? (
                          (() => {
                            const topupId = Number(row.id.replace("topup-", ""));
                            return (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={simulatingId === topupId}
                                onClick={() => {
                                  void simulateWebhook(topupId);
                                }}
                              >
                                {simulatingId === topupId ? "Reconciling..." : row.actionLabel}
                              </Button>
                            );
                          })()
                        ) : (
                          <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                            {row.actionLabel}
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-[18px] font-black text-slate-950">Tiered Plans</h2>

            <div className="mt-6 space-y-5">
              <article className="rounded-[20px] bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                    Starter
                  </span>
                  <span className="text-[20px] font-black text-slate-950">$49</span>
                </div>
                <p className="mt-5 text-[18px] font-bold text-slate-950">5,000 Credits</p>
                <p className="mt-2 text-[15px] leading-7 text-slate-500">
                  Perfect for individual developers testing small agents.
                </p>
                <button type="button" className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800">
                  Select Plan
                </button>
              </article>

              <article className="rounded-[20px] bg-black p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-md bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
                    Pro
                  </span>
                  <div className="text-right">
                    <span className="rounded-md bg-cyan-400 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-950">
                      Best Value
                    </span>
                    <p className="mt-1 text-[20px] font-black">$249</p>
                  </div>
                </div>
                <p className="mt-5 text-[18px] font-bold">30,000 Credits</p>
                <p className="mt-2 text-[15px] leading-7 text-slate-400">
                  Scaling intelligence for high-frequency automation workflows.
                </p>
                <button type="button" className="mt-5 flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950">
                  Purchase Now
                </button>
              </article>

              <article className="rounded-[20px] bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                    Custom
                  </span>
                  <span className="text-[18px] font-black text-slate-950">Contact</span>
                </div>
                <p className="mt-5 text-[18px] font-bold text-slate-950">Unlimited Intelligence</p>
                <p className="mt-2 text-[15px] leading-7 text-slate-500">
                  Dedicated processing power and SLA-backed uptimes.
                </p>
                <button type="button" className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800">
                  Talk to Sales
                </button>
              </article>
            </div>

            <div className="mt-10 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              Secure Payments
              <Lock className="h-4 w-4" />
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="rounded-md bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Visa
                </span>
                <div>
                  <p className="font-bold text-slate-950">•••• 4242</p>
                  <p className="text-sm text-slate-500">Exp 12/26</p>
                </div>
              </div>
              <Sparkles className="h-5 w-5 text-slate-500" />
            </div>
          </section>

          {firstPendingTopup ? (
            <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <p className="font-bold text-amber-900">Pending reconciliation</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    One or more top-ups are still pending. You can confirm them from the transaction table or continue via{" "}
                    <Link href={`/credits/confirm?orderId=${firstPendingTopup.id}`} className="font-bold underline">
                      payment confirmation
                    </Link>.
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
