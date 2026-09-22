// Prompt-free account management backed by DEPLOYER_PRIVATE_KEY in
// packages/foundry/.env — the default path for this repo.
//
//   node scripts-js/account.js generate        new random key -> .env
//   node scripts-js/account.js import <0x...>  existing key   -> .env
//   node scripts-js/account.js show            address + balances
//
// Why this exists instead of Foundry's encrypted keystores: the keystore
// flow needs an interactive hidden password prompt, which on Windows is
// routed through several layers (yarn shim -> node -> make -> cast) and
// proved unreliable in practice — and, just as importantly, it cannot be
// tested non-interactively, so regressions in it are invisible to CI. A
// private key in a gitignored .env has no prompt, behaves identically on
// every OS and terminal, and every path here is exercised by
// `node scripts-js/account.js` in CI.
//
// TEST WALLETS ONLY. The key is stored in cleartext in .env (gitignored,
// never committed). Never put a key here that holds real funds — generate a
// fresh one for this project and fund it from a faucet. See docs/security.md.
import { spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { toString as qrToString } from "qrcode";
import { readFileSync as read } from "fs";
import { parse as parseToml } from "toml";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");
const ENV_KEY = "DEPLOYER_PRIVATE_KEY";

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/** Runs a command, returns trimmed stdout, or exits with its stderr. */
function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf-8" });
  if (result.error) fail(`Could not run \`${cmd}\`: ${result.error.message}`);
  if (result.status !== 0) {
    fail(
      `\`${cmd} ${args[0] ?? ""}\` failed:\n${result.stderr || result.stdout}`
    );
  }
  return (result.stdout ?? "").trim();
}

function isValidPrivateKey(key) {
  return /^0x[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Writes KEY=value into .env, replacing an existing uncommented line if there
 * is one and appending otherwise. Line-based on purpose: rewriting the file
 * from a parsed object would drop every comment explaining the other vars.
 */
function setEnvValue(key, value) {
  const original = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : "";
  const lines = original.split(/\r?\n/);
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  const index = lines.findIndex((line) => pattern.test(line));

  if (index !== -1) {
    lines[index] = `${key}=${value}`;
  } else {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push(
      `# Deployer private key — TEST WALLETS ONLY, never a key with real funds.`
    );
    lines.push(
      `# This file is gitignored. Written by \`yarn generate\` / \`yarn account:import\`.`
    );
    lines.push(`${key}=${value}`);
    lines.push("");
  }

  writeFileSync(ENV_PATH, lines.join("\n"));
}

function getPrivateKey() {
  config({ path: ENV_PATH });
  const key = process.env[ENV_KEY];
  if (!key || !key.trim()) {
    fail(
      `No ${ENV_KEY} found in packages/foundry/.env\n` +
        `   Run \`yarn generate\` to create a new test account, or\n` +
        `   \`yarn account:import 0x<your-test-wallet-private-key>\` to use an existing one.`
    );
  }
  if (!isValidPrivateKey(key.trim())) {
    fail(
      `${ENV_KEY} in .env is not a valid private key (expected 0x + 64 hex characters).`
    );
  }
  return key.trim();
}

function addressFor(privateKey) {
  return run("cast", ["wallet", "address", "--private-key", privateKey]);
}

function saveKey(privateKey, { generated }) {
  const address = addressFor(privateKey);
  setEnvValue(ENV_KEY, privateKey);

  console.log(`\n✅ ${generated ? "Generated" : "Imported"} deployer account`);
  console.log(`\n   Address: ${address}`);
  console.log(
    `   Saved to: packages/foundry/.env (gitignored, never committed)`
  );
  console.log(`\n⚠️  Test wallets only — this key is stored in cleartext.`);
  console.log(
    `\n   Next: fund this address from a faucet, then \`yarn account\` to check it.\n`
  );
  return address;
}

function generate() {
  console.log("\n🔑 Generating a new account …");
  // `cast wallet new` prints its human-readable summary to stderr and a
  // machine-readable `address\tprivateKey` line to stdout (Foundry 1.8.3).
  const stdout = run("cast", ["wallet", "new"]);
  const privateKey = stdout
    .split("\n")
    .map((line) => line.trim().split("\t"))
    .find((parts) => parts.length === 2 && isValidPrivateKey(parts[1]))?.[1];

  if (!privateKey)
    fail(`Could not parse a private key out of \`cast wallet new\` output.`);
  saveKey(privateKey, { generated: true });
}

function importKey(rawKey) {
  if (!rawKey) {
    fail(
      "Usage: yarn account:import 0x<private-key>\n" +
        "   (TEST WALLETS ONLY — the key is stored in cleartext in .env)"
    );
  }
  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!isValidPrivateKey(privateKey)) {
    fail(
      "That doesn't look like a private key (expected 0x + 64 hex characters)."
    );
  }
  saveKey(privateKey, { generated: false });
}

async function show() {
  const address = addressFor(getPrivateKey());

  console.log(await qrToString(address, { type: "terminal", small: true }));
  console.log(`\n📊 Address: ${address}\n`);

  const parsed = parseToml(
    read(join(__dirname, "..", "foundry.toml"), "utf-8")
  );
  const alchemyKey = process.env.ALCHEMY_API_KEY || "";

  for (const [name, rawUrl] of Object.entries(parsed.rpc_endpoints ?? {})) {
    const url = rawUrl.replace("${ALCHEMY_API_KEY}", alchemyKey);
    if (url.includes("${")) continue; // unresolved env placeholder (e.g. production) — skip
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      const balance = await provider.getBalance(address);
      console.log(
        `   ${name.padEnd(18)} ${ethers.utils.formatEther(balance)} ETH`
      );
    } catch {
      console.log(`   ${name.padEnd(18)} (unreachable)`);
    }
  }
  console.log("");
}

const [command, arg] = process.argv.slice(2);
switch (command) {
  case "generate":
    generate();
    break;
  case "import":
    importKey(arg);
    break;
  case "show":
  case undefined:
    await show();
    break;
  default:
    fail(`Unknown command '${command}'. Use: generate | import <0x...> | show`);
}
