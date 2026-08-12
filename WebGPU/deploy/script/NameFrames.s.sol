// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console} from "forge-std/Script.sol";
import {FrameworksV2} from "../src/FrameworksV2.sol";

/// Name the three f-frames of composition 45. The V2 deploy script minted
/// them but never named them — V1's deploy did this via writeComposed.
contract NameFrames is Script {
    function run() external {
        FrameworksV2 fw = FrameworksV2(vm.envAddress("FRAMEWORKS"));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        bytes32[3] memory names = [bytes32("ART"), bytes32("NETWORK"), bytes32("KNOWLEDGE")];
        for (uint256 i; i < 3; ++i) {
            uint256 frame = fw.componentAt(45, i);
            uint256 called = fw.mint(frame);       // the name lives in a frame
            fw.write(called, names[i]);
            fw.bind(frame, fw.CTX_CALLED(), called);
            console.log("named frame", frame);
        }
        vm.stopBroadcast();
    }
}
