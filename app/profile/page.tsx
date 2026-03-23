import Link from "next/link";

import { DEMO_USER_ID, getUserById, listAgentsByCreator } from "@/lib/agent-service";
import { formatCredits, formatDate, formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [user, agents] = await Promise.all([
    getUserById(DEMO_USER_ID),
    listAgentsByCreator(DEMO_USER_ID),
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
        <p className="mt-4 font-[var(--font-mono)] text-xl font-bold">
          Credits: {formatCredits(user.credits)}
        </p>
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
