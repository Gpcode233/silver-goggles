"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { WagmiProvider } from "wagmi";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  zeroGMainnet,
} from "wagmi/chains";

const zeroGGalileoTestnet = defineChain({
  id: 16602,
  name: "0G-Testnet-Galileo",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evmrpc-testnet.0g.ai"],
    },
  },
  blockExplorers: {
    default: {
      name: "0G BlockChain Explorer",
      url: "https://chainscan-galileo.0g.ai/",
    },
  },
  testnet: true,
});


const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
  "00000000000000000000000000000000";

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()) {
  // Do not fail builds/prerender when env is missing. Wallet connections
  // will remain disabled until a real WalletConnect project id is configured.
  console.warn("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing. Using fallback project id.");
}

const config = getDefaultConfig({
  appName: "Ajently",
  projectId,
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    zeroGMainnet,
    zeroGGalileoTestnet,
  ],
  ssr: true,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
