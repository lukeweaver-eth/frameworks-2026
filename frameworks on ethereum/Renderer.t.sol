// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Frameworks} from "../src/Frameworks.sol";
import {FrameworksRenderer} from "../src/FrameworksRenderer.sol";

contract RendererTest is Test {
    Frameworks fw;
    FrameworksRenderer r;
    uint256 comp;

    function setUp() public {
        fw = new Frameworks();
        r  = new FrameworksRenderer(address(fw));

        uint256 genesis = fw.mint(0);
        bytes32[] memory b = new bytes32[](3);
        b[0]="f"; b[1]="w"; b[2]="v";
        fw.mintMany(genesis, b);

        uint256[] memory frames;
        (comp, frames) = fw.compose("1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7", genesis, 3);

        uint256[] memory ids = new uint256[](3);
        bytes32[] memory nm  = new bytes32[](3);
        bytes32[] memory vl  = new bytes32[](3);
        ids[0]=frames[0]; nm[0]="ART";
        ids[1]=frames[1]; nm[1]="NETWORK";
        ids[2]=frames[2]; nm[2]="KNOWLEDGE";
        fw.writeComposed(ids, nm, vl);
    }

    /// The semantic content is readable without running anything.
    function test_names_readable_onchain() public view {
        string[] memory names = r.frameNames(comp);
        assertEq(names.length, 3);
        assertEq(names[0], "ART");
        assertEq(names[1], "NETWORK");
        assertEq(names[2], "KNOWLEDGE");
    }

    function test_command_string_roundtrips() public view {
        assertEq(r.commandString(comp), "1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7");
    }

    /// Metadata is built from chain reads, not a stored artifact.
    function test_uri_is_json_data_uri() public view {
        string memory u = r.uri(comp);
        bytes memory b = bytes(u);
        assertGt(b.length, 100);
        // starts with data:application/json;base64,
        for (uint i; i < 29; ++i) {
            assertEq(b[i], bytes("data:application/json;base64,")[i]);
        }
        console.log("uri length:", b.length);
    }

    /// recast changes what the renderer returns — same string, new meaning.
    function test_recast_changes_metadata() public {
        uint256 other = fw.mint(0);
        string memory before = r.uri(comp);
        fw.recast(comp, other);
        assertTrue(keccak256(bytes(r.uri(comp))) != keccak256(bytes(before)));
        assertEq(r.commandString(comp), "1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7"); // string intact
    }
}
