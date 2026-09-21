---
name: testing
description: Use when writing or reviewing tests — Foundry unit/fuzz/invariant tests for contracts, and the Playwright e2e smoke suite for the frontend. Covers this project's specific patterns and commands.
---

# Testing

## Foundry (packages/foundry/test/)

Run: `yarn foundry:test` (root) or `forge test -vvv` (from
`packages/foundry/`). Coverage: `yarn coverage` (writes `lcov.info` — CI
uploads it as an artifact; read the summary table it prints, per-contract, not
just the aggregate — script/*.sol files are execution-tested by actual
deploys, not unit coverage, so they'll always show low % there).

For every contract, cover (see `YourContract.t.sol` for the shape):

- **Happy path** — the function does what it says.
- **Access control** — the right caller succeeds, the wrong caller reverts
  (`vm.expectRevert(bytes("exact revert string"))` or the custom error type).
- **Boundary/invalid input** — zero values, empty strings, max values where
  relevant.
- **Events** — `vm.expectEmit(checkTopic1, checkTopic2, checkTopic3, checkData)`
  then `emit EventName(...)` with expected args, then the call.
- **State transitions** — read state before and after, assert the delta, not
  just the final value (catches "always resets to X" bugs that a single
  post-state assertion misses).

**Fuzz tests** (`testFuzz_Name(uint256 x, address user)`): bound inputs with
`bound(x, min, max)` rather than rejecting with `vm.assume` — bounding keeps
the fuzzer's runs useful; heavy `vm.assume` rejection wastes most of them. See
`testFuzz_SetGreeting_CounterTracksNumberOfCalls` for the pattern.

**Invariant tests** (`test/*.invariant.t.sol`): use a handler contract (see
`YourContractHandler` in `YourContract.invariant.t.sol`) that the invariant
fuzzer calls through via `targetContract(address(handler))` — never target the
contract under test directly, or the fuzzer will use unbounded random actors
and you lose the ability to track ground truth via ghost variables. Write the
invariant as "this must hold no matter what sequence of calls happened", not
"this holds after one specific sequence".

`foundry.toml` sets `[fuzz] runs = 256` and `[invariant] runs = 128, depth =
64` — this project's defaults, not fixed limits; increase locally for a
suspicious edge case, but keep CI's numbers reasonable for run time.

## Frontend

No unit test framework (Vitest, etc.) is wired up by default — deliberate,
see `docs/development.md`. Add Vitest if you need component/hook-level unit
tests; the Playwright e2e suite below is what ships by default.

## E2E (packages/nextjs/e2e/)

Run: `yarn e2e` (root) or `yarn workspace @se-2/nextjs e2e`. Read
`packages/nextjs/e2e/README.md` first — it explains why `global-setup.ts`
must run anvil → deploy → build → serve in that exact order (Next.js bakes
`deployedContracts.ts` into the build statically; Playwright's own
`webServer` option starts before `globalSetup`, which is why this repo
doesn't use it and instead has `global-setup.ts` own the whole sequence).

When you add a real contract/feature, extend `smoke.spec.ts` to keep the same
shape: load the page → assert the contract/feature renders → assert a real
on-chain read comes back correctly. Keep it deterministic — no reliance on
external network state or wallet interaction (this suite runs disconnected;
it's a smoke test, not a full user-flow test).

## Before calling a change tested

`yarn check` (fast: format/lint/typecheck/address-drift) for any change.
`yarn test:all` (forge test + next build + e2e) for anything touching a
contract or a user-facing flow — not just the specific thing you changed,
since a contract interface change can silently break a frontend consumer that
your fix didn't touch.
