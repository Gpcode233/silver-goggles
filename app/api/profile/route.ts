import { NextResponse } from "next/server";

import {
  getCreditStats,
  getUserById,
  listAgentsByCreator,
  listCreditLedgerForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";
import { getCurrentUserId } from "@/lib/auth";

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

  const [agents, stats, ledger, topups] = await Promise.all([
    listAgentsByCreator(userId),
    getCreditStats(userId),
    listCreditLedgerForUser(userId, 20),
    listTopupOrdersForUser(userId, 20),
  ]);
  return NextResponse.json({ user, agents, stats, ledger, topups });
}
