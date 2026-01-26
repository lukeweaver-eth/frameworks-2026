// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FrameworksRendererV3
 * @dev Manages component versions and ETHFS paths for Frameworks V3 renderer
 *
 * This contract serves as the on-chain registry for all Frameworks V3 modules.
 * Each module (core, palette, camera, color, selection, etc.) can be updated
 * independently, with versioning tracked on-chain.
 *
 * The contract generates HTML loaders that stitch together all modules from ETHFS.
 */
contract FrameworksRendererV3 {

    /// @dev Component metadata
    struct Component {
        string name;           // Component name (e.g., "core", "camera")
        string version;        // Semantic version (e.g., "1.2.3")
        string ethfsPath;      // ETHFS path (e.g., "ethfs://frameworks-v3-core-v1.2.3.js")
        bytes32 contentHash;   // SHA-256 hash of file content
        uint256 timestamp;     // Deployment timestamp
        bool active;           // Is this component active?
    }

    /// @dev Owner of the contract
    address public owner;

    /// @dev Global renderer version
    string public globalVersion;

    /// @dev Three.js ETHFS path (dependency)
    string public threeJsPath;

    /// @dev HTML index ETHFS path
    string public htmlPath;

    /// @dev Component name → Component data
    mapping(string => Component) public components;

    /// @dev List of all component names (for iteration)
    string[] public componentNames;

    /// @dev Load order for modules (dependency order)
    string[] public loadOrder;

    /// @dev Events
    event ComponentUpdated(string indexed name, string version, string ethfsPath, bytes32 contentHash);
    event GlobalVersionUpdated(string version);
    event ThreeJsPathUpdated(string path);
    event HTMLPathUpdated(string path);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @dev Modifier: Only owner
    modifier onlyOwner() {
        require(msg.sender == owner, "FrameworksRendererV3: caller is not the owner");
        _;
    }

    /**
     * @dev Constructor
     * @param _owner Initial owner address
     * @param _globalVersion Initial global version
     * @param _threeJsPath Path to Three.js on ETHFS
     */
    constructor(address _owner, string memory _globalVersion, string memory _threeJsPath) {
        owner = _owner;
        globalVersion = _globalVersion;
        threeJsPath = _threeJsPath;

        // Initialize load order (dependency order)
        loadOrder = [
            "core",
            "palette",
            "camera",
            "color",
            "selection",
            "commandTree",
            "commands",
            "renderer"
        ];

        emit GlobalVersionUpdated(_globalVersion);
        emit ThreeJsPathUpdated(_threeJsPath);
    }

    /**
     * @dev Update a single component
     * @param name Component name
     * @param version Semantic version
     * @param ethfsPath ETHFS path
     * @param contentHash SHA-256 hash
     */
    function updateComponent(
        string memory name,
        string memory version,
        string memory ethfsPath,
        bytes32 contentHash
    ) external onlyOwner {
        bool isNew = bytes(components[name].name).length == 0;

        components[name] = Component({
            name: name,
            version: version,
            ethfsPath: ethfsPath,
            contentHash: contentHash,
            timestamp: block.timestamp,
            active: true
        });

        // Add to component names if new
        if (isNew) {
            componentNames.push(name);
        }

        emit ComponentUpdated(name, version, ethfsPath, contentHash);
    }

    /**
     * @dev Update multiple components in batch (gas efficient)
     * @param names Component names
     * @param versions Semantic versions
     * @param ethfsPaths ETHFS paths
     * @param contentHashes SHA-256 hashes
     */
    function updateMultipleComponents(
        string[] memory names,
        string[] memory versions,
        string[] memory ethfsPaths,
        bytes32[] memory contentHashes
    ) external onlyOwner {
        require(
            names.length == versions.length &&
            names.length == ethfsPaths.length &&
            names.length == contentHashes.length,
            "FrameworksRendererV3: array length mismatch"
        );

        for (uint256 i = 0; i < names.length; i++) {
            bool isNew = bytes(components[names[i]].name).length == 0;

            components[names[i]] = Component({
                name: names[i],
                version: versions[i],
                ethfsPath: ethfsPaths[i],
                contentHash: contentHashes[i],
                timestamp: block.timestamp,
                active: true
            });

            if (isNew) {
                componentNames.push(names[i]);
            }

            emit ComponentUpdated(names[i], versions[i], ethfsPaths[i], contentHashes[i]);
        }
    }

    /**
     * @dev Get component data
     * @param name Component name
     * @return Component struct
     */
    function getComponent(string memory name) external view returns (Component memory) {
        return components[name];
    }

    /**
     * @dev Get all component names
     * @return Array of component names
     */
    function getAllComponentNames() external view returns (string[] memory) {
        return componentNames;
    }

    /**
     * @dev Get all active components
     * @return Array of Component structs
     */
    function getAllComponents() external view returns (Component[] memory) {
        uint256 activeCount = 0;

        // Count active components
        for (uint256 i = 0; i < componentNames.length; i++) {
            if (components[componentNames[i]].active) {
                activeCount++;
            }
        }

        // Build array of active components
        Component[] memory result = new Component[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < componentNames.length; i++) {
            if (components[componentNames[i]].active) {
                result[index] = components[componentNames[i]];
                index++;
            }
        }

        return result;
    }

    /**
     * @dev Get module script tags in load order
     * @return String of <script> tags
     */
    function getModuleScriptTags() public view returns (string memory) {
        string memory result = "";

        for (uint256 i = 0; i < loadOrder.length; i++) {
            Component memory comp = components[loadOrder[i]];

            if (comp.active && bytes(comp.ethfsPath).length > 0) {
                result = string(abi.encodePacked(
                    result,
                    '<script src="',
                    comp.ethfsPath,
                    '"></script>\n'
                ));
            }
        }

        return result;
    }

    /**
     * @dev Set global version
     * @param version New global version
     */
    function setGlobalVersion(string memory version) external onlyOwner {
        globalVersion = version;
        emit GlobalVersionUpdated(version);
    }

    /**
     * @dev Set Three.js ETHFS path
     * @param path New Three.js path
     */
    function setThreeJsPath(string memory path) external onlyOwner {
        threeJsPath = path;
        emit ThreeJsPathUpdated(path);
    }

    /**
     * @dev Set HTML index ETHFS path
     * @param path New HTML path
     */
    function setHTMLPath(string memory path) external onlyOwner {
        htmlPath = path;
        emit HTMLPathUpdated(path);
    }

    /**
     * @dev Set component load order
     * @param order New load order array
     */
    function setLoadOrder(string[] memory order) external onlyOwner {
        loadOrder = order;
    }

    /**
     * @dev Get current load order
     * @return Array of component names in load order
     */
    function getLoadOrder() external view returns (string[] memory) {
        return loadOrder;
    }

    /**
     * @dev Deactivate a component (soft delete)
     * @param name Component name
     */
    function deactivateComponent(string memory name) external onlyOwner {
        require(bytes(components[name].name).length > 0, "FrameworksRendererV3: component not found");
        components[name].active = false;
    }

    /**
     * @dev Reactivate a component
     * @param name Component name
     */
    function reactivateComponent(string memory name) external onlyOwner {
        require(bytes(components[name].name).length > 0, "FrameworksRendererV3: component not found");
        components[name].active = true;
    }

    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FrameworksRendererV3: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Get HTML path (for integration with mint protocol)
     * @return HTML ETHFS path
     */
    function getHTMLPath() external view returns (string memory) {
        return htmlPath;
    }
}
