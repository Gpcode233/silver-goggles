import type { Metadata } from "next";
import { Bricolage_Grotesque, Space_Mono } from "next/font/google";

import favicon from "@/assets/favicon.png";
import { SiteHeader } from "@/components/site-header";
import { Web3Provider } from "@/components/web3-provider";

import "./globals.css";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const monoFont = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Ajently",
  description:
    "Publish, discover, and run AI agents on decentralized 0G Compute + 0G Storage.",
  icons: {
    icon: [{ url: favicon.src, type: "image/png" }],
    shortcut: [{ url: favicon.src, type: "image/png" }],
    apple: [{ url: favicon.src, type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable} antialiased`}>
        <Web3Provider>
          <div className="mx-auto min-h-screen w-full px-4 pb-6 sm:px-6 lg:px-8">
            <SiteHeader />
            <div className="mt-6">{children}</div>
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
