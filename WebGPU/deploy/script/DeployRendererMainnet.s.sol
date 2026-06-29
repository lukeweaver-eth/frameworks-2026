// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FrameworksRendererV4Mainnet.sol";

/// @notice Deploys FrameworksRendererV4Mainnet to mainnet.
///
/// Usage:
///   forge script script/DeployRendererMainnet.s.sol \
///     --rpc-url $ETH_RPC_URL \
///     --account frameworks-mainnet \
///     --broadcast
///
/// After deploy: call registerRenderer(rendererAddress) on the collection
///   0xba1901b542aa58f181f7ae18ed6cd79fda779c62
///   via Etherscan/Rabby using the owner wallet.
contract DeployRendererMainnet is Script {
    function run() external {
        vm.startBroadcast();

        FrameworksRendererV4Mainnet renderer = new FrameworksRendererV4Mainnet();

        vm.stopBroadcast();

        console2.log("FrameworksRendererV4Mainnet deployed at:", address(renderer));
        console2.log("Name:", renderer.name());
        console2.log("Version:", renderer.version());
        console2.log("");
        console2.log("Next step: call registerRenderer on collection:");
        console2.log("  0xba1901b542aa58f181f7ae18ed6cd79fda779c62");
    }
}
