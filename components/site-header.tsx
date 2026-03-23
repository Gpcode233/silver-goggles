"use client";

import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import AjentlyLogo from "@/assets/Ajently.png";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";

export function SiteHeader() {
  return (
    <header className="sticky top-3 z-30">
      <LiquidGlassCard
        glowIntensity="sm"
        shadowIntensity="none"
        borderRadius="16px"
        blurIntensity="md"
        draggable={false}
        className="mx-auto w-full max-w-6xl border border-white/70 bg-white/45 px-4 py-3 shadow-[0_8px_8px_rgba(13,19,33,0.14)] sm:px-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
              <Image src={AjentlyLogo} alt="Ajently logo" priority className="h-8 w-auto sm:h-9" />
              <span>Ajently</span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm font-semibold md:flex">
              <Link href="/" className="rounded-full px-3 py-2 transition hover:bg-black/5">
                Explore Agent
              </Link>
              <Link href="/create" className="rounded-full px-3 py-2 transition hover:bg-black/5">
                Create Agent
              </Link>
            </nav>
          </div>
          <div className="ml-auto">
            <ConnectButton />
          </div>
        </div>
      </LiquidGlassCard>
    </header>
  );
}
