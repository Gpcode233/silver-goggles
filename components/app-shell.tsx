"use client";

import { usePathname } from "next/navigation";

import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenRoute = pathname === "/create/builder";
  const isScrollableStandaloneRoute = pathname === "/auth" || pathname === "/onboarding";

  if (isFullscreenRoute) {
    return <div className="h-screen overflow-hidden">{children}</div>;
  }

  if (isScrollableStandaloneRoute) {
    return <div className="min-h-screen overflow-y-auto">{children}</div>;
  }

  return (
    <div className="app-shell min-h-screen w-full pb-6">
      <SiteHeader />
      <div>{children}</div>
    </div>
  );
}
