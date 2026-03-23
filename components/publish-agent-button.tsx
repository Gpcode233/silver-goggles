"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PublishResponse = {
  error?: string;
  storageMode?: "real";
  uploadProof?: {
    manifest: {
      rootHash: string;
      transactionHash: string | null;
    };
    knowledge: {
      rootHash: string;
      transactionHash: string | null;
    } | null;
  };
};

export function PublishAgentButton({ agentId }: { agentId: number }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function publish() {
    setPublishing(true);
    setError("");
    setStatus("");

    const response = await fetch(`/api/agents/${agentId}/publish`, {
      method: "POST",
    });
    const payload = (await response.json()) as PublishResponse;

    if (!response.ok) {
      setError(payload.error ?? "Failed to publish agent");
      setPublishing(false);
      return;
    }

    const manifestProof = payload.uploadProof?.manifest;
    if (manifestProof) {
      const txLabel = manifestProof.transactionHash ?? "missing tx hash";
      setStatus(`Manifest: ${manifestProof.rootHash} | Tx: ${txLabel}`);
    } else {
      setStatus("Agent published successfully.");
    }

    router.refresh();
    setPublishing(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={publish}
        disabled={publishing}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {publishing ? "Publishing..." : "Publish Agent"}
      </button>
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      {status ? <p className="text-xs font-semibold text-mint">{status}</p> : null}
    </div>
  );
}
