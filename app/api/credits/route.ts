import { NextResponse } from "next/server";

import {
  createTopupOrder,
  DEMO_USER_ID,
  getCreditStats,
  getUserById,
  listCreditLedgerForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";
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

  return NextResponse.json({ user, stats, ledger, topups });
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

  const order = await createTopupOrder({
    userId: DEMO_USER_ID,
    rail: parsed.data.rail,
    currency: parsed.data.currency,
    amount: parsed.data.amount,
  });

  return NextResponse.json(
    {
      order,
      checkout: {
        message: "Top-up order created. Complete payment and send webhook to reconcile credits.",
        providerReference: order.providerReference,
      },
    },
    { status: 201 },
  );
}
