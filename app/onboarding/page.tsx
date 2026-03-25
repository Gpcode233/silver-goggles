"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "lucide-react";

import AjentlyLogo from "@/assets/Ajently.png";

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6 py-10">
      <form
        className="w-full max-w-[720px] rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-10"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError("");
          const formData = new FormData(event.currentTarget);
          const response = await fetch("/api/auth/onboarding", { method: "POST", body: formData });
          const data = (await response.json()) as { error?: string };
          if (!response.ok) {
            setError(data.error ?? "Failed to finish onboarding");
            setSubmitting(false);
            return;
          }
          router.push("/");
          router.refresh();
        }}
      >
        <div className="flex items-center gap-3">
          <Image src={AjentlyLogo} alt="Ajently" className="h-10 w-auto" priority />
          <span className="text-xl font-black text-slate-950">Ajently</span>
        </div>

        <p className="mt-10 inline-flex rounded-full bg-sky-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
          Onboarding
        </p>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
          Set up the profile your workspace will use.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Add a name, email, and profile picture once. Your profile page and created agents will reflect
          this identity immediately.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-slate-400 hover:bg-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-sky-700">
              <Upload className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-bold text-slate-900">Upload Photo</p>
            <p className="mt-2 text-xs text-slate-500">{avatarName || "PNG, JPG up to 2MB"}</p>
            <input
              type="file"
              name="avatar"
              accept="image/*"
              className="hidden"
              onChange={(event) => setAvatarName(event.currentTarget.files?.[0]?.name ?? "")}
            />
          </label>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold uppercase tracking-[0.1em] text-slate-500">Your Name</span>
              <input
                name="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.currentTarget.value)}
                required
                minLength={2}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none"
                placeholder="Alex Thorne"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold uppercase tracking-[0.1em] text-slate-500">Email</span>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none"
                placeholder="you@example.com"
              />
            </label>
            <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-600">
              The email is used on your profile if you sign in with Google or email. If you signed in with a wallet,
              your wallet address still remains your identity fallback.
            </div>
          </div>
        </div>

        {error ? <p className="mt-5 text-sm font-semibold text-red-600">{error}</p> : null}

        <div className="mt-10 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-black px-6 py-4 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Finish Setup"}
          </button>
        </div>
      </form>
    </main>
  );
}
