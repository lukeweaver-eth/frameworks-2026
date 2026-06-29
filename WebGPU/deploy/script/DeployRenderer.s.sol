// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FrameworksRendererV4.sol";

/// @notice Deploys FrameworksRendererV4 and logs the address.
///
/// Usage (Sepolia):
///   forge script script/DeployRenderer.s.sol \
///     --rpc-url $ETH_RPC_SEPOLIA \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify
///
/// Usage (mainnet):
///   forge script script/DeployRenderer.s.sol \
///     --rpc-url $ETH_RPC_MAINNET \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify
contract DeployRenderer is Script {
    function run() external {
        vm.startBroadcast();

        FrameworksRendererV4 renderer = new FrameworksRendererV4();

        vm.stopBroadcast();

        console2.log("FrameworksRendererV4 deployed at:", address(renderer));
        console2.log("Name:", renderer.name());
        console2.log("Version:", renderer.version());
        console2.log("");
        console2.log("Next step: set RENDERER_ADDRESS and run:");
        console2.log("  node script/register-renderer.mjs");
    }
}
