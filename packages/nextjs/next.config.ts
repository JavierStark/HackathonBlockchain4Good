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
  // RainbowKit's Base Account wallet connector transitively pulls in
  // Coinbase's @coinbase/cdp-sdk, whose x402 payment module references
  // @x402/core / @x402/evm as optional dependencies we don't (and don't need
  // to) install. Turbopack's production build statically resolves every
  // import inside a bundled package and fails when those are missing; this
  // isn't hit during local `next dev`/`next build` in this repo's own CI (a
  // difference in how optional deps land across install environments), but
  // does show up on Vercel's remote build. Marking the package external
  // stops Next from trying to bundle/resolve its internals at build time —
  // it's still required normally at runtime, we just don't use the x402
  // payment feature so this is safe.
  serverExternalPackages: ["@coinbase/cdp-sdk"],
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
