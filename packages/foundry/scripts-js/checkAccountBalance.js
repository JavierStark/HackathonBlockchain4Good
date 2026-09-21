import { listKeystores } from "./listKeystores.js";
import { execSync } from "child_process";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { toString } from "qrcode";
import { readFileSync } from "fs";
import { parse } from "toml";
import { ethers } from "ethers";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "IZYEU2cWBgnFmgiTAgpWD";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

async function getBalanceForEachNetwork(address) {
  try {
    // Read the foundry.toml file
    const foundryTomlPath = join(__dirname, "..", "foundry.toml");
    const tomlString = readFileSync(foundryTomlPath, "utf-8");

    // Parse the tomlString to get the JS object representation
    const parsedToml = parse(tomlString);

    // Extract rpc_endpoints from parsedToml
    const rpcEndpoints = parsedToml.rpc_endpoints;

    // Replace placeholders in the rpc_endpoints section
    function replaceENVAlchemyKey(input) {
      return input.replace("${ALCHEMY_API_KEY}", ALCHEMY_API_KEY);
    }

    console.log(await toString(address, { type: "terminal", small: true }));
    console.log(`\n📊 Address: ${address}`);

    for (const networkName in rpcEndpoints) {
      const networkUrl = replaceENVAlchemyKey(rpcEndpoints[networkName]);
      console.log(`\n--${networkName}-- 📡`);

      try {
        const provider = new ethers.providers.JsonRpcProvider(networkUrl);

        // Get balance and format it
        const balance = await provider.getBalance(address);
        const formattedBalance = +ethers.utils.formatUnits(balance);

        console.log("   Balance:", formattedBalance);
        console.log("   Nonce:", await provider.getTransactionCount(address));
      } catch (e) {
        console.log(
          `   ❌ Can't connect to network ${networkName}: ${e.message}`
        );
      }
    }
  } catch (error) {
    console.error("Error reading foundry.toml:", error);
  }
}

// --account <name> [--password <pw>]: skip the interactive keystore
// selection (and, if --password is also given, the password prompt too) —
// for scripted/CI use against a test-only keystore. Never use --password
// with a real credential: it's visible in shell history and process lists.
// With no flags, behavior is exactly as before (fully interactive).
function parseNonInteractiveArgs() {
  const args = process.argv.slice(2);
  const accountIdx = args.indexOf("--account");
  const passwordIdx = args.indexOf("--password");
  return {
    account: accountIdx !== -1 ? args[accountIdx + 1] : null,
    password: passwordIdx !== -1 ? args[passwordIdx + 1] : null,
  };
}

async function checkAccountBalance() {
  try {
    const { account: accountArg, password: passwordArg } =
      parseNonInteractiveArgs();

    // Step 1: List accounts and let user select one (skipped if --account given)
    let selectedKeystore = accountArg;
    if (!selectedKeystore) {
      console.log("📋 Listing available accounts...");
      selectedKeystore = await listKeystores(
        "Select a keystore to display its balance (enter the number, e.g., 1): "
      );
    }

    if (!selectedKeystore) {
      console.error("❌ No keystore selected");
      process.exit(1);
    }

    // Step 2: Get the address of the selected account
    console.log(`\n🔍 Getting address for keystore: ${selectedKeystore}`);
    const addressCommand = passwordArg
      ? `cast wallet address --account ${selectedKeystore} --password ${passwordArg}`
      : `cast wallet address --account ${selectedKeystore}`;

    let address;
    try {
      // execSync's default stdio pipes stdin too — cast's password prompt
      // needs a real, inherited stdin to read from (confirmed: a piped
      // stdin just hangs, it isn't read as buffered input at all). Inherit
      // stdin/stderr for the interactive prompt, pipe only stdout so we can
      // still capture the returned address. Irrelevant when --password was
      // given (no prompt happens at all), but harmless either way.
      address = execSync(addressCommand, {
        stdio: ["inherit", "pipe", "inherit"],
      })
        .toString()
        .trim();
      console.log("\n💰 Checking balances across networks...");
      console.log("\n");
      await getBalanceForEachNetwork(address);
    } catch (error) {
      console.error(`❌ Error getting address: ${error.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the function if this script is called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkAccountBalance().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { checkAccountBalance };
