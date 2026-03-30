# Frameworks Mint Theme — Deploy Guide

A custom Nuxt layer extending `@visualizevalue/mint-app-base` for `mint.frameworks.art`.

The key change over the base theme is `Embed.vue` — adds `sandbox="allow-scripts allow-same-origin"` and `allow="webgpu; fullscreen"` to the iframe so WebGPU tokens render in-page without the "WebGPU not supported" error.

---

## Local setup

```bash
cd mint-theme
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Value |
|----------|-------|
| `NUXT_PUBLIC_CHAIN_ID` | `11155111` (Sepolia) or `1` (mainnet) |
| `NUXT_PUBLIC_CREATOR_ADDRESS` | `0xeE514bd06a8479e3E4771f03Cd01D2AF22aEb86D` |
| `NUXT_PUBLIC_RPC_1` | Infura/Alchemy Sepolia or mainnet endpoint |
| `NUXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | From [cloud.walletconnect.com](https://cloud.walletconnect.com) (free) |

```bash
npm run dev       # local dev at localhost:3000
npm run build     # production build
npm run generate  # static export (optional)
```

---

## Deployment

The app can be deployed as a static site or Node server. Vercel/Netlify work out of the box with `npm run build`.

1. Push repo to GitHub
2. Connect to Vercel or Netlify
3. Set root directory to `mint-theme/`
4. Add env vars from `.env.example` in the hosting dashboard
5. Point `mint.frameworks.art` DNS to the deployment

For a Node server deployment, set `NITRO_PRESET=node-cluster` before building.

---

## Switching to mainnet

In your hosting dashboard, change:

```
NUXT_PUBLIC_CHAIN_ID=1
NUXT_PUBLIC_RPC_1=https://eth.llamarpc.com
NUXT_PUBLIC_RPC_2=https://ethereum-rpc.publicnode.com
NUXT_PUBLIC_RPC_3=https://eth.drpc.org
```

---

## What the theme overrides

### `components/Embed.vue`
Identical to the base app except the iframe sandbox:

```html
<!-- base app -->
<iframe sandbox="allow-scripts" ... />

<!-- frameworks theme -->
<iframe sandbox="allow-scripts allow-same-origin" allow="webgpu; fullscreen" ... />
```

`allow-same-origin` lifts the opaque origin restriction so `navigator.gpu` is accessible. `allow="webgpu"` adds the explicit feature policy permission Chrome requires.

### `assets/theme.css`
Dark monospace styling (SF Mono / Fira Code) matching the Frameworks builder UI.

---

## Renderer registration (Sepolia)

Before minting works, the renderer must be registered on the collection from the owner wallet. Call `registerRenderer(rendererAddress)` on the collection contract via Rabby or Etherscan.

Current deployment history is in `WebGPU/deploy/REDEPLOY.md`.
