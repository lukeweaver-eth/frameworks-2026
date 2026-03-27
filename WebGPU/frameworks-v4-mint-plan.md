# Frameworks V4 → Mint Protocol Deployment Plan

## Architecture Overview

The system has four layers that need to work together:

```
┌─────────────────────────────────────────────────────────┐
│  BUILDER INTERFACE (frameworks-v4.html, modified)       │
│  Build composition → Export command string → Mint       │
└───────────────┬─────────────────────────┬───────────────┘
                │ command string          │ abi.encode(image, cmd)
                ▼                         ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│  PREVIEW / VIEWER    │   │  MINT COLLECTION CONTRACT    │
│  (local hash URL)    │   │  create(name, desc,          │
│                      │   │    artifact[], renderer, 0)  │
└──────────────────────┘   └──────────────┬───────────────┘
                                          │ uri(tokenId, token)
                                          ▼
                           ┌──────────────────────────────┐
                           │  FRAMEWORKS RENDERER V4      │
                           │  Assembles HTML via Scripty:  │
                           │  CSS + command injection      │
                           │  + frameworks_v4 from EthFS  │
                           └──────────────┬───────────────┘
                                          │ loads
                                          ▼
                           ┌──────────────────────────────┐
                           │  ETHFS FILE STORAGE          │
                           │  frameworks_v4_viewer.min.js  │
                           │  (gzipped, base64)           │
                           └──────────────────────────────┘
```

---

## Phase 1: Prepare the On-Chain Viewer Script

The current `frameworks-v4.html` is the full builder with editing UI.
For on-chain token display, we need a **viewer-only** version.

### 1A. Fork `frameworks-v4.html` → `frameworks-v4-viewer.js`

Extract the `<script>` contents into a standalone JS file with these modifications:

- **Add `autoExecuteCommand` detection** at the top of the `main()` initialization:
  ```javascript
  // Check for auto-execute (injected by on-chain renderer)
  if (typeof autoExecuteCommand !== 'undefined' && autoExecuteCommand) {
    showUI = false;
    document.getElementById('command-bar').style.display = 'none';
    executor.executeCommandString(autoExecuteCommand);
  }
  ```
- **Strip or hide builder UI elements** when in viewer mode (command bar, HUD overlay, palette overlay, bracket overlay)
- **Keep the rendering pipeline intact** — FrameStore, Camera, WebGPU pipeline, CommandExecutor all stay
- **Default `showUI = false`** in viewer mode so the render is clean
- **Auto-orbit camera** after command execution for a nice presentation view, or snap to the best view based on the structure's bounding box

### 1B. Minify the viewer script

```bash
npx terser frameworks-v4-viewer.js \
  -o frameworks_v4_viewer.min.js \
  --compress --mangle
```

### 1C. GZIP the minified script

```bash
gzip -9 -k frameworks_v4_viewer.min.js
# produces frameworks_v4_viewer.min.js.gz
```

### 1D. Upload to EthFS

Use the EthFS FileStore at `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245`.

The upload happens via the `createFile` function on the FileStore contract.
For a file this large (~80-120KB gzipped), it will need to be uploaded in
**multiple chunks** via multiple transactions.

```javascript
// Using ethers.js or viem
const fileStore = new ethers.Contract(
  "0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245",
  ETHFS_FILE_STORE_ABI,
  signer
);

// File name registered in EthFS
const fileName = "frameworks_v4_viewer.min.js.gz";

// Upload in chunks (max ~24KB per tx due to contract size limits)
const chunks = splitIntoChunks(gzippedFileBytes, 24000);
for (const chunk of chunks) {
  await fileStore.createFile(fileName, chunk);
  // or appendToFile for subsequent chunks
}
```

**Alternative: Use ethfs.xyz web UI** — the ethfs.xyz website has an upload
interface that handles chunking automatically. This is the easiest path.

### 1E. Also ensure these existing files are on EthFS

The renderer depends on two files that already exist from the V2 deployment:
- `fullSizeCanvas.css` — already on EthFS ✓
- `gunzipScripts-0.0.1.js` — already on EthFS ✓

---

## Phase 2: Deploy the FrameworksRendererV4 Contract

### 2A. Contract Overview

The `FrameworksRendererV4.sol` contract (see attached file) follows the same
pattern as `FrameworksRendererV2.sol` but:

