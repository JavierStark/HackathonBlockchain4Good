# On-chain vs. off-chain

For every feature, classify its data before writing a contract. Read this
before `.claude/skills/evm-contract-development/SKILL.md` for anything new.

## Put on-chain

- **Ownership** — of a token, an asset, a role.
- **Permissions** — access control that must be tamper-proof and independent
  of any single server (admin roles, allowlists that gate value transfer).
- **Financial state** — balances, escrow, anything representing real value.
- **Attestations / immutable proofs** — a claim that must be independently
  verifiable and can't be quietly altered after the fact.
- **Settlement** — the actual transfer of value or the final record of an
  agreement.
- **Hashes/proofs of off-chain data**, where you need to prove data existed
  at a point in time or wasn't tampered with, without storing the data itself
  on-chain (store the hash on-chain, the data off-chain).

## Keep off-chain

- **Large metadata** — descriptions, images, anything sizeable. Store on
  IPFS/a database, put a hash or URI on-chain if you need to bind it to an
  on-chain record.
- **UI preferences** — theme, layout, anything only the user's own client
  needs.
- **Ephemeral state** — draft data, in-progress form state, anything that
  doesn't need to survive or be publicly verifiable.
- **Search indexes / analytics** — computed from on-chain events, but the
  index itself doesn't need consensus guarantees.
- **Content that doesn't need blockchain guarantees** — if losing it or a
  server silently changing it wouldn't actually undermine the product's trust
  model, it doesn't need to be on-chain.

## Why this matters here

Every unnecessary on-chain write costs real gas and adds contract complexity
(more surface for `.claude/skills/evm-security-review/SKILL.md`'s checklist
to cover) with no product benefit. For a hackathon MVP, putting something
on-chain "because it's a blockchain app" — without a specific guarantee it
needs — is the most common way to burn time budget on infrastructure the
product doesn't need. See
`.claude/skills/dapp-product-development/SKILL.md` for applying this at
design time, before any Solidity gets written.

## Indexing

This repo doesn't ship an indexer (Ponder, a subgraph) by default — direct
contract reads via `useScaffoldReadContract`/`useScaffoldEventHistory` cover
most hackathon-scale needs (see `.claude/skills/frontend-web3/SKILL.md`).
Only reach for `.agents/skills/ponder/SKILL.md` or
`.agents/skills/subgraph/SKILL.md` if the product genuinely needs historical
or complex cross-event queries that direct reads can't reasonably serve —
adding an indexer is real infrastructure, not a default.
