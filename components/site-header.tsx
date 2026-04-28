"use client";

import Image from "next/image";
import Link from "next/link";
import { User, Search } from "lucide-react";

import AjentlyLogo from "@/assets/Ajently.png";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/96">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[22px] font-black tracking-tight">
          <Image src={AjentlyLogo} alt="Ajently logo" priority className="h-9 w-auto" />
          <span>Ajently</span>
        </Link>

        <form action="/" className="hidden max-w-[340px] flex-1 items-center rounded-2xl bg-slate-100 px-4 py-2.5 md:flex">
          <Search className="mr-3 h-4 w-4 text-slate-400" />
          <input
            name="search"
            type="search"
            placeholder="Search agents..."
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-8 text-sm font-bold tracking-[0.04em] text-slate-400 lg:flex">
          <Link href="/" className="border-b-2 border-slate-900 pb-2 text-slate-900">
            EXPLORE
          </Link>
          <Link href="/credits" className="pb-2 transition hover:text-slate-900">
            CREDITS
          </Link>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/create"
            className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Create Agent
          </Link>
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
            aria-label="Profile"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
