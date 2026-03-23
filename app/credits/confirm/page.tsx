"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ConfirmResponse = {
  state: "completed" | "pending" | "failed";
  gateway: {
    code: string | null;
    description: string | null;
    paymentReference: string | null;
  };
  error?: string;
};

export const dynamic = "force-dynamic";

export default function CreditsConfirmPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const missingOrderId = !orderId;
  const [loading, setLoading] = useState(!missingOrderId);
  const [payload, setPayload] = useState<ConfirmResponse | null>(null);

  useEffect(() => {
    if (missingOrderId) {
      return;
    }

    let cancelled = false;

    async function confirmPayment() {
      setLoading(true);
      const response = await fetch(`/api/credits/${orderId}/confirm`, { method: "POST" });
      const result = (await response.json()) as ConfirmResponse;
      if (cancelled) {
        return;
      }
      setPayload(
        response.ok
          ? result
          : {
              state: "failed",
              gateway: { code: null, description: null, paymentReference: null },
              error: result.error ?? "Failed to confirm payment.",
            },
      );
      setLoading(false);
    }

    void confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [missingOrderId, orderId]);

  const resolvedPayload =
    missingOrderId && !payload
      ? {
          state: "failed" as const,
          gateway: {
            code: null,
            description: null,
            paymentReference: null,
          },
          error: "Missing top-up order id.",
        }
      : payload;

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-ink/15 bg-white/80 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Ajently x Interswitch</p>
        <h1 className="mt-3 text-3xl font-black">Payment confirmation</h1>
        {loading ? <p className="mt-4 text-sm text-ink/70">Checking your payment with Interswitch...</p> : null}
        {!loading && resolvedPayload?.state === "completed" ? (
          <p className="mt-4 text-sm text-emerald-700">
            Payment confirmed. Your Ajently credits have been added.
          </p>
        ) : null}
        {!loading && resolvedPayload?.state === "pending" ? (
          <p className="mt-4 text-sm text-amber-700">
            Interswitch still reports this payment as pending. You can retry confirmation from the credits page.
          </p>
        ) : null}
        {!loading && resolvedPayload?.state === "failed" ? (
          <p className="mt-4 text-sm text-red-600">
            {resolvedPayload.error ?? resolvedPayload.gateway.description ?? "Payment was not confirmed."}
          </p>
        ) : null}

        {resolvedPayload ? (
          <div className="mt-6 space-y-2 rounded-2xl border border-ink/10 bg-ink/5 p-4 text-sm">
            <p>
              <span className="font-semibold">Gateway state:</span> {resolvedPayload.state}
            </p>
            <p>
              <span className="font-semibold">Response code:</span> {resolvedPayload.gateway.code ?? "-"}
            </p>
            <p>
              <span className="font-semibold">Description:</span> {resolvedPayload.gateway.description ?? "-"}
            </p>
            <p className="break-all">
              <span className="font-semibold">Payment reference:</span>{" "}
              {resolvedPayload.gateway.paymentReference ?? "-"}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/credits">Back to credits</Link>
          </Button>
          {resolvedPayload?.state === "pending" && orderId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
            >
              Retry confirmation
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
