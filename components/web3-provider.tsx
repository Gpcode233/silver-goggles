"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { type Chain, arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

const zeroGMainnet: Chain = {
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: {
    name: "0G",
    symbol: "0G",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
    public: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Chain Explorer", url: "https://chainscan.0g.ai" },
  },
};

const zeroGGalileoTestnet: Chain = {
  id: 80087,
  name: "0G-Galileo-Testnet",
  nativeCurrency: {
    name: "OG",
    symbol: "OG",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
    public: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Chain Explorer", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
};

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
  chains: [mainnet, polygon, optimism, arbitrum, base, zeroGMainnet, zeroGGalileoTestnet],
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
