#!/usr/bin/env node
// Enriches packages/foundry/deployments/<chainId>.json (SE-2's own per-chain
// manifest, otherwise left nearly empty — see docs/development.md) with the
// fields an agent or teammate actually needs to trust an address: when it was
// deployed, by whom, the tx/block, and the exact commit that produced it.
// Source of truth is packages/foundry/broadcast/**/run-latest.json — the same
// data scripts-js/generateTsAbis.js reads to write deployedContracts.ts, so this
// manifest can never disagree with what the frontend is actually using.
//
// Runs automatically after every deploy (wired into the Makefile's
// deploy-and-generate-abis target). Can also be run standalone:
//   node scripts/record-deployment.mjs [--chain-id 84532]
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FOUNDRY_DIR = join(__dirname, "..", "packages", "foundry");
const BROADCAST_DIR = join(FOUNDRY_DIR, "broadcast");
const DEPLOYMENTS_DIR = join(FOUNDRY_DIR, "deployments");

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--chain-id");
  return { chainId: idx !== -1 ? Number(args[idx + 1]) : null };
}

function findRunLatestFiles() {
  if (!existsSync(BROADCAST_DIR)) return [];
  const found = [];
  for (const scriptDir of readdirSync(BROADCAST_DIR)) {
    const scriptPath = join(BROADCAST_DIR, scriptDir);
    if (!statSync(scriptPath).isDirectory()) continue;
    for (const chainDir of readdirSync(scriptPath)) {
      const runLatest = join(scriptPath, chainDir, "run-latest.json");
      if (existsSync(runLatest)) found.push({ chainDir, path: runLatest, mtime: statSync(runLatest).mtimeMs });
    }
  }
  return found;
}

function detectChainId(files) {
  if (files.length === 0) throw new Error("No broadcast/**/run-latest.json found — deploy something first.");
  const newest = files.reduce((a, b) => (b.mtime > a.mtime ? b : a));
  return Number(newest.chainDir);
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: FOUNDRY_DIR }).trim();
  } catch {
    return null;
  }
}

function buildManifest(chainId, files) {
  const relevant = files.filter((f) => Number(f.chainDir) === chainId);
  if (relevant.length === 0) throw new Error(`No broadcast run found for chain ${chainId}.`);

  const contracts = {};
  let networkName = null;
  let deployer = null;
  let latestTimestampMs = 0;

  for (const { path } of relevant) {
    const run = JSON.parse(readFileSync(path, "utf8"));
    const receiptsByHash = new Map((run.receipts ?? []).map((r) => [r.transactionHash, r]));

    for (const tx of run.transactions ?? []) {
      if (tx.transactionType !== "CREATE" && tx.transactionType !== "CREATE2") continue;
      if (!tx.contractName || !tx.contractAddress) continue;

      const receipt = receiptsByHash.get(tx.hash);
      contracts[tx.contractName] = {
        address: tx.contractAddress,
        txHash: tx.hash ?? null,
        blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : null,
        deployer: receipt?.from ?? null,
        // Populated separately once `yarn verify` succeeds — never auto-assumed true.
        verified: false,
      };
      if (receipt?.from) deployer = receipt.from;
    }

    if (run.timestamp && run.timestamp > latestTimestampMs) latestTimestampMs = run.timestamp;
  }

  if (Object.keys(contracts).length === 0) {
    throw new Error(`Found broadcast data for chain ${chainId} but no CREATE transactions with a contract name.`);
  }

  // Preserve networkName from SE-2's own exportDeployments() output if present.
  const existingPath = join(DEPLOYMENTS_DIR, `${chainId}.json`);
  if (existsSync(existingPath)) {
    try {
      const existing = JSON.parse(readFileSync(existingPath, "utf8"));
      networkName = existing.networkName ?? null;
    } catch {
      /* start fresh */
    }
  }

  return {
    chainId,
    networkName,
    // Foundry's broadcast `timestamp` field is already milliseconds since epoch.
    deployedAt: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : new Date().toISOString(),
    deployer,
    gitCommit: gitCommit(),
    contracts,
  };
}

function main() {
  const { chainId: requestedChainId } = parseArgs();
  const files = findRunLatestFiles();
  const chainId = requestedChainId ?? detectChainId(files);
  const manifest = buildManifest(chainId, files);

  const outPath = join(DEPLOYMENTS_DIR, `${chainId}.json`);
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`📄 Recorded deployment manifest: packages/foundry/deployments/${chainId}.json`);
  for (const [name, info] of Object.entries(manifest.contracts)) {
    console.log(`   ${name} → ${info.address}`);
  }
}

main();
