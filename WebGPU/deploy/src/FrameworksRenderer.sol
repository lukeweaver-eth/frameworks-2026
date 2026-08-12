// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64  } from "@openzeppelin/contracts/utils/Base64.sol";
/// @dev Minimal EthFS FileStore read interface.
interface IEthFS {
    function readFile(string memory filename) external view returns (string memory);
    function fileExists(string memory filename) external view returns (bool);
}

interface IFrameworks {
    function chars(uint256) external view returns (string memory);
    function contents(uint256) external view returns (bytes32);
    function context(uint256, uint256) external view returns (uint256);
    function componentCount(uint256) external view returns (uint256);
    function componentAt(uint256, uint256) external view returns (uint256);
    function author(uint256) external view returns (address);
    function CTX_CALLED() external view returns (uint256);
    function CTX_COMMAND_SET() external view returns (uint256);
}

/// @title  Frameworks Renderer
/// @notice Renders a composition frame as an interactive WebGPU artifact.
///
///         Unlike the V4 renderer, nothing is stored in an encoded artifact.
///         Everything is read from the Frameworks contract at call time:
///
///           chars(id)                 the string that was typed
///           context(id, CTX_COMMAND_SET)  the set that gives it meaning
///           components(id)            the frames the string made real
///           context(frame, CTX_CALLED)    each frame's name
///
///         The viewer receives the string and casts the composition in the
///         browser. A 200,000-frame structure and a 3-frame structure cost
///         the same here, because what is stored is the construction, not
///         the result.
///
///         Because the command set is read rather than assumed, calling
///         recast() on a composition changes what this renderer returns —
///         same string, different structure.
contract FrameworksRenderer {

    /// @dev EthFS FileStore (Sepolia) — the one upload-to-ethfs.mjs writes to
    ///      and the deployed V4 renderer reads from. Not the 0x8FAA1AAb…
    ///      address in some older sources; that is a different contract.
    address constant private ethfsFileStorage = 0xFe1411d6864592549AdE050215482e4385dFa0FB;

    /// @dev The viewer build this renderer serves. EthFS names are immutable,
    ///      so a new viewer means a new renderer.
    string constant private VIEWER = "frameworks_v5_viewer_v1.min.html";

    IFrameworks public immutable frameworks;

    constructor(address frameworksContract) {
        frameworks = IFrameworks(frameworksContract);
    }

    function name() external pure returns (string memory) {
        return "Frameworks V5";
    }

    function version() external pure returns (uint256) {
        return 5;
    }

    // =========================================================================
    // Metadata
    // =========================================================================

    /// @notice Full JSON metadata for a composition frame.
    function uri(uint256 id) external view returns (string memory) {
        string memory cmd   = frameworks.chars(id);
        string memory title = _nameOf(id);

        bytes memory json = abi.encodePacked(
            '{"name":"', title,
            '","description":"An on-chain Frameworks composition. ',
            Strings.toString(frameworks.componentCount(id)),
            ' frames, cast from ',
            Strings.toString(bytes(cmd).length),
            ' characters.',
            '","animation_url":"', generateHtml(title, cmd),
            '","attributes":[',
                '{"trait_type":"Frames","value":',
                    Strings.toString(frameworks.componentCount(id)), '},',
                '{"trait_type":"Characters","value":',
                    Strings.toString(bytes(cmd).length), '},',
                '{"trait_type":"Command Set","value":',
                    Strings.toString(frameworks.context(id, frameworks.CTX_COMMAND_SET())), '}',
            ']}'
        );

        return string(abi.encodePacked(
            "data:application/json;base64,", Base64.encode(json)
        ));
    }

    /// @notice The interactive artifact on its own.
    function animationURI(uint256 id) external view returns (string memory) {
        return generateHtml(_nameOf(id), frameworks.chars(id));
    }

    /// @notice The composition's string, as typed.
    function commandString(uint256 id) external view returns (string memory) {
        return frameworks.chars(id);
    }

    /// @notice The names of a composition's frames, in order.
    /// @dev    What makes this legible rather than only viewable: the
    ///         semantic content is readable without running anything.
    function frameNames(uint256 id) external view returns (string[] memory names) {
        uint256 n = frameworks.componentCount(id);
        names = new string[](n);
        uint256 slot = frameworks.CTX_CALLED();
        for (uint256 i; i < n; ++i) {
            uint256 called = frameworks.context(frameworks.componentAt(id, i), slot);
            names[i] = called == 0 ? "" : _toString(frameworks.contents(called));
        }
    }

    // =========================================================================
    // HTML assembly
    // =========================================================================

    /// @dev Reads the viewer from EthFS and injects the command string before
    ///      </head>, then returns the whole page as a data:text/html URI.
    ///
    ///      Deliberately not ScriptyBuilder: the viewer is a complete 112KB
    ///      HTML document, not a script tag to assemble, and passing it
    ///      through getEncodedHTML reverts. The V4 renderer reads EthFS
    ///      directly for the same reason.
    function generateHtml(string memory /*title*/, string memory cmd)
        internal view returns (string memory)
    {
        bytes memory html = bytes(IEthFS(ethfsFileStorage).readFile(VIEWER));

        bytes memory injection = abi.encodePacked(
            "<script>let autoExecuteCommand='", bytes(cmd), "';</script></head>"
        );

        bytes memory headClose = bytes("</head>");
        uint256 at = _indexOf(html, headClose);

        bytes memory page = at == type(uint256).max
            ? abi.encodePacked(injection, html)
            : abi.encodePacked(
                _slice(html, 0, at),
                injection,
                _slice(html, at + headClose.length, html.length - at - headClose.length)
              );

        return string(abi.encodePacked("data:text/html;base64,", Base64.encode(page)));
    }

    /// @dev First occurrence of `needle`, or type(uint256).max.
    function _indexOf(bytes memory haystack, bytes memory needle)
        internal pure returns (uint256)
    {
        if (needle.length == 0 || needle.length > haystack.length) return type(uint256).max;
        for (uint256 i; i <= haystack.length - needle.length; ++i) {
            bool hit = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) { hit = false; break; }
            }
            if (hit) return i;
        }
        return type(uint256).max;
    }

    function _slice(bytes memory data, uint256 offset, uint256 length)
        internal pure returns (bytes memory out)
    {
        out = new bytes(length);
        for (uint256 i; i < length; ++i) out[i] = data[offset + i];
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _nameOf(uint256 id) internal view returns (string memory) {
        uint256 called = frameworks.context(id, frameworks.CTX_CALLED());
        if (called == 0) return string(abi.encodePacked("Framework #", Strings.toString(id)));
        return _toString(frameworks.contents(called));
    }

    /// @dev bytes32 is right-padded with zeros; trim before decoding.
    function _toString(bytes32 v) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && v[len] != 0) ++len;
        bytes memory out = new bytes(len);
        for (uint256 i; i < len; ++i) out[i] = v[i];
        return string(out);
    }
}
