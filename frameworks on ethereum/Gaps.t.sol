// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {Frameworks} from "../src/Frameworks.sol";

contract GapsTest is Test {
    Frameworks fw;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    function setUp() public { fw = new Frameworks(); }

    /// attach() checks the parent's author but not the child's.
    function test_anyone_can_attach_someone_elses_frame() public {
        vm.prank(alice);
        uint256 aliceFrame = fw.mint(0);

        vm.startPrank(bob);
        uint256 bobFrame = fw.mint(0);
        fw.attach(bobFrame, aliceFrame);      // no consent from alice
        vm.stopPrank();

        assertEq(fw.componentAt(bobFrame, 0), aliceFrame);
        assertEq(fw.author(aliceFrame), alice);   // still hers, now inside bob's
    }

    /// A frame can be inside many parents — containment is a graph, not a tree.
    function test_frame_can_have_many_parents() public {
        uint256 child = fw.mint(0);
        uint256 p1 = fw.mint(0);
        uint256 p2 = fw.mint(0);
        fw.attach(p1, child);
        fw.attach(p2, child);
        assertEq(fw.componentAt(p1, 0), child);
        assertEq(fw.componentAt(p2, 0), child);
        // "coordinates relative to THE container" is undefined here.
    }

    /// No parent pointer: you cannot get from a child to its container.
    function test_no_way_up_the_tree() public {
        (bool ok,) = address(fw).staticcall(abi.encodeWithSignature("parentOf(uint256)", 1));
        assertFalse(ok, "there is no parentOf");
    }
}
