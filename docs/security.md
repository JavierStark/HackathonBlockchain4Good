# Security

## Secrets

- Never committed. `.gitignore` (root + per-package) excludes `.env*`,
  `*.key`, `keystore*`. `.env.example` files (root index + per-package) list
  every variable by name with a safe placeholder or blank — never a real
  value.
- Local dev never needs a real private key (Anvil's well-known test accounts
  cover it — see `docs/deployment.md`).
- **The deployer key is stored in cleartext** in the gitignored
  `packages/foundry/.env` (`DEPLOYER_PRIVATE_KEY`), not in an encrypted
  keystore. This is a deliberate trade-off for a hackathon repo where the
  deployer is a throwaway testnet account — the encrypted-keystore path
  needs an interactive password prompt that proved unreliable on Windows and
  cannot be covered by CI (full reasoning in
  `docs/development.md#windows-notes`). **Never put a key holding real funds
  in `.env`.** For real-money deployments use a hardware wallet
  (`forge script --ledger`), not either of these paths.
- CI secrets live in GitHub repo/environment settings only, injected as
  environment variables into workflow steps, never echoed. If you need to
  confirm a secret resolved correctly, derive something safe from it (e.g.
  `cast wallet address --private-key "$KEY"` prints the *address*, never the
  key) — don't print the secret itself, even for debugging.

## Contract security

Every contract change goes through
`.claude/skills/evm-security-review/SKILL.md`'s checklist before being called
done: reentrancy, access control, unsafe external calls, integer/boundary
issues, front-running/MEV exposure, initialization/upgrade risk, signature
replay, ERC-standard compliance. This is enforced by convention (the skill,
`AGENTS.md`'s Golden Rules, the PR template checklist), not by an automated
gate — automated tools below catch a subset of these; the checklist is the
actual review.

## Automated security checks (CI)

`.github/workflows/ci.yml`'s `security` job:

- **Gitleaks** (secret scanning) — `continue-on-error: true`.
- **Slither** (Solidity static analysis) — via `packages/foundry/slither.config.json`,
  which excludes `lib/` (vendored OpenZeppelin/forge-std/solidity-bytes-utils)
  and informational/optimization-only findings, keeping signal on real
  correctness/security findings. Run with `|| true` (annotates, doesn't fail
  the job).
- **`yarn npm audit --severity high`** — dependency vulnerability scan,
  `|| true`.

**Why non-blocking:** false positives on generated code, vendored
dependencies, and low-severity transitive advisories are common enough that a
hard-blocking check here tends to get bypassed or ignored over time (the
classic "red X nobody looks at anymore" failure mode), which defeats the
point more than a non-blocking annotation does. If you tighten any of these
to blocking, tune it for this repo first (allowlist known-safe findings) so
the block is trustworthy, not noisy.

> **Known limitation:** Slither was configured and wired into CI during setup
> but could not be fully exercised locally on the Windows/Python 3.14
> development machine used to build this repo — a transitive dependency
> (`ckzg`, a C extension) has no prebuilt wheel for that specific
> Python-version/OS combination yet. It installs from a standard prebuilt
> wheel on GitHub's `ubuntu-latest` runners (Python 3.11/3.12), which is what
> CI actually uses — but verify the `security` job's first real run rather
> than assuming based on this note.

## CI security posture

- `permissions: contents: read` at the top of every workflow — nothing needs
  write access except `deploy-frontend.yml`'s PR-comment step
  (`pull-requests: write`, scoped narrowly) and `pages.yml`'s Pages deploy
  (`pages: write`, `id-token: write`, both required by
  `actions/deploy-pages`).
- Third-party actions are pinned to major-version tags
  (`actions/checkout@v4`, `foundry-rs/foundry-toolchain@v1`,
  `gitleaks/gitleaks-action@v2`, etc.), not commit SHAs — a deliberate
  readability/maintainability tradeoff over the marginal extra protection of
  SHA-pinning every action. If a specific action's supply-chain risk concerns
  you more than usual (a small/unknown publisher), pin that one to a commit
  SHA specifically.
- Production contract deploys require a GitHub Environment approval
  (`deploy-contracts.yml`, `network: production`) — never automatic on merge.
- Recommended branch protection on `main` (manual GitHub setting, cannot be
  automated from here): require `ci.yml` to pass before merge.

## Reporting a vulnerability

This is a hackathon project — for now, open an issue or contact the
maintainer directly for anything sensitive rather than a public issue.
