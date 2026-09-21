# Deployment

## Local

```bash
yarn chain     # terminal 1
yarn deploy    # terminal 2 — defaults to localhost
yarn start     # terminal 3
```

Or all three at once: `yarn dev:all`. No real private key is ever needed —
the Makefile auto-imports Anvil's well-known throwaway test key
(`0x2a871d07...409c6`, Anvil's own documented default, not a secret) into a
local keystore named `scaffold-eth-default`.

## Testnet

1. **Get a deployer account.** Never reuse a real wallet's key.
   ```bash
   yarn generate           # generates a new keystore, prompts for a password
   # or
   yarn account:import     # imports an existing (testnet-only) private key
   yarn account             # shows the address + balance
   ```
2. **Fund it** from a faucet:
   - Sepolia: <https://sepoliafaucet.com> or <https://www.alchemy.com/faucets/ethereum-sepolia>
   - Base Sepolia: <https://www.alchemy.com/faucets/base-sepolia> or bridge Sepolia ETH at <https://bridge.base.org/deposit>
3. **Deploy:**
   ```bash
   yarn deploy --network baseSepolia
   # or: yarn deploy --network sepolia
   ```
   This compiles, deploys, regenerates `packages/nextjs/contracts/deployedContracts.ts`,
   and writes `packages/foundry/deployments/<chainId>.json`.
4. **Verify:**
   ```bash
   yarn workspace @se-2/foundry verify RPC_URL=baseSepolia
   ```
   Requires `BASESCAN_API_KEY` (Base) or `ETHERSCAN_API_KEY` (Sepolia/Optimism/
   Arbitrum, Etherscan's v2 API is multichain on one key) in
   `packages/foundry/.env`. Get a free key at <https://basescan.org/apis> or
   <https://etherscan.io/apis>.
5. **Confirm the frontend matches:**
   ```bash
   yarn check-addresses
   ```

### Via GitHub Actions instead

`.github/workflows/deploy-contracts.yml` (Actions tab → "Deploy Contracts" →
"Run workflow") does the same thing with a logged, repeatable process: pick
the network, it compiles + tests first, deploys, verifies, and publishes the
deployment manifest as a downloadable artifact + a step summary. Needs
`DEPLOYER_PRIVATE_KEY` (and the relevant `*_API_KEY`) set as repo secrets
first (Settings → Secrets and variables → Actions).

## Production

Only via `deploy-contracts.yml` with `network: production`. This requires:

1. `PRODUCTION_RPC_URL` set (repo secret) — until it is, any production
   deploy attempt fails fast rather than silently hitting a placeholder.
2. A `production` GitHub Environment (Settings → Environments → New
   environment → name it `production`) with **required reviewers**
   configured — the workflow's `environment: production` mapping means the
   run pauses for that approval before it can execute.

Never trigger this without the user explicitly asking for a production
deploy by name (see `AGENTS.md`'s Golden Rules).

## Frontend

### Vercel (recommended)

Simplest: connect the repo at [vercel.com/new](https://vercel.com/new)
(auto-deploys on every push, no secrets to manage in GitHub). Root directory:
`packages/nextjs`.

Or, for deploys gated behind this repo's CI: `.github/workflows/deploy-frontend.yml`
needs three repo secrets — `VERCEL_TOKEN` (vercel.com → Settings → Tokens),
`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (run `vercel link` once locally in
`packages/nextjs/`, then read them from the generated `.vercel/project.json`).
Without them, the workflow's `check-secrets` job skips the deploy cleanly
(not a failure) — pick one path (integration or workflow), not both.

### GitHub Pages (optional fallback)

Confirmed compatible: this app has no API routes, no server actions, no
server-only secrets — a pure client-side dapp, `output: "export"` builds
cleanly. Enable Pages (Settings → Pages → Source: GitHub Actions), then run
`.github/workflows/pages.yml` manually (Actions tab → "Deploy Frontend
(GitHub Pages, optional)" → "Run workflow"). Not wired to run automatically —
deliberately opt-in, since Vercel is the primary path.

## Recommended branch protection (manual GitHub settings — cannot be automated from here)

- **`main`**: require `ci.yml`'s checks (all four jobs) to pass before
  merging; no direct pushes.
- **`production` Environment**: required reviewers, as above.
- **`preview`** (Vercel): no extra settings needed — Vercel scopes preview
  deploys per-PR automatically.

## Rollback

There is no automated contract rollback — a deployed contract is immutable.
"Rolling back" means deploying a corrected version and letting the generated
files (`deployedContracts.ts`, `deployments/<chainId>.json`) update to point
at it. If the MVP needs an emergency stop for a live contract, that has to be
a feature of the contract itself (pause, owner-only emergency withdraw) — see
`.claude/skills/evm-security-review/SKILL.md`.
