import Link from "next/link";
import { FileText, ArrowRight, Workflow, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default function CreateAgentChoicePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
      <span className="rounded-full bg-sky-100 px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
        Initialization
      </span>

      <div className="mt-8 max-w-4xl text-center">
        <h1 className="text-5xl font-black tracking-[-0.05em] text-slate-950 sm:text-[76px] sm:leading-[0.95]">
          Choose your workspace.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-[20px] leading-9 text-slate-600">
          Select the architectural approach for your next AI agent. Every choice leads to a
          high-performance cognitive layer.
        </p>
      </div>

      <div className="mt-14 grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        <article className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-10 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="mt-10 text-[24px] font-black text-slate-950">Create with Form</h2>
          <p className="mt-4 max-w-lg text-[17px] leading-8 text-slate-600">
            Build your agent using structured inputs. Perfect for precise configurations, defined
            personas, and specific knowledge base indexing.
          </p>
          <Link
            href="/create/form"
            className="mt-10 inline-flex items-center gap-2 text-[18px] font-bold text-slate-950"
          >
            Get Started
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="pointer-events-none absolute -bottom-6 right-0 h-40 w-32 rounded-tl-[40px] border-[10px] border-slate-100 border-b-0 border-r-0 opacity-60" />
        </article>

        <article className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-10 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
            <Workflow className="h-8 w-8" />
          </div>
          <h2 className="mt-10 text-[24px] font-black text-slate-950">Visual Builder</h2>
          <p className="mt-4 max-w-lg text-[17px] leading-8 text-slate-600">
            Map out logic using drag-and-drop workflow blocks. Ideal for complex multi-step
            reasoning and dynamic tool integration.
          </p>
          <Link
            href="/create/builder"
            className="mt-10 inline-flex items-center gap-2 text-[18px] font-bold text-sky-700"
          >
            Open Canvas
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-40 opacity-10">
            <Workflow className="h-full w-full" />
          </div>
        </article>
      </div>

      <div className="mt-16 flex w-full max-w-3xl items-center gap-5 rounded-[24px] border border-slate-200 bg-white px-8 py-6">
        <div className="flex -space-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-sm font-bold text-white">
            +12
          </div>
        </div>
        <p className="text-[17px] leading-8 text-slate-600">
          Not sure where to start?{" "}
          <Link href="/" className="font-semibold text-slate-950 underline">
            Browse community templates
          </Link>{" "}
          or talk to an agent expert.
        </p>
      </div>
    </main>
  );
}
