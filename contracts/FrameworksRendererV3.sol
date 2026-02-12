// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Strings        } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64         } from "@openzeppelin/contracts/utils/Base64.sol";
import { IScriptyBuilderV2,
         HTMLRequest,
         HTMLTagType,
         HTMLTag        } from "scripty.sol/contracts/scripty/interfaces/IScriptyBuilderV2.sol";
import { IRenderer      } from "@visualizevalue/mint/contracts/contracts/interfaces/IRenderer.sol";
import { ArtifactReader } from "@visualizevalue/mint/contracts/contracts/libraries/ArtifactReader.sol";
import { Token          } from "@visualizevalue/mint/contracts/contracts/types/Token.sol";

contract FrameworksRendererV3 is IRenderer {
    address constant private ethfsFileStorage = 0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245;
    address constant private scriptyBuilder   = 0xD7587F110E08F4D120A231bA97d3B577A81Df022;
    address constant private scriptyStorage   = 0xbD11994aABB55Da86DC246EBB17C1Be0af5b7699;

    /// @notice ETHFS filename for the Frameworks library
    string public ethfsFilename;

    /// @notice Deploy renderer with specific Frameworks version
    /// @param _ethfsFilename The filename on ETHFS (e.g., "frameworks-3.1.2-combined.min.js")
    constructor(string memory _ethfsFilename) {
        ethfsFilename = _ethfsFilename;
    }

    /// @notice Expose the name of this renderer for easy registration in UIs.
    function name () external pure returns (string memory) {
        return "Frameworks V3 Renderer";
    }

    /// @notice Expose the version of this renderer to identify it in UIs.
    function version () external pure returns (uint) {
        return 3;
    }

    /// @notice Generate the JSON metadata for a given token.
    ///         We expect the static preview image and command string
    //          to both be encoded in the artifact data.
    function uri (
        uint tokenId,
        Token calldata token
    ) external view returns (string memory) {
        (string memory image, string memory commands) = abi.decode(ArtifactReader.get(token), (string, string));

        bytes memory dataURI = abi.encodePacked(
            '{',
                '"id": "', Strings.toString(tokenId), '",',
                '"name": "', token.name, '",',
                '"description": "', token.description, '",',
                '"image": "', image, '",',
                '"animation_url": "', generateHtml(token.name, commands), '"',
            '}'
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(dataURI)
            )
        );
    }

    /// @notice Generate the preview image URI.
    function imageURI (uint, Token calldata token) external view returns (string memory) {
        (string memory image,) = abi.decode(ArtifactReader.get(token), (string, string));

        return image;
    }

    /// @notice Generate the script URI.
    function scriptURI (uint, Token calldata token) external view returns (string memory) {
        (, string memory commands) = abi.decode(ArtifactReader.get(token), (string, string));

        return string(abi.encodePacked("data:text/javascript;base64,", Base64.encode(bytes(commands))));
    }

    /// @notice Generate the animation URI.
    function animationURI (uint, Token calldata token) external view returns (string memory) {
        (, string memory commands) = abi.decode(ArtifactReader.get(token), (string, string));

        return generateHtml(token.name, commands);
    }

    /// @dev Generates the HTML for a given token with Frameworks commands.
    function generateHtml (string memory title, string memory commands) internal view returns (string memory) {
        HTMLTag[] memory headTags = new HTMLTag[](2);

        // Name the file
        headTags[0].tagOpen = "<title>";
        headTags[0].tagContent = bytes(title);
        headTags[0].tagClose = "</title>";

        // Add base styles for fullscreen canvas
        headTags[1].name = "fullSizeCanvas.css";
        headTags[1].tagOpen = '<link rel="stylesheet" href="data:text/css;base64,';
        headTags[1].tagClose = '">';
        headTags[1].contractAddress = ethfsFileStorage;

        // Add Three.js and Frameworks scripts
        HTMLTag[] memory bodyTags = new HTMLTag[](5);

        // Load Three.js (gzipped)
        bodyTags[0].name = "three-v0.147.0.min.js.gz";
        bodyTags[0].tagType = HTMLTagType.scriptGZIPBase64DataURI;
        bodyTags[0].contractAddress = ethfsFileStorage;

        // Unzip script
        bodyTags[1].name = "gunzipScripts-0.0.1.js";
        bodyTags[1].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[1].contractAddress = ethfsFileStorage;

        // Set config BEFORE loading Frameworks (this is critical!)
        bodyTags[2].tagContent = bytes(
            string(abi.encodePacked(
                "window.FRAMEWORKS_CONFIG = { commandHistory: '", commands, "', isOnChain: true };"
            ))
        );
        bodyTags[2].tagType = HTMLTagType.script;

        // Load Frameworks V3 library from ETHFS
        bodyTags[3].name = ethfsFilename;
        bodyTags[3].tagType = HTMLTagType.scriptBase64DataURI;
        bodyTags[3].contractAddress = ethfsFileStorage;

        // Initialize Frameworks and execute commands
        bodyTags[4].tagContent = bytes(
            string(abi.encodePacked(
                "function waitForFrameworks(callback){if(typeof THREE!=='undefined'&&typeof Framework!=='undefined'&&typeof FrameworksInstancedRenderer!=='undefined'){callback();}else{setTimeout(()=>waitForFrameworks(callback),50);}}",
                "waitForFrameworks(()=>{",
                    "const framework=new Framework();",
                    "const paletteManager=new PaletteManager('eightyColors');",
                    "const container=document.createElement('div');",
                    "container.id='container';",
                    "container.style.cssText='width:100%;height:100vh;margin:0;padding:0;';",
                    "document.body.style.margin='0';",
                    "document.body.appendChild(container);",
                    "const renderer=new FrameworksInstancedRenderer(framework,'container');",
                    "const colorContext=new ColorContext(framework,paletteManager);",
                    "const cameraContext=new CameraContext(framework,renderer);",
                    "const selectionContext=new FrameSelectionContext(framework);",
                    "const commandTree=new CommandTree();",
                    "const commandExecutor=new CommandExecutor(framework,paletteManager,renderer,commandTree,colorContext,cameraContext,selectionContext);",
                    "renderer.start();",
                    "if(window.FRAMEWORKS_CONFIG.commandHistory){",
                        "commandExecutor.executeCommandString(window.FRAMEWORKS_CONFIG.commandHistory);",
                    "}",
                    "document.addEventListener('keydown',(e)=>{",
                        "if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'){return;}",
                        "const key=e.key;",
                        "const isShift=e.shiftKey;",
                        "commandExecutor.executeKey(key,isShift);",
                    "});",
                "});"
            ))
        );
        bodyTags[4].tagType = HTMLTagType.script;

        // Assemble the html
        HTMLRequest memory htmlRequest;
        htmlRequest.headTags = headTags;
        htmlRequest.bodyTags = bodyTags;

        return string(IScriptyBuilderV2(scriptyBuilder).getEncodedHTML(htmlRequest));
    }

}
