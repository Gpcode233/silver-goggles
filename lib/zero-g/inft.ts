import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes, Log } from "ethers";

import {
  applyINFTMint,
  getAgentById,
  listAgentsMissingINFT,
} from "@/lib/agent-service";
import type { AgentRecord } from "@/lib/types";

const INFT_ABI = [
  "function mint(address to, string encryptedURI, bytes32 metadataHash) external returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function getMetadataHash(uint256 tokenId) external view returns (bytes32)",
  "event Minted(uint256 indexed tokenId, address indexed to, string encryptedURI, bytes32 metadataHash)",
];

let cached: { contract: Contract; signer: Wallet } | null = null;

function inftConfig() {
  const rpc = process.env.ZERO_G_EVM_RPC;
  const key = process.env.ZERO_G_PRIVATE_KEY;
  const address = process.env.INFT_CONTRACT_ADDRESS;
  if (!rpc) throw new Error("ZERO_G_EVM_RPC is not set");
  if (!key) throw new Error("ZERO_G_PRIVATE_KEY is not set");
  if (!address) throw new Error("INFT_CONTRACT_ADDRESS is not set; deploy the iNFT contract first");
  return { rpc, key, address };
}

function getContract(): { contract: Contract; signer: Wallet } {
  if (cached) return cached;
  const cfg = inftConfig();
  const provider = new JsonRpcProvider(cfg.rpc);
  const signer = new Wallet(cfg.key, provider);
  const contract = new Contract(cfg.address, INFT_ABI, signer);
  cached = { contract, signer };
  return cached;
}

export type MintResult = {
  tokenId: number;
  contractAddress: string;
  ownerAddress: string;
  mintTxHash: string;
};

export async function mintINFTForAgent(agentId: number): Promise<MintResult> {
  const agent = await getAgentById(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  if (!agent.manifestUri || !agent.storageHash) {
    throw new Error(`Agent ${agentId} has no manifest on 0G Storage; publish first`);
  }
  if (agent.inftTokenId !== null) {
    return {
      tokenId: agent.inftTokenId,
      contractAddress: agent.inftContractAddress!,
      ownerAddress: agent.inftOwnerAddress!,
      mintTxHash: agent.inftMintTxHash!,
    };
  }

  const { contract, signer } = getContract();
  const owner = await signer.getAddress();
  // metadataHash = keccak256 over the canonical 0G manifest URI. The actual
  // manifest content already lives on 0G Storage (the URI is content-addressed).
  const metadataHash = keccak256(toUtf8Bytes(agent.manifestUri));

  const tx = await contract.mint(owner, agent.manifestUri, metadataHash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Mint tx failed for agent ${agentId} (tx=${tx.hash})`);
  }

  // Pull tokenId from the Minted event.
  let tokenId: number | null = null;
  const iface = contract.interface;
  for (const log of receipt.logs as Log[]) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "Minted") {
        tokenId = Number(parsed.args.tokenId);
        break;
      }
    } catch {
      // not our log, ignore
    }
  }
  if (tokenId === null) {
    // Fallback: reconstruct from contract state. Not perfect under concurrency
    // but adequate for sequential mints during a sync.
    throw new Error("Mint succeeded but Minted event was not found in logs");
  }

  const result: MintResult = {
    tokenId,
    contractAddress: await contract.getAddress(),
    ownerAddress: owner,
    mintTxHash: tx.hash,
  };

  await applyINFTMint({
    agentId,
    tokenId: result.tokenId,
    contractAddress: result.contractAddress,
    ownerAddress: result.ownerAddress,
    mintTxHash: result.mintTxHash,
  });

  return result;
}

export type MintBatchResult = {
  checked: number;
  minted: number;
  failed: Array<{ agentId: number; error: string }>;
  results: Array<{ agentId: number; tokenId: number; mintTxHash: string }>;
};

export async function mintINFTsForAgentsMissingToken(): Promise<MintBatchResult> {
  const candidates = await listAgentsMissingINFT();
  const results: MintBatchResult["results"] = [];
  const failed: MintBatchResult["failed"] = [];

  for (const agent of candidates) {
    try {
      const r = await mintINFTForAgent(agent.id);
      results.push({ agentId: agent.id, tokenId: r.tokenId, mintTxHash: r.mintTxHash });
    } catch (error) {
      failed.push({ agentId: agent.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    checked: candidates.length,
    minted: results.length,
    failed,
    results,
  };
}

export function inftExplorerUrl(): string {
  return process.env.NEXT_PUBLIC_ZERO_G_EXPLORER_URL ?? "https://chainscan-galileo.0g.ai";
}

export function inftTxUrl(txHash: string): string {
  return `${inftExplorerUrl()}/tx/${txHash}`;
}

export function inftTokenUrl(contractAddress: string, tokenId: number): string {
  return `${inftExplorerUrl()}/token/${contractAddress}?a=${tokenId}`;
}

// Forward declaration used by sync endpoint to avoid a circular import warning.
export async function listAgentsForINFTSyncReport(): Promise<AgentRecord[]> {
  return listAgentsMissingINFT();
}
