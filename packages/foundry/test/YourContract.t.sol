// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/YourContract.sol";

/// @dev Owner stand-in with no receive/fallback — used to exercise the
/// `require(success, "Failed to send Ether")` revert branch in withdraw().
contract RejectingReceiver {
    function deployYourContract() external returns (YourContract) {
        return new YourContract(address(this));
    }
}

contract YourContractTest is Test {
    YourContract public yourContract;
    address public owner;

    event GreetingChange(address indexed greetingSetter, string newGreeting, bool premium, uint256 value);

    function setUp() public {
        owner = vm.addr(1);
        yourContract = new YourContract(owner);
    }

    // ---------------------------------------------------------------------
    // Happy path / deployment
    // ---------------------------------------------------------------------

    function testMessageOnDeployment() public view {
        require(keccak256(bytes(yourContract.greeting())) == keccak256("Building Unstoppable Apps!!!"));
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(yourContract.owner(), owner);
    }

    function test_Constructor_InitialState() public view {
        assertEq(yourContract.totalCounter(), 0);
        assertFalse(yourContract.premium());
    }

    // ---------------------------------------------------------------------
    // setGreeting — state transitions
    // ---------------------------------------------------------------------

    function test_SetGreeting_UpdatesGreetingAndCounters() public {
        address user = makeAddr("user");
        vm.prank(user);
        yourContract.setGreeting("gm hackathon");

        assertEq(yourContract.greeting(), "gm hackathon");
        assertEq(yourContract.totalCounter(), 1);
        assertEq(yourContract.userGreetingCounter(user), 1);
    }

    function test_SetGreeting_CountersAreIndependentPerUser() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        yourContract.setGreeting("hello from alice");
        vm.prank(alice);
        yourContract.setGreeting("hello again from alice");
        vm.prank(bob);
        yourContract.setGreeting("hello from bob");

        assertEq(yourContract.totalCounter(), 3);
        assertEq(yourContract.userGreetingCounter(alice), 2);
        assertEq(yourContract.userGreetingCounter(bob), 1);
    }

    function test_SetGreeting_WithValue_SetsPremiumTrue() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        vm.prank(user);
        yourContract.setGreeting{ value: 0.01 ether }("premium greeting");

        assertTrue(yourContract.premium());
        assertEq(address(yourContract).balance, 0.01 ether);
    }

    function test_SetGreeting_WithoutValue_SetsPremiumFalse() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        // First call sets premium = true …
        vm.prank(user);
        yourContract.setGreeting{ value: 0.01 ether }("premium");
        assertTrue(yourContract.premium());

        // … a later free call flips it back to false (premium reflects only the
        // *last* call's value, it is not sticky).
        vm.prank(user);
        yourContract.setGreeting("free again");
        assertFalse(yourContract.premium());
    }

    function test_SetGreeting_EmitsGreetingChangeEvent() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        vm.expectEmit(true, false, false, true);
        emit GreetingChange(user, "with event", true, 0.005 ether);

        vm.prank(user);
        yourContract.setGreeting{ value: 0.005 ether }("with event");
    }

    function test_SetGreeting_AcceptsEmptyString() public {
        // Contract places no restriction on empty greetings — document that as
        // intended behaviour rather than leaving it untested.
        yourContract.setGreeting("");
        assertEq(yourContract.greeting(), "");
        assertEq(yourContract.totalCounter(), 1);
    }

    // ---------------------------------------------------------------------
    // withdraw — access control
    // ---------------------------------------------------------------------

    function test_Withdraw_OwnerCanWithdraw() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);
        vm.prank(user);
        yourContract.setGreeting{ value: 1 ether }("funding the contract");

        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        yourContract.withdraw();

        assertEq(owner.balance, ownerBalanceBefore + 1 ether);
        assertEq(address(yourContract).balance, 0);
    }

    function test_RevertWhen_NonOwnerCallsWithdraw() public {
        address notOwner = makeAddr("notOwner");
        vm.prank(notOwner);
        vm.expectRevert(bytes("Not the Owner"));
        yourContract.withdraw();
    }

    function test_RevertWhen_TransferToOwnerFails() public {
        RejectingReceiver rejecting = new RejectingReceiver();
        YourContract contractWithBadOwner = rejecting.deployYourContract();

        address user = makeAddr("user");
        vm.deal(user, 1 ether);
        vm.prank(user);
        contractWithBadOwner.setGreeting{ value: 1 ether }("funding");

        vm.prank(address(rejecting));
        vm.expectRevert(bytes("Failed to send Ether"));
        contractWithBadOwner.withdraw();
    }

    // ---------------------------------------------------------------------
    // receive()
    // ---------------------------------------------------------------------

    function test_Receive_AcceptsPlainEtherTransfer() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        vm.prank(user);
        (bool success,) = address(yourContract).call{ value: 0.2 ether }("");

        assertTrue(success);
        assertEq(address(yourContract).balance, 0.2 ether);
    }

    // ---------------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------------

    function testFuzz_SetGreeting_CounterTracksNumberOfCalls(address user, uint8 numCalls) public {
        vm.assume(user != address(0));
        // Bound rather than reject — keeps the fuzzer's inputs useful instead of
        // discarding most of them, per forge-std guidance.
        uint256 calls = bound(numCalls, 0, 20);

        for (uint256 i = 0; i < calls; i++) {
            vm.prank(user);
            yourContract.setGreeting("fuzz greeting");
        }

        assertEq(yourContract.userGreetingCounter(user), calls);
        assertEq(yourContract.totalCounter(), calls);
    }

    function testFuzz_SetGreeting_PremiumReflectsLastCallValue(uint96 value) public {
        address user = makeAddr("fuzzUser");
        vm.deal(user, uint256(value) + 1 ether);

        vm.prank(user);
        yourContract.setGreeting{ value: value }("fuzz value");

        assertEq(yourContract.premium(), value > 0);
    }
}
