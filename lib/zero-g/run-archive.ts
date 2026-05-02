import {
  getAgentById,
  getRunById,
  getUserById,
  markRunArchive,
} from "@/lib/agent-service";
import type { RunArchiveManifest } from "@/lib/types";
import { storageMode, uploadManifest } from "@/lib/zero-g/storage";

// Fire-and-forget archival: uploads the run's prompt + response to 0G Storage
// and stamps the proof onto the runs row. Failures are recorded as
// archive_status='failed' so the UI can surface the state without blocking
// the chat response. When 0G Storage is in mock mode the run is marked
// 'skipped' since there's no on-chain proof to record.
export async function archiveRunToZeroG(runId: number): Promise<void> {
  try {
    if (storageMode() !== "real") {
      await markRunArchive({ runId, status: "skipped" });
      return;
    }

    const run = await getRunById(runId);
    if (!run) {
      return;
    }

    // Already archived (idempotent re-entry from retries).
    if (run.archiveStatus === "archived" && run.runRootHash) {
      return;
    }

    const [agent, user] = await Promise.all([
      getAgentById(run.agentId),
      getUserById(run.userId),
    ]);

    const manifest: RunArchiveManifest = {
      schema: "ajently.run.v1",
      agentId: run.agentId,
      agentName: agent?.name ?? `agent-${run.agentId}`,
      agentManifestUri: agent?.manifestUri ?? null,
      userId: run.userId,
      userWalletAddress: user?.walletAddress ?? "unknown",
      prompt: run.input,
      response: run.output,
      cost: run.cost,
      computeMode: run.computeMode,
      computeProviderAddress: null,
      createdAt: run.createdAt,
    };

    const upload = await uploadManifest(manifest, { requireReal: true });

    await markRunArchive({
      runId,
      status: "archived",
      uri: upload.uri,
      rootHash: upload.rootHash,
      txHash: upload.transactionHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[run-archive] runId=${runId} archive failed:`, message);
    try {
      await markRunArchive({ runId, status: "failed" });
    } catch (innerError) {
      console.warn(`[run-archive] runId=${runId} failed to mark status=failed:`, innerError);
    }
  }
}
