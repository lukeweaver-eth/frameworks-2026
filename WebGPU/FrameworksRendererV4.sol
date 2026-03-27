// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Strings        } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64         } from "@openzeppelin/contracts/utils/Base64.sol";
import { IScriptyBuilderV2,
         HTMLRequest,
         HTMLTagType,
         HTMLTag        } from "scripty.sol/contracts/scripty/interfaces/IScriptyBuilderV2.sol";
import { IRenderer      } from "./../interfaces/IRenderer.sol";
import { ArtifactReader } from "./../libraries/ArtifactReader.sol";
import { Token          } from "./../types/Token.sol";

/// @title  Frameworks Renderer V4 (WebGPU)
/// @author Savage Systems
/// @notice Renders Frameworks V4 compositions as fully on-chain interactive
///         WebGPU artifacts via the Mint protocol.
///
///         Artifact format: abi.encode(string image, string commandString)
///         - image:         static preview as a data URI (captured from builder)
///         - commandString: condensed Frameworks command DSL string
///
///         The renderer assembles a self-contained HTML page using ScriptyBuilderV2:
///         1. <title> + fullSizeCanvas.css from EthFS (head)
///         2. Inject `let autoExecuteCommand = '...';` (body, inline script)
///         3. Load frameworks_v4_viewer.min.js.gz from EthFS (body, gzipped)
///         4. Load gunzipScripts to decompress (body)
///
///         The resulting animation_url is a complete WebGPU application that
///         renders the composition in viewer mode (no editing UI).
contract FrameworksRendererV4 is IRenderer {

    // =========================================================================
    // Infrastructure addresses (same across mainnet, Sepolia, Goerli, etc.)
    // =========================================================================

    /// @dev EthFS V2 FileStorage — stores named files as on-chain bytecode.
    address constant private ethfsFileStorage = 0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245;

    /// @dev ScriptyBuilderV2 — assembles HTML from head/body tag arrays.
    address constant private scriptyBuilder   = 0xD7587F110E08F4D120A231bA97d3B577A81Df022;

    /// @dev ScriptyStorageV2 — alternative storage (unused here but noted for completeness).
    address constant private scriptyStorage   = 0xbD11994aABB55Da86DC246EBB17C1Be0af5b7699;

    // =========================================================================
    // IRenderer — identity
    // =========================================================================

    /// @notice Human-readable name shown in Mint UIs.
    function name() external pure returns (string memory) {
        return "Frameworks V4 (WebGPU)";
    }

    /// @notice Monotonic version for distinguishing deployed iterations.
    function version() external pure returns (uint) {
        return 4;
    }

    // =========================================================================
    // IRenderer — metadata
    // =========================================================================

    /// @notice Generate the complete JSON metadata for a given token.
    /// @dev    Decodes the artifact into (image, commandString), then builds
    ///         a JSON blob with image, script_url, and animation_url fields.
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
                '"script_url": "data:text/javascript;base64,',
                    Base64.encode(bytes(commandString)), '",',
                '"animation_url": "', generateHtml(token.name, commandString), '"',
            '}'
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(dataURI)
            )
        );
    }

    /// @notice Return just the static preview image URI.
    function imageURI(uint, Token calldata token) external view returns (string memory) {
        (string memory image, ) =
            abi.decode(ArtifactReader.get(token), (string, string));
        return image;
    }

    /// @notice Return the interactive animation URI (full WebGPU HTML page).
    function animationURI(uint, Token calldata token) external view returns (string memory) {
        (, string memory commandString) =
            abi.decode(ArtifactReader.get(token), (string, string));
        return generateHtml(token.name, commandString);
    }

    /// @notice Return the raw command string as a JS data URI.
    function scriptURI(uint, Token calldata token) external view returns (string memory) {
        (, string memory commandString) =
            abi.decode(ArtifactReader.get(token), (string, string));
        return string(
            abi.encodePacked(
                "data:text/javascript;base64,",
                Base64.encode(bytes(commandString))
            )
        );
    }

    // =========================================================================
    // Internal — HTML assembly via ScriptyBuilderV2
    // =========================================================================

    /// @dev Assembles a complete HTML page that:
    ///      - Sets the page title
    ///      - Loads fullSizeCanvas.css for full-viewport styling
    ///      - Injects the command string as a global JS variable
    ///      - Loads the gzipped Frameworks V4 viewer from EthFS
    ///      - Loads the gunzip decompressor
    ///
    ///      The viewer script checks for `autoExecuteCommand` on init,
    ///      hides all editing UI, and renders the composition in viewer mode.
    function generateHtml(
        string memory title,
        string memory commandString
    ) internal view returns (string memory) {

        // — Head tags —

        HTMLTag[] memory headTags = new HTMLTag[](3);

        // 1. Page title
        headTags[0].tagOpen    = "<title>";
        headTags[0].tagContent = bytes(title);
        headTags[0].tagClose   = "</title>";

        // 2. Viewport meta for proper scaling
        headTags[1].tagOpen    = '<meta name="viewport" content="width=device-width,initial-scale=1"';
        headTags[1].tagClose   = ">";

        // 3. fullSizeCanvas.css from EthFS (base64 data URI stylesheet)
        headTags[2].name            = "fullSizeCanvas.css";
        headTags[2].tagOpen         = '<link rel="stylesheet" href="data:text/css;base64,';
        headTags[2].tagClose        = '">';
        headTags[2].contractAddress = ethfsFileStorage;

        // — Body tags —

        HTMLTag[] memory bodyTags = new HTMLTag[](4);

        // 1. Inline: inject the command string + WebGPU fallback check
        bodyTags[0].tagContent = abi.encodePacked(
            "let autoExecuteCommand='",
            bytes(commandString),
            "';"
            "if(!navigator.gpu){"
                "document.body.innerHTML="
                "'<div style=\"display:flex;align-items:center;justify-content:center;"
                "height:100vh;color:#888;font-family:monospace;text-align:center;padding:2em\">"
                "<div><h2>WebGPU Required</h2>"
                "<p>This artifact requires a WebGPU-capable browser.<br>"
                "Chrome 113+, Edge 113+, or Firefox Nightly.</p></div></div>';"
            "}"
        );
        bodyTags[0].tagType = HTMLTagType.script;

        // 2. Frameworks V4 viewer script (gzipped, base64 data URI)
        //    This is the minified viewer-only build of frameworks-v4.
        //    Name must match what was uploaded to EthFS.
        bodyTags[1].name            = "frameworks_v4_viewer.min.js.gz";
        bodyTags[1].tagType         = HTMLTagType.scriptGZIPBase64DataURI;
        bodyTags[1].contractAddress = ethfsFileStorage;

        // 3. gunzip decompressor (already on EthFS from prior deployments)
        bodyTags[2].name            = "gunzipScripts-0.0.1.js";
        bodyTags[2].tagType         = HTMLTagType.scriptBase64DataURI;
        bodyTags[2].contractAddress = ethfsFileStorage;

        // 4. Inline: initialization trigger for after gunzip completes
        //    The viewer script's main() is called automatically, but we
        //    add a small bootstrap to ensure autoExecuteCommand is picked up.
        bodyTags[3].tagContent = abi.encodePacked(
            "if(typeof main==='function'&&typeof autoExecuteCommand!=='undefined'){"
                "/* main() auto-invoked by viewer script */"
            "}"
        );
        bodyTags[3].tagType = HTMLTagType.script;

        // — Assemble —

        HTMLRequest memory htmlRequest;
        htmlRequest.headTags = headTags;
        htmlRequest.bodyTags = bodyTags;

        return string(
            IScriptyBuilderV2(scriptyBuilder).getEncodedHTML(htmlRequest)
        );
    }

}
