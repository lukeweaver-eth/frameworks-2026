// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// Minimal self-contained IScriptyBuilderV2 interface.
// Only the structs and methods used by FrameworksRendererV4 are included.
// Source: scripty.sol (https://github.com/scripty-sol/scripty.sol)

enum HTMLTagType {
    useTagOpenAndClose,          // 0
    script,                      // 1
    scriptBase64DataURI,         // 2
    scriptGZIPBase64DataURI,     // 3
    scriptPNGBase64DataURI       // 4
}

struct HTMLTag {
    string name;
    address contractAddress;
    bytes contractData;
    HTMLTagType tagType;
    bytes tagOpen;
    bytes tagClose;
    bytes tagContent;
}

struct HTMLRequest {
    HTMLTag[] headTags;
    HTMLTag[] bodyTags;
}

interface IScriptyBuilderV2 {
    function getHTML(HTMLRequest memory htmlRequest) external view returns (bytes memory);
    function getEncodedHTML(HTMLRequest memory htmlRequest) external view returns (bytes memory);
    function getHTMLString(HTMLRequest memory htmlRequest) external view returns (string memory);
    function getEncodedHTMLString(HTMLRequest memory htmlRequest) external view returns (string memory);
}
