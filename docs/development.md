# Development

## Tool versions (as built/tested)

| Tool | Version | Notes |
|---|---|---|
| Node | ≥ 20.18.3 (built/tested on 24.14.1) | `.nvmrc` pins `24` for CI/nvm |
| Yarn | 4.13.0 | via corepack, `packageManager` field in `package.json` |
| Foundry | ≥ 1.4.0 (built/tested on 1.8.3) | pinned in CI via `foundry-rs/foundry-toolchain`'s `version:` input |
| Solidity | 0.8.37 | pinned in `packages/foundry/foundry.toml`'s `solc` field |
| EVM version | cancun | pinned in `foundry.toml`, matches every configured network |
| OpenZeppelin Contracts | v5.7.0 | git submodule, pinned via `foundry.lock` |
| Next.js | 16.2.x | |
| Playwright | 1.63.x | Chromium only (`npx playwright install chromium`) |

Never use "latest" for anything in CI or a deploy script — bump versions
deliberately and re-verify.

## Install

```bash
corepack enable
yarn install
yarn doctor
```

`yarn doctor` (`scripts/doctor.mjs`) checks Node/Yarn/Foundry versions, `make`,
a POSIX shell (on Windows), and git — with an actionable fix for each failure.
Run it first whenever something breaks; it catches most environment issues
before they turn into a confusing downstream error.

## Windows notes

This repo runs natively on Windows (no WSL required) — Foundry ships native
`win32_amd64` binaries. Four fixes were required and are load-bearing; also
summarized in `AGENTS.md`:

1. **`packages/foundry/Makefile`'s `SHELL` override.** GNU Make on Windows has
   no POSIX `sh` on `PATH` by default and silently falls back to `cmd.exe`,
   which can't run the Makefile's `~`, `[ ]`, `if/fi` recipes. The Makefile
   pins `SHELL := C:/Program Files/Git/usr/bin/sh.exe` on Windows. If Git for
   Windows is installed somewhere else, override with
   `make SHELL=/path/to/sh.exe ...` or edit that line directly.
2. **`os.homedir()` instead of `process.env.HOME`.**
   `packages/foundry/scripts-js/{parseArgs,listKeystores,selectOrCreateKeystore}.js`
   look up `~/.foundry/keystores`. `HOME` is unset by default in PowerShell
   (only `USERPROFILE` is set), which crashed keystore lookup with a
   `TypeError` before this fix. `os.homedir()` works cross-platform.
3. **`verify`/`fork` take their network via a literal trailing argument, not
   a positional shell parameter.** The original
   `"verify": "make verify RPC_URL=${1:-localhost}"` pattern relies on
   `yarn workspace <pkg> <script> <arg>` forwarding `<arg>` as `$1` — this
   works on POSIX shells but **silently does not work on Windows** (confirmed
   empirically while building this repo: the extra arg is dropped, and the
   command always falls back to `localhost}` regardless of what you pass).
   The fix: defaults now live in the Makefile itself (`RPC_URL ?= localhost`,
   `FORK_URL ?= mainnet`), and `packages/foundry/package.json`'s scripts are
   just `"verify": "make verify"` / `"fork": "make fork"`. Yarn *does*
   reliably append extra CLI args as a literal trailing string (confirmed
   separately), so `yarn workspace @se-2/foundry verify RPC_URL=baseSepolia`
   works identically on every OS — it becomes `make verify RPC_URL=baseSepolia`,
   a plain Make command-line variable override, not a shell trick.
4. **Interactive password prompts need inherited stdin, not `execSync`'s
   default.** `yarn account` (`checkAccountBalance.js`) and
   `yarn account:reveal-pk` (`revealPK.js`) both called a password-protected
   `cast` command via plain `execSync(cmd)`. Node's `execSync` pipes stdin by
   default (not inherited from the parent terminal); confirmed a piped stdin
   just hangs rather than being read as buffered input by cast's password
   prompt at all. Symptom: the prompt appears, typing the password and
   pressing Enter visibly does nothing, a second Enter surfaces "incorrect
   password" — even with the right one. Fix:
   `execSync(cmd, { stdio: ["inherit", "pipe", "inherit"] })` — inherit
   stdin/stderr so the real prompt works, pipe only stdout to still capture
   the result. Not confirmed Windows-only (the same `execSync` default
   applies on macOS/Linux too), but that's where it was actually hit and
   fixed.

If you hit a new platform-specific issue, the pattern that found these four
was: run the exact command, don't assume; when something "should" work per
the docs but doesn't, test the specific mechanism in isolation (a throwaway
Makefile target, a `console.log` of the resolved value, a minimal
`spawnSync`/`execSync` repro) before trusting it.

## Why no frontend unit test framework by default

Deliberate, not an oversight. This repo ships Foundry tests (unit, fuzz,
invariant — thorough, since contract bugs are expensive) and one Playwright
e2e smoke suite (validates the actual integration: deploy → frontend read).
For a hackathon-speed MVP, that combination catches the failures that matter
most (a broken contract, a broken deploy→frontend wire) without the
maintenance overhead of a third test layer. Add Vitest
(`yarn workspace @se-2/nextjs add -D vitest`) if the frontend grows enough
component/hook-level logic to justify it.

## Local dev commands

See `AGENTS.md`'s Development Commands section for the full list. The two you
actually need most of the time: `yarn dev:all` (everything) and `yarn check`
(fast validation before committing).

## Repository-wide `.gitattributes`

`* text=auto eol=lf` normalizes line endings to LF in git regardless of
checkout OS — prevents `forge fmt --check`/prettier/eslint from flagging
line-ending-only diffs that differ between a Windows and non-Windows
contributor's checkout.
