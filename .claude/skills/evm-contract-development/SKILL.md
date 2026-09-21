---
name: evm-contract-development
description: Use when writing or modifying Solidity contracts in packages/foundry/contracts/ — architecture, OpenZeppelin usage, access control, events/errors, gas awareness, and wiring a new contract into the deploy scripts and frontend.
---

# EVM contract development

## Before writing a contract

1. Read `AGENTS.md`'s Golden Rules and Architecture Rules sections.
2. Check `.claude/skills/dapp-product-development/SKILL.md` first if this is
   a new feature, not a fix — decide the minimum on-chain surface before
   writing Solidity.
3. Check `docs/on-chain-vs-off-chain.md` for what belongs in the contract at
   all vs. off-chain.
4. Look at `packages/foundry/contracts/YourContract.sol` for the project's
   existing style (custom errors vs. require strings, event naming, NatSpec
   density) and match it.

## Structure

- One contract per file in `packages/foundry/contracts/`.
- One deploy script per contract in `packages/foundry/script/`, named
  `Deploy<ContractName>.s.sol`, following the `DeployYourContract.s.sol`
  pattern: extend `ScaffoldETHDeploy`, use the `ScaffoldEthDeployerRunner`
  modifier (it funds the deployer on Anvil and exports the deployment).
  Register it in `packages/foundry/script/Deploy.s.sol`.
- `packages/foundry/foundry.toml` pins `solc = "0.8.37"` and
  `evm_version = "cancun"` — don't add a pragma that falls outside
  `>=0.8.0 <0.9.0` without checking this still resolves, and don't rely on an
  opcode newer than Cancun without updating `evm_version` (and checking every
  target network in `[rpc_endpoints]` actually supports it).

## OpenZeppelin

`lib/openzeppelin-contracts` is already installed as a submodule (pinned via
`foundry.lock`) and remapped (`packages/foundry/remappings.txt`:
`@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts`). Prefer OZ's
battle-tested implementations over hand-rolled versions for anything with a
standard pattern:

- Access control: `Ownable`, `AccessControl` (role-based) — don't hand-roll an
  `isOwner` modifier for anything beyond the stock example's trivial case.
- Tokens: `ERC20`, `ERC721`, `ERC1155` and their extensions
  (`ERC20Permit`, `ERC721Enumerable`, etc.) — check the installed source
  (`lib/openzeppelin-contracts/contracts/`) for the exact extension surface
  rather than assuming from memory; OZ's API shifts between major versions
  (this repo is pinned to OZ v5.7.0 — v5 moved off `Context._msgSender()`
  patterns and default-denies zero-address transfers differently than v4).
- Security primitives: `ReentrancyGuard`, `Pausable`.

If you're not sure an OZ contract does what you think, read the installed
source directly — don't guess from pre-trained knowledge of an older version.

## Events, errors, gas

- Emit an event for every state transition a frontend or indexer might care
  about (see `GreetingChange` in the stock contract for the shape: indexed
  actor, the new state, and any value involved).
- Use custom errors (`error InvalidChain();` + `revert InvalidChain();`) over
  `require(cond, "string")` for new code — cheaper and more structured. The
  stock contract's `require(msg.sender == owner, "Not the Owner")` predates
  this convention; match new code to custom errors, don't feel obligated to
  rewrite the old ones unless you're already touching that function.
- Avoid unbounded loops over growable arrays/mappings in anything callable —
  they're a DoS vector once the collection is large enough to exceed the
  block gas limit.
- Default to non-upgradeable, immutable contracts unless the product
  genuinely needs upgradeability (see `evm-security-review` for the
  proxy-risk checklist if it does) — upgradeability is a real complexity and
  attack-surface cost, not a free option.

## Wiring a new contract in

1. Write the contract + its deploy script.
2. Write tests (`.claude/skills/testing/SKILL.md`).
3. `forge fmt && forge build && forge test` from `packages/foundry/`.
4. `yarn deploy` from the repo root — this compiles, deploys to the local
   Anvil chain, regenerates `packages/nextjs/contracts/deployedContracts.ts`,
   and records `packages/foundry/deployments/31337.json`.
5. Confirm the frontend can read it: `yarn check-addresses`, then check
   `/debug` in the running app.
6. Run `.claude/skills/evm-security-review/SKILL.md`'s checklist before
   calling the contract done.
