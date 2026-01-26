# Frameworks V3 Deployment - Quick Start

Get up and running with Frameworks V3 deployment to ETHFS in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- Private key with ETH for gas (or testnet ETH)
- RPC URL for target network (Alchemy, Infura, etc.)

## Quick Setup

### 1. Install Dependencies

```bash
npm install ethers
```

### 2. Configure Environment

Set environment variables:

```bash
export PRIVATE_KEY="0x..."
export RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
```

Or create a `.env` file and load it:

```bash
# .env
PRIVATE_KEY=0x...
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

```bash
# Load with
source .env
```

### 3. Update RPC URLs (Optional)

Edit `deploy/config.json` to add your RPC URLs:

```json
{
  "networks": {
    "sepolia": {
      "rpcUrl": "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
      ...
    }
  }
}
```

## Deploy Workflow

### Test First (Dry Run)

Always dry run first to see what will be deployed:

```bash
cd deploy
node deploy.js --dry-run
```

Output:
```
==========================================================
FRAMEWORKS V3 DEPLOYMENT
==========================================================

🔍 DRY RUN MODE - No actual uploads will be performed

📋 Loading configuration...
  Network: mainnet (dry run)
  Components: 8

📦 Loading deployment state...
  Current global version: 1.0.0
  Last deployment: never

🔍 Computing file hashes...

🔍 Detecting changes...
  Changed: core, camera, commands
  Unchanged: palette, color, selection, commandTree, renderer

📦 Preparing uploads...
  core: v0.0.0 → v1.0.0
  camera: v0.0.0 → v1.0.0
  commands: v0.0.0 → v1.0.0

[ETHFS] Uploading 3 file(s)...
  [DRY RUN] Would upload frameworks-v3-core-v1.0.0.js
  [DRY RUN] Would upload frameworks-v3-camera-v1.0.0.js
  [DRY RUN] Would upload frameworks-v3-commands-v1.0.0.js
```

### Deploy All Changed Files

```bash
node deploy.js --network sepolia
```

This will:
1. Detect which files changed (via SHA-256 hash)
2. Increment versions (patch by default)
3. Upload to ETHFS FileStore
4. Update `versions.json` with SSTORE2 pointers
5. Generate HTML and upload it

### Deploy Specific Component

```bash
# Deploy only camera module
node deploy.js --component camera --network sepolia

# Deploy with minor version bump
node deploy.js --component camera --bump minor --network sepolia

# Force deploy even if unchanged
node deploy.js --component core --force --network sepolia
```

### Version Bumping

```bash
# Patch version (default): 1.0.0 -> 1.0.1
node deploy.js --network sepolia

# Minor version: 1.0.0 -> 1.1.0
node deploy.js --bump minor --network sepolia

# Major version: 1.0.0 -> 2.0.0
node deploy.js --bump major --network sepolia
```

## Understanding Output

### Successful Deployment

```bash
✓ core: frameworks-v3-core-v1.0.0.js → 0xABCD...1234
✓ camera: frameworks-v3-camera-v1.0.0.js → 0xEF01...5678

💾 Updating deployment state...
  ✓ core: frameworks-v3-core-v1.0.0.js → 0xABCD...1234
  ✓ camera: frameworks-v3-camera-v1.0.0.js → 0xEF01...5678

✓ Saved deployment state to versions.json

==========================================================
DEPLOYMENT SUMMARY
==========================================================
Global version: v1.0.0
Components updated: 2
Timestamp: 2025-01-25T10:30:00.000Z

✅ Deployment complete!

Next steps:
1. Deploy FrameworksRenderer.sol contract to sepolia
2. Test rendered HTML using ETHFS FileStore
3. Register renderer with mint protocol Factory

Deployed files:
  - frameworks-v3-core-v1.0.0.js: 0xABCD...1234
  - frameworks-v3-camera-v1.0.0.js: 0xEF01...5678
```

### Check versions.json

After deployment, `deploy/versions.json` contains:

```json
{
  "globalVersion": "1.0.0",
  "lastDeployment": "2025-01-25T10:30:00.000Z",
  "deploymentCount": 1,
  "components": {
    "core": {
      "version": "1.0.0",
      "hash": "a3f2e1d...",
      "filename": "frameworks-v3-core-v1.0.0.js",
      "pointer": "0xABCD...1234",
      "lastModified": "2025-01-25T10:30:00.000Z",
      "size": 15234
    }
  },
  "deploymentHistory": [
    {
      "timestamp": "2025-01-25T10:30:00.000Z",
      "globalVersion": "1.0.0",
      "components": [
        {
          "name": "core",
          "version": "1.0.0",
          "filename": "frameworks-v3-core-v1.0.0.js",
          "pointer": "0xABCD...1234"
        }
      ],
      "network": "sepolia"
    }
  ]
}
```

**Important Fields:**
- `filename` - Name used to reference file in Scripty.sol
- `pointer` - SSTORE2 address where file is stored
- `hash` - SHA-256 hash for change detection

## Common Commands

```bash
# Dry run to see what would be deployed
node deploy.js --dry-run

