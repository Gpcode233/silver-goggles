"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { Mail, Wallet } from "lucide-react";
import { useAccount } from "wagmi";

import AjentlyLogo from "@/assets/Ajently.png";

function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);

  async function authenticate(payload: Record<string, string>) {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { error?: string; user?: { onboardingCompleted?: boolean } };
    if (!response.ok) {
      setError(data.error ?? "Unable to continue");
      setSubmitting(false);
      return;
    }
    router.push(data.user?.onboardingCompleted ? nextPath : "/onboarding");
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;

    async function recoverGoogleSession() {
      if (status !== "authenticated") {
        return;
      }

      setSubmitting(true);
      setError("");

      const response = await fetch("/api/auth/google/complete", {
        method: "POST",
        credentials: "same-origin",
      });

      const data = (await response.json()) as {
        error?: string;
        user?: { onboardingCompleted?: boolean };
      };

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Unable to continue with Google");
        setSubmitting(false);
        return;
      }

      router.replace(data.user?.onboardingCompleted ? nextPath : "/onboarding");
      router.refresh();
    }

    void recoverGoogleSession();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, status]);

  return (
    <main className="grid min-h-screen overflow-y-auto bg-[#f8fafc] lg:grid-cols-[1.02fr_0.98fr]">
      <section className="flex items-start justify-center px-5 py-8 lg:px-10 lg:py-10">
        <div className="w-full max-w-[480px]">
          <div className="flex items-center gap-3">
            <Image src={AjentlyLogo} alt="Ajently" className="h-10 w-auto" priority />
            <span className="text-[30px] font-black tracking-tight text-slate-950">Ajently</span>
          </div>

          <div className="mt-10">
            <p className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
              Access Workspace
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-slate-950 lg:text-[58px] lg:leading-[0.94]">
              Sign in to access Ajently.
            </h1>
          </div>

          <div className="mt-8 space-y-3.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setSubmitting(true);
                setError("");
                void signIn(
                  "google",
                  { callbackUrl: `/auth/google-complete${nextPath && nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}` },
                  { prompt: "select_account" },
                );
              }}
              className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[17px] font-bold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Continue with Google
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (!isConnected) {
                  openConnectModal?.();
                  return;
                }
                void authenticate({ provider: "wallet", walletAddress: address ?? "" });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[17px] font-bold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Wallet className="h-5 w-5" />
              {isConnected ? `Continue with ${address?.slice(0, 6)}...${address?.slice(-4)}` : "Connect Wallet"}
            </button>
            <div className="hidden">
              <ConnectButton />
            </div>
          </div>

          <div className="my-7 flex items-center gap-4 text-sm text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            or use email
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "login" ? "bg-white text-slate-900" : "text-slate-500"}`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "signup" ? "bg-white text-slate-900" : "text-slate-500"}`}
            >
              Sign Up
            </button>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void authenticate({ provider: "email", mode, email, password });
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold uppercase tracking-[0.1em] text-slate-500">Email</span>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
                <Mail className="mr-3 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  className="w-full bg-transparent text-base text-slate-900 outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold uppercase tracking-[0.1em] text-slate-500">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none"
                placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                required
                minLength={6}
              />
            </label>
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-black px-5 py-3.5 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
            </button>
          </form>
        </div>
      </section>

      <section className="hidden bg-[linear-gradient(160deg,#0f172a,#112b49_55%,#0d7490)] lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <div className="max-w-[520px]">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Ajently Access</p>
          <h2 className="mt-6 text-[58px] font-black tracking-[-0.06em] leading-[0.94] text-white">
            Ajently keeps your agents and credits in one workspace.
          </h2>
          <p className="mt-6 text-[17px] leading-8 text-slate-300">
            Sign in once and keep your runs, payments, and published agents tied to your own account.
          </p>
        </div>

        <div className="grid gap-4">
          {[
            "Marketplace access is gated behind session-based login.",
            "Created agents attach to the active user and surface under newest.",
            "Wallet sign-in preserves the connected address as your identity fallback.",
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-[17px] text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function AuthFallback() {
  return (
    <main className="grid min-h-screen overflow-y-auto bg-[#f8fafc] lg:grid-cols-[1.02fr_0.98fr]">
      <section className="flex items-start justify-center px-5 py-8 lg:px-10 lg:py-10">
        <div className="w-full max-w-[480px]">
          <div className="flex items-center gap-3">
            <Image src={AjentlyLogo} alt="Ajently" className="h-10 w-auto" priority />
            <span className="text-[30px] font-black tracking-tight text-slate-950">Ajently</span>
          </div>
          <div className="mt-10">
            <p className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
              Access Workspace
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-slate-950 lg:text-[58px] lg:leading-[0.94]">
              Sign in to access Ajently.
            </h1>
          </div>
        </div>
      </section>
      <section className="hidden bg-[linear-gradient(160deg,#0f172a,#112b49_55%,#0d7490)] lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-12" />
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthScreen />
    </Suspense>
  );
}
