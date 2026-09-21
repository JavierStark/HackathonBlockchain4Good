---
name: hackathon-execution
description: Use for prioritization and demo-prep decisions during the hackathon — what to build first, when to seed demo data, and the final submission checklist. Read this when the user asks "what should I work on next" or "get this ready to demo".
---

# Hackathon execution

## Priority order (when in doubt, work top-down)

1. **A working end-to-end path** — one contract, one frontend flow, deployed
   locally, demoable. This repo's stock `YourContract` + `/debug` page *is*
   that proof for the wiring; replace it with the real idea's minimal version
   first, before adding a second feature.
2. **Tests for what exists** — not exhaustive, but enough that a refactor
   doesn't silently break the demo path (`.claude/skills/testing/SKILL.md`).
3. **Testnet deployment** — get it off localhost early, not the night before
   the demo. `yarn deploy --network baseSepolia` once the core flow works
   locally.
4. **Polish the demo flow specifically** — the exact screens/clicks the demo
   will walk through. Don't polish screens nobody will see during judging.
5. **Everything else** — additional features, edge cases, broader test
   coverage — in whatever time is left.

Do not reorder this to build infrastructure the product doesn't need yet
(an indexer, a second contract, upgradeability) ahead of having one working
path — see `docs/on-chain-vs-off-chain.md` and
`.claude/skills/dapp-product-development/SKILL.md`.

## Demo prep

```bash
yarn demo:reset    # Fresh Anvil state + redeploy — run this right before demoing
yarn demo:seed      # Deterministic sample transactions (extend scripts/demo-seed.mjs
                     # for your actual contract once you replace the stock one)
```

Both use only Anvil's well-known local test accounts — never real funds, never
a real key. `demo:reset` uses Anvil's own `anvil_reset` RPC method (no process
restart needed), so it's safe to run repeatedly during rehearsal.

## Final submission checklist

- [ ] `yarn test:all` passes (contracts, frontend build, e2e smoke suite)
- [ ] Deployed to the target testnet, addresses recorded
      (`packages/foundry/deployments/<chainId>.json`) and verified
      (`docs/deployment.md`)
- [ ] `yarn check-addresses` passes — frontend definitely points at the
      testnet deployment being demoed, not a stale local one
- [ ] Frontend deployed (Vercel preview/production, or GitHub Pages) and
      reachable at a public URL
- [ ] `yarn demo:reset && yarn demo:seed` run against the deployment being
      demoed, if the demo benefits from non-empty starting state
- [ ] README's Quick Start actually works for someone who hasn't seen the
      project before (have a teammate try it if there's time)
- [ ] No secrets in the repo (`git log` and `git diff` checked, not just the
      current working tree)
- [ ] `docs/hackathon.md`'s troubleshooting section covers anything that bit
      the team during development, for whoever picks this up next