# Deploy all changed files to sepolia
node deploy.js --network sepolia

# Deploy specific component with minor bump
node deploy.js --component renderer --bump minor --network sepolia

# Force deploy even if no changes
node deploy.js --force --network mainnet

# View help
node deploy.js --help
```

## Deploy Renderer Contract

After uploading modules to ETHFS, deploy the Solidity renderer:

```bash
cd ..  # Back to project root

# Using Foundry
forge create contracts/FrameworksRenderer.sol:FrameworksRenderer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

# Using Hardhat (if configured)
npx hardhat run scripts/deploy-renderer.js --network sepolia
```

**Important:** The renderer references ETHFS files by **filename** (e.g., `frameworks-v3-core-v1.0.0.js`), so make sure your contract uses the same names from `versions.json`.

## Verify Deployment

### 1. Check ETHFS FileStore

Verify file exists on ETHFS:

```javascript
// Using ethers.js
const fileStore = new ethers.Contract(
  '0xFe1411d6864592549AdE050215482e4385dFa0FB',
  ['function fileExists(string) view returns (bool)'],
  provider
);

const exists = await fileStore.fileExists('frameworks-v3-core-v1.0.0.js');
console.log('File exists:', exists);  // Should be true
```

### 2. Test Renderer

Call the renderer with test token:

```solidity
Token memory testToken = Token({
    name: "Test Framework",
    description: "Test",
    artifact: [testArtifactPointer],
    renderer: 0,
    mintedBlock: block.number,
    closeAt: 0,
    data: 0
});

string memory metadata = frameworksRenderer.uri(1, testToken);
// Should return: data:application/json;base64,...
```

### 3. Decode and View

Decode the base64 JSON and check `animation_url`:

```javascript
const json = JSON.parse(atob(metadata.split(',')[1]));
const html = atob(json.animation_url.split(',')[1]);
// Save html to file and open in browser
```

## Troubleshooting

### Upload Issues

**Error: "PRIVATE_KEY environment variable required"**
```bash
export PRIVATE_KEY="0x..."
```

**Error: "File already exists"**
- Use `--force` flag to overwrite
- Or change component to increment version

**Error: "Out of gas"**
- Increase `gasLimit` in `deploy/config.json`:
  ```json
  "ethfsUploadConfig": {
    "gasLimit": 10000000
  }
  ```

**Error: "Nonce too low"**
- Wait a few seconds between uploads
- Increase `retryDelay` in config

### Renderer Issues

**Error: "File not found in Scripty.sol"**
- Check filename in contract matches `versions.json`
- Verify file uploaded to same network
- Make sure ETHFS_FILE_STORAGE address is correct for network

**HTML Not Rendering:**
- Check browser console for JavaScript errors
- Verify Three.js loaded correctly from ETHFS
- Test command history is valid
- Try with `--dry-run` first

### Version Conflicts

**Old version still showing:**
- Deploy new renderer with updated filenames
- Old tokens use old renderer (immutable by design)

**versions.json out of sync:**
- Run `--dry-run` to see current hashes
- Use `--force` if needed

## Cost Estimates

### Testnet (Sepolia)
- Free ETH from faucets
- Upload costs: ~$0 (testnet ETH)

### Mainnet
Approximate costs @ 50 gwei:

| Component | Size | Gas | Cost (ETH) |
|-----------|------|-----|------------|
| core      | 15KB | ~300K | 0.015 |
| palette   | 10KB | ~200K | 0.010 |
| camera    | 12KB | ~240K | 0.012 |
| commands  | 25KB | ~500K | 0.025 |
| renderer  | 20KB | ~400K | 0.020 |

**Full deployment:** ~0.1 ETH @ 50 gwei

**L2 (Base/Optimism):** Same deployment ~$5-10 total

## Next Steps

1. **Update Renderer:** Deploy `FrameworksRenderer.sol` with correct filenames
2. **Register:** Add renderer to mint protocol Factory
3. **Test:** Create test token and verify HTML renders
4. **Deploy Production:** Deploy to mainnet or Base
5. **Integrate:** Add minting UI to Frameworks interface

## Advanced Usage

See full documentation:
- `deploy/README.md` - Complete deployment guide
- `../INTEGRATION.md` - Full ETHFS + mint protocol integration
- `../DEPLOYMENT_SYSTEM.md` - System architecture

## Support

Common questions:
- **Q:** Do I need to upload Three.js?
  **A:** Yes, or reference existing Three.js on ETHFS if available

- **Q:** Can I update deployed files?
  **A:** No, ETHFS files are immutable. Deploy new version with incremented number

- **Q:** How do I test without spending ETH?
  **A:** Use `--dry-run` and deploy to testnet first

- **Q:** What if deployment fails midway?
  **A:** Check `versions.json` to see what succeeded, redeploy failed components with `--component`
