// Cross-platform process spawning for tools that are .CMD/.ps1 shims on
// Windows (yarn, corepack-managed binaries) rather than a real .exe —
// spawn()/execFileSync() can't invoke those directly without going through a
// shell.
//
// This needs `shell: true` together with an `args` array, which triggers
// Node's DEP0190 warning ("arguments are not escaped, only concatenated").
// We deliberately do NOT work around it by hand-building a quoted command
// string ourselves: a first attempt at that here manually quoted a path
// containing a space (process.execPath under "Program Files"), and Node's
// own argv -> Windows-command-line conversion re-escaped those
// manually-inserted quote characters, producing a broken command.
//
// IMPORTANT — confirmed empirically, corrects an earlier assumption in this
// file: Node's `shell: true` mode quotes each element of the `args` array
// safely, but does NOT quote the `cmd` string itself. So `cmd` must be a bare
// command name resolvable via PATH ("node", "yarn", "cast") — never an
// absolute path that might contain a space (e.g. never `process.execPath`,
// which resolves to something like "C:\Program Files\nodejs\node.exe" and
// breaks unquoted: cmd.exe reads it only up to the first space). Every
// caller in this repo already satisfies this (bare command names, fixed
// non-user-controlled args), so this is a documented constraint, not a gap.
//
// To suppress the DEP0190 noise: `process.on("warning", ...)` was tried
// first and dropped — DEP0190 surfaces as `warning.code`, not as a "DEP0190"
// substring in `warning.message`, and depending on exactly which
// child_process path triggers it, the warning can be emitted in a way that
// doesn't reliably go through a single listener's filter. `process.noDeprecation`
// is Node's own documented, built-in switch for this class of warning
// (equivalent to the `--no-deprecation` CLI flag) and needs no event-timing
// assumptions.
import { spawn, execFileSync } from "node:child_process";

const isWindows = process.platform === "win32";

if (isWindows) {
  process.noDeprecation = true;
}

/** Async, streaming (child_process.spawn) — for long-running or interactive-output commands. */
export function spawnCross(cmd, args, opts = {}) {
  if (isWindows) {
    return spawn(cmd, args, { ...opts, shell: true });
  }
  return spawn(cmd, args, opts);
}

/** Sync, buffered (child_process.execFileSync) — for short commands you wait on. */
export function execCross(cmd, args, opts = {}) {
  if (isWindows) {
    return execFileSync(cmd, args, { ...opts, shell: true });
  }
  return execFileSync(cmd, args, opts);
}
