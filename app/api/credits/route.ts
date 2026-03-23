import { NextResponse } from "next/server";

import {
  DEMO_USER_ID,
  createTopupOrder,
  getCreditStats,
  getUserById,
  listCreditLedgerForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";
import {
  buildInterswitchCheckoutSession,
  getInterswitchEnvironment,
  isInterswitchConfigured,
} from "@/lib/interswitch";
import { createTopupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserById(DEMO_USER_ID);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [stats, ledger, topups] = await Promise.all([
    getCreditStats(DEMO_USER_ID),
    listCreditLedgerForUser(DEMO_USER_ID, 100),
    listTopupOrdersForUser(DEMO_USER_ID, 100),
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
    userId: DEMO_USER_ID,
    rail: parsed.data.rail,
    currency: parsed.data.currency,
    amount: parsed.data.amount,
  });

  const origin = new URL(request.url).origin;
  const checkout = buildInterswitchCheckoutSession({
    txnRef: order.providerReference,
    amount: order.amount,
    redirectUrl: `${origin}/credits/confirm?orderId=${order.id}`,
    customerId: `user-${DEMO_USER_ID}`,
    customerName: "Ajently Demo User",
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
