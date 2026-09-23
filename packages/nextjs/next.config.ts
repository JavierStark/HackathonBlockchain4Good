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
  // Same pin for Next's (webpack-based) file-tracing, which `vercel build`'s
  // Next.js builder uses when producing `.vercel/output` for a monorepo.
  // Without this, Vercel CLI's prebuilt deploy can fail looking for a
  // `.next/package.json` witness file it expects when it can't otherwise
  // determine the workspace root: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
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
