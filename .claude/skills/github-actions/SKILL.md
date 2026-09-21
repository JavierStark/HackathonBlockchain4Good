---
name: github-actions
description: Use when adding to or modifying this repo's CI/CD workflows in .github/workflows/ — what each workflow does, how they're gated, and how to extend them without breaking the security/reliability properties they're built around.
---

# GitHub Actions (this repo's CI/CD)

## What exists

- **`ci.yml`** — runs on every push to `main` and every PR. Four jobs:
  `contracts` (forge fmt/build/test/coverage), `frontend` (lint/typecheck/
  build), `security` (gitleaks, Slither, `yarn npm audit` — all
  non-blocking, see below), `e2e` (Playwright smoke suite, needs `contracts`
  + `frontend`). `permissions: contents: read` at the top level; nothing in
  here needs write access.
- **`deploy-contracts.yml`** — `workflow_dispatch` only, never runs on push
  or merge. Requires picking a network; `network: production` maps to the
  `production` GitHub Environment (needs that Environment's required
  reviewers configured — see `docs/deployment.md` for the one-time repo
  setting this can't do itself).
- **`deploy-frontend.yml`** — Vercel preview on PRs, production on push to
  `main`. Skips cleanly (not a failure) if Vercel secrets aren't configured.
- **`pages.yml`** — optional GitHub Pages fallback, manual dispatch only. Do
  not make this run automatically alongside `deploy-frontend.yml` — pick one
  frontend-deploy path.

## Extending CI

- New contract check → add a step to the `contracts` job, after `forge test`.
- New frontend check → add a step to the `frontend` job, after
  `next:check-types`.
- A genuinely new pipeline stage (not a step within an existing job) → new
  job, with explicit `needs:` if it depends on another job's output, and its
  own `timeout-minutes` (every existing job has one — don't add an
  unbounded one).

## Security job is non-blocking on purpose

Gitleaks and `yarn npm audit` use `continue-on-error: true` / `|| true`
respectively (see `docs/security.md` for the full reasoning): false positives
on generated/vendored code are common enough that a hard-failing check here
gets ignored over time, which defeats the point. If you tighten this to
blocking, be deliberate about it and make sure the specific tool has been
tuned for this repo first (allowlists, etc.) — don't just remove
`continue-on-error` and hope.

## Secrets this repo's workflows expect

See `.env.example`'s CI section and `docs/deployment.md` for the full list
(`DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `BASESCAN_API_KEY`,
`POLYGONSCAN_API_KEY`, `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`).
Never echo a secret in a workflow step (`run: echo ${{ secrets.X }}` is
exactly what not to do) — GitHub masks known secret values in logs, but don't
rely on that as your only protection; avoid printing them at all, including
indirectly (e.g. via a command's own verbose/debug output).

## Actions are pinned to major-version tags

(`actions/checkout@v4`, `foundry-rs/foundry-toolchain@v1`, etc.), not commit
SHAs — a deliberate tradeoff for readability/maintainability over the
marginal extra security of SHA-pinning every action; see `docs/security.md`.
If you add a third-party (non-`actions/`, non well-known publisher) action,
consider pinning that one to a commit SHA specifically.

## Caching

`actions/setup-node`'s `cache: yarn` handles the yarn cache automatically
(keyed off `yarn.lock`). `foundry-rs/foundry-toolchain` caches the Foundry
binaries by version. Don't add a manual `actions/cache` step for either
unless you've confirmed the built-in caching isn't sufficient — it usually is.
