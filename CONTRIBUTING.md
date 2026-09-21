# Contributing

This is a hackathon project built on [Scaffold-ETH 2](https://scaffoldeth.io) —
this guide covers contributing to *this* repo, not upstream SE-2.

## Getting started

See the [README](README.md) for setup, or `docs/hackathon.md` for a 5-minute
quick start. Run `yarn doctor` first if anything doesn't work.

## Git workflow

- `main` is always demo-ready. Don't push broken code to it.
- Branch off `main` with a prefix that says what the change is:
  - `feat/...` — new functionality
  - `fix/...` — bug fix
  - `chore/...` — tooling, deps, config
  - `docs/...` — documentation only
- Open a PR against `main`. CI (`.github/workflows/ci.yml`) must pass before
  merging.
- Keep commits small and use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `security:`.

## Before opening a PR

Run the fast pre-commit check (also runs automatically via husky on commit):

```bash
yarn check
```

For anything touching contracts or a user-facing flow, run the full suite:

```bash
yarn test:all
```

Then fill out the PR template's checklist honestly — it exists to catch the
things that are easy to forget (secrets, gas impact, interface changes that
break the frontend), not to be a formality.

## Where things live

See [`AGENTS.md`](AGENTS.md) for the full architecture map, golden rules, and
the agent workflow this repo is built around (it applies to human contributors
too). The short version:

- Contracts: `packages/foundry/contracts/`, tests in `packages/foundry/test/`
- Frontend: `packages/nextjs/`, e2e smoke tests in `packages/nextjs/e2e/`
- Deployment scripts: `scripts/`
- Specialized guidance: `.claude/skills/` (contract dev, security review,
  frontend web3, testing, deployment, CI, product/hackathon execution)

## Reporting bugs / requesting features

Use the issue templates. Give enough context to reproduce (or to understand
the feature) without back-and-forth — see the template for what that means in
practice.
