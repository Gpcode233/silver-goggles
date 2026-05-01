import { NextResponse } from "next/server";

import { getTopupOrderById, reconcileTopupOrder } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const topupId = Number(id);

  if (!Number.isInteger(topupId) || topupId <= 0) {
    return NextResponse.json({ error: "Invalid top-up id" }, { status: 400 });
  }

  const order = await getTopupOrderById(topupId);
  if (!order) {
    return NextResponse.json({ error: "Top-up order not found" }, { status: 404 });
  }

  try {
    const updated = await reconcileTopupOrder({
      providerReference: order.providerReference,
      status: "completed",
      note: "Simulated webhook reconciliation",
    });
    return NextResponse.json({ order: updated, simulated: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate webhook" },
      { status: 400 },
    );
  }
}
