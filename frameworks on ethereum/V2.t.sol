// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {FrameworksV2} from "../src/FrameworksV2.sol";

contract V2Test is Test {
    FrameworksV2 fw;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    // A minimal 6551 account impl is not needed to *derive* addresses.
    address impl  = address(0xACC0);

    function setUp() public { fw = new FrameworksV2(impl); }

    /// This test contract holds frames, so it must accept ERC-721s.
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure returns (bytes4) { return this.onERC721Received.selector; }

    /// Containment IS ownership.
    function test_containment_is_ownership() public {
        uint256 parent = fw.mint(0);
        uint256 child  = fw.mint(parent);
        assertEq(fw.ownerOf(child), fw.accountOf(parent));
        assertEq(fw.containerOf(child), parent);      // the missing direction
        assertEq(fw.componentCount(parent), 1);
        assertEq(fw.componentAt(parent, 0), child);
    }

    /// GAP 1 CLOSED: you cannot attach someone else's frame.
    function test_cannot_attach_someone_elses_frame() public {
        vm.prank(alice);
        uint256 aliceFrame = fw.mint(0);
        vm.startPrank(bob);
        uint256 bobFrame = fw.mint(0);
        vm.expectRevert();                 // ERC721InsufficientApproval
        fw.attach(bobFrame, aliceFrame);
        vm.stopPrank();
        assertEq(fw.ownerOf(aliceFrame), alice);
    }

    /// GAP 2 CLOSED: one owner, so one container.
    function test_single_parent_only() public {
        uint256 p1 = fw.mint(0);
        uint256 p2 = fw.mint(0);
        uint256 child = fw.mint(p1);
        assertEq(fw.containerOf(child), p1);
        fw.attach(p2, child);              // moving it OUT of p1
        assertEq(fw.containerOf(child), p2);
        assertEq(fw.componentCount(p1), 0);   // no longer in p1
        assertEq(fw.componentCount(p2), 1);
    }

    /// GAP 3 CLOSED: containerOf is O(1), not a scan.
    function test_container_lookup_is_constant() public {
        uint256 root = fw.mint(0);
        uint256 deep = root;
        for (uint256 i; i < 5; ++i) deep = fw.mint(deep);
        for (uint256 i; i < 40; ++i) fw.mint(0);      // 40 unrelated frames
        uint256 g0 = gasleft();
        fw.containerOf(deep);
        uint256 used = g0 - gasleft();
        emit log_named_uint("containerOf gas with 46 frames", used);
        assertLt(used, 15_000);
    }

    /// Selling a framework must not reassign authorship — Stage 2 pays author.
    function test_authorship_survives_transfer() public {
        vm.prank(alice);
        uint256 f = fw.mint(0);
        vm.prank(alice);
        fw.transferFrom(alice, bob, f);
        assertEq(fw.ownerOf(f), bob);
        assertEq(fw.author(f), alice);      // credit stays put
    }

    /// Transferring a container moves the whole subtree with it.
    function test_subtree_travels_with_container() public {
        uint256 parent = fw.mint(0);
        uint256 child  = fw.mint(parent);
        fw.transferFrom(address(this), bob, parent);
        assertEq(fw.ownerOf(parent), bob);
        assertEq(fw.ownerOf(child), fw.accountOf(parent));  // still inside
        assertEq(fw.containerOf(child), parent);
    }

    /// The ART/NETWORK/KNOWLEDGE example, now nameable.
    function test_compose_and_name() public {
        uint256 set = fw.mint(0);
        (uint256 comp, uint256[] memory frames) =
            fw.compose("1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7", set, 3);
        fw.name(comp, "a space to think in");

        assertEq(frames.length, 3);
        assertEq(fw.chars(comp), "1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7");
        uint256 called = fw.context(comp, fw.CTX_CALLED());
        assertEq(fw.contents(called), bytes32("a space to think in"));
        // 3 f-frames + 1 name frame
        assertEq(fw.componentCount(comp), 4);
    }

    /// Ancestor walk for Stage 2 — bounded by depth.
    function test_ancestor_walk() public {
        uint256 a = fw.mint(0);
        uint256 b = fw.mint(a);
        uint256 c = fw.mint(b);
        uint256[] memory chain = fw.ancestorsOf(c, 10);
        assertEq(chain.length, 2);
        assertEq(chain[0], b);
        assertEq(chain[1], a);
    }
}
