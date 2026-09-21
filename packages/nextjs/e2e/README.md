# E2E smoke suite

Run with `yarn e2e` from the repo root (or `yarn workspace @se-2/nextjs e2e`).

**What "deterministic" means here:** every run starts from the same known
state — `global-setup.ts` boots a brand-new local Anvil chain (or reuses one
that's already running, e.g. from `yarn dev:all`) and deploys the stock
`YourContract` fresh. The suite never depends on a testnet, a real wallet, or
data left over from a previous run. `global-teardown.ts` stops the chain again
— but only if this run was the one that started it.

**What it checks** (see `smoke.spec.ts`):

1. The home page loads.
2. The wallet-connect UI is present.
3. The `/debug` page renders the deployed contract and successfully reads a
   `view` function's live value from chain — the one real end-to-end check:
   it only passes if Anvil is up, the contract is deployed, and the
   frontend's generated ABI/address match what's actually on-chain.

**Extending it:** once you replace the stock contract with your own, update
the assertions in `smoke.spec.ts` to match your contract's name and a read of
one of its `view` functions — keep the same shape (load page → assert
contract renders → assert a real value comes back from chain).

**CI:** `.github/workflows/ci.yml`'s `e2e` job runs this after `contracts` and
`frontend` both pass. Locally, `webServer.reuseExistingServer` in
`playwright.config.ts` means a `yarn dev:all` you already have running will be
reused instead of rebuilding.
