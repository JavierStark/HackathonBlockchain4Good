import { spawn } from "child_process";
import { createInterface } from "readline";
import { config } from "dotenv";
import { stdin as input, stdout as output } from "process";
config();

/**
 * Prompts the user for input with the given question
 * @param {string} question - The question to ask the user
 * @returns {Promise<string>} - The user's response
 */
function prompt(question) {
  const rl = createInterface({
    input,
    output,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// --private-key <pk> --password <pw>: fully non-interactive import, for
// scripted/CI use against a test-only wallet — skips the "Enter private
// key:" prompt entirely. Never use this with a real credential: both values
// are visible in shell history and process lists. Positional account name
// still works the same either way (`yarn account:import <name>`). With no
// flags, behavior is exactly as before (fully interactive).
function parseNonInteractiveArgs() {
  const args = process.argv.slice(2);
  const pkIdx = args.indexOf("--private-key");
  const passwordIdx = args.indexOf("--password");
  const accountName = args.find(
    (a, i) =>
      !a.startsWith("--") &&
      args[i - 1] !== "--private-key" &&
      args[i - 1] !== "--password"
  );
  return {
    accountName,
    privateKey: pkIdx !== -1 ? args[pkIdx + 1] : null,
    password: passwordIdx !== -1 ? args[passwordIdx + 1] : null,
  };
}

/**
 * Main function to import an account
 */
async function importAccount() {
  try {
    const {
      accountName: accountNameArg,
      privateKey,
      password,
    } = parseNonInteractiveArgs();

    // Get account name from command line args or prompt user
    let accountName = accountNameArg;
    if (!accountName) {
      accountName = await prompt("\nEnter account name (e.g., my-keystore): ");

      if (!accountName.trim()) {
        console.error("\n❌ Account name cannot be empty");
        process.exit(1);
      }
    }

    // Check if account name is scaffold-eth-default
    if (accountName === "scaffold-eth-default") {
      console.error(
        "\n❌ Cannot use 'scaffold-eth-default' as account name. This is reserved for local development."
      );
      process.exit(1);
    }

    // No `shell: true` — cast is a real .exe on PATH, not a shim that needs
    // one (unlike yarn). An earlier version wrapped this in an unnecessary
    // extra cmd.exe layer, which is very likely what corrupted cast's own
    // interactive private-key read ("Enter private key:" immediately
    // followed by "Error: invalid string length", confirmed reproducible).
    // generateKeystore.js's working `cast wallet import` call never used
    // shell:true either — matching that proven-working pattern here.
    const importArgs =
      privateKey && password
        ? [
            "wallet",
            "import",
            accountName,
            "--private-key",
            privateKey,
            "--unsafe-password",
            password,
          ]
        : ["wallet", "import", accountName, "--interactive"];

    const importProcess = spawn("cast", importArgs, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Handle process completion
    importProcess.on("close", (code) => {
      if (code === 0) {
        process.exit(0);
      } else {
        console.error(`\n❌ Failed to import account. Error code: ${code}`);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("\n❌ Error importing account:", error);
    process.exit(1);
  }
}

// Run the import function
importAccount().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
