// Minimal Hardhat config for compiling and deploying the INFT + MockOracle
// contracts to the 0G Galileo testnet (chainId 16601). Kept as .cjs so it
// doesn't get pulled into the Next.js TypeScript build graph.
require("@nomicfoundation/hardhat-ethers");
require("dotenv/config");

const PRIVATE_KEY = process.env.ZERO_G_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: { sources: "./contracts", artifacts: "./artifacts", cache: "./cache-hh" },
  networks: {
    zg: {
      url: process.env.ZERO_G_EVM_RPC || "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
