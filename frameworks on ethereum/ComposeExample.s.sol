// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Frameworks} from "../src/Frameworks.sol";

/// @notice Commit the ART / NETWORK / KNOWLEDGE composition.
///
///         Typed in the builder as:
///             1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7
///
///         Three `f`s, so three frames become real. Everything else in the
///         string — the camera presets, the naming, the view — is cast in
///         the browser and never stored.
contract ComposeExample is Script {

    string constant CHARS = "1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7";

    function run() external {
        Frameworks fw = Frameworks(vm.envAddress("FRAMEWORKS"));
        uint256 genesis = vm.envOr("GENESIS", uint256(1));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        (uint256 comp, uint256[] memory frames) = fw.compose(CHARS, genesis, 3);

        uint256[] memory ids   = new uint256[](3);
        bytes32[] memory names = new bytes32[](3);
        bytes32[] memory vals  = new bytes32[](3);
        ids[0] = frames[0]; names[0] = "ART";
        ids[1] = frames[1]; names[1] = "NETWORK";
        ids[2] = frames[2]; names[2] = "KNOWLEDGE";
        fw.writeComposed(ids, names, vals);

        vm.stopBroadcast();

        console.log("composition frame:", comp);
        console.log("  ART:      ", frames[0]);
        console.log("  NETWORK:  ", frames[1]);
        console.log("  KNOWLEDGE:", frames[2]);
    }
}
