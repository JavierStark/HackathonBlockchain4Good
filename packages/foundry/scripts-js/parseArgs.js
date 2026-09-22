import { spawnSync } from "child_process";
import { config } from "dotenv";
import { join, dirname } from "path";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { parse } from "toml";
import { fileURLToPath } from "url";
import { selectOrCreateKeystore } from "./selectOrCreateKeystore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config();

// Get all arguments after the script name
const args = process.argv.slice(2);
let fileName = "Deploy.s.sol";
let network = "localhost";
let keystoreArg = null;

// Show help message if --help is provided
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: yarn deploy [options]
Options:
  --file <filename>     Specify the deployment script file (default: Deploy.s.sol)
  --network <network>   Specify the network (default: localhost)
  --keystore <name>     Specify the keystore account to use (bypasses selection prompt)
  --help, -h           Show this help message
Examples:
  yarn deploy --file DeployYourContract.s.sol --network sepolia
  yarn deploy --network sepolia --keystore my-account
  yarn deploy --file DeployYourContract.s.sol
  yarn deploy
  `);
  process.exit(0);
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--network" && args[i + 1]) {
    network = args[i + 1];
    i++; // Skip next arg since we used it
  } else if (args[i] === "--file" && args[i + 1]) {
    fileName = args[i + 1];
    i++; // Skip next arg since we used it
  } else if (args[i] === "--keystore" && args[i + 1]) {
    keystoreArg = args[i + 1];
    i++; // Skip next arg since we used it
  }
}

// Function to check if a keystore exists
function validateKeystore(keystoreName) {
  if (keystoreName === "scaffold-eth-default") {
    return true; // Default keystore is always valid
  }

  const keystorePath = join(homedir(), ".foundry", "keystores", keystoreName);
  return existsSync(keystorePath);
}

// Check if the network exists in rpc_endpoints
try {
  const foundryTomlPath = join(__dirname, "..", "foundry.toml");
  const tomlString = readFileSync(foundryTomlPath, "utf-8");
  const parsedToml = parse(tomlString);

  if (!parsedToml.rpc_endpoints[network]) {
    console.log(
      `\n❌ Error: Network '${network}' not found in foundry.toml!`,
      "\nPlease check `foundry.toml` for available networks in the [rpc_endpoints] section or add a new network."
    );
    process.exit(1);
  }
} catch (error) {
  console.error("\n❌ Error reading or parsing foundry.toml:", error);
  process.exit(1);
}

// Default path: a DEPLOYER_PRIVATE_KEY in .env (see scripts-js/account.js).
// Skip the whole keystore/password flow — the Makefile picks the private-key
// branch up from the environment, and nothing prompts. Everything below this
// block is the optional keystore path, kept for anyone who prefers it.
if (process.env.DEPLOYER_PRIVATE_KEY?.trim()) {
  const { spawnSync: spawnMake } = await import("child_process");
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY.trim();

  // On the local chain your account starts with 0 ETH — only Anvil's own ten
  // built-in accounts are prefunded — so a deploy signed with your key fails
  // with "Insufficient funds for gas * price + value". Top it up through
  // Anvil's anvil_setBalance RPC so the *same* account works on localhost and
  // on testnets, and `yarn account` always shows the address that actually
  // deploys. (DeployHelpers.s.sol calls vm.deal for this, but that only
  // affects forge's local simulation, not the real node's state — which is
  // why the simulation succeeds and the broadcast then fails.)
  if (network === "localhost") {
    const deployerAddress = spawnMake(
      "cast",
      ["wallet", "address", "--private-key", deployerKey],
      { encoding: "utf-8" }
    ).stdout?.trim();

    if (deployerAddress) {
      try {
        const res = await fetch("http://127.0.0.1:8545", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "anvil_setBalance",
            // 10,000 ETH — same as Anvil's own default account balance.
            params: [deployerAddress, "0x21e19e0c9bab2400000"],
          }),
        });
        const body = await res.json();
        if (body.error) throw new Error(body.error.message);
        console.log(
          `\n💰 Funded ${deployerAddress} with 10000 ETH on the local chain`
        );
      } catch (error) {
        console.log(
          `\n⚠️  Could not auto-fund ${deployerAddress} locally: ${error.message}` +
            `\n   Is \`yarn chain\` running? The deploy will fail without ETH.`
        );
      }
    }
  }

  process.env.DEPLOY_SCRIPT = `script/${fileName}`;
  process.env.RPC_URL = network;
  console.log(
    `\n🚀 Deploying to ${network} using DEPLOYER_PRIVATE_KEY from .env`
  );
  const keyResult = spawnMake("make", ["deploy-and-generate-abis"], {
    stdio: "inherit",
    shell: true,
  });
  process.exit(keyResult.status ?? 1);
}

if (
  process.env.LOCALHOST_KEYSTORE_ACCOUNT !== "scaffold-eth-default" &&
  network === "localhost"
) {
  console.log(`
⚠️ Warning: Using ${process.env.LOCALHOST_KEYSTORE_ACCOUNT} keystore account on localhost.

You can either:
1. Enter the password for ${process.env.LOCALHOST_KEYSTORE_ACCOUNT} account
   OR
2. Set the localhost keystore account in your .env and re-run the command to skip password prompt:
   LOCALHOST_KEYSTORE_ACCOUNT='scaffold-eth-default'
`);
}

let selectedKeystore = process.env.LOCALHOST_KEYSTORE_ACCOUNT;
if (network !== "localhost") {
  if (keystoreArg) {
    // Use the keystore provided via command line argument
    if (!validateKeystore(keystoreArg)) {
      console.log(`\n❌ Error: Keystore '${keystoreArg}' not found!`);
      console.log(
        `Please check that the keystore exists in ~/.foundry/keystores/`
      );
      process.exit(1);
    }
    selectedKeystore = keystoreArg;
    console.log(`\n🔑 Using keystore: ${selectedKeystore}`);
  } else {
    try {
      selectedKeystore = await selectOrCreateKeystore();
    } catch (error) {
      console.error("\n❌ Error selecting keystore:", error);
      process.exit(1);
    }
  }
} else if (keystoreArg) {
  // Allow overriding the localhost keystore with --keystore flag
  if (!validateKeystore(keystoreArg)) {
    console.log(`\n❌ Error: Keystore '${keystoreArg}' not found!`);
    console.log(
      `Please check that the keystore exists in ~/.foundry/keystores/`
    );
    process.exit(1);
  }
  selectedKeystore = keystoreArg;
  console.log(
    `\n🔑 Using keystore: ${selectedKeystore} for localhost deployment`
  );
}

// Check for default account on live network
if (selectedKeystore === "scaffold-eth-default" && network !== "localhost") {
  console.log(`
❌ Error: Cannot deploy to live network using default keystore account!

To deploy to ${network}, please follow these steps:

1. If you haven't generated a keystore account yet:
   $ yarn generate

2. Run the deployment command again.

The default account (scaffold-eth-default) can only be used for localhost deployments.
`);
  process.exit(0);
}

// Set environment variables for the make command
process.env.DEPLOY_SCRIPT = `script/${fileName}`;
process.env.RPC_URL = network;
process.env.ETH_KEYSTORE_ACCOUNT = selectedKeystore;

const result = spawnSync("make", ["deploy-and-generate-abis"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status);
