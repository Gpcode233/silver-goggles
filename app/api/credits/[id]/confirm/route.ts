import { NextResponse } from "next/server";

import { confirmTopupOrderWithInterswitch } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: Params) {
  const { id } = await context.params;
  const topupId = Number(id);

  if (!Number.isInteger(topupId) || topupId <= 0) {
    return NextResponse.json({ error: "Invalid top-up id" }, { status: 400 });
  }

  try {
    const result = await confirmTopupOrderWithInterswitch(topupId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm top-up" },
      { status: 400 },
    );
  }
}
