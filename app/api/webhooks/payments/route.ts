import { NextResponse } from "next/server";

import { reconcileTopupOrder } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

type WebhookPayload = {
  providerReference?: string;
  status?: "completed" | "failed";
  note?: string;
};

export async function POST(request: Request) {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET?.trim();
  if (secret) {
    const signature = request.headers.get("x-webhook-secret")?.trim();
    if (!signature || signature !== secret) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  const payload = (await request.json()) as WebhookPayload;
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
