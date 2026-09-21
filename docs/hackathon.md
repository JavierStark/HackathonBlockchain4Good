# Hackathon workflow

## 5-minute setup

```bash
corepack enable
yarn install
yarn doctor        # confirms Node/Yarn/Foundry/make are all correctly set up
yarn dev:all        # anvil + deploy + frontend, one command
```

Open `http://localhost:3000`. Click "Debug Contracts" — you should see
`YourContract` with its `greeting` already reading `"Building Unstoppable
Apps!!!"` from the freshly deployed local contract. That confirms the whole
pipeline (Foundry → deploy → ABI generation → frontend) works.

If anything fails, `yarn doctor`'s output tells you what's missing and how to
fix it. If Foundry itself isn't installed yet, see `docs/development.md` for
the exact install steps (native Windows binaries, no WSL needed).

## 15-minute setup (through your first testnet deploy)

1. Do the 5-minute setup above.
2. `yarn generate` — creates a testnet deployer keystore (prompts for a
   password; **never** import a real/mainnet key here).
3. Fund it from a faucet — see `docs/deployment.md#testnet` for links.
4. `yarn deploy --network baseSepolia`
5. `yarn check-addresses` — confirms the frontend now points at the testnet
   deployment.
6. Restart `yarn start` (or `yarn dev:all`) and switch your wallet to Base
   Sepolia in the app — you're now looking at the real testnet contract.

## Local development

`yarn dev:all` for the default loop. `yarn check` before every commit (fast:
format, lint, typecheck, address drift — also runs automatically via husky's
pre-commit hook). `yarn test:all` before opening a PR or before a demo.

## Testnet deployment

See `docs/deployment.md#testnet` for the full walkthrough (deploy, verify,
confirm addresses match).

## Frontend deployment

See `docs/deployment.md#frontend` — Vercel is the fastest path
(connect the repo, done); a GitHub Pages fallback exists if you want a free
GitHub-hosted URL instead.

## Contract verification

`yarn workspace @se-2/foundry verify RPC_URL=<network>` — needs the matching
`*_API_KEY` in `packages/foundry/.env` (`BASESCAN_API_KEY` for Base,
`ETHERSCAN_API_KEY` for Sepolia/Optimism/Arbitrum). See `docs/deployment.md`.

## Environment variables

Full list with PUBLIC/SECRET labeling: `.env.example` (root — an index) and
the per-package `.env.example` files it points to
(`packages/foundry/.env.example`, `packages/nextjs/.env.example`).

## Troubleshooting

- **`yarn doctor` fails on Foundry/make/sh** — see `docs/development.md`'s
  Windows notes; each failure has a specific fix printed by the doctor script.
- **`yarn workspace @se-2/foundry verify sepolia` (bare arg) does nothing /
  always verifies localhost** — this is the known Windows arg-forwarding gap;
  use `yarn workspace @se-2/foundry verify RPC_URL=sepolia` instead (see
  `AGENTS.md`'s Golden Rules for why).
- **Frontend shows a stale contract address after deploying** — run
  `yarn check-addresses`; if it fails, re-run `yarn deploy` (it regenerates
  both `deployedContracts.ts` and `deployments/<chainId>.json` together, so
  they can't drift from a normal deploy — drift usually means one was
  hand-edited).
- **`yarn e2e` fails or hangs** — read `packages/nextjs/e2e/README.md`; the
  deploy → build → serve ordering is strict, and a cold build can take a few
  minutes (this is expected, not a hang — the suite's global timeout accounts
  for it).
- **Corepack `EPERM` enabling yarn on Windows** — use
  `corepack enable --install-directory <a folder you own>` and add that
  folder to your `PATH` ahead of any existing global yarn install; see
  `scripts/doctor.mjs`'s fix message for the exact command.

## Demo workflow

```bash
yarn demo:reset   # fresh local chain state + redeploy — run right before demoing
yarn demo:seed     # deterministic sample transactions, Anvil test accounts only
```

Never touches real funds or a real key — safe to run repeatedly during
rehearsal. See `.claude/skills/hackathon-execution/SKILL.md` for the full
demo-prep and priority-ordering guidance.

## Final submission checklist

See `.claude/skills/hackathon-execution/SKILL.md#final-submission-checklist`
for the complete list (tests passing, testnet deployment verified, addresses
matched, frontend live, README's quick start actually works, no secrets in
the repo).
