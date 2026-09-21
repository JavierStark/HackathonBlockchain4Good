import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  // Pin the workspace root to this monorepo explicitly. Without this, Next
  // walks up looking for a lockfile and can latch onto an unrelated one
  // outside the repo (e.g. a stray package-lock.json in a parent folder),
  // which breaks path resolution during `next build`/`next dev`.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

module.exports = nextConfig;
