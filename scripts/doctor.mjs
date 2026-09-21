#!/usr/bin/env node
// Zero-dependency environment health check. Run with `yarn doctor`.
// Fails loudly with an actionable message instead of letting a later command
// (yarn chain / yarn deploy / forge test) fail with a confusing error.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { execCross } from "./lib/cross-exec.mjs";

const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 18;
const MIN_NODE_PATCH = 3;
const MIN_FOUNDRY_VERSION = "1.4.0";

const results = [];
const isWindows = platform() === "win32";

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    // On Windows, some tools are .CMD/.ps1 shims (e.g. yarn via corepack) that
    // execFileSync can't spawn directly without going through a shell.
    if (isWindows && err.code === "ENOENT") {
      try {
        return execCross(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      } catch {
        return null;
      }
    }
    return null;
  }
}

function check(name, ok, detail, fix) {
  results.push({ name, ok, detail, fix });
}

function versionAtLeast(current, required) {
  const c = current.split(".").map(Number);
  const r = required.split(".").map(Number);
  for (let i = 0; i < r.length; i++) {
    if ((c[i] ?? 0) > r[i]) return true;
    if ((c[i] ?? 0) < r[i]) return false;
  }
  return true;
}

// --- Node.js ---
{
  const [maj, min, patch] = process.versions.node.split(".").map(Number);
  const ok = maj > MIN_NODE_MAJOR || (maj === MIN_NODE_MAJOR && (min > MIN_NODE_MINOR || (min === MIN_NODE_MINOR && patch >= MIN_NODE_PATCH)));
  check(
    "Node.js",
    ok,
    `v${process.versions.node} (need >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.${MIN_NODE_PATCH})`,
    "Install Node 20.18.3+ (nvm/nvm-windows/fnm, or https://nodejs.org).",
  );
}

// --- Yarn (via corepack, should resolve to the packageManager field: yarn@4.x) ---
{
  const v = run("yarn", ["--version"]);
  const ok = v !== null && v.startsWith("4.");
  check(
    "Yarn 4 (corepack)",
    ok,
    v ? `yarn ${v}` : "yarn not found on PATH",
    'Run `corepack enable` (or, if that fails with EPERM on Windows: ' +
      '`corepack enable --install-directory <a folder you own>` and prepend that folder to PATH). ' +
      "Then re-run this from the repo root so corepack picks up packageManager from package.json.",
  );
}

// --- Foundry toolchain ---
for (const bin of ["forge", "cast", "anvil"]) {
  const out = run(bin, ["--version"]);
  const match = out?.match(/Version:\s*([\d.]+)/);
  const version = match?.[1];
  const ok = version !== undefined && versionAtLeast(version, MIN_FOUNDRY_VERSION);
  check(
    bin,
    ok,
    version ? `${bin} ${version}` : `${bin} not found on PATH`,
    `Install Foundry: https://getfoundry.sh (run foundryup on macOS/Linux; on Windows, ` +
      `download foundry_<version>_win32_amd64.zip from https://github.com/foundry-rs/foundry/releases, ` +
      `verify its .sha256, extract to %USERPROFILE%\\.foundry\\bin, add that folder to your user PATH). ` +
      `Need >= ${MIN_FOUNDRY_VERSION}.`,
  );
}

// --- GNU Make ---
{
  const out = run("make", ["--version"]);
  check("make", out !== null, out ? out.split("\n")[0] : "make not found on PATH", "Install GNU Make (Git for Windows' chocolatey/scoop package, or `choco install make`).");
}

// --- POSIX sh (only matters for the Foundry package's Makefile recipes) ---
{
  if (isWindows) {
    const gitSh = "C:/Program Files/Git/usr/bin/sh.exe";
    const ok = existsSync(gitSh);
    check(
      "POSIX sh (for Makefile recipes)",
      ok,
      ok ? gitSh : "not found at the default Git for Windows location",
      "packages/foundry/Makefile pins SHELL to this path on Windows automatically. " +
        "If Git for Windows is installed elsewhere, run `make SHELL=/path/to/sh.exe ...` " +
        "or edit the SHELL line at the top of packages/foundry/Makefile.",
    );
  } else {
    const out = run("sh", ["-c", "echo ok"]);
    check("POSIX sh", out === "ok", out === "ok" ? "available" : "not found", "Install a POSIX shell (should already be present on macOS/Linux).");
  }
}

// --- git ---
{
  const out = run("git", ["--version"]);
  check("git", out !== null, out ?? "git not found on PATH", "Install Git: https://git-scm.com");
}

// --- Report ---
console.log("\n🩺 Hackathon factory doctor\n");
let failed = false;
for (const r of results) {
  const icon = r.ok ? "✅" : "❌";
  console.log(`${icon} ${r.name.padEnd(28)} ${r.detail}`);
  if (!r.ok) {
    failed = true;
    console.log(`   → ${r.fix}\n`);
  }
}

console.log("");
if (failed) {
  console.log("❌ Environment is not ready — fix the items above and re-run `yarn doctor`.\n");
  process.exit(1);
} else {
  console.log("✅ Environment looks good. Try `yarn dev:all`.\n");
}