- **No p5.js dependency** — V4 is pure WebGPU, no library loading
- **Loads `frameworks_v4_viewer.min.js.gz`** from EthFS instead
- **Still uses ScriptyBuilderV2** to assemble the HTML page
- **Injects the command string** as `let autoExecuteCommand = '...';` before the viewer script

The artifact format remains: `abi.encode(string image, string commandString)`

### 2B. Deploy with Foundry/Hardhat

```bash
# Foundry
forge create src/FrameworksRendererV4.sol:FrameworksRendererV4 \
  --rpc-url $ETH_RPC_URL \
  --private-key $PRIVATE_KEY

# Hardhat
npx hardhat run scripts/deploy-renderer.js --network mainnet
```

### 2C. Register the Renderer on Your Mint Collection

```javascript
const mint = new ethers.Contract(COLLECTION_ADDRESS, MINT_ABI, signer);
const rendererIndex = await mint.registerRenderer(RENDERER_V4_ADDRESS);
console.log("Renderer registered at index:", rendererIndex);
```

Save this `rendererIndex` — you'll pass it to `create()` when minting tokens.

---

## Phase 3: Modify the Builder Interface for Minting

### 3A. Add Mint Controls to `frameworks-v4.html`

Add a "Mint Panel" to the builder interface with:

1. **Name input** — token name
2. **Description input** — token description
3. **Preview image capture** — take a canvas screenshot (WebGPU `copyExternalImageToTexture` or canvas `toDataURL`)
4. **Command string display** — the condensed command string (already exists via Export button)
5. **Mint button** — generates and submits the `create()` transaction

### 3B. Artifact Encoding

The artifact for Mint is `abi.encode(string image, string commandString)`:

```javascript
import { ethers } from 'ethers';

function encodeArtifact(imageDataURI, commandString) {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ['string', 'string'],
    [imageDataURI, commandString]
  );
}
```

The image should be a `data:image/png;base64,...` data URI captured from the canvas.

### 3C. Handling Large Artifacts with `prepareArtifact`

If the encoded artifact exceeds the ~24KB single-transaction limit, use the
Mint contract's `prepareArtifact` function to upload in chunks:

```javascript
const artifactBytes = encodeArtifact(imageURI, commandString);
const chunks = splitIntoChunks(artifactBytes, 24000);

// Determine the next token ID
const nextTokenId = (await mint.latestTokenId()) + 1n;

// Upload chunks
for (let i = 0; i < chunks.length; i++) {
  await mint.prepareArtifact(
    nextTokenId,
    [chunks[i]],
    i === 0  // clear on first chunk
  );
}

// Create the token with empty artifact (already prepared)
await mint.create(
  tokenName,
  tokenDescription,
  [],              // empty — already prepared
  rendererIndex,   // the V4 renderer index
  0                // no extra data
);
```

### 3D. Wallet Connection

Use a lightweight wallet connector (viem + wagmi, or raw ethers.js):

```javascript
// Minimal wallet connection
async function connectWallet() {
  if (!window.ethereum) {
    alert('Install MetaMask or another wallet');
    return;
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return signer;
}
```

### 3E. Builder → Mint Workflow

```
1. Build composition using keyboard commands
2. Press Export to get condensed command string
3. Fill in name + description
4. Click "Capture Preview" → screenshots the canvas
5. Click "Mint" →
   a. Encodes artifact = abi.encode(preview_image, command_string)
   b. Connects wallet if not connected
   c. If artifact > 24KB, calls prepareArtifact in chunks
   d. Calls create() on the Mint collection contract
   e. Shows confirmation with token ID
6. Click "View on networked.art" → opens token page
```

---

## Phase 4: View Minted Tokens

### 4A. networked.art Integration

Your Mint app instance (networked.art, or wherever you host it)
will automatically resolve the token because:

1. The Mint contract's `uri(tokenId)` calls the V4 renderer
2. The renderer returns JSON metadata with `animation_url`
3. The `animation_url` is a self-contained HTML page (base64 encoded)
   that includes the CSS, the command injection, and the V4 viewer script
4. The Mint app renders this in an iframe

The token page URL pattern: `https://networked.art/[collection-address]/[tokenId]`

### 4B. Token Metadata Structure

