# Frameworks V3 - ETHFS Deployment System

Modular deployment system for Frameworks V3 components to ETHFS (Ethereum File System).

## Architecture

Frameworks V3 is split into 9 independent modules:
- **core.js** - Frame, Cursor, Framework classes
- **palette.js** - Color palette management
- **context-camera.js** - Camera context (view controls)
- **context-color.js** - Color context (palette navigation)
- **context-selection.js** - Frame selection context
- **command-tree.js** - Undo/fork command tree
- **commands.js** - Command executor
- **renderer-instanced.js** - Three.js instanced renderer
- **index.html** - HTML wrapper

Each module is independently versioned and deployed to ETHFS. The Solidity contract tracks all versions and generates HTML loaders.

## Directory Structure

```
frameworks-v3/
├── deploy/
│   ├── deploy.js           # Main deployment script
│   ├── config.json         # Configuration (component paths, network)
│   ├── versions.json       # Deployment state tracker
│   ├── hash-tracker.js     # File change detection
│   ├── ethfs-upload.js     # ETHFS upload logic
│   ├── html-generator.js   # HTML generation
│   └── README.md           # This file
├── contracts/
│   └── FrameworksRendererV3.sol  # On-chain component registry
└── src/
    └── (component files)
```

## Files

### deploy.js
Main orchestration script. Detects changed files, uploads to ETHFS, updates Solidity contract, generates HTML.

**Usage:**
```bash
# Deploy all changed components
node deploy/deploy.js

# Dry run (simulate without uploading)
node deploy/deploy.js --dry-run

# Deploy specific component
node deploy/deploy.js --component camera --bump minor

# Deploy to testnet
node deploy/deploy.js --network sepolia

# Force deploy (even if no changes)
node deploy/deploy.js --force
```

**Options:**
- `-d, --dry-run` - Simulate deployment without uploading
- `-c, --component NAME` - Deploy only specific component
- `-b, --bump TYPE` - Version bump: major, minor, patch (default: patch)
- `-n, --network NAME` - Network: mainnet, sepolia (default: mainnet)
- `-f, --force` - Force deployment even if no changes
- `-h, --help` - Show help

### config.json
Configuration file mapping components to source files and defining load order.

**Structure:**
```json
{
  "network": "mainnet",
  "components": {
    "core": "src/core.js",
    "palette": "src/palette.js",
    ...
  },
  "loadOrder": ["core", "palette", ...],
  "dependencies": {
    "threejs": {
      "version": "0.160.0",
      "ethfsPath": "ethfs://three.min.js"
    }
  }
}
```

### versions.json
Tracks deployment state - which versions of each component are deployed.

**Structure:**
```json
{
  "globalVersion": "1.0.0",
  "lastDeployment": "2025-01-25T12:00:00Z",
  "components": {
    "core": {
      "version": "1.0.0",
      "hash": "abc123...",
      "ethfsPath": "ethfs://frameworks-v3-core-v1.0.0.js",
      "lastModified": "2025-01-25T10:00:00Z",
      "size": 12345
    },
    ...
  },
  "deploymentHistory": [...]
}
```

### hash-tracker.js
Computes SHA-256 hashes of source files to detect changes.

**Functions:**
- `computeFileHash(filePath)` - Compute hash of single file
- `computeAllHashes(config, baseDir)` - Hash all components
- `detectChanges(current, previous)` - Find changed components
- `printChangeReport(report)` - Print change summary

### ethfs-upload.js
ETHFS upload integration (stub - needs real implementation).

**Functions:**
- `uploadToETHFS(filePath, filename, config)` - Upload single file
- `uploadMultiple(files, config)` - Upload multiple files
- `estimateGas(filePath)` - Estimate gas cost

**TODO:** Implement actual ETHFS upload using ethfs-cli or SDK.

### html-generator.js
Generates HTML files that load modules from ETHFS.

**Functions:**
- `extractCSS(templatePath)` - Extract CSS from template
- `extractBodyHTML(templatePath)` - Extract HTML body
- `extractInitScript(templatePath)` - Extract initialization code
- `generateHTML(versions, config, templatePath)` - Generate complete HTML
- `generateTestHTML(templatePath, outputPath)` - Generate test build with local modules

## Deployment Workflow

