import { spawnSync, spawn } from "child_process";
import readline from "readline";
import { fileURLToPath } from "url";

// --name <name> --password <pw>: fully non-interactive, for scripted/CI use
// against a test-only wallet — skips both the keystore-name and
// password/confirm prompts. Never use --password with a real credential:
// it's visible in shell history and process lists. With no flags, behavior
// is exactly as before (fully interactive).
function parseNonInteractiveArgs() {
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf("--name");
  const passwordIdx = args.indexOf("--password");
  return {
    name: nameIdx !== -1 ? args[nameIdx + 1] : null,
    password: passwordIdx !== -1 ? args[passwordIdx + 1] : null,
  };
}

async function createKeystore() {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Generate a new wallet
    console.log("\n🔑 Generating new wallet...");
    const newWalletResult = spawnSync("cast", ["wallet", "new"], {
      encoding: "utf-8",
    });

    if (newWalletResult.error || newWalletResult.status !== 0) {
      console.error(
        "\n❌ Error generating new wallet:",
        newWalletResult.stderr || newWalletResult.error
      );
      process.exit(1);
    }

    // `cast wallet new` (confirmed on Foundry 1.8.3) writes its human-readable
    // summary — the "Private key:"-labeled line this used to parse — to
    // STDERR, and only a machine-readable `address\tprivateKey` line to
    // stdout. Parse that tab-separated stdout line first (more robust: no
    // label text to drift out of sync with cast's own wording), and fall
    // back to scanning both streams for the "Private key:" label in case an
    // older/newer cast version formats this differently.
    let privateKey = newWalletResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .map((line) => line.split("\t"))
      .find((parts) => parts.length === 2 && parts[1].startsWith("0x"))?.[1];

    if (!privateKey) {
      const combinedOutput = `${newWalletResult.stdout}\n${
        newWalletResult.stderr ?? ""
      }`;
      privateKey = combinedOutput
        .split("\n")
        .find((line) => line.includes("Private key:"))
        ?.split(":")[1]
        ?.trim();
    }

    if (!privateKey) {
      console.error(
        "\n❌ Could not extract private key from `cast wallet new` output"
      );
      console.error("stdout:", newWalletResult.stdout);
      console.error("stderr:", newWalletResult.stderr);
      process.exit(1);
    }

    const { name: nameArg, password: passwordArg } = parseNonInteractiveArgs();

    const keystoreName =
      nameArg ||
      (await new Promise((resolve) => {
        rl.question("\nEnter name for new keystore: ", resolve);
      }));

    // Close readline before spawning process with inherited stdio
    rl.close();

    const importArgs = passwordArg
      ? [
          "wallet",
          "import",
          keystoreName,
          "--private-key",
          privateKey,
          "--unsafe-password",
          passwordArg,
        ]
      : ["wallet", "import", keystoreName, "--private-key", privateKey];

    return new Promise((resolve, reject) => {
      const importProcess = spawn("cast", importArgs, {
        stdio: "inherit",
      });

      importProcess.on("close", (code) => {
        if (code === 0) {
          console.log(
            "\n💰 Fund the address and re-run the deploy command to use this keystore."
          );
          console.log(
            `\nTIP: Use \`yarn account\` and select \`${keystoreName}\` keystore to check if the address is funded.`
          );
          process.exit(0);
        } else {
          console.error("\n❌ Error importing keystore");
          reject(new Error("Import failed"));
        }
      });
    });
  } catch (error) {
    console.error("\n❌ Error creating keystore:", error);
    process.exit(1);
  } finally {
    // Ensure readline is closed
    if (rl) rl.close();
  }
}

// Run the function if this script is called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createKeystore()
    .then((keystoreName) => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createKeystore };
