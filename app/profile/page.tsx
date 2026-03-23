import Link from "next/link";

import {
  DEMO_USER_ID,
  getCreditStats,
  getUserById,
  listAgentsByCreator,
  listCreditLedgerForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";
import { formatCredits, formatDate, formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [user, agents, creditStats, ledger, topups] = await Promise.all([
    getUserById(DEMO_USER_ID),
    listAgentsByCreator(DEMO_USER_ID),
    getCreditStats(DEMO_USER_ID),
    listCreditLedgerForUser(DEMO_USER_ID, 15),
    listTopupOrdersForUser(DEMO_USER_ID, 15),
  ]);

  if (!user) {
    return (
      <main>
        <p>User profile not found.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-flare">Profile</p>
        <h1 className="text-3xl font-black">Creator Wallet</h1>
        <p className="muted mt-2 text-sm">Wallet: {user.walletAddress}</p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            <span className="font-semibold">Remaining:</span> {formatCredits(user.credits)}
          </p>
          <p>
            <span className="font-semibold">Used:</span> {formatCredits(creditStats.used)}
          </p>
          <p>
            <span className="font-semibold">Topped Up:</span> {formatCredits(creditStats.toppedUp)}
          </p>
        </div>
        <div className="mt-4">
          <Link
            href="/credits"
            className="rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold hover:bg-ink/5"
          >
            Open Credits & Top-Up
          </Link>
        </div>
      </section>

      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <h2 className="text-xl font-bold">Recent Credit Activity</h2>
        {ledger.length === 0 ? (
          <p className="muted mt-2 text-sm">No credit activity yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {ledger.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-ink/15 bg-white/70 p-3 text-sm">
                <p>
                  <span className="font-semibold">{entry.kind}</span> |{" "}
                  {entry.amount > 0 ? "+" : ""}
                  {formatCredits(entry.amount)}
                </p>
                <p className="muted text-xs">{formatDate(entry.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <h2 className="text-xl font-bold">Top-Up Orders</h2>
        {topups.length === 0 ? (
          <p className="muted mt-2 text-sm">No top-up orders yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {topups.map((order) => (
              <article key={order.id} className="rounded-2xl border border-ink/15 bg-white/70 p-3 text-sm">
                <p>
                  <span className="font-semibold">#{order.id}</span> | {order.rail} |{" "}
                  {order.currency} {formatCredits(order.amount)} | {order.status}
                </p>
                <p className="muted text-xs">{formatDate(order.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-3xl p-6 shadow-panel sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Your Agents</h2>
          <Link
            href="/create"
            className="rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold hover:bg-ink/5"
          >
            New Agent
          </Link>
        </div>
        {agents.length === 0 ? (
          <p className="muted text-sm">No agents yet.</p>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <article
                key={agent.id}
                className="rounded-2xl border border-ink/15 bg-white/70 p-3 text-sm"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{agent.name}</p>
                  <span className="font-[var(--font-mono)] text-xs">
                    {formatUsd(agent.pricePerRun)} / run
                  </span>
                </div>
                <p className="muted mb-2">{agent.description}</p>
                <p className="mb-2 text-xs">
                  {agent.published ? "Published" : "Draft"} | {formatDate(agent.createdAt)}
                </p>
                <Link
                  href={`/agents/${agent.id}`}
                  className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold hover:bg-ink/5"
                >
                  Open
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