```
1. Compute file hashes
   ├─> Compare with versions.json
   └─> Detect changed components

2. For each changed component:
   ├─> Increment version (patch/minor/major)
   ├─> Generate filename: frameworks-v3-{component}-v{version}.js
   ├─> Upload to ETHFS
   └─> Get back ETHFS path

3. Update versions.json
   ├─> Store new versions
   ├─> Store ETHFS paths
   ├─> Store hashes
   └─> Add to deployment history

4. Generate HTML
   ├─> Extract CSS and body from template
   ├─> Inject ETHFS module paths
   ├─> Upload HTML to ETHFS
   └─> Update index component in versions.json

5. Update Solidity contract (manual)
   ├─> Call updateMultipleComponents()
   ├─> Set new htmlPath
   └─> Increment global version
```

## Versioning Strategy

**Semantic Versioning:** `major.minor.patch`

- **Patch (x.y.Z)**: Bug fixes, no API changes
- **Minor (x.Y.0)**: New features, backward compatible
- **Major (X.0.0)**: Breaking changes

**Component-level versioning:** Each module has independent version.

**Global version:** Overall renderer version (incremented on each deployment).

**Naming convention:**
```
frameworks-v3-{component}-v{version}.js

Examples:
- frameworks-v3-core-v1.0.0.js
- frameworks-v3-camera-v1.0.2.js
- frameworks-v3-commands-v2.1.0.js
```

## Solidity Contract

**FrameworksRendererV3.sol** - On-chain component registry

**Key functions:**
- `updateComponent(name, version, ethfsPath, hash)` - Update single component
- `updateMultipleComponents(names, versions, paths, hashes)` - Batch update
- `getComponent(name)` - Get component data
- `getAllComponents()` - Get all active components
- `getModuleScriptTags()` - Generate <script> tags for HTML
- `setGlobalVersion(version)` - Update global version
- `setHTMLPath(path)` - Update HTML ETHFS path
- `getHTMLPath()` - Get current HTML path (for mint protocol)

## Integration with Mint Protocol

```solidity
interface IFrameworksRenderer {
    function getHTMLPath() external view returns (string memory);
    function getGlobalVersion() external view returns (string memory);
}

contract MintProtocol {
    IFrameworksRenderer public renderer;

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        string memory htmlPath = renderer.getHTMLPath();
        return string(abi.encodePacked(htmlPath, "?token=", tokenId));
    }
}
```

## Usage Examples

### Deploy all changes
```bash
node deploy/deploy.js
```

### Test deployment without uploading
```bash
node deploy/deploy.js --dry-run
```

### Deploy specific component with minor version bump
```bash
node deploy/deploy.js --component camera --bump minor
```

### Deploy to Sepolia testnet
```bash
node deploy/deploy.js --network sepolia
```

### Force deployment (no changes detected but want to deploy)
```bash
node deploy/deploy.js --force --component renderer
```

## Next Steps

1. **Implement real ETHFS upload** - Replace stub in ethfs-upload.js
2. **Deploy Solidity contract** - Deploy FrameworksRendererV3.sol to mainnet
3. **Configure .env** - Add private keys and contract addresses
4. **Test deployment** - Run dry-run on testnet
5. **Integrate with mint protocol** - Connect renderer to token minting

## Benefits

- ✅ **Modular Updates** - Only upload changed components
- ✅ **Version Tracking** - Clear history of each component
- ✅ **Gas Efficiency** - Batch contract updates
- ✅ **Rollback Capability** - Reference older versions if needed
- ✅ **Immutability** - ETHFS provides permanent storage
- ✅ **Composability** - Other projects can use individual contexts
- ✅ **Testing** - Dry-run mode for safe testing

## Troubleshooting

**"Component not found"**
- Check that component name matches config.json
- Verify file exists at specified path

**"No changes detected"**
- Use `--force` to deploy anyway
- Check that file was actually modified

**"ETHFS upload failed"**
- Verify network connection
- Check gas settings
- Ensure sufficient ETH for gas

**"HTML generation failed"**
- Verify index-instanced.html exists
- Check that all components are deployed
- Ensure template has required structure

## Support

For issues or questions:
1. Check this README
2. Review deployment logs
3. Inspect versions.json for state
4. Run with --dry-run to simulate
5. Check Solidity contract events on Etherscan
