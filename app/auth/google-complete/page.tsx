"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GoogleCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const nextPath = searchParams.get("next") || "/";

    async function complete() {
      const response = await fetch("/api/auth/google/complete", {
        method: "POST",
        credentials: "same-origin",
      });

      const data = (await response.json()) as {
        error?: string;
        user?: { onboardingCompleted?: boolean };
      };

      if (!response.ok) {
        if (!cancelled) {
          setError(data.error ?? "Unable to finish Google sign-in");
        }
        return;
      }

      if (!cancelled) {
        router.replace(data.user?.onboardingCompleted ? nextPath : "/onboarding");
        router.refresh();
      }
    }

    void complete();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Google Sign-In</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950">
          Finishing your workspace access
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          We are connecting your Google account to your Ajently workspace.
        </p>
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm font-semibold text-slate-500">
            <span className="h-3 w-3 animate-pulse rounded-full bg-sky-500" />
            Redirecting...
          </div>
        )}
      </div>
    </main>
  );
}
