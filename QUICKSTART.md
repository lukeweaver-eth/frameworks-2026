# Frameworks V3 - Quick Start Guide

## You Now Have 4 Things:

### 1. Development Environment
Edit individual modular files, see changes instantly:
```bash
# Edit any file in src/ (core.js, commands.js, etc.)
# Then open:
open test-modular.html
# Refresh browser to see changes
```

### 2. Build System
Combine modules into production-ready file:
```bash
node scripts/build-combined.js
# Output: src/frameworks-v3.1.0-combined.min.js (45.6 KB)
```

### 3. Deployment Pipeline
Upload and deploy in 2 commands:
```bash
# Upload to ETHFS
npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia

# Mint test token (update RENDERER_INDEX first!)
npx hardhat run scripts/mint-quick.js --network sepolia
```

### 4. Testing Tools
```bash
# Test locally before deploying
open test-combined.html

# Test minted token
TOKEN_ID=225 npx hardhat run scripts/test-minted-token.js --network sepolia
```

## Typical Workflow

```bash
# 1. Make changes to src/core.js (or any module)
# 2. Test locally
open test-modular.html

# 3. Build for production
node scripts/build-combined.js

# 4. Test production build
open test-combined.html

# 5. Upload to ETHFS
npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia

# 6. Mint & test
npx hardhat run scripts/mint-quick.js --network sepolia
```

## Important Notes

- **Modular source** in `src/` - Edit these files
- **Combined build** in `src/frameworks-v3.1.0-combined.min.js` - Upload this to ETHFS
- **Working renderer**: `0x6970B8b97AD1247F4e5Fb34a4E1b5c58Cac1BCed` (uses `frameworks-v3.1-instanced.min.js`)

## Update ETHFS Filename

After uploading with a new filename, update `contracts/FrameworksRendererV3.sol` line 114:
```solidity
bodyTags[3].name = "frameworks-v3.1.0-combined.min.js";
```

Then redeploy the renderer.

## Custom Commands

```bash
# Mint with specific command
COMMAND="fp5fpp2fppp" npx hardhat run scripts/mint-quick.js --network sepolia
```

See [WORKFLOW.md](WORKFLOW.md) for detailed documentation.
