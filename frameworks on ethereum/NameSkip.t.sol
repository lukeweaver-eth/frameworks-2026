// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {FrameworksV2} from "../src/FrameworksV2.sol";
import {FrameworksRenderer} from "../src/FrameworksRenderer.sol";

contract NameSkipTest is Test {
    FrameworksV2 fw;
    FrameworksRenderer r;
    function onERC721Received(address,address,uint256,bytes calldata)
        external pure returns (bytes4) { return this.onERC721Received.selector; }

    function setUp() public {
        fw = new FrameworksV2(0x41C8f39463A868d3A88af00cd0fe7102F30E44eC);
        r  = new FrameworksRenderer(address(fw));
    }

    /// Naming a composition must not add a phantom "" to its frame list.
    function test_name_frame_is_not_a_component() public {
        uint256 set = fw.mint(0);
        (uint256 comp, uint256[] memory frames) = fw.compose("fff", set, 3);

        bytes32[3] memory n = [bytes32("ART"), bytes32("NETWORK"), bytes32("KNOWLEDGE")];
        for (uint256 i; i < 3; ++i) {
            uint256 called = fw.mint(frames[i]);
            fw.write(called, n[i]);
            fw.bind(frames[i], fw.CTX_CALLED(), called);
        }

        // before naming the composition itself
        string[] memory before = r.frameNames(comp);
        assertEq(before.length, 3);

        fw.name(comp, "a space to think in");

        // componentCount now includes the name frame...
        assertEq(fw.componentCount(comp), 4);
        // ...but frameNames must not.
        string[] memory after_ = r.frameNames(comp);
        assertEq(after_.length, 3, "name frame leaked into components");
        assertEq(after_[0], "ART");
        assertEq(after_[1], "NETWORK");
        assertEq(after_[2], "KNOWLEDGE");
    }
}
