// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/YourContract.sol";

/// @dev Drives YourContract through randomized setGreeting/withdraw calls from
/// a handful of fixed actors, tracking the ground truth the invariants check
/// against. This is the standard forge-std "handler" pattern: the invariant
/// fuzzer only ever calls public functions on this contract, never directly on
/// YourContract, so we control which actors show up and can keep our own
/// shadow accounting to compare state against.
contract YourContractHandler is Test {
    YourContract public target;
    address[] public actors;

    uint256 public ghost_totalCalls;
    mapping(address => uint256) public ghost_callsPerActor;

    constructor(YourContract _target) {
        target = _target;
        actors.push(makeAddr("actor0"));
        actors.push(makeAddr("actor1"));
        actors.push(makeAddr("actor2"));
    }

    function setGreeting(uint256 actorSeed, string calldata newGreeting, uint96 value) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.deal(actor, uint256(value));

        vm.prank(actor);
        target.setGreeting{ value: value }(newGreeting);

        ghost_totalCalls += 1;
        ghost_callsPerActor[actor] += 1;
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }
}

contract YourContractInvariantTest is Test {
    YourContract public yourContract;
    YourContractHandler public handler;

    function setUp() public {
        yourContract = new YourContract(makeAddr("owner"));
        handler = new YourContractHandler(yourContract);

        // Restrict the invariant fuzzer to calling through the handler — calling
        // YourContract directly would let it pick arbitrary unbounded actors and
        // make the ghost-variable accounting below meaningless.
        targetContract(address(handler));
    }

    /// totalCounter must always equal the number of setGreeting calls the
    /// handler actually made — it can never drift from the true call count.
    function invariant_TotalCounterMatchesCallCount() public view {
        assertEq(yourContract.totalCounter(), handler.ghost_totalCalls());
    }

    /// Each actor's on-chain counter must match how many times the handler
    /// called setGreeting as that specific actor.
    function invariant_PerActorCounterMatchesGhost() public view {
        uint256 len = handler.actorsLength();
        for (uint256 i = 0; i < len; i++) {
            address actor = handler.actors(i);
            assertEq(yourContract.userGreetingCounter(actor), handler.ghost_callsPerActor(actor));
        }
    }

    /// totalCounter is the sum of every actor's individual counter — no
    /// greeting call is ever double-counted or dropped.
    function invariant_TotalCounterEqualsSumOfActorCounters() public view {
        uint256 len = handler.actorsLength();
        uint256 sum = 0;
        for (uint256 i = 0; i < len; i++) {
            sum += yourContract.userGreetingCounter(handler.actors(i));
        }
        assertEq(yourContract.totalCounter(), sum);
    }
}
