# Agent task template

Use this for any non-trivial change (more than a one-line fix). Copy the
headings, fill in what applies, skip what doesn't with a one-line "N/A —
why".

## Goal

<!-- One sentence: what this change accomplishes. -->

## User story

<!-- "As a <who>, I can <what>, so that <why>." -->

## Acceptance criteria

<!-- Testable statements. "It works" is not one; "a user who hasn't connected
a wallet sees a Connect Wallet prompt on the /claim page" is. -->

## Contract changes

<!-- New/modified contracts, new deploy script, interface changes. If none,
say "None". If this changes an existing contract's public interface, list
every frontend consumer found via grep. -->

## Frontend changes

<!-- New/modified components, hooks, pages. -->

## Tests

<!-- What Foundry tests (happy path/access control/revert/events/fuzz/
invariant — see .claude/skills/testing/SKILL.md) and/or e2e coverage this adds
or updates. -->

## Security considerations

<!-- Run through .claude/skills/evm-security-review/SKILL.md if this touches
a contract. State explicitly which items applied and how they were handled. -->

## Deployment impact

<!-- None / requires a new testnet deploy / requires re-verification /
changes an env var. -->

## Documentation

<!-- Does this change a command, a network, an env var, or the architecture?
If so, AGENTS.md and/or the relevant docs/*.md need updating as part of this
change, not as a follow-up. -->

## Validation commands

```bash
yarn check       # always
yarn test:all    # if this touches a contract or a user-facing flow
```

<!-- List any additional manual verification performed (e.g. "ran yarn dev:all,
clicked through the claim flow with a local Anvil account"). -->
