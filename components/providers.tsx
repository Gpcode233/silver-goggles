"use client";

import { SessionProvider } from "next-auth/react";

import { Web3Provider } from "@/components/web3-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Web3Provider>{children}</Web3Provider>
    </SessionProvider>
  );
}
