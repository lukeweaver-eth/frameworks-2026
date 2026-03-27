// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FrameworksRendererV4.sol";

contract DeployRenderer is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        FrameworksRendererV4 renderer = new FrameworksRendererV4();

        vm.stopBroadcast();

        console.log("=================================");
        console.log("FrameworksRendererV4 deployed at:", address(renderer));
        console.log("Name:", renderer.name());
        console.log("Version:", renderer.version());
        console.log("=================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Register on your Mint collection:");
        console.log("   RENDERER_ADDRESS=%s", address(renderer));
        console.log("   node script/register-renderer.mjs");
    }
}
