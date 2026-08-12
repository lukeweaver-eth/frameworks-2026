// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FrameworksRenderer} from "../src/FrameworksRenderer.sol";

contract DeployFrameworksRenderer is Script {
    function run() external returns (FrameworksRenderer r) {
        address fw = vm.envAddress("FRAMEWORKS");
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        r = new FrameworksRenderer(fw);
        vm.stopBroadcast();
        console.log("FrameworksRenderer:", address(r));
        console.log("reads Frameworks at:", fw);
    }
}
