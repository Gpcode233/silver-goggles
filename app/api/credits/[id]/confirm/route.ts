import { NextResponse } from "next/server";

import {
  confirmTopupOrderWithInterswitch,
  confirmTopupOrderWithPaystack,
} from "@/lib/agent-service";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const topupId = Number(id);

  if (!Number.isInteger(topupId) || topupId <= 0) {
    return NextResponse.json({ error: "Invalid top-up id" }, { status: 400 });
  }

  // Provider is provided by the redirect-back URL set during init. Default to
  // Interswitch for backwards compat.
  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") ?? "interswitch").toLowerCase();

  try {
    const result =
      provider === "paystack"
        ? await confirmTopupOrderWithPaystack(topupId)
        : await confirmTopupOrderWithInterswitch(topupId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm top-up" },
      { status: 400 },
    );
  }
}
