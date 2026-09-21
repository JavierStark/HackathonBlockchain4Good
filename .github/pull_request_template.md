## What & why

<!-- One or two sentences: what changed, and why. Link an issue if there is one. -->

## Changes

<!-- Contract changes / Frontend changes / Scripts / Docs — whichever apply. -->

## Checklist

- [ ] Tests added/updated (`forge test` for contracts, `e2e/smoke.spec.ts` or a
      new spec for frontend behavior)
- [ ] `yarn check` passes locally (format, lint, typecheck, address drift)
- [ ] Contract security considered — see `.claude/skills/evm-security-review/`
      if this touches a `.sol` file (reentrancy, access control, unsafe
      external calls, etc.)
- [ ] Frontend tested locally (`yarn dev:all`, exercised the changed flow)
- [ ] No secrets committed (no private keys, API keys, or `.env*` files —
      `git diff` was checked before pushing)
- [ ] Deployment impact considered — does this change a deployed contract's
      interface? Does `packages/nextjs` depend on the old ABI anywhere?
- [ ] Gas impact considered for any changed/added contract function
- [ ] Documentation updated if this changes a command, a network, an env var,
      or the architecture (`AGENTS.md` / `docs/`)

## Deployment impact

<!-- None / Requires a new testnet deploy / Requires re-verification / etc. -->
