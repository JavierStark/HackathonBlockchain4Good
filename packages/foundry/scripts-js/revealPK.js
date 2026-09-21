import { listKeystores } from "./listKeystores.js";
import { execSync } from "child_process";

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

async function revealPk() {
  try {
    console.log("👀 This will reveal your private key on the console.");

    const { account: accountArg, password: passwordArg } =
      parseNonInteractiveArgs();

    const selectedKeystore =
      accountArg ||
      (await listKeystores(
        "Select a keystore to reveal its private key (enter the number, e.g., 1): "
      ));

    if (!selectedKeystore) {
      console.error("❌ No keystore selected");
      process.exit(1);
    }

    try {
      const revealPKCommand = passwordArg
        ? `cast wallet decrypt-keystore ${selectedKeystore} --unsafe-password ${passwordArg}`
        : `cast wallet decrypt-keystore ${selectedKeystore}`;

      // execSync's default stdio pipes stdin too — cast's password prompt
      // needs a real, inherited stdin to read from (confirmed: a piped
      // stdin just hangs, it isn't read as buffered input at all). Inherit
      // stdin/stderr for the interactive prompt, pipe only stdout so we can
      // still capture the revealed key.
      const revealPKResult = execSync(revealPKCommand, {
        stdio: ["inherit", "pipe", "inherit"],
      })
        .toString()
        .trim();

      console.log(`\n🔑 ${revealPKResult}`);
    } catch (error) {
      console.error("\n❌ Failed to decrypt keystore. Wrong password?");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error revealing private key:");
    console.error(error.message);
    process.exit(1);
  }
}

revealPk().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
