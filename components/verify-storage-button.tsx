"use client";

import { useState } from "react";

type StorageProofResponse = {
  retrievedAt: string;
  manifest: {
    rootHash: string;
    transactionHash: string | null;
    storedHashMatches: boolean;
    bytes: number;
  };
  knowledge: {
    rootHash: string;
    transactionHash: string | null;
    bytes: number;
  } | null;
  error?: string;
};

export function VerifyStorageButton({ agentId }: { agentId: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [proof, setProof] = useState<StorageProofResponse | null>(null);

  async function verifyStorage() {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/agents/${agentId}/storage`, { method: "GET" });
    const payload = (await response.json()) as StorageProofResponse;

    if (!response.ok) {
      setError(payload.error ?? "Failed to verify storage retrieval");
      setProof(null);
      setLoading(false);
      return;
    }

    setProof(payload);
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={verifyStorage}
        disabled={loading}
        className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold transition hover:bg-ink/5 disabled:opacity-60"
      >
        {loading ? "Verifying Storage..." : "Verify Storage Retrieval"}
      </button>

      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

      {proof ? (
        <div className="rounded-2xl border border-ink/15 bg-white/70 p-3 text-xs">
          <p>
            <span className="font-semibold">Retrieved:</span> {proof.retrievedAt}
          </p>
          <p className="truncate">
            <span className="font-semibold">Manifest hash:</span> {proof.manifest.rootHash}
          </p>
          <p className="truncate">
            <span className="font-semibold">Manifest tx:</span>{" "}
            {proof.manifest.transactionHash ?? "missing"}
          </p>
          <p>
            <span className="font-semibold">Manifest bytes:</span> {proof.manifest.bytes}
          </p>
          <p>
            <span className="font-semibold">Stored hash match:</span>{" "}
            {proof.manifest.storedHashMatches ? "yes" : "no"}
          </p>
          {proof.knowledge ? (
            <>
              <p className="mt-1 truncate">
                <span className="font-semibold">Knowledge hash:</span> {proof.knowledge.rootHash}
              </p>
              <p className="truncate">
                <span className="font-semibold">Knowledge tx:</span>{" "}
                {proof.knowledge.transactionHash ?? "missing"}
              </p>
              <p>
                <span className="font-semibold">Knowledge bytes:</span> {proof.knowledge.bytes}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
