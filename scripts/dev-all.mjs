#!/usr/bin/env node
// One-command local dev bootstrap: doctor -> anvil -> deploy + generate ABIs -> next dev.
// Zero extra dependencies (no concurrently/wait-on) so it works the moment
// `yarn install` finishes. Run with `yarn dev:all`.
import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { spawnCross } from "./lib/cross-exec.mjs";

const isWindows = platform() === "win32";
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");
const RPC_URL = "http://127.0.0.1:8545";
const CHAIN_READY_TIMEOUT_MS = 60_000;
const CHAIN_POLL_INTERVAL_MS = 500;

const colors = { anvil: "\x1b[36m", deploy: "\x1b[33m", next: "\x1b[35m", doctor: "\x1b[32m", reset: "\x1b[0m" };

function log(tag, line) {
  const color = colors[tag] ?? "";
  console.log(`${color}[${tag}]${colors.reset} ${line}`);
}

function prefixStream(tag, stream) {
  let buf = "";
  stream.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) if (line.length > 0) log(tag, line);
  });
}

// Windows spawns yarn -> node -> (anvil.exe | next.exe) as a process tree;
// child.kill() alone only signals the immediate shim and leaves the real
// process running. taskkill /t walks the tree; on POSIX a plain SIGINT/SIGTERM
// to the child is enough since we don't detach it into its own group.
function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (isWindows) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      /* already dead */
    }
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already dead */
    }
  }
}

function runStep(tag, cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCross(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], ...opts });
    prefixStream(tag, child.stdout);
    prefixStream(tag, child.stderr);
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${tag} exited with code ${code}`))));
  });
}

function spawnLongRunning(tag, cmd, args) {
  const child = spawnCross(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  prefixStream(tag, child.stdout);
  prefixStream(tag, child.stderr);
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) log(tag, `⚠️  exited with code ${code}`);
    else if (signal) log(tag, `stopped (${signal})`);
  });
  return child;
}

async function waitForChain() {
  const deadline = Date.now() + CHAIN_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, CHAIN_POLL_INTERVAL_MS));
  }
  throw new Error(`Anvil did not become ready at ${RPC_URL} within ${CHAIN_READY_TIMEOUT_MS / 1000}s`);
}

const children = [];
function shutdown() {
  console.log("\n🛑 Shutting down dev:all …");
  for (const child of children) killTree(child);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  log("doctor", "Checking toolchain …");
  // Plain "node", not process.execPath: on Windows, spawn's shell:true mode
  // quotes the *args* array safely but not the command string itself, and
  // process.execPath (e.g. "C:\Program Files\nodejs\node.exe") breaks on the
  // unescaped space — confirmed while building this script. "node" resolves
  // via PATH with no such issue, and it's already a hard requirement here.
  await runStep("doctor", "node", ["scripts/doctor.mjs"]);

  log("anvil", "Starting local chain …");
  const anvil = spawnLongRunning("anvil", "yarn", ["chain"]);
  children.push(anvil);

  await waitForChain();
  log("anvil", "✅ RPC is up");

  log("deploy", "Deploying contracts + generating frontend ABIs …");
  await runStep("deploy", "yarn", ["deploy"]);
  log("deploy", "✅ Deployed");

  log("next", "Starting frontend …");
  const next = spawnLongRunning("next", "yarn", ["start"]);
  children.push(next);

  console.log("\n✨ All set — http://localhost:3000 (Ctrl-C to stop everything)\n");
}

main().catch((err) => {
  console.error(`\n❌ dev:all failed: ${err.message}\n`);
  for (const child of children) killTree(child);
  process.exit(1);
});
