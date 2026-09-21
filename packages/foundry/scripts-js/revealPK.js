import { listKeystores } from "./listKeystores.js";
import { execSync } from "child_process";

async function revealPk() {
  try {
    console.log("👀 This will reveal your private key on the console.");

    const selectedKeystore = await listKeystores(
      "Select a keystore to reveal its private key (enter the number, e.g., 1): "
    );

    if (!selectedKeystore) {
      console.error("❌ No keystore selected");
      process.exit(1);
    }

    try {
      const revealPKCommand = `cast wallet decrypt-keystore ${selectedKeystore}`;

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
