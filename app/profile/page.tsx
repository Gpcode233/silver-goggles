import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Gauge, Plus, TrendingUp, UserCircle2 } from "lucide-react";

import {
  getCreditStats,
  getUserById,
  listAgentsByCreator,
  listRunsForUser,
  listTopupOrdersForUser,
} from "@/lib/agent-service";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatAmount(value: number) {
  return Math.round(value).toLocaleString();
}

function formatWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatPurchaseDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    notFound();
  }

  const [user, agents, creditStats, topups, runs] = await Promise.all([
    getUserById(userId),
    listAgentsByCreator(userId),
    getCreditStats(userId),
    listTopupOrdersForUser(userId, 15),
    listRunsForUser(userId, 10),
  ]);

  if (!user) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <p>User profile not found.</p>
      </main>
    );
  }

  const totalUsedCredits = runs.length > 0 ? Math.max(1, Math.round(creditStats.used)) : 0;
  const purchaseRows = topups.slice(0, 3).map((topup) => ({
    id: `#AJ-${String(882000 + topup.id)}`,
    date: formatPurchaseDate(topup.createdAt),
    packageName:
      topup.rail === "fiat"
        ? `Interswitch Top-up (${Math.round(topup.amount)} ${topup.currency})`
        : `${Math.round(topup.amount)} ${topup.currency} Wallet Top-up`,
    amount:
      topup.rail === "fiat"
        ? `${topup.currency} ${Math.round(topup.amount).toLocaleString()}`
        : `+${Math.round(topup.amount)} Cr`,
    status:
      topup.status === "completed"
        ? "Completed"
        : topup.status === "failed"
          ? "Failed"
          : "Pending",
  }));

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-[56px] sm:leading-[0.95]">
              Workspace
            </h1>
            <p className="mt-4 text-[18px] text-slate-600">
              Manage your intelligent assets and performance metrics.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[305px_minmax(0,1fr)]">
          <div className="space-y-4">
            <article className="rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-[#1f1f18] text-white">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName ?? "Profile"}
                      className="h-full w-full rounded-[20px] object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-12 w-12" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[18px] font-black text-slate-950">{user.displayName ?? "Ajently User"}</p>
                  <p className="text-[15px] text-slate-500">
                    {user.authProvider === "wallet"
                      ? formatWallet(user.walletAddress)
                      : user.email ?? "Profile not completed"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-[18px] bg-slate-50 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Credits Balance
                  </p>
                  <p className="mt-2 text-[20px] font-black text-slate-950">
                    {formatAmount(user.credits)}{" "}
                    <span className="text-base font-medium text-slate-500">/ 20k</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {user.authProvider === "wallet"
                      ? formatWallet(user.walletAddress)
                      : user.email ?? "No email saved"}
                  </p>
                </div>
                <Link
                  href="/credits"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white"
                >
                  <Plus className="h-5 w-5" />
                </Link>
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Total Used
                  </p>
                  <p className="mt-3 text-[20px] font-black text-slate-950">
                    {runs.length > 0 ? `${totalUsedCredits} credits` : "No usage yet"}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                  <Gauge className="h-6 w-6" />
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Agents Created
                  </p>
                  <p className="mt-3 text-[20px] font-black text-slate-950">
                    {agents.length > 0 ? `${agents.length} Active` : "No agents yet"}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                  <Bot className="h-6 w-6" />
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Creator Earnings
                  </p>
                  <p className="mt-3 text-[20px] font-black text-slate-950">
                    {creditStats.creatorEarned > 0 ? `${formatAmount(creditStats.creatorEarned)} credits` : "No earnings yet"}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-8">
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-[22px] font-black text-slate-950">My Agents</h2>
                {agents.length > 0 ? (
                  <Link href="/" className="text-[16px] font-bold text-sky-700">
                    Explore
                  </Link>
                ) : null}
              </div>

              {agents.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-8 text-[16px] text-slate-500">
                  You have not created or saved any agents yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {agents.slice(0, 4).map((agent) => (
                    <Link
                      key={agent.id}
                      href={`/agents/${agent.id}`}
                      className="rounded-[22px] border border-slate-200 bg-white p-5 transition hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#20404b] text-cyan-200">
                          <Bot className="h-6 w-6" />
                        </div>
                        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                          {agent.category}
                        </span>
                      </div>
                      <h3 className="mt-6 text-[18px] font-black text-slate-950">{agent.name}</h3>
                      <p className="mt-2 line-clamp-3 text-[16px] leading-8 text-slate-600">
                        {agent.description}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                        <span>{formatRelativeTime(agent.createdAt)}</span>
                        <span>
                          {agent.pricePerRun === 0
                            ? "Free"
                            : `${Math.round(agent.pricePerRun)} credits/use`}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-5 text-[22px] font-black text-slate-950">Recently Used</h2>
              {runs.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-8 text-[16px] text-slate-500">
                  No agent runs yet. Try an agent and your recent activity will show up here.
                </div>
              ) : (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                  {runs.slice(0, 5).map((run, index) => (
                    <article
                      key={run.id}
                      className={`flex items-center justify-between gap-4 px-5 py-5 ${
                        index > 0 ? "border-t border-slate-100" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[18px] font-bold text-slate-950">
                            {agents.find((agent) => agent.id === run.agentId)?.name ?? `Agent #${run.agentId}`}
                          </p>
                          <p className="text-[15px] text-slate-500">
                            {run.computeMode} run - {Math.round(run.cost)} credits used
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">{formatRelativeTime(run.createdAt)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-[22px] font-black text-slate-950">Purchase History</h2>
            <button type="button" className="text-[16px] font-bold text-sky-700">
              Download Invoices
            </button>
          </div>

          {purchaseRows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-8 text-[16px] text-slate-500">
              You have not purchased credits yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Package</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 text-[15px] text-slate-700">
                      <td className="px-6 py-5">{row.id}</td>
                      <td className="px-6 py-5">{row.date}</td>
                      <td className="px-6 py-5">{row.packageName}</td>
                      <td className="px-6 py-5 font-semibold">{row.amount}</td>
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-md px-3 py-1 text-xs font-bold ${
                            row.status === "Completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : row.status === "Pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
