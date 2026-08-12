// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FrameworksV2} from "../src/FrameworksV2.sol";

/// @title  Deploy FrameworksV2 + remint genesis
/// @notice Stage 1 deployment. Frames are ERC-721s with token-bound accounts,
///         so containment is ownership.
///
///         Genesis is reminted rather than migrated — V1 has no proxy and its
///         frames cannot be carried over. V1 stays live at 0x5ae5…880f as the
///         record of what was there.
contract DeployV2 is Script {

    /// @dev Tokenbound V3 reference account implementation (Sepolia + mainnet).
    address constant ACCOUNT_IMPL = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;

    function run() external returns (FrameworksV2 fw, uint256 genesis) {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        fw = new FrameworksV2(ACCOUNT_IMPL);
        console.log("FrameworksV2:", address(fw));

        // The command set frame. Its components are the bindings, in order —
        // now held by its token-bound account rather than an array.
        genesis = fw.mint(0);

        bytes32[] memory b = new bytes32[](42);
        b[0]="f";  b[1]="F";  b[2]="d";  b[3]="D";  b[4]="x";  b[5]="t";
        b[6]="T";  b[7]="s";  b[8]="S";  b[9]="r";  b[10]="R"; b[11]="e";
        b[12]="E"; b[13]="h"; b[14]="H"; b[15]="q"; b[16]="Q"; b[17]="w";
        b[18]="W"; b[19]="a"; b[20]="A"; b[21]="`"; b[22]="C"; b[23]="z";
        b[24]="Z"; b[25]=" "; b[26]="m"; b[27]="p"; b[28]="P"; b[29]="v";
        b[30]="V"; b[31]="#"; b[32]="c"; b[33]="g"; b[34]="G"; b[35]="0";
        b[36]="1"; b[37]="2"; b[38]="3"; b[39]="4"; b[40]="5"; b[41]="6";
        fw.mintMany(genesis, b);

        fw.name(genesis, "genesis");

        // The example composition, now nameable — V1 had no path to this.
        (uint256 comp, ) = fw.compose(
            "1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7", genesis, 3
        );
        fw.name(comp, "a space to think in");

        vm.stopBroadcast();

        console.log("genesis command set:", genesis);
        console.log("  account:", fw.accountOf(genesis));
        console.log("  bindings:", fw.componentCount(genesis));
        console.log("composition:", comp);
        console.log("  account:", fw.accountOf(comp));
        console.log("total frames:", fw.count());
    }
}
