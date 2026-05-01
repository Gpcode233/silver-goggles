import { NextResponse } from "next/server";

import {
  createTopupOrder,
  getCreditStats,
  getUserById,
  listCreditLedgerForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";
import { getCurrentUserId } from "@/lib/auth";
import {
  buildInterswitchCheckoutSession,
  getInterswitchEnvironment,
  isInterswitchConfigured,
} from "@/lib/interswitch";
import { createTopupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [stats, ledger, topups] = await Promise.all([
    getCreditStats(userId),
    listCreditLedgerForUser(userId, 100),
    listTopupOrdersForUser(userId, 100),
  ]);

  return NextResponse.json({
    user,
    stats,
    ledger,
    topups,
    paymentProvider: {
      name: "Interswitch Web Checkout",
      configured: isInterswitchConfigured(),
      environment: getInterswitchEnvironment(),
    },
  });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTopupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid top-up request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!isInterswitchConfigured()) {
    return NextResponse.json(
      {
        error:
          "Interswitch checkout is not configured. Set INTERSWITCH_MERCHANT_CODE and INTERSWITCH_PAY_ITEM_ID.",
      },
      { status: 500 },
    );
  }

  const order = await createTopupOrder({
    userId,
    rail: parsed.data.rail,
    currency: parsed.data.currency,
    amount: parsed.data.amount,
  });
  const user = await getUserById(userId);

  const origin = new URL(request.url).origin;
  const checkout = buildInterswitchCheckoutSession({
    txnRef: order.providerReference,
    amount: order.amount,
    redirectUrl: `${origin}/credits/confirm?orderId=${order.id}`,
    currency: order.currency,
    customerId: `user-${userId}`,
    customerName: user?.displayName ?? user?.email ?? "Ajently User",
    itemName: `Ajently Credits (${order.amount} ${order.currency})`,
  });

  return NextResponse.json(
    {
      order,
      checkout,
    },
    { status: 201 },
  );
}
