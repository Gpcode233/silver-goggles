import { NextResponse } from "next/server";

import { reconcileTopupOrder } from "@/lib/agent-service";
import { type PaystackWebhookEvent, verifyTransaction, verifyWebhookSignature } from "@/lib/paystack";

export const dynamic = "force-dynamic";

// Paystack webhook receiver. Signature is HMAC-SHA512 of the raw body using
// the secret key, sent in x-paystack-signature. Always verify before trusting
// the payload — anyone can hit this URL.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Defense-in-depth: re-verify the transaction with Paystack rather than
  // trusting the webhook payload alone. Mitigates replay or spoof if the
  // secret leaks.
  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Paystack verify failed" },
      { status: 502 },
    );
  }

  const targetStatus = verified.status === "success" ? "completed" : verified.status === "failed" ? "failed" : null;
  if (!targetStatus) {
    // pending or abandoned — ack 200 so Paystack stops retrying for this event
    return NextResponse.json({ ok: true, ignored: true, status: verified.status });
  }

  try {
    const order = await reconcileTopupOrder({
      providerReference: reference,
      status: targetStatus,
      note:
        targetStatus === "completed"
          ? `Paystack ${verified.channel ?? "card"} payment confirmed (${verified.reference})`
          : `Paystack payment failed (${verified.reference})`,
    });
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 },
    );
  }
}
