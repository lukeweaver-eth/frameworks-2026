# Frameworks V3 Development Workflow

Quick reference for iterative development and deployment.

## Development Environment

### 1. Edit Individual Modules
Work on individual files in `src/`:
- `core.js` - Frame, Cursor, Framework classes
- `palette.js` - Color palette manager
- `context-color.js` - Color selection context
- `context-camera.js` - Camera controls
- `context-selection.js` - Frame selection
- `command-tree.js` - Command history navigation
- `commands.js` - Command executor
- `renderer-instanced.js` - GPU renderer

### 2. Test Locally with Modular Files
```bash
# Open in browser to test your changes
open test-modular.html
```

This loads individual modules so you can see changes immediately after refreshing.

### 3. Test with Combined Build
```bash
# Build combined/minified version
node scripts/build-combined.js

# Test combined build
open test-combined.html
```

This tests the production build that will be deployed on-chain.

## Deployment Pipeline

### Quick Deploy (4 steps)

```bash
# 1. Build combined file
node scripts/build-combined.js

# 2. Upload to ETHFS
npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia

# 3. Deploy renderer (if needed - update ETHFS filename in contract first!)
npx hardhat run scripts/deploy-renderer-quick.js --network sepolia

# 4. Mint test token
npx hardhat run scripts/mint-quick.js --network sepolia
```

### With Custom Command

```bash
# Mint with specific command
COMMAND="fp5fpp2fppp" npx hardhat run scripts/mint-quick.js --network sepolia
```

### Test Minted Token

```bash
# Test specific token ID
TOKEN_ID=225 npx hardhat run scripts/test-minted-token.js --network sepolia
```

## File Structure

```
frameworks-v3/
├── src/                          # Source modules (edit these!)
│   ├── core.js
│   ├── palette.js
│   ├── context-*.js
│   ├── commands.js
│   ├── renderer-instanced.js
│   └── frameworks-v3.1.0-combined.min.js  # Built by build-combined.js
│
├── test-modular.html             # Dev test (loads individual modules)
├── test-combined.html            # Production test (loads combined file)
│
├── scripts/
│   ├── build-combined.js         # Combine & minify modules
│   ├── upload-combined-to-ethfs.js  # Upload to ETHFS
│   ├── deploy-renderer-quick.js  # Deploy renderer contract
│   └── mint-quick.js             # Mint test token
│
└── contracts/
    └── FrameworksRendererV3.sol  # Renderer contract
```

## Tips

### Quick Iteration
1. Edit files in `src/`
2. Refresh `test-modular.html` to see changes
3. When ready to deploy, run build script

### Testing Commands
Edit `TEST_COMMANDS` in `test-modular.html` or `window.FRAMEWORKS_CONFIG.commandHistory` in `test-combined.html`.

### Updating ETHFS Filename
After uploading a new version, update line 114 in `contracts/FrameworksRendererV3.sol`:
```solidity
bodyTags[3].name = "frameworks-v3.1.0-combined.min.js";
```

### Reusing Existing Renderer
If the ETHFS file already exists, you don't need to deploy a new renderer. Just upload the new file with the same name and existing tokens will use it.

## Current Setup

- **ETHFS FileStore**: `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245`
- **ETHFS ContentStore**: `0xFe1411d6864592549AdE050215482e4385dFa0FB`
- **Mint Contract**: `0x452718C9C188da8969B05e34B5031b91906f5264` (Sepolia)
- **ArtifactReader Library**: `0x4722F16408aF27378a782eda6cE88F46905e5227`
- **Working Renderer**: `0x6970B8b97AD1247F4e5Fb34a4E1b5c58Cac1BCed` (uses `frameworks-v3.1-instanced.min.js`)

## Troubleshooting

### "File not found" error
Run `node scripts/build-combined.js` first.

### "Out of gas" on token render
The combined file may be too large. Check file size in build output (should be < 50 KB).

### Changes not showing in test
- Hard refresh browser (Cmd+Shift+R)
- Clear browser cache
- Check browser console for errors

### Mint transaction fails
- Check account balance has enough ETH
- Update RENDERER_INDEX in mint-quick.js to your registered renderer
- Verify Mint contract address is correct for network
