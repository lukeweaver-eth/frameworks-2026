// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Strings        } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64         } from "@openzeppelin/contracts/utils/Base64.sol";
import { IRenderer      } from "./interfaces/IRenderer.sol";
import { ArtifactReader } from "./libraries/ArtifactReader.sol";
import { Token          } from "./types/Token.sol";

/// @title  Frameworks Renderer V4 (WebGPU)
/// @author Savage Systems
/// @notice Renders Frameworks V4 compositions as fully on-chain interactive
///         WebGPU artifacts via the Mint protocol.
///
///         Artifact format: abi.encode(string image, string commandString)
///
///         The on-chain file is the full frameworks-v4-mint.html stored as
///         plain text on EthFS. The renderer reads it, injects a tiny inline
///         script that sets `autoExecuteCommand` before the </head> tag, and
///         returns the result as a data:text/html;base64 URI.
///
///         The HTML detects autoExecuteCommand on load, executes it, and hides
///         the builder UI — rendering the composition in clean viewer mode.
///         Viewers can press ? to toggle the full builder back on.
contract FrameworksRendererV4 is IRenderer {

    // =========================================================================
    // Infrastructure
    // =========================================================================

    /// @dev EthFS FileStore — same address on mainnet and all testnets.
    address constant private ethfsFileStorage = 0xFe1411d6864592549AdE050215482e4385dFa0FB;

    /// @dev Filename as stored on EthFS. Bump version on each reupload.
    string  constant private FILE_NAME = "frameworks_v4_viewer_v13.html";

    // =========================================================================
    // IRenderer — identity
    // =========================================================================

    function name() external pure returns (string memory) {
        return "Frameworks V4 (WebGPU)";
    }

    function version() external pure returns (uint) {
        return 4;
    }

    // =========================================================================
    // IRenderer — metadata
    // =========================================================================

    function uri(
        uint tokenId,
        Token calldata token
    ) external view returns (string memory) {
        (string memory image, string memory commandString) =
            abi.decode(ArtifactReader.get(token), (string, string));

        bytes memory dataURI = abi.encodePacked(
            '{',
                '"id": "',          Strings.toString(tokenId), '",',
                '"name": "',        token.name, '",',
                '"description": "', token.description, '",',
                '"image": "',       image, '",',
                '"animation_url": "', _buildAnimationURI(commandString), '"',
            '}'
        );

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(dataURI)
        ));
    }

    function imageURI(uint, Token calldata token) external view returns (string memory) {
        (string memory image, ) = abi.decode(ArtifactReader.get(token), (string, string));
        return image;
    }

    function animationURI(uint, Token calldata token) external view returns (string memory) {
        (, string memory commandString) = abi.decode(ArtifactReader.get(token), (string, string));
        return _buildAnimationURI(commandString);
    }

    // =========================================================================
    // Internal
    // =========================================================================

    /// @dev Reads the full HTML from EthFS, injects autoExecuteCommand just
    ///      before </head>, and returns the whole page as a data:text/html URI.
    function _buildAnimationURI(
        string memory commandString
    ) internal view returns (string memory) {

        string memory html = IEthFS(ethfsFileStorage).readFile(FILE_NAME);

        // Inject autoExecuteCommand script just before </head>
        // The HTML's main() checks for this global on startup.
        bytes memory injection = abi.encodePacked(
            "<script>let autoExecuteCommand='",
            bytes(commandString),
            "';</script></head>"
        );

        // Find </head> and split the HTML around it.
        // Simple approach: split at the known </head> boundary.
        bytes memory htmlBytes = bytes(html);
        bytes memory headClose = bytes("</head>");
        uint splitAt = _indexOf(htmlBytes, headClose);

        bytes memory result;
        if (splitAt == type(uint256).max) {
            // </head> not found — just prepend the script
            result = abi.encodePacked(injection, htmlBytes);
        } else {
            result = abi.encodePacked(
                _slice(htmlBytes, 0, splitAt),
                injection,
                _slice(htmlBytes, splitAt + headClose.length, htmlBytes.length - splitAt - headClose.length)
            );
        }

        return string(abi.encodePacked(
            "data:text/html;base64,",
            Base64.encode(result)
        ));
    }

    /// @dev Find the first occurrence of `needle` in `haystack`.
    ///      Returns type(uint256).max if not found.
    function _indexOf(bytes memory haystack, bytes memory needle) internal pure returns (uint256) {
        if (needle.length == 0 || needle.length > haystack.length) return type(uint256).max;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) { found = false; break; }
            }
            if (found) return i;
        }
        return type(uint256).max;
    }

    /// @dev Slice `length` bytes from `data` starting at `offset`.
    function _slice(bytes memory data, uint256 offset, uint256 length) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[offset + i];
        }
        return result;
    }
}

/// @dev Minimal EthFS FileStore read interface.
interface IEthFS {
    function readFile(string memory filename) external view returns (string memory contents);
    function fileExists(string memory filename) external view returns (bool);
}
