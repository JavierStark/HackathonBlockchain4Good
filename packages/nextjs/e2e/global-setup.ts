// Boots a fresh local Anvil chain, deploys the stock contract, builds the
// frontend against that exact deployment, then serves it — strictly in that
// order (see playwright.config.ts for why: deployedContracts.ts is baked into
// the build statically, so build must never start before deploy finishes).
// Self-contained on purpose (direct child_process calls, no import from
// repo-root scripts/) so `yarn e2e` has no dependency beyond this package.
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const RPC_URL = "http://127.0.0.1:8545";
const APP_URL = "http://localhost:3000";
const REPO_ROOT = join(__dirname, "..", "..", "..");
const NEXTJS_ROOT = join(__dirname, "..");
const ANVIL_PID_FILE = join(__dirname, ".anvil-pid");
const SERVE_PID_FILE = join(__dirname, ".serve-pid");
const isWindows = process.platform === "win32";
const comspec = process.env.ComSpec || "cmd.exe";

async function pollUntil(
  url: string,
  ready: (res: Response) => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        url,
        url === RPC_URL
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
            }
          : {},
      );
      if (ready(res)) return;
    } catch {
      /* not up yet */
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${label} did not become ready at ${url} within ${timeoutMs}ms`);
}

function runBlocking(cwd: string, command: string, env?: Record<string, string>): void {
  const mergedEnv = env ? { ...process.env, ...env } : undefined;
  if (isWindows) {
    execFileSync(comspec, ["/d", "/s", "/c", command], { cwd, stdio: "inherit", env: mergedEnv });
  } else {
    execFileSync("sh", ["-c", command], { cwd, stdio: "inherit", env: mergedEnv });
  }
}

function spawnDetached(cwd: string, command: string): number | undefined {
  const child = isWindows
    ? spawn(comspec, ["/d", "/s", "/c", command], { cwd, stdio: "ignore", detached: true })
    : spawn("sh", ["-c", command], { cwd, stdio: "ignore", detached: true });
  child.unref();
  return child.pid;
}

export default async function globalSetup() {
  let chainUp = false;
  try {
    await pollUntil(RPC_URL, res => res.ok, 1_000, "Anvil");
    chainUp = true;
  } catch {
    /* nothing listening yet — we'll start it */
  }

  if (chainUp) {
    console.log("[e2e] Anvil already running at :8545 — reusing it (won't be stopped after this run).");
  } else {
    console.log("[e2e] Starting a fresh local Anvil chain …");
    const pid = spawnDetached(REPO_ROOT, "yarn chain");
    if (pid) writeFileSync(ANVIL_PID_FILE, String(pid));
    await pollUntil(RPC_URL, res => res.ok, 60_000, "Anvil");
    console.log("[e2e] ✅ Anvil is up");
  }

  console.log("[e2e] Deploying contracts to the local chain …");
  runBlocking(REPO_ROOT, "yarn deploy");
  console.log("[e2e] ✅ Deployed — deployedContracts.ts now reflects this exact deployment");

  console.log("[e2e] Building the frontend against this deployment (cold build can take a few minutes) …");
  // Tells scaffold.config.ts to default to foundry (this local deployment)
  // instead of baseSepolia — see the comment there for why the two builds
  // need different defaults.
  runBlocking(NEXTJS_ROOT, "yarn build", { NEXT_PUBLIC_E2E_LOCAL_NETWORK: "true" });
  console.log("[e2e] ✅ Build complete");

  console.log("[e2e] Starting the production server …");
  const servePid = spawnDetached(NEXTJS_ROOT, "yarn serve");
  if (servePid) writeFileSync(SERVE_PID_FILE, String(servePid));
  await pollUntil(APP_URL, res => res.status < 500, 60_000, "Next.js server");
  console.log("[e2e] ✅ App is up at " + APP_URL);
}
