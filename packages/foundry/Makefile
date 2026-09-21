.PHONY: build deploy generate-abis record-deployment get-address account chain compile flatten fork format lint test verify

# Windows: GNU Make has no POSIX `sh` on PATH by default and silently falls back to
# cmd.exe, which cannot run the `~`, `[ ]`, `if/fi` recipes below. Force Git for
# Windows' bundled sh.exe. Override with `make SHELL=/path/to/sh ...` if Git is
# installed somewhere else.
ifeq ($(OS),Windows_NT)
SHELL := C:/Program Files/Git/usr/bin/sh.exe
.SHELLFLAGS := -c
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

# Deploy the contracts
deploy:
	@if [ ! -f "$(DEPLOY_SCRIPT)" ]; then 		echo "Error: Deploy script '$(DEPLOY_SCRIPT)' not found"; 		exit 1; 	fi
	@if [ "$(RPC_URL)" = "localhost" ]; then 		if [ "$(ETH_KEYSTORE_ACCOUNT)" = "scaffold-eth-default" ]; then 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --password localhost --broadcast --ffi; 		else 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --broadcast --ffi; 		fi 	else 		forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --broadcast --ffi; 	fi

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

