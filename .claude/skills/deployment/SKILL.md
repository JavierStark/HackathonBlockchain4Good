---
name: deployment
description: Use when deploying contracts or the frontend to any network — local, testnet, or production. Covers environment variables, verification, deployment manifests, and rollback.
---

# Deployment

Full walkthrough with exact commands: `docs/deployment.md`. This is the
decision-making summary.

## Local (default, no real key ever)

`yarn deploy` deploys to Anvil using `LOCALHOST_KEYSTORE_ACCOUNT=scaffold-eth-default`
(Anvil's prefunded account #9, auto-imported by the Makefile's
`setup-anvil-wallet`). Never ask for or use a real private key here.

## Testnet

`yarn deploy --network baseSepolia` (or `sepolia`, or any network in
`packages/foundry/foundry.toml`'s `[rpc_endpoints]`). Needs a real (testnet-
only) `DEPLOYER_PRIVATE_KEY` via `yarn generate` or `yarn account:import` —
never a mainnet key. Requires the user's go-ahead before running against a
real network (even a testnet) unless they've already asked for it explicitly.

Verify: `yarn workspace @se-2/foundry verify RPC_URL=baseSepolia` — note the
argument syntax (`RPC_URL=<network>` as a literal trailing arg, not
`--network <network>` or a bare positional value) — see `AGENTS.md`'s Golden
Rules for why the other forms silently no-op on Windows.

## Production

**Only** via `.github/workflows/deploy-contracts.yml` with
`network: production`, which is gated behind the `production` GitHub
Environment's required-reviewer approval. Never run a production deploy
locally, and never trigger this workflow without the user explicitly asking
for a production deploy by name — this is the one Golden Rule in `AGENTS.md`
worth repeating twice.

## After any live deploy

1. `packages/foundry/deployments/<chainId>.json` and
   `packages/nextjs/contracts/deployedContracts.ts` are regenerated together
   automatically (`yarn deploy` → `make deploy-and-generate-abis` →
   `record-deployment`) — never hand-edit either.
2. `yarn check-addresses` — fails loudly if they ever disagree.
3. Confirm verification succeeded (or note that it didn't and why —
   `deploy-contracts.yml`'s verify step is `continue-on-error`, since a failed
   verification shouldn't undo a successful deploy, but it shouldn't go
   unnoticed either).

## Rollback

Contracts aren't mutable once deployed — "rollback" means deploying a new
version and updating what the frontend points at (redeploy → the generated
files above update automatically). There is no automated rollback for a live
contract; if a deployed contract has a critical bug, the immediate mitigation
is whatever the contract itself provides (a pause function, an owner-only
emergency withdraw) — which is exactly why `evm-security-review` asks whether
the MVP needs one.

## Frontend

Vercel (`.github/workflows/deploy-frontend.yml`, or Vercel's own Git
integration — pick one, not both) is the primary path: preview per PR,
production on push to `main`. GitHub Pages
(`.github/workflows/pages.yml`) is an optional manual-dispatch fallback,
confirmed compatible (this app has no API routes/server actions) — use it
only if you specifically want a free GitHub-hosted URL instead of Vercel.

## Secrets

Never printed, never committed. See `.env.example` (root) for the full list
and which environment needs which. CI secrets live in GitHub repo/environment
settings, not in any file in this repo.