The renderer produces:
```json
{
  "id": "1",
  "name": "Token Name",
  "description": "Token Description",
  "image": "data:image/png;base64,...",
  "script_url": "data:text/javascript;base64,...",
  "animation_url": "data:text/html;base64,..."
}
```

- `image` — static preview (captured at mint time)
- `script_url` — the raw command string as a JS data URI
- `animation_url` — the full interactive WebGPU viewer with the composition

---

## Phase 5: Verification & Testing (Pre-Mainnet)

### 5A. Local Testing

1. **Test the viewer script standalone** — create a test HTML that sets
   `autoExecuteCommand` and loads the viewer JS. Verify the composition
   renders correctly without UI.

2. **Test artifact encoding** — encode/decode a test artifact and verify
   the image and command string survive the round-trip.

3. **Test the renderer locally** — use Foundry's `forge test` to call
   `uri()`, `imageURI()`, and `animationURI()` and verify the output
   is valid HTML/JSON.

### 5B. Testnet Deployment (Sepolia)

ScriptyBuilder and EthFS are deployed at the same addresses on Sepolia:
- ScriptyBuilderV2: `0xD7587F110E08F4D120A231bA97d3B577A81Df022`
- ETHFSV2FileStorage: `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245`

1. Upload `frameworks_v4_viewer.min.js.gz` to EthFS on Sepolia
2. Deploy `FrameworksRendererV4` on Sepolia
3. Create a test Mint collection via the Factory on Sepolia
4. Register the renderer
5. Mint a test token
6. Verify it renders in the Mint app

### 5C. Gas Estimation

| Operation | Estimated Gas |
|-----------|--------------|
| Upload viewer script to EthFS (per chunk) | ~500K–2M per tx |
| Deploy FrameworksRendererV4 | ~1.5M |
| Register renderer on collection | ~50K |
| Create token (small artifact) | ~200K–500K |
| Create token (large artifact, multi-chunk) | ~200K–2M total |

---

## File Inventory

| File | Purpose | Status |
|------|---------|--------|
| `frameworks-v4.html` | Builder interface | Exists — needs mint UI additions |
| `frameworks-v4-viewer.js` | Viewer-only script | TO CREATE from v4.html |
| `frameworks_v4_viewer.min.js.gz` | Minified+gzipped viewer | TO CREATE |
| `FrameworksRendererV4.sol` | On-chain renderer contract | CREATED (see attached) |
| Mint app config | networked.art Nuxt config | Exists — just register renderer |

---

## Key Differences: V2 → V4

| Aspect | V2 (p5.js) | V4 (WebGPU) |
|--------|-----------|-------------|
| Render engine | p5.js (Canvas 2D/WebGL) | Native WebGPU |
| Library dependency | p5-v1.5.0.min.js.gz (EthFS) | None — self-contained |
| Viewer script | frameworks_renderer_v2_fixed.min.js | frameworks_v4_viewer.min.js.gz |
| Gunzip needed | Yes (for p5.js) | Yes (for viewer script) |
| Frame capacity | ~10K | 1M+ (compute shader culling) |
| Body tags count | 4 (p5 + gunzip + cmd + renderer) | 3 (cmd + viewer.gz + gunzip) |
| Artifact format | abi.encode(image, script) | abi.encode(image, commandString) |
| Browser requirement | WebGL (universal) | WebGPU (Chrome 113+, Edge, Firefox Nightly) |

---

## Risk: WebGPU Browser Support

WebGPU is not yet universal. Consider:
- Adding a `<noscript>` / fallback message in the HTML for unsupported browsers
- The static `image` field in metadata ensures the token still has a preview
  on platforms that don't render `animation_url`
- WebGPU support is expanding rapidly and will be standard by the time
  most collectors encounter these tokens

---

## Next Steps (Ordered)

1. ☐ Create `frameworks-v4-viewer.js` (strip UI, add autoExecuteCommand)
2. ☐ Minify + gzip the viewer script
3. ☐ Upload to EthFS (Sepolia first, then mainnet)
4. ☐ Deploy `FrameworksRendererV4.sol` to Sepolia
5. ☐ Test end-to-end on Sepolia
6. ☐ Add mint UI controls to the builder interface
7. ☐ Deploy renderer to mainnet
8. ☐ Register renderer on your Mint collection
9. ☐ Mint first Frameworks V4 token
10. ☐ Verify on networked.art
