# Frameworks V4 → Mint Protocol: Deployment Guide

End-to-end deployment of the Frameworks V4 renderer to the Mint protocol.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- [Node.js](https://nodejs.org/) 18+ installed
- An Ethereum wallet with ETH (mainnet or Sepolia)
- A deployed Mint collection contract (via mint.vv.xyz or the Factory)
- The `visualizevalue/mint` repo cloned locally

## Directory Layout

```
deploy/
├── README.md                      ← you are here
├── package.json                   ← npm deps (ethers)
├── foundry.toml                   ← Foundry config
├── script/
│   ├── DeployRenderer.s.sol       ← Foundry deploy script
│   ├── upload-to-ethfs.mjs        ← upload viewer.js to EthFS
│   └── register-renderer.mjs      ← register renderer on Mint collection
├── src/
│   └── FrameworksRendererV4.sol   ← the renderer contract (copy here)
└── viewer/
    └── frameworks-v4-viewer.js    ← the viewer script (copy here)
```

## Steps

### 0. Setup

```bash
cd deploy
npm install
```

Copy the contract and viewer into place:
```bash
cp ../FrameworksRendererV4.sol src/
cp ../frameworks-v4-viewer.js viewer/
```

### 1. Minify + Gzip the Viewer Script

```bash
npx terser viewer/frameworks-v4-viewer.js \
  -o viewer/frameworks_v4_viewer.min.js \
  --compress --mangle

gzip -9 -k viewer/frameworks_v4_viewer.min.js
# → viewer/frameworks_v4_viewer.min.js.gz

ls -la viewer/frameworks_v4_viewer.min.js.gz
# Should be ~10-15 KB
```

### 2. Upload to EthFS

Upload the gzipped viewer to EthFS FileStorage. The script handles chunking.

```bash
# Set your env vars
export PRIVATE_KEY=0x...
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# For Sepolia testing:
# export RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

node script/upload-to-ethfs.mjs
```

The script will:
- Read `viewer/frameworks_v4_viewer.min.js.gz`
- Base64-encode it
- Upload it to EthFS as `frameworks_v4_viewer.min.js.gz`
- Print the file name for verification

**Alternative: Use ethfs.xyz**
Go to https://ethfs.xyz, connect your wallet, and upload the
`.gz` file manually. Name it `frameworks_v4_viewer.min.js.gz`.

### 3. Deploy the Renderer Contract

The renderer needs to be compiled against the Mint repo's interfaces.
Link the Mint repo as a dependency:

```bash
# Option A: If you cloned the mint repo
forge install --no-commit

# Option B: Point remappings to your local mint repo
# Edit foundry.toml remappings (see below)
```

Deploy:

```bash
# Sepolia
forge script script/DeployRenderer.s.sol:DeployRenderer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Mainnet (add --slow for safety)
forge script script/DeployRenderer.s.sol:DeployRenderer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --slow
```

Note the deployed address from the output.

### 4. Register Renderer on Your Mint Collection

```bash
export RENDERER_ADDRESS=0x...      # from step 3
export COLLECTION_ADDRESS=0x...    # your Mint collection

node script/register-renderer.mjs
```

Note the renderer index from the output — you'll use this when minting.

### 5. Test with the Builder

Open `frameworks-v4-mint.html` in Chrome. Build a composition, then:

1. Click **Mint ▸** to open the mint panel
2. Click **Connect Wallet**
3. Fill in the **Collection Address** and **Renderer Index** in the config section
4. Enter a **Token Name** and optional description
5. Click **Export** to populate the command string
6. Click **Capture Preview** to screenshot the canvas
7. Click **Mint Token** to submit the transaction

### 6. View on networked.art

After minting, your token is viewable at:
```
https://networked.art/<collection-address>/<token-id>
```

Or wherever you host your Mint app instance.

---

## Network Addresses (Same on All Networks)

| Contract | Address |
|----------|---------|
| ScriptyBuilderV2 | `0xD7587F110E08F4D120A231bA97d3B577A81Df022` |
| ETHFS V2 FileStorage | `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245` |
| ScriptyStorageV2 | `0xbD11994aABB55Da86DC246EBB17C1Be0af5b7699` |

## Troubleshooting

**"NonExistentRenderer" error when minting:**
Make sure the renderer index in the mint panel matches what `registerRenderer` returned.

**Artifact too large / out of gas:**
The preview PNG can be large. Try capturing at a smaller canvas size, or use
JPEG (`canvas.toDataURL('image/jpeg', 0.8)`) — edit `frameworks-v4-mint.html`
to change the format in the capture handler.

**WebGPU not showing in token viewer:**
The browser viewing the token must support WebGPU (Chrome 113+). The static
preview image (`image` field in metadata) will always display regardless.

**EthFS upload fails:**
The FileStore has a ~24KB-per-transaction limit. The upload script handles
chunking, but if the gzipped file exceeds ~200KB total, you may need to
split the viewer into multiple EthFS files.
