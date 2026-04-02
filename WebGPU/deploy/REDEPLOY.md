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

Do this from the **collection owner wallet** — this is a **different key** than the deployer in `.env`. Do not use the register script with the deploy key.

Call `registerRenderer(rendererAddress)` directly via Etherscan/Rabby from the owner wallet.

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
| v7 | `frameworks_v4_viewer_v3.html` | `0x78DA5Ad98D4c1C724E94e1bf429D900a7BACce31` | — (superseded) | Smooth GPU-side color animation via continuous global phase — broken by terser class name mangling |
| v8 | `frameworks_v4_viewer_v4.html` | `0xDC7370E16498B6ffa91B26C57bF0df3AF28d414c` | — (superseded) | keep_classnames only — still mangles local vars, still broken |
| v9 | `frameworks_v4_viewer_v5.html` | `0xb676Db61D4731d46A18ab632260Fc9d705d38c10` | — (superseded) | mangle: false only — terser join_vars still merged const declarations causing palette TDZ |
| v10 | `frameworks_v4_viewer_v6.html` | `0x8cC9E7c0306d9A6F512E414cC9e050d705e2A61D` | — (superseded) | join_vars: false insufficient; compress still reordered paletteBuf init before palette decl |
| v11 | `frameworks_v4_viewer_v7.html` | `0xD9c7af587564C74f98986818020171667Fdcd202` | — (superseded) | Source bug: palette used before declaration (paletteBuf write at line 2978, palette declared at 3060) |
| v12 | `frameworks_v4_viewer_v8.html` | `0xEaB332A2f9802A4eCd73Fa249075F18ac90E6408` | 12 (pending registration) | Fix source ordering: palette declared before paletteBuf creation |

Collection: `0xc3D5853bC409156C0AaC4E3d6F96d307C2E7Fb40` (Sepolia)
EthFS FileStore: `0xFe1411d6864592549AdE050215482e4385dFa0FB` (all networks)
ScriptyBuilderV2: `0xD7587F110E08F4D120A231bA97d3B577A81Df022` (all networks)
