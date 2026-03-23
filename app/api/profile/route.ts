import { NextResponse } from "next/server";

import {
  DEMO_USER_ID,
  getCreditStats,
  getUserById,
  listAgentsByCreator,
  listCreditLedgerForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserById(DEMO_USER_ID);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [agents, stats, ledger, topups] = await Promise.all([
    listAgentsByCreator(DEMO_USER_ID),
    getCreditStats(DEMO_USER_ID),
    listCreditLedgerForUser(DEMO_USER_ID, 20),
    listTopupOrdersForUser(DEMO_USER_ID, 20),
  ]);
  return NextResponse.json({ user, agents, stats, ledger, topups });
}
