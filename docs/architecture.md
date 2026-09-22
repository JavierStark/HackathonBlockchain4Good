# Architecture

## Monorepo layout

```
/
├── .github/workflows/     CI, contract deploy, frontend deploy, Pages fallback
├── .claude/skills/        This factory's core agent skills (canonical)
├── .agents/skills/        create-eth's third-party/feature skills
├── docs/                  This directory
├── scripts/               Cross-package automation (Node, zero-dep where practical)
├── packages/
│   ├── foundry/           Solidity contracts, tests, deploy scripts
│   └── nextjs/             Next.js frontend
├── AGENTS.md              Canonical agent guidance (read this first)
└── package.json           Yarn workspaces root
```

Yarn 4 workspaces (`packages/*`) tie `packages/foundry` and `packages/nextjs`
together under one `yarn install`, one lockfile, shared root scripts.

## Contract package (`packages/foundry`)

- **`contracts/`** — Solidity source.
- **`test/`** — Foundry tests (`.t.sol` unit/fuzz, `.invariant.t.sol` invariant).
- **`script/`** — deploy scripts. `DeployHelpers.s.sol` provides
  `ScaffoldETHDeploy` (base class every deploy script extends) and the
  `ScaffoldEthDeployerRunner` modifier, which: funds the deployer on Anvil,
  broadcasts the deployment, and calls `exportDeployments()` to write
  `deployments/<chainId>.json`. `Deploy.s.sol` is the entrypoint that runs
  every per-contract deploy script (`DeployYourContract.s.sol`, etc.) in
  sequence. `VerifyAll.s.sol` handles explorer verification.
- **`scripts-js/`** — Node helpers invoked by `package.json` scripts:
  - `account.js` — **the account path this repo actually uses**:
    `yarn generate` / `yarn account:import 0x<key>` / `yarn account`, all
    backed by `DEPLOYER_PRIVATE_KEY` in the gitignored `.env`. No password
    prompt; fully scriptable. See `docs/development.md#windows-notes` for why
    this replaced keystores as the default, and the trade-off it carries.
  - `parseArgs.js` — the deploy CLI's argument parsing (resolves
    `--network`/`--file`/`--keystore`, then shells out to
    `make deploy-and-generate-abis`). Short-circuits the keystore flow
    entirely when `DEPLOYER_PRIVATE_KEY` is set.
  - `generateKeystore.js`, `importAccount.js`, `selectOrCreateKeystore.js`,
    `listKeystores.js`, `revealPK.js`, `checkAccountBalance.js` — the
    optional encrypted-keystore path (`yarn account:keystore*`). Kept
    working, but not the default and not CI-covered.
- **`Makefile`** — the actual command runner underneath most `yarn` scripts
  here (`chain`, `deploy`, `verify`, `format`, `lint`, `compile`, `flatten`).
  Pinned to Git for Windows' `sh.exe` on Windows — see
  `docs/development.md#windows-notes`.
- **`foundry.toml`** — pinned `solc = "0.8.37"`, `evm_version = "cancun"`,
  `[rpc_endpoints]` (localhost/sepolia/baseSepolia + more, `production`
  resolved from `PRODUCTION_RPC_URL`), `[etherscan]` (verification keys per
  network), `[fuzz]`/`[invariant]` run counts.
- **`lib/`** — git submodules: `forge-std`, `openzeppelin-contracts` (v5.7.0),
  `solidity-bytes-utils`, version-pinned via `foundry.lock`.

## Frontend package (`packages/nextjs`)

- **`app/`** — Next.js App Router pages: home (`page.tsx`), `/debug`
  (contract interaction UI, from `@scaffold-ui/debug-contracts`),
  `/blockexplorer` (local block explorer for the Anvil chain).
- **`contracts/deployedContracts.ts`** — **auto-generated** by
  `scripts-js/generateTsAbis.js` from `packages/foundry/broadcast/**/run-*.json`
  after every `yarn deploy`. Statically imported — this is why a build must
  never start before a deploy finishes (see `packages/nextjs/e2e/README.md`).
  `contracts/externalContracts.ts` is for contracts this repo doesn't deploy
  (manually maintained).
- **`hooks/scaffold-eth/`** — `useScaffoldReadContract`,
  `useScaffoldWriteContract`, `useScaffoldEventHistory`, etc. — the only
  supported way to talk to contracts from the frontend (see `AGENTS.md`).
- **`scaffold.config.ts`** — single source of truth for `targetNetworks`
  (which chains the app supports), polling interval, RPC overrides, burner
  wallet visibility.
- **`e2e/`** — Playwright smoke suite; see its own README for the
  deploy→build→serve ordering constraint.

## The deploy → frontend pipeline

```
yarn deploy
  → forge script (compiles, broadcasts to the target network)
  → broadcast/**/run-latest.json written (tx hashes, addresses, receipts)
  → generateTsAbis.js reads broadcast/, writes deployedContracts.ts
  → record-deployment.mjs reads the same broadcast data, writes/enriches
    deployments/<chainId>.json (address, tx hash, block, deployer, git commit,
    verified flag)
```

Both generated files come from the same broadcast data — `yarn check-addresses`
(`scripts/check-addresses.mjs`) verifies they still agree, catching any
accidental hand-edit or stale regeneration.

## Deployment architecture

- **Local**: Anvil, no real key, `yarn deploy`.
- **Testnet**: any network in `foundry.toml`'s `[rpc_endpoints]` — Base
  Sepolia is the hackathon default, Ethereum Sepolia alongside it, several
  more L2 testnets pre-configured. `.github/workflows/deploy-contracts.yml`
  (manual dispatch) runs the same deploy with a generated manifest + explorer
  verification.
- **Production**: same workflow, `network: production`, gated behind a
  GitHub Environment approval. The RPC URL is resolved purely from
  `PRODUCTION_RPC_URL` — nothing hardcoded, and the deploy fails fast if
  that's unset.

## CI/CD architecture

Four independent GitHub Actions workflows (see
`.claude/skills/github-actions/SKILL.md` for how to extend them):
`ci.yml` (verification, every push/PR), `deploy-contracts.yml` (manual,
gated), `deploy-frontend.yml` (Vercel, automatic), `pages.yml` (GitHub Pages,
manual, optional).

## Agent system

`AGENTS.md` is canonical; `CLAUDE.md`, `.cursor/rules/project.mdc`, and
`.github/copilot-instructions.md` are thin pointers to it (no duplicated
content). `.claude/skills/` holds this factory's own core-workflow skills;
`.agents/skills/` holds create-eth's third-party/feature skills (OpenZeppelin,
ERC-721, SIWE, etc.) — both are indexed from `AGENTS.md`.
