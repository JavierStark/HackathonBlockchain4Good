---
name: dapp-product-development
description: Use when turning a product idea into an MVP — deciding the minimum viable contract surface, what stays off-chain, user journeys, and acceptance criteria, before writing any code.
---

# Dapp product development

Use this before `evm-contract-development` when the task is "build a feature/
product", not "fix this bug". The goal is the smallest thing that's real and
demoable, not the smallest thing that's technically complete.

## 1. Classify every piece of data: on-chain or off-chain

See `docs/on-chain-vs-off-chain.md` for the full framework. Quick version:
on-chain only for what actually needs a blockchain's guarantees — ownership,
permissions, financial state, immutable proofs, settlement. Everything else
(large metadata, UI preferences, search/analytics, ephemeral state) stays in
the frontend or a simple off-chain store. Every unnecessary on-chain write
is gas cost and complexity with no product benefit — justify each one.

## 2. Find the minimum viable contract

For the idea as stated, write down:

- What must be enforced by the contract (nobody, including the team, can
  bypass it)?
- What could be enforced off-chain instead, with the contract only recording
  the outcome?

Prefer the smaller contract. A hackathon judge cares that the on-chain
guarantee is real and demonstrable, not that everything is on-chain.

## 3. User journey → acceptance criteria

Write the user journey as a short numbered list (connect wallet → do X → see
Y), then acceptance criteria as testable statements ("a user who has not
connected a wallet sees a Connect Wallet prompt, not a broken read"). Use
`docs/agent-task-template.md` for this if the feature is non-trivial.

## 4. Gas awareness at design time, not after

Before writing Solidity: does this design require a loop over user-supplied
data (DoS risk + gas cost that grows with usage)? Does it require multiple
transactions where one would do? Would batching or an off-chain
signature-then-on-chain-claim pattern avoid unnecessary writes? Decide this
before implementation, not as a later optimization pass.

## 5. Prototype screens

Sketch (in words or a rough component list) the 2-4 screens/states that make
the demo work: the happy path from "connect wallet" to "see the on-chain
result". Build only those first — polish and edge-case screens come after the
happy path is demoable end-to-end (`yarn dev:all` → click through it).

## 6. Hand off

Once the MVP scope is decided: `.claude/skills/evm-contract-development/SKILL.md`
for the contract, `.claude/skills/frontend-web3/SKILL.md` for the UI,
`.claude/skills/testing/SKILL.md` for coverage, then
`.claude/skills/hackathon-execution/SKILL.md` for demo prep once it's working
locally.
