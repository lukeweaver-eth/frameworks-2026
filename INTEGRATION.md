# Frameworks V3 - ETHFS + Mint Protocol Integration

Complete guide to deploying Frameworks V3 as a fully on-chain renderer for the mint protocol using ETHFS and Scripty.sol.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Technologies](#key-technologies)
- [Deployment Workflow](#deployment-workflow)
- [Contract Integration](#contract-integration)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

Frameworks V3 is deployed as a modular, fully on-chain renderer system using three key technologies:

1. **ETHFS** - On-chain file storage using SSTORE2 bytecode
2. **Scripty.sol** - Gas-efficient HTML generation from on-chain scripts
3. **Mint Protocol** - NFT minting with pluggable renderer system

This integration allows Frameworks structures to be minted as NFTs where:
- All code is stored on-chain via ETHFS
- HTML is generated on-chain via Scripty.sol
- Each token stores command history + preview image as artifact data
- The structure can be reconstructed from commands on any chain

---

## Architecture

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LOCAL DEVELOPMENT                                        │
│                                                             │
│  src/                                                       │
│    core.js ────────┐                                       │
│    palette.js ─────┤                                       │
│    camera.js ──────┤                                       │
│    commands.js ────┤── Modular contexts                    │
│    renderer.js ────┤                                       │
│    ... ────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. DEPLOYMENT SYSTEM                                        │
│                                                             │
│  deploy/deploy.js                                           │
│    - Detects file changes (SHA-256 hashing)                │
│    - Versions components (semantic versioning)             │
│    - Uploads to ETHFS FileStore                            │
│    - Tracks SSTORE2 pointers                               │
│    - Updates versions.json                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ON-CHAIN STORAGE (ETHFS)                                │
│                                                             │
│  FileStore (0xFe14...dFa0FB)                               │
│    frameworks-v3-core-v1.0.0.js      → 0xABCD...pointer   │
│    frameworks-v3-palette-v1.0.0.js   → 0xEF01...pointer   │
│    frameworks-v3-camera-v1.0.0.js    → 0x1234...pointer   │
│    ...                                                      │
│                                                             │
│  Files stored as SSTORE2 bytecode chunks                   │
│  Automatically chunked at 24KB boundaries                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RENDERER CONTRACT                                        │
│                                                             │
│  FrameworksRenderer.sol                                     │
│    - Implements IRenderer interface                        │
│    - References ETHFS files by name                        │
│    - Uses Scripty.sol for HTML generation                  │
│    - Decodes artifact data (commands, preview)             │
│    - Returns base64-encoded HTML data URI                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. MINT PROTOCOL                                            │
│                                                             │
│  Token                                                      │
│    name: "Spatial Framework #1"                            │
│    artifact: [0x...pointer to command data]               │
│    renderer: index of FrameworksRenderer                   │
│                                                             │
│  Factory.mint() → Calls FrameworksRenderer.uri()           │
│                                                             │
│  Returns JSON metadata with animation_url containing       │
│  fully reconstructable Frameworks structure                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User builds structure → Commands recorded → Upload to ETHFS
                                                  │
                                                  ▼
                                            SSTORE2 pointer
                                                  │
                                                  ▼
                                      Mint token with pointer
                                                  │
                                                  ▼
                                      Renderer.uri() called
                                                  │
                                                  ▼
                                      Scripty.sol assembles HTML
                                                  │
                                                  ▼
                                      Returns data:text/html;base64,...
                                                  │
                                                  ▼
                                      Structure reconstructed in browser
```

---

## Key Technologies

### ETHFS (Ethereum File System)

**Contract:** `0xFe1411d6864592549AdE050215482e4385dFa0FB` (all networks)

ETHFS uses the SSTORE2 pattern to efficiently store files on-chain:
- Stores data as contract bytecode (cheaper than SSTORE)
- Automatically chunks files at 24KB boundaries
- Content-addressable via SSTORE2 pointers
- Same contract address across all EVM chains

**Key Methods:**
```solidity
function createFile(string memory filename, string memory contents)
    returns (address pointer, File memory file)

function createFileFromChunks(string memory filename, string[] memory chunks)
    returns (address pointer, File memory file)

function getFile(string memory filename)
    returns (File memory file)
```

**File Struct:**
```solidity
struct File {
    uint256 size;
    BytecodeSlice[] slices;  // Array of SSTORE2 pointers + offsets
}

struct BytecodeSlice {
    address pointer;  // SSTORE2 contract address
    uint32 start;     // Offset into bytecode
    uint32 end;       // End offset
}
```

### Scripty.sol

**Contract:** `0xD7587F110E08F4D120A231bA97d3B577A81Df022`

Scripty.sol provides gas-efficient on-chain HTML generation:
- Fetches scripts from ETHFS by filename
- Assembles HTML with proper tags
- Supports multiple tag types (script, base64 data URI, GZIP)
- Returns base64-encoded HTML

**Usage Pattern:**
```solidity
HTMLTag[] memory bodyTags = new HTMLTag[](3);

// Reference ETHFS file
bodyTags[0].name = "frameworks-v3-core-v1.0.0.js";
bodyTags[0].tagType = HTMLTagType.scriptBase64DataURI;
bodyTags[0].contractAddress = ETHFS_FILE_STORE;

// Inline script
bodyTags[1].tagContent = bytes("window.config={...}");
bodyTags[1].tagType = HTMLTagType.script;

HTMLRequest memory htmlRequest;
htmlRequest.bodyTags = bodyTags;

bytes memory html = IScriptyBuilderV2(SCRIPTY_BUILDER).getEncodedHTML(htmlRequest);
```

### Mint Protocol

**Renderer Interface:**
```solidity
interface IRenderer {
    function name() external pure returns (string memory);
    function version() external pure returns (uint);
    function uri(uint tokenId, Token calldata token) external view returns (string memory);
    function imageURI(uint tokenId, Token calldata token) external view returns (string memory);
    function animationURI(uint tokenId, Token calldata token) external view returns (string memory);
}
```

**Token Struct:**
```solidity
struct Token {
    string  name;
    string  description;
    address[] artifact;    // SSTORE2 pointers to token data
    uint32  renderer;      // Index in renderer registry
    uint32  mintedBlock;
    uint64  closeAt;
    uint128 data;
}
```

**Artifact Data Format:**

For Frameworks, the artifact contains:
```solidity
abi.encode(
    string previewImage,    // Base64 data URI or IPFS URL
    string commandHistory,  // "fdfTT..." keystroke commands
    string initialData      // Optional: JSON-serialized frame data
)
```

---

## Deployment Workflow

### Prerequisites

1. **Install Dependencies:**
   ```bash
   npm install ethers
   ```

2. **Set Environment Variables:**
   ```bash
   export PRIVATE_KEY="0x..."
   export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
   ```

3. **Configure Networks:**
   Edit `deploy/config.json` with your RPC URLs:
   ```json
   {
     "networks": {
       "mainnet": {
         "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
         ...
       }
     }
   }
   ```

### Step 1: Modify Source Files

Edit any of the Frameworks modules:
```bash
src/core.js
src/palette.js
src/context-camera.js
src/commands.js
src/renderer-instanced.js
```

### Step 2: Deploy to ETHFS

**Dry Run (recommended first):**
```bash
cd deploy
node deploy.js --dry-run
```

This will:
- Compute hashes of all files
- Detect which files changed
- Show what would be uploaded
- No actual transactions

**Deploy All Changed Files:**
```bash
node deploy.js --network sepolia
```

**Deploy Specific Component:**
```bash
node deploy.js --component camera --bump minor
```

**Force Deploy (even if unchanged):**
```bash
node deploy.js --component core --force
```

### Step 3: Verify Deployment

Check `deploy/versions.json` for updated pointers:
```json
{
  "components": {
    "core": {
      "version": "1.0.0",
      "hash": "a3f2...",
      "filename": "frameworks-v3-core-v1.0.0.js",
      "pointer": "0xABCD...1234",
      "lastModified": "2025-01-25T10:30:00.000Z"
    }
  }
}
```

### Step 4: Deploy Renderer Contract

Deploy `contracts/FrameworksRenderer.sol` to the same network:

```bash
# Using Foundry
forge create contracts/FrameworksRenderer.sol:FrameworksRenderer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

# Or using Hardhat
npx hardhat run scripts/deploy-renderer.js --network sepolia
```

**Important:** The renderer contract references ETHFS files by **filename** (e.g., `frameworks-v3-core-v1.0.0.js`), not by pointer. Make sure the filenames in the contract match those uploaded to ETHFS.

### Step 5: Register with Mint Protocol

Register the FrameworksRenderer with mint protocol's Factory:

```solidity
// Call mint Factory
factory.addRenderer(address(frameworksRenderer));
```

The renderer will be assigned an index which users can specify when minting.

---

## Contract Integration

### FrameworksRenderer.sol

Located at: `contracts/FrameworksRenderer.sol`

**Key Features:**
- Implements mint protocol `IRenderer` interface
- References 7 Frameworks modules from ETHFS
- Uses Scripty.sol for on-chain HTML generation
- Decodes artifact data to extract commands and preview
- Includes JavaScript string escaping for safe injection

**Referenced ETHFS Files:**
```solidity
bodyTags[0].name = "three-v0.160.0.min.js";           // Three.js
bodyTags[1].name = "frameworks-v3-core-v1.0.0.js";    // Core
bodyTags[2].name = "frameworks-v3-palette-v1.0.0.js"; // Palette
bodyTags[3].name = "frameworks-v3-camera-v1.0.0.js";  // Camera
bodyTags[4].name = "frameworks-v3-commands-v1.0.0.js"; // Commands
bodyTags[5].name = "frameworks-v3-renderer-v1.0.0.js"; // Renderer
bodyTags[6].name = "frameworks-v3-index-v1.0.0.js";   // Index
```

**Artifact Data Encoding:**

When minting a token, upload command history to ETHFS, then create artifact:

```solidity
// 1. Upload command history and preview to ETHFS
address commandPointer = fileStore.createFile(
    "framework-123-commands.txt",
    "fdfTTss..."
);

address previewPointer = fileStore.createFile(
    "framework-123-preview.png",
    base64ImageData
);

// 2. Encode artifact data
bytes memory artifactData = abi.encode(
    "data:image/png;base64,...",  // previewImage
    "fdfTTss...",                  // commandHistory
    ""                             // initialData (optional)
);

// 3. Store artifact via SSTORE2
address artifactPointer = SSTORE2.write(artifactData);

// 4. Create token with artifact pointer
Token memory token = Token({
    name: "Spatial Framework #123",
    description: "A 3D spatial structure...",
    artifact: [artifactPointer],  // Array of SSTORE2 pointers
    renderer: FRAMEWORKS_RENDERER_INDEX,
    ...
});
```

### Updating the Renderer

When deploying new versions of Frameworks modules to ETHFS, you have two options:

**Option 1: Deploy New Renderer**
- Upload new versions to ETHFS with incremented version numbers
- Deploy new FrameworksRenderer contract referencing new filenames
- Register new renderer with mint protocol
- Old tokens still use old renderer (immutable)

**Option 2: Proxy Pattern**
- Deploy FrameworksRenderer behind upgradeable proxy
- Update renderer logic to reference new ETHFS files
- All tokens automatically use new version
- More complex, but allows continuous improvement

---

## Usage Guide

### For Users (Minting Frameworks)

1. **Build Structure:**
   - Use Frameworks UI to build spatial structure
   - Commands are recorded (e.g., `fdfTTss...`)

2. **Generate Preview:**
   - Capture PNG/SVG preview of structure
   - Encode as base64 data URI

3. **Upload to ETHFS:**
   ```javascript
   const commandPointer = await fileStore.createFile(
       "my-framework-commands",
       commandHistory
   );
   ```

4. **Mint Token:**
   ```javascript
   const artifactData = ethers.utils.defaultAbiCoder.encode(
       ["string", "string", "string"],
       [previewImageDataURI, commandHistory, ""]
   );

   const artifactPointer = await SSTORE2.write(artifactData);

   await factory.mint({
       name: "My Framework",
       description: "A spatial composition",
       artifact: [artifactPointer],
       renderer: FRAMEWORKS_RENDERER_INDEX
   });
   ```

5. **View Token:**
   - Call `tokenURI(tokenId)` to get JSON metadata
   - `animation_url` contains base64-encoded HTML
   - Open in browser to see reconstructed structure

### For Developers (Deploying New Versions)

1. **Modify Source:**
   ```bash
   vim src/commands.js  # Make your changes
   ```

2. **Test Locally:**
   ```bash
   # Test with local index-instanced.html
   open index-instanced.html
   ```

3. **Deploy:**
   ```bash
   cd deploy
   export PRIVATE_KEY="0x..."
   export RPC_URL="https://..."

   # Dry run first
   node deploy.js --dry-run

   # Deploy changed files
   node deploy.js --network sepolia
   ```

4. **Deploy Renderer:**
   ```bash
   forge create contracts/FrameworksRenderer.sol:FrameworksRenderer \
     --rpc-url $RPC_URL \
     --private-key $PRIVATE_KEY
   ```

5. **Test Renderer:**
   ```solidity
   // Call renderer.uri() with test token
   Token memory testToken = ...;
   string memory metadata = renderer.uri(1, testToken);

   // Decode base64 and verify HTML
   ```

---

## Troubleshooting

### Upload Issues

**Error: "File already exists"**
- Use `--force` flag to overwrite
- Or increment version in filename

**Error: "Out of gas"**
- Increase gas limit in `deploy/config.json`
- For very large files, try `createFileFromChunks` with smaller chunks

**Error: "PRIVATE_KEY required"**
- Set environment variable: `export PRIVATE_KEY="0x..."`
- Make sure to include `0x` prefix

### Renderer Issues

**Error: "File not found" in Scripty.sol**
- Verify filename matches ETHFS upload
- Check that ETHFS_FILE_STORAGE address is correct
- Make sure file was uploaded to same network

**HTML Not Rendering:**
- Check browser console for errors
- Verify Three.js loaded correctly
- Check that command history is valid
- Test with `--dry-run` first

### Version Conflicts

**Old version still showing:**
- Deploy new renderer with updated filenames
- Update mint protocol to use new renderer index
- Remember: old tokens use old renderer (immutable)

**versions.json Out of Sync:**
- Run `node deploy.js --dry-run` to see current state
- Use `--force` to redeploy if needed
- Check `deploy/versions.json` for correct pointers

---

## Cost Estimates

### ETHFS Upload Costs

Approximate gas costs for uploading files to ETHFS:

| File Size | Gas Units | Cost @ 50 gwei | Cost @ 100 gwei |
|-----------|-----------|----------------|-----------------|
| 10 KB     | ~200,000  | 0.01 ETH       | 0.02 ETH        |
| 50 KB     | ~1,000,000| 0.05 ETH       | 0.10 ETH        |
| 100 KB    | ~2,000,000| 0.10 ETH       | 0.20 ETH        |
| 500 KB    | ~10,000,000| 0.50 ETH      | 1.00 ETH        |

**Tips to Reduce Costs:**
- Minify JavaScript before upload
- Use gzip compression (Scripty.sol supports `scriptGZIPBase64DataURI`)
- Upload shared libraries (Three.js) once and reference
- Deploy to L2s (Base, Optimism) for 10-100x cheaper uploads

### Full Deployment Cost

Example full deployment to Ethereum mainnet:

```
Three.js (~500 KB):          ~0.50 ETH
Core module (~20 KB):        ~0.02 ETH
Palette module (~10 KB):     ~0.01 ETH
Camera module (~15 KB):      ~0.015 ETH
Commands module (~30 KB):    ~0.03 ETH
Renderer module (~25 KB):    ~0.025 ETH
Index module (~10 KB):       ~0.01 ETH

Renderer Contract Deploy:    ~0.05 ETH

Total:                       ~0.66 ETH @ 50 gwei
```

**L2 Deployment:**
Same deployment on Base or Optimism: **~$5-10** total

---

## Advanced Topics

### Custom Artifact Data

Extend artifact data for more complex use cases:

```solidity
abi.encode(
    string previewImage,
    string commandHistory,
    string initialData,
    string palette,         // Custom color palette
    uint256 timestamp,      // Creation timestamp
    bytes32 metadata        // Additional metadata hash
)
```

Update `FrameworksRenderer._generateHTML()` to decode extra fields.

### GZIP Compression

Compress JavaScript modules before upload:

```javascript
const zlib = require('zlib');
const fs = require('fs');

const source = fs.readFileSync('src/core.js', 'utf8');
const compressed = zlib.gzipSync(source);
const base64 = compressed.toString('base64');

// Upload compressed data
await fileStore.createFile('frameworks-v3-core-v1.0.0.js.gz', base64);
```

Update renderer to use `HTMLTagType.scriptGZIPBase64DataURI`.

### Dynamic Module Loading

For very large deployments, load modules conditionally:

```javascript
bodyTags[7].tagContent = bytes(
    "window.loadModule = async (name) => {"
    "  const response = await fetch(`ethfs://${name}`);"
    "  eval(await response.text());"
    "};"
);
```

---

## References

- [ETHFS Documentation](https://github.com/frolic/ethfs)
- [Scripty.sol Repository](https://github.com/intartnft/scripty.sol)
- [Mint Protocol Docs](https://docs.mint.vv.xyz/)
- [SSTORE2 Pattern](https://github.com/0xsequence/sstore2)
- [Frameworks V3 Docs](../CLAUDE.md)

---

## Support

For issues or questions:
- Check `deploy/README.md` for deployment specifics
- See `deploy/QUICKSTART.md` for quick start guide
- Review deployment logs in console output
- Check `deploy/versions.json` for current state

## License

MIT
