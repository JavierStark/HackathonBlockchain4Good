---
name: evm-security-review
description: Mandatory before calling any Solidity contract change "done" — a security checklist covering reentrancy, access control, unsafe external calls, integer/boundary issues, front-running/MEV, and upgrade risk. Produces a checklist the agent must complete, not skip.
---

# EVM security review

Run through every item below for any new or modified contract. This is not
optional polish — `AGENTS.md`'s Golden Rules require it before reporting
contract work as complete. For each item, either confirm it's not applicable
and say why, or confirm it's handled and how.

## Checklist

**Reentrancy**

- [ ] Every function that makes an external call (`.call{value: ...}`,
      transferring an ERC20/721, calling into an untrusted contract) follows
      checks-effects-interactions: state updated *before* the external call,
      not after. (See `YourContract.withdraw()` — balance is read at call
      time via `address(this).balance`, but note it has no reentrancy guard
      because it only sends to the immutable `owner`, not an arbitrary
      address; if you add a withdraw-to-arbitrary-address path, add
      `ReentrancyGuard` or checks-effects-interactions.)
- [ ] If a function both sends ETH/tokens externally and reads/writes state
      afterward, either reorder it or add OZ's `ReentrancyGuard`.

**Access control**

- [ ] Every state-changing function's intended caller set is enforced
      on-chain (modifier or explicit check), not just assumed from the
      frontend hiding a button.
- [ ] Privileged roles (owner, admin, minter) are set in the constructor or
      via a controlled setter — never left to whoever calls first.
- [ ] `tx.origin` is never used for authorization (phishing-vulnerable — use
      `msg.sender`).

**External calls**

- [ ] Return values of external calls are checked (`(bool success, ) = ...;
      require(success, ...)` — see `withdraw()`) — a silently-ignored failed
      call is a common source of stuck funds.
- [ ] Calls to contracts you don't control (a token, a price feed, an
      arbitrary user-supplied address) are treated as untrusted: they can
      reenter, revert unexpectedly, or return manipulated data.
- [ ] No `delegatecall` to a user-supplied or otherwise untrusted address.

**Integer / boundary issues**

- [ ] Solidity >=0.8.0 has built-in overflow/underflow reverts — but check
      any `unchecked { }` block manually for the specific case it's used for.
- [ ] Division-before-multiplication precision loss is avoided where it
      matters (e.g. fee calculations).
- [ ] Array/loop bounds can't be pushed past the block gas limit by an
      attacker growing a mapping/array they control the size of.

**Front-running / MEV**

- [ ] Any function where transaction ordering matters (auctions, first-come
      claims, price-sensitive swaps) — is that acceptable for this MVP, or
      does it need a commit-reveal scheme or a slippage/deadline parameter?
      Explicitly note the decision rather than leaving it unconsidered.

**Initialization / upgrade risk**

- [ ] If the contract is upgradeable (it shouldn't be unless there's a
      specific reason — see `evm-contract-development`): initializer can only
      run once (`initializer` modifier), and storage layout is
      append-only across upgrades.
- [ ] Constructor/initializer doesn't leave any privileged role unset or
      settable by a non-owner after deployment.

**Signature / replay (if applicable)**

- [ ] Signed messages include a nonce and/or chain ID to prevent replay
      across transactions or across chains/forks.

**ERC standard compliance (if applicable)**

- [ ] ERC20/721/1155 overrides don't silently break the standard's invariants
      (e.g. `transfer` returning `false` instead of reverting, if the rest of
      the codebase assumes revert-on-failure).

## Reporting

State explicitly which items applied and how they were handled — "N/A, this
function has no external calls" is a valid, sufficient answer. Silence on an
item is not.
