// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Frameworks} from "../src/Frameworks.sol";

/// @title  Deploy Frameworks + mint genesis
/// @notice Deploys the write surface, then mints the genesis command set:
///         one frame per binding, each holding its character, wrapped in a
///         set frame named "genesis".
///
///         This is the bootstrap, and it happens exactly once. No frame
///         creates these — the deployer calls the contract, and afterwards
///         frames exist. Everything after this is built by pressing keys.
///
///         The 42 bindings match GENESIS_COMMAND_SET in frameworks-v5-mint.html.
///         Order is significant: component i of the set frame is binding i,
///         and the client reads them positionally.
contract DeployFrameworks is Script {

    function run() external returns (Frameworks fw, uint256 genesis) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        fw = new Frameworks();
        console.log("Frameworks:", address(fw));

        // The set frame. Its components are the bindings, in order.
        genesis = fw.mint(0);

        // Each binding holds its character. Which primitive it names is
        // positional — the client's PRIMITIVES table, read in this order.
        bytes32[] memory b = new bytes32[](42);
        b[0]="f";  b[1]="F";  b[2]="d";  b[3]="D";  b[4]="x";  b[5]="t";
        b[6]="T";  b[7]="s";  b[8]="S";  b[9]="r";  b[10]="R"; b[11]="e";
        b[12]="E"; b[13]="h"; b[14]="H"; b[15]="q"; b[16]="Q"; b[17]="w";
        b[18]="W"; b[19]="a"; b[20]="A"; b[21]="`"; b[22]="C"; b[23]="z";
        b[24]="Z"; b[25]=" "; b[26]="m"; b[27]="p"; b[28]="P"; b[29]="v";
        b[30]="V"; b[31]="#"; b[32]="c"; b[33]="g"; b[34]="G"; b[35]="0";
        b[36]="1"; b[37]="2"; b[38]="3"; b[39]="4"; b[40]="5"; b[41]="6";

        fw.mintMany(genesis, b);

        // Name it. `called` is a context — a frame holding the name — bound
        // into slot 0, exactly as w/W does at runtime.
        uint256 called = fw.mint(genesis);
        fw.write(called, "genesis");
        fw.bind(genesis, fw.CTX_CALLED(), called);

        vm.stopBroadcast();

        console.log("genesis command set:", genesis);
        console.log("bindings:", fw.componentCount(genesis) - 1);
        console.log("total frames:", fw.count());
    }
}
