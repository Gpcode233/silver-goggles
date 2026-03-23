import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveDataPath } from "@/lib/data-dir";

export type UploadResult = {
  rootHash: string;
  uri: string;
  transactionHash: string | null;
  mode: "real" | "mock";
};

const MOCK_STORAGE_DIR = resolveDataPath("mock-storage");
const DOWNLOAD_DIR = resolveDataPath("downloads");

let storageSdkPromise: Promise<{
  Indexer: typeof import("@0glabs/0g-ts-sdk").Indexer;
  MemData: typeof import("@0glabs/0g-ts-sdk").MemData;
}> | null = null;
let storageSignerPromise: Promise<{
  indexer: import("@0glabs/0g-ts-sdk").Indexer;
  signer: import("ethers").Wallet;
}> | null = null;

async function loadStorageSdk() {
  if (!storageSdkPromise) {
    storageSdkPromise = import("@0glabs/0g-ts-sdk").then(({ Indexer, MemData }) => ({
      Indexer,
      MemData,
    }));
  }
  return storageSdkPromise;
}

function getRootHashFromUri(uri: string): string {
  const normalized = uri.trim();
  if (normalized.startsWith("0g://")) {
    return normalized.slice("0g://".length);
  }
  return normalized;
}

function realStorageEnabled(): boolean {
  return (
    process.env.ZERO_G_STORAGE_MODE === "real" &&
    Boolean(process.env.ZERO_G_STORAGE_INDEXER_RPC) &&
    Boolean(process.env.ZERO_G_EVM_RPC) &&
    Boolean(process.env.ZERO_G_PRIVATE_KEY)
  );
}

async function getStorageClients() {
  if (!storageSignerPromise) {
    storageSignerPromise = (async () => {
      const [{ Indexer }, { JsonRpcProvider, Wallet }] = await Promise.all([
        loadStorageSdk(),
        import("ethers"),
      ]);
      const indexer = new Indexer(process.env.ZERO_G_STORAGE_INDEXER_RPC!);
      const provider = new JsonRpcProvider(process.env.ZERO_G_EVM_RPC!);
      const signer = new Wallet(process.env.ZERO_G_PRIVATE_KEY!, provider);
      return { indexer, signer };
    })();
  }
  return storageSignerPromise;
}

async function uploadBytesToMockStorage(data: Uint8Array): Promise<UploadResult> {
  await fs.mkdir(MOCK_STORAGE_DIR, { recursive: true });
  const rootHash = crypto.createHash("sha256").update(data).digest("hex");
  const filePath = path.join(MOCK_STORAGE_DIR, rootHash);
  await fs.writeFile(filePath, data);
  return { rootHash, uri: `0g://${rootHash}`, transactionHash: null, mode: "mock" };
}

async function uploadBytesToRealStorage(data: Uint8Array): Promise<UploadResult> {
  const [{ MemData }, { indexer, signer }] = await Promise.all([
    loadStorageSdk(),
    getStorageClients(),
  ]);
  const payload = new MemData(data);
  const [, treeError] = await payload.merkleTree();
  if (treeError) {
    throw new Error(`Merkle tree error: ${treeError.message}`);
  }

  const [receipt, error] = await indexer.upload(
    payload,
    process.env.ZERO_G_EVM_RPC!,
    signer as never,
  );

  if (!receipt || error) {
    throw new Error(error?.message ?? "0G storage upload failed");
  }

  return {
    rootHash: receipt.rootHash,
    uri: `0g://${receipt.rootHash}`,
    transactionHash: receipt.txHash,
    mode: "real",
  };
}

export async function uploadManifest(manifest: object): Promise<UploadResult> {
  const body = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8");
  if (!realStorageEnabled()) {
    return uploadBytesToMockStorage(body);
  }
  return uploadBytesToRealStorage(body);
}

export async function uploadKnowledge(payload: Uint8Array): Promise<UploadResult> {
  if (!realStorageEnabled()) {
    return uploadBytesToMockStorage(payload);
  }
  return uploadBytesToRealStorage(payload);
}

export async function downloadText(
  uri: string,
  fallbackLocalPath?: string | null,
): Promise<string> {
  return downloadTextByRootHash(getRootHashFromUri(uri), fallbackLocalPath);
}

export async function downloadTextByRootHash(
  rootHash: string,
  fallbackLocalPath?: string | null,
): Promise<string> {
  const normalizedRootHash = getRootHashFromUri(rootHash);

  if (!realStorageEnabled()) {
    const filePath = path.join(MOCK_STORAGE_DIR, normalizedRootHash);
    try {
      const content = await fs.readFile(filePath);
      return content.toString("utf-8");
    } catch {
      if (!fallbackLocalPath) {
        return "";
      }
      const localContent = await fs.readFile(fallbackLocalPath);
      return localContent.toString("utf-8");
    }
  }

  const { indexer } = await getStorageClients();
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  const outputFile = path.join(
    DOWNLOAD_DIR,
    `${normalizedRootHash.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`,
  );

  const downloadError = await indexer.download(normalizedRootHash, outputFile, true);
  if (downloadError) {
    if (fallbackLocalPath) {
      const localContent = await fs.readFile(fallbackLocalPath);
      return localContent.toString("utf-8");
    }
    throw downloadError;
  }

  const content = await fs.readFile(outputFile);
  return content.toString("utf-8");
}

export function storageMode(): "real" | "mock" {
  return realStorageEnabled() ? "real" : "mock";
}
