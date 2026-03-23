import Link from "next/link";

import { AgentCard } from "@/components/agent-card";
import { listAgents } from "@/lib/agent-service";
import { AGENT_CATEGORIES } from "@/lib/types";
import { computeMode } from "@/lib/zero-g/compute";
import { storageMode } from "@/lib/zero-g/storage";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const category = params.category ?? "";

  const agents = await listAgents({ search, category });

  return (
    <main className="space-y-8">
      <section className="glass rounded-3xl px-6 py-8 shadow-panel sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-flare">
              App Store For AI Agents
            </p>
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
              Do better work with AI agents.
            </h1>
            <p className="muted mt-3 max-w-2xl">
              
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-mint/20 px-3 py-1">Storage: {storageMode()}</span>
              <span className="rounded-full bg-ember/25 px-3 py-1">Compute: {computeMode()}</span>
            </div>
          </div>
          <div className="flex lg:justify-end">
            <Link
              href="/create"
              className="rounded-2xl bg-ink px-6 py-3 text-center text-sm font-bold text-white transition hover:-translate-y-0.5"
            >
              Publish New Agent
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4">
        <form className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search agents..."
            className="w-full rounded-xl border border-ink/20 bg-transparent px-3 py-2 text-sm outline-none ring-flare transition focus:ring-2"
          />
          <Select>
            <SelectTrigger className="w-full rounded-xl border border-ink/20 bg-transparent px-3 py-2 text-sm outline-none ring-flare transition focus:ring-2">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {AGENT_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            type="submit"
            variant="default"
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/90"
          >
            Apply
          </Button>
        </form>
      </section>

      <section>
        {agents.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center shadow-panel">
            <p className="mb-3 text-lg font-bold">No published agents found</p>
            <Link
              href="/create"
              className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5"
            >
              Publish the first one
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
