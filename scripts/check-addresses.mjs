#!/usr/bin/env node
// Fails if packages/foundry/deployments/<chainId>.json and
// packages/nextjs/contracts/deployedContracts.ts disagree about a contract
// address for any chain both files know about. They're written by two different
// steps of the same `yarn deploy` (record-deployment.mjs and generateTsAbis.js,
// both sourced from the same broadcast/**/run-latest.json) — if they drift, it
// means one of the generated files was hand-edited or is stale. Run via
// `yarn check` and in CI.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_DIR = join(__dirname, "..", "packages", "foundry", "deployments");
const DEPLOYED_CONTRACTS_TS = join(__dirname, "..", "packages", "nextjs", "contracts", "deployedContracts.ts");

// Manifests matching a pattern in deployments/.gitignore (currently just
// 31337.json, the local Anvil chain) are local-only by design — their
// absence from the committed deployedContracts.ts is expected, not drift.
function loadGitignoredManifestNames() {
  const gitignorePath = join(DEPLOYMENTS_DIR, ".gitignore");
  if (!existsSync(gitignorePath)) return new Set();
  return new Set(
    readFileSync(gitignorePath, "utf8")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#")),
  );
}

function loadManifests() {
  if (!existsSync(DEPLOYMENTS_DIR)) return {};
  const gitignoredNames = loadGitignoredManifestNames();
  const manifests = {};
  for (const file of readdirSync(DEPLOYMENTS_DIR)) {
    if (!file.endsWith(".json") || gitignoredNames.has(file)) continue;
    const chainId = file.replace(".json", "");
    try {
      const data = JSON.parse(readFileSync(join(DEPLOYMENTS_DIR, file), "utf8"));
      if (data.contracts) manifests[chainId] = data.contracts;
    } catch {
      // Not every deployments/*.json necessarily has our enriched shape (e.g. a
      // network that was only ever deployed before record-deployment.mjs existed
      // and never redeployed since) — skip rather than crash `yarn check`.
    }
  }
  return manifests;
}

// deployedContracts.ts is a generated-but-typed file (`as const satisfies
// GenericContractsDeclaration`), not JSON. Rather than add a TypeScript-parsing
// dependency just to read two fields, walk it as text: it's machine-formatted by
// prettier with a fixed indentation, so this is reliable in practice.
function parseDeployedContractsTs() {
  if (!existsSync(DEPLOYED_CONTRACTS_TS)) return {};
  const lines = readFileSync(DEPLOYED_CONTRACTS_TS, "utf8").split("\n");
  const result = {};
  let currentChain = null;
  let currentContract = null;

  for (const line of lines) {
    const chainMatch = line.match(/^\s{2}(\d+):\s*\{\s*$/);
    if (chainMatch) {
      currentChain = chainMatch[1];
      result[currentChain] = {};
      currentContract = null;
      continue;
    }
    const contractMatch = line.match(/^\s{4}(\w+):\s*\{\s*$/);
    if (contractMatch && currentChain) {
      currentContract = contractMatch[1];
      result[currentChain][currentContract] = {};
      continue;
    }
    const addressMatch = line.match(/^\s+address:\s*"(0x[a-fA-F0-9]{40})"/);
    if (addressMatch && currentChain && currentContract) {
      result[currentChain][currentContract].address = addressMatch[1];
    }
  }
  return result;
}

function main() {
  const manifests = loadManifests();
  const frontendContracts = parseDeployedContractsTs();
  const mismatches = [];
  const chainsChecked = new Set();

  for (const [chainId, contracts] of Object.entries(manifests)) {
    const frontendChain = frontendContracts[chainId];
    if (!frontendChain) {
      // A manifest file existing on disk with zero corresponding entry in
      // deployedContracts.ts is drift, not "not generated yet" — this is
      // exactly what happens if `yarn deploy`/`yarn e2e` ran locally for a
      // network whose broadcast/ history isn't on this machine (e.g. a
      // network only ever deployed via CI): deployedContracts.ts gets
      // rebuilt from local broadcast/ alone and silently drops every chain
      // that isn't in it, even though its deployments/<chainId>.json manifest
      // is still sitting right there. See docs/deployment.md's warning under
      // "Testnet" step 3.
      mismatches.push(
        `chain ${chainId}: has a deployments/${chainId}.json manifest but no entry at all in deployedContracts.ts ` +
          `(likely wiped by a local 'yarn deploy'/'yarn e2e' run on a machine without this chain's broadcast/ history)`,
      );
      continue;
    }
    chainsChecked.add(chainId);

    for (const [name, info] of Object.entries(contracts)) {
      const frontendEntry = frontendChain[name];
      if (!frontendEntry) {
        mismatches.push(`chain ${chainId}: "${name}" is in deployments/${chainId}.json but missing from deployedContracts.ts`);
        continue;
      }
      if (frontendEntry.address?.toLowerCase() !== info.address?.toLowerCase()) {
        mismatches.push(
          `chain ${chainId}: "${name}" address mismatch — deployments/${chainId}.json has ${info.address}, deployedContracts.ts has ${frontendEntry.address}`,
        );
      }
    }
  }

  if (mismatches.length > 0) {
    console.error("❌ Deployment manifest and frontend contract addresses disagree:\n");
    for (const m of mismatches) console.error(`   - ${m}`);
    console.error("\nRe-run `yarn deploy` (or `node scripts/record-deployment.mjs`) so both are regenerated together.\n");
    process.exit(1);
  }

  if (chainsChecked.size === 0) {
    console.log("ℹ️  No overlapping chains between deployments/ and deployedContracts.ts yet — nothing to check.");
  } else {
    console.log(`✅ Addresses match across deployments/ and deployedContracts.ts for chain(s): ${[...chainsChecked].join(", ")}`);
  }
}

main();
