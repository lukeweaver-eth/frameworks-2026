// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Strings        } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64         } from "@openzeppelin/contracts/utils/Base64.sol";
import { IScriptyBuilderV2,
         HTMLRequest,
         HTMLTagType,
         HTMLTag        } from "scripty.sol/contracts/scripty/interfaces/IScriptyBuilderV2.sol";
import { IRenderer      } from "mint/contracts/interfaces/IRenderer.sol";
import { ArtifactReader } from "mint/contracts/libraries/ArtifactReader.sol";
import { Token          } from "mint/contracts/types/Token.sol";

/**
 * @title FrameworksRenderer
 * @notice Renderer for Frameworks V3 - a spatial content structure tool
 * @dev Implements mint protocol IRenderer interface
 *      Uses Scripty.sol for on-chain HTML generation
 *      References ETHFS-stored Frameworks modules
 *
 * Artifact Data Format:
 *   abi.encode(
 *     string previewImage,    // Base64 data URI or IPFS/Arweave URL
 *     string commandHistory,  // Keystroke commands that built the structure
 *     string initialData      // Optional: serialized frame data for complex structures
 *   )
 */
contract FrameworksRenderer is IRenderer {
    // =============================================================
    //                        CONSTANTS
    // =============================================================

    /// @dev ETHFS FileStore contract (same address across networks)
    address constant private ETHFS_FILE_STORAGE = 0xFe1411d6864592549AdE050215482e4385dFa0FB;

    /// @dev Scripty.sol Builder contract for HTML generation
    address constant private SCRIPTY_BUILDER = 0xD7587F110E08F4D120A231bA97d3B577A81Df022;

    /// @dev Scripty.sol Storage contract (legacy, may not be needed)
    address constant private SCRIPTY_STORAGE = 0xbD11994aABB55Da86DC246EBB17C1Be0af5b7699;

    /// @dev Version of this renderer
    uint constant private RENDERER_VERSION = 1;

    // =============================================================
    //                    IRENDERER IMPLEMENTATION
    // =============================================================

    /**
     * @notice Expose the name of this renderer for easy registration in UIs
     * @return Renderer name
     */
    function name () external pure returns (string memory) {
        return "Frameworks V3";
    }

    /**
     * @notice Expose the version of this renderer to identify it in UIs
     * @return Renderer version number
     */
    function version () external pure returns (uint) {
        return RENDERER_VERSION;
    }

    /**
     * @notice Generate the JSON metadata for a given token
     * @dev Decodes artifact data to extract preview image and command history
     *      Returns base64-encoded JSON metadata with animation_url
     * @param tokenId Token ID being rendered
     * @param token Token struct containing artifact and metadata
     * @return Base64-encoded data URI with JSON metadata
     */
    function uri (
        uint tokenId,
        Token calldata token
    ) external view returns (string memory) {
        (
            string memory previewImage,
            string memory commandHistory,
            string memory initialData
        ) = abi.decode(ArtifactReader.get(token), (string, string, string));

        bytes memory dataURI = abi.encodePacked(
            '{',
                '"id": "', Strings.toString(tokenId), '",',
                '"name": "', token.name, '",',
                '"description": "', token.description, '",',
                '"image": "', previewImage, '",',
                '"animation_url": "', _generateHTML(token.name, commandHistory, initialData), '",',
                '"attributes": [',
                    '{',
                        '"trait_type": "Command Count",',
                        '"value": ', Strings.toString(bytes(commandHistory).length),
                    '},',
                    '{',
                        '"trait_type": "Has Initial Data",',
                        '"value": "', bytes(initialData).length > 0 ? "true" : "false", '"',
                    '}',
                ']',
            '}'
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(dataURI)
            )
        );
    }

    /**
     * @notice Generate the preview image URI
     * @dev Returns the static preview image from artifact data
     * @param tokenId Token ID (unused, required by interface)
     * @param token Token struct containing artifact
     * @return Preview image data URI or URL
     */
    function imageURI (uint, Token calldata token) external view returns (string memory) {
        (string memory previewImage,,) = abi.decode(ArtifactReader.get(token), (string, string, string));
        return previewImage;
    }

    /**
     * @notice Generate the animation URI
     * @dev Returns interactive Frameworks HTML that reconstructs the structure
     * @param tokenId Token ID (unused, required by interface)
     * @param token Token struct containing artifact
     * @return Base64-encoded HTML data URI
     */
    function animationURI (uint, Token calldata token) external view returns (string memory) {
        (
            ,
            string memory commandHistory,
            string memory initialData
        ) = abi.decode(ArtifactReader.get(token), (string, string, string));

        return _generateHTML(token.name, commandHistory, initialData);
    }

    // =============================================================
    //                    HTML GENERATION
    // =============================================================

    /**
     * @notice Generates the HTML for a Frameworks structure
     * @dev Uses Scripty.sol to assemble HTML from ETHFS-stored modules
     *      References Three.js and Frameworks contexts from ETHFS
     *      Injects command history and initial data for reconstruction
     * @param title Title for the HTML document
     * @param commandHistory Keystroke commands to replay
     * @param initialData Optional initial frame data
     * @return Base64-encoded HTML data URI
     */
    function _generateHTML (
        string memory title,
        string memory commandHistory,
        string memory initialData
    ) internal view returns (string memory) {
        // Build head tags
        HTMLTag[] memory headTags = new HTMLTag[](3);

        // Set document title
        headTags[0].tagOpen = "<title>";
        headTags[0].tagContent = bytes(title);
        headTags[0].tagClose = "</title>";

        // Add viewport meta tag for proper scaling
        headTags[1].tagOpen = "<meta ";
        headTags[1].tagContent = 'name="viewport" content="width=device-width, initial-scale=1.0"';
        headTags[1].tagClose = ">";

        // Add base styles (full-screen canvas, black background)
        headTags[2].tagOpen = "<style>";
        headTags[2].tagContent = bytes(
            "body{margin:0;padding:0;overflow:hidden;background:#000}"
            "canvas{display:block;width:100vw;height:100vh}"
        );
        headTags[2].tagClose = "</style>";

        // Build body tags - load libraries and modules from ETHFS
        HTMLTag[] memory bodyTags = new HTMLTag[](8);

        // Load Three.js from ETHFS
        // TODO: Verify exact filename once Three.js is uploaded to ETHFS
        bodyTags[0].name = "three-v0.160.0.min.js";
        bodyTags[0].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[0].contractAddress = ETHFS_FILE_STORAGE;

        // Load Frameworks core module
        bodyTags[1].name = "frameworks-v3-core-v1.0.0.js";
        bodyTags[1].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[1].contractAddress = ETHFS_FILE_STORAGE;

        // Load Frameworks palette module
        bodyTags[2].name = "frameworks-v3-palette-v1.0.0.js";
        bodyTags[2].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[2].contractAddress = ETHFS_FILE_STORAGE;

        // Load Frameworks camera module
        bodyTags[3].name = "frameworks-v3-camera-v1.0.0.js";
        bodyTags[3].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[3].contractAddress = ETHFS_FILE_STORAGE;

        // Load Frameworks commands module
        bodyTags[4].name = "frameworks-v3-commands-v1.0.0.js";
        bodyTags[4].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[4].contractAddress = ETHFS_FILE_STORAGE;

        // Load Frameworks renderer module
        bodyTags[5].name = "frameworks-v3-renderer-v1.0.0.js";
        bodyTags[5].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[5].contractAddress = ETHFS_FILE_STORAGE;

        // Load Frameworks main/index module
        bodyTags[6].name = "frameworks-v3-index-v1.0.0.js";
        bodyTags[6].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[6].contractAddress = ETHFS_FILE_STORAGE;

        // Inject initialization script with command history and initial data
        bodyTags[7].tagContent = bytes(
            string(abi.encodePacked(
                "window.FRAMEWORKS_CONFIG={",
                    "commandHistory:'", _escapeJS(commandHistory), "',",
                    "initialData:'", _escapeJS(initialData), "',",
                    "isOnChain:true,",
                    "interactive:true",
                "};"
            ))
        );
        bodyTags[7].tagType = HTMLTagType.script;

        // Assemble the HTML using Scripty.sol
        HTMLRequest memory htmlRequest;
        htmlRequest.headTags = headTags;
        htmlRequest.bodyTags = bodyTags;

        return string(IScriptyBuilderV2(SCRIPTY_BUILDER).getEncodedHTML(htmlRequest));
    }

    /**
     * @notice Escape JavaScript strings for safe injection
     * @dev Handles single quotes, double quotes, newlines, and backslashes
     * @param str Input string to escape
     * @return Escaped string safe for JS injection
     */
    function _escapeJS (string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        uint256 escapeCount = 0;

        // Count characters that need escaping
        for (uint256 i = 0; i < strBytes.length; i++) {
            bytes1 char = strBytes[i];
            if (
                char == '"' ||
                char == "'" ||
                char == "\\" ||
                char == "\n" ||
                char == "\r"
            ) {
                escapeCount++;
            }
        }

        // If no escaping needed, return original
        if (escapeCount == 0) {
            return str;
        }

        // Build escaped string
        bytes memory escaped = new bytes(strBytes.length + escapeCount);
        uint256 j = 0;

        for (uint256 i = 0; i < strBytes.length; i++) {
            bytes1 char = strBytes[i];

            if (char == '"' || char == "'" || char == "\\") {
                escaped[j++] = "\\";
                escaped[j++] = char;
            } else if (char == "\n") {
                escaped[j++] = "\\";
                escaped[j++] = "n";
            } else if (char == "\r") {
                escaped[j++] = "\\";
                escaped[j++] = "r";
            } else {
                escaped[j++] = char;
            }
        }

        return string(escaped);
    }
}
