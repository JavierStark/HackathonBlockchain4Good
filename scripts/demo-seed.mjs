#!/usr/bin/env node
// Populates the local chain with a few deterministic transactions so a demo
// doesn't open on an empty state. Uses only Anvil's well-known, publicly
// documented test accounts (same on every machine, from the standard
// "test test test ... junk" mnemonic) — never a real key, never real funds.
//
// Idea-agnostic by design: this repo ships the stock YourContract as the
// wiring proof, so seeding just calls setGreeting a few times. When you build
// your real contract, extend this script to seed *your* domain data the same
// way — swap the ABI call, keep the account/tx pattern.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_PATH = join(__dirname, "..", "packages", "foundry", "deployments", "31337.json");
const RPC_URL = "http://127.0.0.1:8545";

// Anvil's standard deterministic accounts (mnemonic: "test test test test test
// test test test test test test junk"). Public, well-known, local-only.
const ANVIL_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
];

function sh(cmd, args) {
  // `cast` is a real .exe on PATH (installed by foundryup), unlike yarn — no
  // shell indirection needed here.
  execFileSync(cmd, args, { stdio: "inherit" });
}

async function assertChainUp() {
  try {
    await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
  } catch {
    console.error(`❌ Could not reach Anvil at ${RPC_URL}. Is \`yarn chain\` (or \`yarn dev:all\`) running?`);
    process.exit(1);
  }
}

function getContractAddress() {
  if (!existsSync(DEPLOYMENTS_PATH)) {
    console.error("❌ No local deployment found. Run `yarn deploy` first.");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(DEPLOYMENTS_PATH, "utf8"));
  const address = manifest.contracts?.YourContract?.address;
  if (!address) {
    console.error("❌ YourContract not found in packages/foundry/deployments/31337.json. Run `yarn deploy` first.");
    process.exit(1);
  }
  return address;
}

async function main() {
  await assertChainUp();
  const contract = getContractAddress();

  const seedCalls = [
    { account: ANVIL_ACCOUNTS[0], greeting: "gm from the hackathon 👋", value: null },
    { account: ANVIL_ACCOUNTS[1], greeting: "shipping the MVP", value: "0.01ether" },
    { account: ANVIL_ACCOUNTS[2], greeting: "demo day ready 🚀", value: null },
  ];

  console.log(`🌱 Seeding ${contract} with ${seedCalls.length} demo transactions …\n`);
  for (const { account, greeting, value } of seedCalls) {
    console.log(`   ${account.address.slice(0, 10)}… → setGreeting("${greeting}")${value ? ` [+${value}]` : ""}`);
    const args = ["send", contract, "setGreeting(string)", greeting, "--private-key", account.key, "--rpc-url", RPC_URL];
    if (value) args.push("--value", value);
    sh("cast", args);
  }

  console.log("\n✨ Demo data seeded. Open the frontend and check the Debug Contracts page / event history.");
}

main().catch((err) => {
  console.error(`❌ demo:seed failed: ${err.message}`);
  process.exit(1);
});
