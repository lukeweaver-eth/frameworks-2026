// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Strings        } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64         } from "@openzeppelin/contracts/utils/Base64.sol";
import { IRenderer      } from "./interfaces/IRenderer.sol";
import { ArtifactReader } from "./libraries/ArtifactReader.sol";
import { Token          } from "./types/Token.sol";

/// @title  Frameworks Renderer V4 (WebGPU) — Mainnet
/// @author Savage Systems
/// @notice Renders Frameworks V4 compositions as fully on-chain interactive
///         WebGPU artifacts via the Mint protocol.
///
///         Collection: 0xba1901b542aa58f181f7ae18ed6cd79fda779c62 (mainnet)
///         EthFS file: frameworks_4.0.min.html
contract FrameworksRendererV4Mainnet is IRenderer {

    // =========================================================================
    // Infrastructure
    // =========================================================================

    /// @dev EthFS FileStore — same address on mainnet and all testnets.
    address constant private ethfsFileStorage = 0xFe1411d6864592549AdE050215482e4385dFa0FB;

    /// @dev Filename as stored on EthFS.
    string  constant private FILE_NAME = "frameworks_4.0.min.html";

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

    function _buildAnimationURI(
        string memory commandString
    ) internal view returns (string memory) {

        string memory html = IEthFS(ethfsFileStorage).readFile(FILE_NAME);

        bytes memory injection = abi.encodePacked(
            "<script>let autoExecuteCommand='",
            bytes(commandString),
            "';</script></head>"
        );

        bytes memory htmlBytes = bytes(html);
        bytes memory headClose = bytes("</head>");
        uint splitAt = _indexOf(htmlBytes, headClose);

        bytes memory result;
        if (splitAt == type(uint256).max) {
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
