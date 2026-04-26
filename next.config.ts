import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "@0gfoundation/0g-ts-sdk", "@0glabs/0g-serving-broker"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
