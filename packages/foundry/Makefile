.PHONY: build deploy generate-abis record-deployment get-address account chain compile flatten fork format lint test verify

# Windows: GNU Make has no POSIX `sh` on PATH by default and silently falls back
# to cmd.exe, which cannot run the `~` expansion that setup-anvil-wallet
# (below) uses. Pin ONLY that target to Git for Windows' sh.exe, via GNU
# Make's target-specific variables — not a global SHELL override.
#
# A global override was tried first and reverted: it also routed every OTHER
# recipe (account, deploy, compile, test, ...) through Git Bash's MSYS2 pty
# layer, which silently breaks native Win32 console interaction for anything
# reading an interactive password. Confirmed the hard way, twice: `yarn
# account` and `forge script` (deploy, when it needs a keystore password —
# see DEPLOY_CMD below) would both accept the exact correct password and
# still fail to decrypt — MSYS2's pty doesn't relay a native console app's
# raw-mode password read correctly. `deploy`'s own if/fi conditionals were
# rewritten below as Make-native `ifeq` directives specifically so that
# target no longer needs a POSIX shell at all, and can run under Make's real
# Windows default (cmd.exe), which preserves a genuine console handle.
#
# Override with `make setup-anvil-wallet SHELL=/path/to/sh ...` (or edit the
# lines below directly) if Git for Windows is installed somewhere else.
ifeq ($(OS),Windows_NT)
setup-anvil-wallet: SHELL := C:/Program Files/Git/usr/bin/sh.exe
setup-anvil-wallet: .SHELLFLAGS := -c
endif

DEPLOY_SCRIPT ?= script/Deploy.s.sol
# Defaults live HERE, not in package.json script strings. `yarn workspace
# @se-2/foundry verify RPC_URL=sepolia` works identically on every OS because
# yarn just appends "RPC_URL=sepolia" literally after "make verify" — a plain
# Make command-line override. The package.json convention this used to use
# (`make verify RPC_URL=${1:-localhost}`, relying on yarn forwarding an extra
# CLI arg as shell positional parameter $1) silently ignores the argument on
# Windows and always falls back to the default — confirmed during setup.
RPC_URL ?= localhost
FORK_URL ?= mainnet

# Which forge invocation `deploy` runs, chosen entirely by Make itself
# (ifeq, evaluated when the Makefile is read) rather than a shell if/fi —
# see the note above for why this matters on Windows.
#
# Priority order:
#  1. DEPLOYER_PRIVATE_KEY set (from packages/foundry/.env, loaded by
#     parseArgs.js before it invokes make) — no keystore, NO INTERACTIVE
#     PASSWORD PROMPT. This is the default, recommended path: it's the only
#     one that works identically on every OS and terminal, and the only one
#     that can be tested non-interactively. See docs/development.md.
#  2. localhost + scaffold-eth-default — uses --password with the hardcoded
#     non-secret Anvil password (see setup-anvil-wallet).
#  3. anything else — a keystore without a supplied password, so forge
#     prompts interactively. Kept working for people who prefer keystores,
#     but it is NOT the documented default (see the Windows caveat in
#     docs/development.md#windows-notes).
#
# The deploy recipe is @-prefixed so DEPLOYER_PRIVATE_KEY is never echoed.
ifneq ($(strip $(DEPLOYER_PRIVATE_KEY)),)
DEPLOY_CMD = forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) --broadcast --ffi
else ifeq ($(RPC_URL),localhost)
ifeq ($(ETH_KEYSTORE_ACCOUNT),scaffold-eth-default)
DEPLOY_CMD = forge script $(DEPLOY_SCRIPT) --rpc-url localhost --password localhost --broadcast --ffi
else
DEPLOY_CMD = forge script $(DEPLOY_SCRIPT) --rpc-url localhost --broadcast --ffi
endif
else
DEPLOY_CMD = forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --broadcast --ffi
endif

# setup wallet for anvil
setup-anvil-wallet:
	shx rm ~/.foundry/keystores/scaffold-eth-default 2>/dev/null; 	shx rm -rf broadcast/Deploy.s.sol/31337
	cast wallet import --private-key 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 --unsafe-password 'localhost' scaffold-eth-default

# Start local chain
chain: setup-anvil-wallet
	anvil

# Start a fork
fork: setup-anvil-wallet
	anvil --fork-url $(FORK_URL) --chain-id 31337

# Deploy the contracts. Existence check + branch selection both happen via
# Make functions (wildcard/error/ifeq above), not shell syntax — see the
# SHELL note above for why deploy deliberately has no POSIX-only syntax left.
deploy:
	$(if $(wildcard $(DEPLOY_SCRIPT)),,$(error Deploy script '$(DEPLOY_SCRIPT)' not found))
	@echo Deploying $(DEPLOY_SCRIPT) to $(RPC_URL)
	@$(DEPLOY_CMD)

# Deploy and generate ABIs
deploy-and-generate-abis: deploy generate-abis record-deployment

# Generate TypeScript ABIs
generate-abis:
	node scripts-js/generateTsAbis.js

# Enrich deployments/<chainId>.json with tx hash, block, deployer, commit SHA
record-deployment:
	node ../../scripts/record-deployment.mjs

# List account
account:
	@node scripts-js/checkAccountBalance.js

# Get address of a keystore
get-address:
	@cast wallet address --account $(ACCOUNT_NAME)

# Compile contracts
compile:
	forge compile

# Flatten contracts
flatten:
	forge flatten

# Format code
format:
	forge fmt && prettier --write ./scripts-js/**/*.js

# Lint code
lint:
	forge fmt --check && prettier --check ./scripts-js/**/*.js

# Run tests
test:
	forge test

# Verify contracts
verify:
	forge script script/VerifyAll.s.sol --ffi --rpc-url $(RPC_URL)

