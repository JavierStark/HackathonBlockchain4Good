#!/usr/bin/env node
// Resets local chain state and redeploys fresh contracts for a clean demo.
// Requires a local Anvil already running (`yarn chain` / `yarn dev:all`).
// Uses Anvil's own `anvil_reset` RPC method instead of killing/restarting the
// process — simpler, and doesn't disturb whatever terminal is running `yarn chain`.
// Never touches a real network, real funds, or a real private key.
import { execCross } from "./lib/cross-exec.mjs";

const RPC_URL = "http://127.0.0.1:8545";

async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method} failed: ${body.error.message}`);
  return body.result;
}

async function main() {
  console.log("🔄 Resetting local chain state …");
  try {
    await rpc("anvil_reset");
  } catch (err) {
    console.error(`❌ Could not reach Anvil at ${RPC_URL}. Is \`yarn chain\` (or \`yarn dev:all\`) running?`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }
  console.log("✅ Chain state reset (block 0, fresh accounts)");

  console.log("\n🚀 Redeploying contracts …");
  execCross("yarn", ["deploy"], { stdio: "inherit" });

  console.log("\n✨ Demo environment is fresh. Run `yarn demo:seed` to add sample data.");
}

main().catch((err) => {
  console.error(`❌ demo:reset failed: ${err.message}`);
  process.exit(1);
});
