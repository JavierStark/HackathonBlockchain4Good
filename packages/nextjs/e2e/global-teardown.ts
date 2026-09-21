// Stops the Next.js server and/or Anvil chain started by global-setup.ts —
// but only the ones this run actually started (a chain or server already
// running before the suite, e.g. from `yarn dev:all`, is left alone).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const isWindows = process.platform === "win32";

function stopPidFile(pidFile: string, label: string): void {
  if (!existsSync(pidFile)) return;
  const pid = readFileSync(pidFile, "utf8").trim();
  console.log(`[e2e] Stopping ${label} this run started (pid ${pid}) …`);
  try {
    if (isWindows) {
      execFileSync("taskkill", ["/pid", pid, "/t", "/f"], { stdio: "ignore" });
    } else {
      process.kill(-Number(pid), "SIGTERM"); // negative pid: whole detached process group
    }
  } catch {
    // Already gone — fine.
  }
  unlinkSync(pidFile);
}

export default async function globalTeardown() {
  stopPidFile(join(__dirname, ".serve-pid"), "the Next.js server");
  stopPidFile(join(__dirname, ".anvil-pid"), "the Anvil chain");
}
