# AGENTS.md

This file provides guidance to coding agents working in this repository. It is
the canonical source — `CLAUDE.md`, `.cursor/rules/`, and
`.github/copilot-instructions.md` all point back here rather than duplicating
it. Read this file, `.claude/skills/hackathon-execution/SKILL.md`, and
`docs/architecture.md` before starting non-trivial work.

## Project Overview

An EVM hackathon starter built on [Scaffold-ETH 2](https://scaffoldeth.io)
(Foundry flavor) — a monorepo with a Solidity/Foundry contracts package and a
Next.js frontend, wired together so a deploy on any network automatically
updates what the frontend reads. It is **idea-agnostic on purpose**: the stock
`YourContract` example is the end-to-end wiring proof (deploy → ABI generation
→ frontend read → e2e test), not the product. Replace it with your actual
contract using `.claude/skills/dapp-product-development/SKILL.md`.

- **`packages/foundry`** — Solidity contracts, Forge tests, deploy scripts
  (`packages/foundry/script/`), account/keystore management
  (`packages/foundry/scripts-js/`)
- **`packages/nextjs`** — React frontend (Next.js App Router, RainbowKit,
  Wagmi, Viem, TypeScript, Tailwind + DaisyUI), Playwright e2e smoke tests in
  `packages/nextjs/e2e/`
- **`scripts/`** — cross-package automation (`doctor.mjs`, `dev-all.mjs`,
  `record-deployment.mjs`, `check-addresses.mjs`, `demo-reset.mjs`,
  `demo-seed.mjs`) — see `docs/development.md` for what each does
- **Networks**: localhost (Anvil) for iteration, Ethereum Sepolia + Base
  Sepolia as the primary hackathon testnets (configurable — see
  `packages/foundry/foundry.toml`'s `[rpc_endpoints]` and
  `packages/nextjs/scaffold.config.ts`'s `targetNetworks`), a `production`
  network resolved purely from `PRODUCTION_RPC_URL` once the team picks one
- **Deployment**: `yarn deploy` locally, `.github/workflows/deploy-contracts.yml`
  (manual dispatch, `production` gated behind a GitHub Environment approval)
  for testnet/production, Vercel (`.github/workflows/deploy-frontend.yml`) or
  GitHub Pages (`.github/workflows/pages.yml`, optional/manual — the app is a
  pure client-side dapp, confirmed static-export-compatible) for the frontend

This project runs on **Windows** as well as macOS/Linux. Four platform-specific
fixes are load-bearing — do not revert them without understanding why (see
`docs/development.md#windows-notes` for the full explanation of each):

1. `packages/foundry/Makefile` pins `SHELL` to Git for Windows' `sh.exe` on
   Windows — without it, Make silently falls back to `cmd.exe` and every
   recipe using `~`, `[ ]`, or `if/fi` breaks.
2. `packages/foundry/scripts-js/{parseArgs,listKeystores,selectOrCreateKeystore}.js`
   use `os.homedir()`, not `process.env.HOME` (unset by default in PowerShell).
3. `packages/foundry/package.json`'s `verify`/`fork` scripts take their target
   via a literal `RPC_URL=<network>` / `FORK_URL=<network>` argument (e.g.
   `yarn workspace @se-2/foundry verify RPC_URL=sepolia`), **not**
   `yarn verify --network sepolia` or a bare positional arg — `yarn workspace
   <pkg> <script> <arg>` does not forward `<arg>` as a shell positional
   parameter (`$1`) on Windows, so the old `${1:-default}` pattern silently
   ignored it and always fell back to localhost. Defaults now live in the
   Makefile itself (`RPC_URL ?= localhost`, `FORK_URL ?= mainnet`).
4. **Accounts use a private key in `.env`, not an encrypted keystore.**
   `yarn generate` / `yarn account:import` / `yarn account` all go through
   `packages/foundry/scripts-js/account.js`, which reads and writes
   `DEPLOYER_PRIVATE_KEY` in the gitignored `packages/foundry/.env`. The
   Makefile's `deploy` target picks that up and passes `--private-key` to
   forge. **Nothing prompts for a password anywhere on this path.**

   This replaced Foundry's encrypted-keystore flow as the default after it
   proved unreliable here: the keystore password prompt is an interactive
   hidden-input read routed through several layers (yarn shim → node → make
   → cast), it failed repeatedly on Windows with "incorrect password" even
   when the password was correct, and — the deciding factor — it cannot be
   driven non-interactively, so neither CI nor an agent can verify it. The
   `.env` path behaves identically on every OS and is fully testable.
   Keystores remain available via `yarn account:keystore*` for anyone who
   wants them, but they are not the documented default and not CI-covered.

   Trade-off, stated plainly: a cleartext key in a gitignored file is less
   safe than an encrypted keystore. That is acceptable **only** because this
   is a hackathon repo where the deployer is a throwaway testnet account.
   Never put a key with real funds in `.env` — see `docs/security.md`.

## Golden Rules

- **Never** expose, log, or commit a private key, API key, or `.env*` file.
  `DEPLOYER_PRIVATE_KEY` lives in the gitignored `packages/foundry/.env` and
  must never be echoed — the Makefile's deploy recipe is `@`-prefixed for
  exactly this reason.
- **Never** put a private key holding real funds in `.env`. The deployer is a
  throwaway testnet account (`yarn generate`); local dev doesn't even need
  that much — Anvil's well-known test accounts cover it.
- **Never** deploy to `production` (or run `deploy-contracts.yml` with
  `network: production`) without the user's explicit go-ahead — it requires a
  GitHub Environment approval for exactly this reason.
- **Never** silently change a deployed contract address. Addresses come from
  `yarn deploy` → `scripts/record-deployment.mjs` →
  `packages/foundry/deployments/<chainId>.json` and
  `packages/nextjs/contracts/deployedContracts.ts`. `yarn check-addresses`
  fails the build if these two ever disagree — never hand-edit either file.
- **Never** change a contract's public interface (function signature, event
  shape, custom error) without grepping `packages/nextjs` for every
  `useScaffoldReadContract`/`useScaffoldWriteContract`/`useScaffoldEventHistory`
  call that uses it.
- **Always** add or update Foundry tests for contract behavior you touch —
  happy path, access control, revert case, at minimum.
- **Always** run `yarn check` (format, lint, typecheck, address drift) before
  calling work done; run `yarn test:all` for anything touching contracts or a
  user-facing flow.
- **Always** read `git diff` before reporting a change as complete.
- **Never** make unrelated changes in the same commit/PR as a requested fix.
- **Never** delete existing functionality without explaining why in the PR/commit.

## Development Commands

```bash
yarn doctor              # Verify the toolchain is installed correctly
yarn dev:all             # One command: anvil + deploy + frontend (Ctrl-C stops all)

# Or run the pieces separately, each in its own terminal:
yarn chain                # Start local Anvil
yarn deploy                # Deploy to localhost + regenerate frontend ABIs
yarn start                 # Frontend dev server at http://localhost:3000

# Validation
yarn check                # Fast: format/lint check, typecheck, address drift
yarn test:all              # Full: forge test, next build, e2e smoke suite
yarn foundry:test           # Just the Solidity tests
yarn e2e                     # Just the Playwright smoke suite
yarn coverage                 # Solidity coverage report (forge coverage)

# Formatting/linting
yarn format                # forge fmt + prettier, both packages
yarn lint                  # forge fmt --check + eslint, both packages

# Accounts — TEST WALLETS ONLY, key lives in gitignored packages/foundry/.env
yarn generate                        # New random deployer account -> .env
yarn account:import 0x<key>           # Bring your own test key -> .env
yarn account                           # Show deployer address + balances

# Deploy to a live network (see docs/deployment.md for the full walkthrough)
yarn deploy --network baseSepolia
yarn workspace @se-2/foundry verify RPC_URL=baseSepolia   # see Golden Rules note above on arg syntax

# Demo prep (local Anvil only — never touches real funds)
yarn demo:reset              # Fresh chain state + redeploy
yarn demo:seed                # Deterministic sample transactions
```

## Architecture Rules — where new code goes

- **Contracts**: `packages/foundry/contracts/`. One deploy script per contract
  in `packages/foundry/script/` (pattern: `DeployYourContract.s.sol`), wired
  into `packages/foundry/script/Deploy.s.sol`.
- **Contract tests**: `packages/foundry/test/`, mirroring the contract name
  (`YourContract.t.sol` for unit/fuzz, `YourContract.invariant.t.sol` for
  invariants — see that file for the handler-contract pattern used here).
- **Frontend contract interaction**: always through the hooks in
  `packages/nextjs/hooks/scaffold-eth` —
  `useScaffoldReadContract`/`useScaffoldWriteContract` (not the old
  `useScaffoldContractRead`/`useScaffoldContractWrite` names),
  `useScaffoldEventHistory`, `useScaffoldWatchContractEvent`,
  `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor`. Contract
  data comes from `packages/nextjs/contracts/deployedContracts.ts`
  (auto-generated — never hand-edit) and `externalContracts.ts` (manually
  added external/third-party contracts).
- **UI components**: use `@scaffold-ui/components` (`Address`, `AddressInput`,
  `Balance`, `EtherInput`, `IntegerInput`) and DaisyUI classes over raw
  Tailwind when a DaisyUI component exists.
- **On-chain vs. off-chain**: before adding a feature, classify its data — see
  `docs/on-chain-vs-off-chain.md`. Don't put UI preferences, large metadata, or
  anything not requiring blockchain guarantees on-chain.
- **New scripts** (deploy automation, demo tooling): `scripts/`, zero
  dependencies beyond Node's stdlib where practical — see the existing ones
  for the pattern (cross-platform via `scripts/lib/cross-exec.mjs`, never
  `shell: true` + an args array — that's Node's DEP0190 footgun).

## Testing Rules

- **Solidity**: every meaningful contract needs happy-path, access-control,
  invalid-input, revert, and event-emission tests at minimum (see
  `YourContract.t.sol` for the shape). Add a fuzz test
  (`testFuzz_...(uint256 x)` + `bound()`, not blind `vm.assume` rejection) for
  any function with numeric/address inputs worth exploring. Add an invariant
  test (`test/*.invariant.t.sol`) when a contract has a property that must
  hold across arbitrary call sequences (see the handler-contract pattern in
  `YourContract.invariant.t.sol`).
- **Frontend**: no unit test framework is wired up by default (deliberate —
  see `docs/development.md` for why). Add Vitest if you need it.
- **E2E**: `packages/nextjs/e2e/smoke.spec.ts`, run via `yarn e2e`. Read
  `packages/nextjs/e2e/README.md` before touching this — the deploy → build →
  serve ordering in `global-setup.ts` is load-bearing (Next.js bakes
  `deployedContracts.ts` into the build statically; building before the
  deploy finishes serves a stale contract address).
- **Security**: for any contract change, work through
  `.claude/skills/evm-security-review/SKILL.md`'s checklist before calling it
  done — reentrancy, access control, unsafe external calls, integer
  edge-cases, front-running/MEV exposure, initialization/upgrade risks if
  applicable.

## Deployment Rules

- **Local**: `yarn deploy` (defaults to `localhost`). No real key ever
  required — see Golden Rules.
- **Testnet**: `yarn deploy --network baseSepolia` (or `sepolia`, or any
  network in `foundry.toml`'s `[rpc_endpoints]`). Prefer running this from
  `.github/workflows/deploy-contracts.yml` (`workflow_dispatch`) once secrets
  are configured, so the deployment manifest and verification run
  consistently — but running it locally is fine too.
- **Production**: only via `deploy-contracts.yml` with `network: production`,
  which requires the `production` GitHub Environment's approval gate. Never
  suggest or perform a production deploy without the user explicitly asking
  for it by name.
- **After any live deploy**: confirm `packages/foundry/deployments/<chainId>.json`
  and `packages/nextjs/contracts/deployedContracts.ts` were regenerated
  together (they always are, via `yarn deploy` → `make deploy-and-generate-abis`
  → `record-deployment`) and that `yarn check-addresses` passes.

## Agent Workflow

```
PLAN → INSPECT → IMPLEMENT → TEST → FORMAT → LINT → BUILD → REVIEW DIFF → REPORT
```

Never skip validation because a change "looks small" — `yarn check` takes
under a minute and catches format/lint/type/address-drift issues before they
become a confusing failure three steps later. Use
`docs/agent-task-template.md` for anything beyond a one-line fix.

## Frontend Contract Interaction

#### Reading Contract Data

```typescript
const { data: totalCounter } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "userGreetingCounter",
  args: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
});
```

#### Writing to Contracts

```typescript
const { writeContractAsync, isPending } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: [newGreeting],
  value: parseEther("0.01"), // for payable functions
});
```

#### Reading Events

```typescript
const { data: events, isLoading } = useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "GreetingChange",
  watch: true,
  fromBlock: 31231n,
  blockData: true,
});
```

### Notifications & Error Handling

Use `notification` from `~~/utils/scaffold-eth` for success/error/warning
feedback and `getParsedError` for readable error messages.

### Configuring networks

- **Foundry**: add an entry to `packages/foundry/foundry.toml`'s
  `[rpc_endpoints]` (and `[etherscan]` if it needs verification).
- **Next.js**: add the chain to `packages/nextjs/scaffold.config.ts`'s
  `targetNetworks` array — the network selector, RPC, and burner-wallet
  visibility all derive from this array; nothing is hardcoded elsewhere.
  Decrease `pollingInterval` for L2s.

## Code Style Guide

### Identifiers

| Style            | Category                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX / JSXElement type parameter |
| `lowerCamelCase` | variable / parameter / function / property / module alias                                                              |
| `CONSTANT_CASE`  | constant / enum / global variables                                                                                     |
| `snake_case`     | for foundry script files                                                                                                |

### Import Paths

Use the `~~` path alias for imports in the nextjs package:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
```

### TypeScript Conventions

- Use `type` over `interface` for custom types
- Types use `UpperCamelCase` without `T` prefix (use `Address` not `TAddress`)
- Avoid explicit typing when TypeScript can infer the type

### Comments

Make comments that add information. Avoid redundant JSDoc for simple functions.

## Documentation

Use **Context7 MCP** tools to fetch up-to-date documentation for any library
(Wagmi, Viem, RainbowKit, DaisyUI, Foundry, Next.js, etc.) — it's configured
as an MCP server (`.mcp.json`). Prefer retrieval-led reasoning over
pre-trained knowledge for fast-moving libraries.

## Skills & Agents Index

Before starting a task that matches an entry below, read the referenced file
for version-accurate patterns — don't rely on pre-trained knowledge for
fast-moving libraries.

**Core workflow skills** (`.claude/skills/<name>/SKILL.md`):

- **evm-contract-development** — Solidity architecture, OpenZeppelin usage,
  access control, custom errors, gas awareness, deploy scripts
- **evm-security-review** — mandatory pre-"done" checklist for any contract
  change: reentrancy, access control, signature replay, unsafe external
  calls, integer edge cases, front-running/MEV, upgrade/initialization risk
- **frontend-web3** — Wagmi/Viem/RainbowKit patterns, transaction lifecycle,
  wallet/chain-switching UX
- **dapp-product-development** — turning an idea into an MVP: minimum viable
  contract surface, on-chain/off-chain split, user journeys
- **testing** — Foundry unit/fuzz/invariant tests, Playwright e2e
- **deployment** — local → testnet → production, verification, rollback
- **github-actions** — this repo's CI/CD workflows, how to extend them safely
- **hackathon-execution** — demo velocity, MVP prioritization, submission
  checklist

**Third-party/feature skills** (`.agents/skills/<name>/SKILL.md` — ship with
create-eth, read when the entry matches what you're building):

- **openzeppelin** — OpenZeppelin Contracts integration, pattern discovery
  from installed source
- **erc-721** — NFT-specific pitfalls (`_safeMint` reentrancy, on-chain SVG
  stack-too-deep, metadata `attributes`, IPFS base URI)
- **eip-5792** — batch transactions, `wallet_sendCalls`, paymaster, ERC-7677
- **ponder** — blockchain event indexing, GraphQL APIs (only add if the MVP
  actually needs historical/complex queries — see `docs/on-chain-vs-off-chain.md`)
- **siwe** — Sign-In with Ethereum, wallet authentication, EIP-4361
- **x402** — HTTP 402 payment-gated routes, micropayments
- **drizzle-neon** — Drizzle ORM, Neon Postgres, off-chain storage
- **subgraph** — The Graph subgraph integration

**Agents** (`.agents/agents/`, `.claude/agents/`):

- **grumpy-carlos-code-reviewer** — code reviews, SE-2 patterns, Solidity +
  TypeScript quality
