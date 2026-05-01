import { verifyInterswitchWebhookSignature } from "@/lib/interswitch";
import { NextResponse } from "next/server";

import { reconcileTopupOrder } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

type WebhookPayload = {
  providerReference?: string;
  status?: "completed" | "failed";
  note?: string;
  merchantReference?: string;
  transactionReference?: string;
  responseCode?: string;
  responseDescription?: string;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const interswitchSignature = request.headers.get("x-interswitch-signature")?.trim();

  if (interswitchSignature) {
    if (!verifyInterswitchWebhookSignature(rawBody, interswitchSignature)) {
      return NextResponse.json({ error: "Invalid Interswitch webhook signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as WebhookPayload;
    const providerReference = payload.merchantReference ?? payload.providerReference;
    if (!providerReference) {
      return NextResponse.json({ error: "Missing merchantReference" }, { status: 400 });
    }

    const status = payload.responseCode === "00" || payload.responseCode === "10" || payload.responseCode === "11"
      ? "completed"
      : "failed";

    try {
      const order = await reconcileTopupOrder({
        providerReference,
        status,
        note:
          payload.transactionReference?.trim() ||
          payload.responseDescription?.trim() ||
          "Interswitch webhook",
      });
      return NextResponse.json({ ok: true, order });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to reconcile Interswitch webhook" },
        { status: 400 },
      );
    }
  }

  const secret = process.env.PAYMENTS_WEBHOOK_SECRET?.trim();
  if (secret) {
    const signature = request.headers.get("x-webhook-secret")?.trim();
    if (!signature || signature !== secret) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody) as WebhookPayload;
  if (!payload.providerReference || !payload.status) {
    return NextResponse.json({ error: "Missing providerReference or status" }, { status: 400 });
  }

  try {
    const order = await reconcileTopupOrder({
      providerReference: payload.providerReference,
      status: payload.status,
      note: payload.note,
    });
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reconcile top-up" },
      { status: 400 },
    );
  }
}
