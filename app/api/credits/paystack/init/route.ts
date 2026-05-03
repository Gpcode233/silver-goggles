import { NextResponse } from "next/server";

import { createTopupOrder, getUserById } from "@/lib/agent-service";
import { getCurrentUserId } from "@/lib/auth";
import {
  initTransaction,
  isPaystackConfigured,
  isPaystackCurrencySupported,
  paystackEnvironment,
} from "@/lib/paystack";
import { createTopupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaystackConfigured()) {
    return NextResponse.json(
      { error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const parsed = createTopupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid top-up request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!isPaystackCurrencySupported(parsed.data.currency)) {
    return NextResponse.json(
      { error: `Paystack does not support currency ${parsed.data.currency}` },
      { status: 400 },
    );
  }

  const user = await getUserById(userId);
  const email =
    user?.email?.trim() || `user-${userId}@ajently.local`;

  const order = await createTopupOrder({
    userId,
    rail: parsed.data.rail,
    currency: parsed.data.currency,
    amount: parsed.data.amount,
  });

  const origin = new URL(request.url).origin;
  try {
    const init = await initTransaction({
      email,
      amount: order.amount,
      currency: order.currency,
      reference: order.providerReference,
      callbackUrl: `${origin}/credits/confirm?orderId=${order.id}&provider=paystack`,
      metadata: { orderId: order.id, userId, source: "ajently" },
    });

    return NextResponse.json(
      {
        order,
        provider: { name: "Paystack", environment: paystackEnvironment() },
        checkout: {
          authorizationUrl: init.authorizationUrl,
          accessCode: init.accessCode,
          reference: init.reference,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize Paystack transaction", order },
      { status: 502 },
    );
  }
}
