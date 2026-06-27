# Frameworks V4 — Redeploy Steps

Run these from the `deploy/` directory.

## Two-file architecture

- **`frameworks-v4-mint.html`** — local builder. Has ethers CDN, wallet connect, Mint panel. Never uploaded to EthFS.
- **`frameworks-v4-viewer.html`** — on-chain artifact. Full interactivity (all keyboard commands, command bar, export) minus the chain-interaction buttons. This is what the upload script reads and what the renderer serves.

## When to redeploy

- **Viewer changed** (`frameworks-v4-viewer.js`) → Steps 1–4
- **Renderer contract changed** (`src/FrameworksRendererV4.sol`) → Steps 2–4
- **Neither** (e.g. only builder HTML changed) → no redeploy needed

---

## Step 1 — Bump the version filename

EthFS files are immutable by name. Each new viewer upload needs a new name.

Edit two files, incrementing the version number (v2 → v3, etc.):

**`script/upload-to-ethfs.mjs`** — change `FILE_NAME`:
```js
const FILE_NAME = 'frameworks_v4_viewer_v3.min.js.gz';  // bump version
```

**`src/FrameworksRendererV4.sol`** — change the EthFS filename in `generateHtml()`:
```solidity
bodyTags[1].name = "frameworks_v4_viewer_v3.min.js.gz";  // match above
```

**`package.json`** — update the `cp` at the end of the minify script:
```
... && cp viewer/frameworks_v4_viewer.min.js.gz viewer/frameworks_v4_viewer_v3.min.js.gz
```

---

## Step 2 — Minify + gzip the viewer

```bash
npm run minify
# Output: viewer/frameworks_v4_viewer_vN.min.js.gz (~12KB)
```

---

## Step 3 — Upload to EthFS

```bash
export PRIVATE_KEY=0x...
export ETH_RPC_URL=https://sepolia.infura.io/v3/...   # or mainnet

npm run upload
# Logs the tx hash and confirms the file is live
```

---

## Step 4 — Deploy the renderer contract

```bash
forge script script/DeployRenderer.s.sol \
  --rpc-url $ETH_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
# Logs: FrameworksRendererV4 deployed at: 0x...
```

---

## Step 5 — Register the renderer on your collection

The **collection owner wallet is different from the deployer wallet** in `.env`. Registration must be done manually via Etherscan or Rabby — the `npm run register` script won't work here.

Call `registerRenderer(rendererAddress)` on the collection contract via Etherscan/Rabby using the owner wallet:
- Collection: `0xc3D5853bC409156C0AaC4E3d6F96d307C2E7Fb40`
- Arg: renderer address from Step 4

---

## Step 6 — Update the builder HTML

In `frameworks-v4-mint.html`, update the Collection Config defaults:

```html
<input id="mint-renderer-idx" value="N">   <!-- index from Step 5 -->
```

---

## Deployment history (Sepolia)

| Version | EthFS filename | Renderer address | Renderer index | Notes |
|---------|---------------|-----------------|----------------|-------|
| v1 | `frameworks_v4_viewer.min.js.gz` | `0xB75E76bd063DD09192e96F0F26968Aa5CB20f0F2` | 2 | Initial deploy — bounding-box camera override |
| v2 | `frameworks_v4_viewer_v2.min.js.gz` | `0x60b164dE5efD6963e566614E7e3633396c4c0fF9` | 3 (pending registration) | Camera from command string; v/ijkl/IJKL FOV+zoom; % presentation mode |
| v3 | `frameworks_v4_mint_v3.html` | `0xa2386b0700F93E4eEF7ecC471f841216ba9ECBa6` | — (superseded) | Full mint HTML on-chain; zero viewer drift; autoExecuteCommand injection |
| v4 | `frameworks_v4_mint_v4.html` | `0xE958203177Cc654d0Af06E2E23d606F274E935a2` | 4 (pending registration) | s/S scale+line rework; frame selection system; h/H hide; q corner replay fix; default scale 2; command replay headless |
| v5 | `frameworks_v4_viewer_v1.html` | `0x76E477Fd9f966520c553cc2Eb6056BCB2636A58c` | 5 (pending registration) | Split viewer/mint: viewer has full interactivity minus ethers/wallet/mint panel; w/W text labels; Tab label toggle; mintCommandString populated on auto-execute |
| v6 | `frameworks_v4_viewer_v2.html` | `0x358a5a7A0d8f23B52A86Dd1fbA3BBB358227A250` | 6 (pending registration) | Minified (112KB→62KB); q corner reset fix; e/E proper reflection; C snap cursor to selection; / command overlay; ? shows original command; full reset on execute |
| v7 | `frameworks_v4_viewer_v3.html` | `0x78DA5Ad98D4c1C724E94e1bf429D900a7BACce31` | 7 (pending registration) | Continuous GPU-side color animation (animGlobalPhase); palette editing (P(#[n:m]x)); background #12141a; view/camera sync (1-6 keys); HUD fix |
| v8–v10 | (various) | (various) | 8–10 (not registered) | Failed: terser class mangling + join_vars TDZ |
| v11–v14 | (various) | (various) | 11–14 (not registered) | Failed: palette declared after paletteBuf use; wrong source fix; raw HTML upload; IIFE wrap |
| v15 | `frameworks_v4_viewer_v11.html` | `0xFd2003545B0c25aFE4E92DB866BEd105F75F3AEe` | 15 (not registered) | Missing IIFE — double-declaration error in proxy |
| v16 | `frameworks_v4_viewer_v12.html` | `0x67A5395945Dd99c88c2F3F978056aF354b0E7511` | 16 (pending registration) | Fix palette TDZ + IIFE wrap; raw unminified upload |
| v17 | `frameworks_v4_viewer_v13.html` | `0xb8eB33fBfFec6641334Ae69c169167CFeaAdc4fB` | 17 (pending registration) | Minified 122KB→67KB (4 chunks); compress join_vars:false + mangle keep_classnames:true |
| v18 | `frameworks_v4_viewer_v14.html` | `0x4276Af782304286eD7A769CFa97EA5433F722917` | 18 (pending registration) | Same source as v16/v17 — confirmed IIFE + palette order fix; 68.2KB minified |
| v19 | `frameworks_v4_viewer_v15.html` | `0x5181C06Ac2e75eF196D3a8F52C1c42A77a675bb0` | 19 (pending registration) | Derived from mint via derive-viewer.py — fixes viewer/mint divergence; 68.0KB minified |
| v20 | `frameworks_v4_viewer_v16.html` | `0x20CBaD40EcE732870db8D811B524c6dA0eFA9c16` | 20 (pending registration) | Same as v19 source but uploaded raw/unminified (123KB, 7 chunks) — avoids terser TDZ on CommandExecutor |

Collection: `0xc3D5853bC409156C0AaC4E3d6F96d307C2E7Fb40` (Sepolia)
EthFS FileStore: `0xFe1411d6864592549AdE050215482e4385dFa0FB` (all networks)
ScriptyBuilderV2: `0xD7587F110E08F4D120A231bA97d3B577A81Df022` (all networks)
