# Deployment — Sepolia, 2026-08-11

## V2 — current (Stage 1: frames are tokens)

| What | Address |
|---|---|
| FrameworksV2 | `0x1d136e21e3D595b08010647b0F8D65d1766f0Ad1` |
| FrameworksRenderer (V2) | `0x57122C3b744E398833ece6EdD612749b664E2f9E` |
| 6551 Registry | `0x000000006551c19487814612e58FE06813775758` |
| Account impl (Tokenbound V3) | `0x41C8f39463A868d3A88af00cd0fe7102F30E44eC` |

```
1       genesis command set    account 0x2b0838703bAaC0b22DE0BD055ec5eafbf1874Ae9
2–43    the bindings           owned BY that account — containment is ownership
44      "genesis"
45      "a space to think in"  account 0x72Ce3D397881A95Ee3ccEbb0E7c6ae107f26f6A6
46,47,48  ART, NETWORK, KNOWLEDGE   owned by 45's account
49      45's name frame
50,51,52  the name frames for 46–48
```

Verified live: `ownerOf(46)` is 45's account, `containerOf(46)` is 45,
`frameNames(45)` is `["ART","NETWORK","KNOWLEDGE"]`, and `uri(45)` renders as
**"a space to think in"** — V1 had no way to name a composition.

Two things worth knowing:

- **The renderer needed no code change.** `componentCount`/`componentAt` have
  the same signatures in V2; they resolve through `accountOf` internally. Only
  a redeploy pointed at the new address.
- **A composition's name frame is one of its own components.** `name()` mints
  it inside the composition, which is right — a name is a frame like anything
  else. But it is not a *part* of the composition, so the renderer skips it by
  identity (whatever `CTX_CALLED` points at) in both `frameNames` and the
  `Frames` count. Fixed in the renderer, not the contract: the storage is
  correct, the reading was wrong.

## V1 — superseded, still live

Kept as the record of what Stage 0 was. Has the array-based containment, the
`attach` consent bug, and no way up the tree (see `Gaps.t.sol`).

## Addresses

| What | Address | Verified |
|---|---|---|
| Frameworks | [`0x5ae53901f5a39528ac4bc8e8cba54deb830b880f`](https://sepolia.etherscan.io/address/0x5ae53901f5a39528ac4bc8e8cba54deb830b880f#code) | ✓ solc 0.8.28, no optimizer |
| FrameworksRenderer | [`0x281C60Fafa8eaDCdfa16d58e919a1e3507eFA140`](https://sepolia.etherscan.io/address/0x281C60Fafa8eaDCdfa16d58e919a1e3507eFA140#readContract) | ✓ solc 0.8.24, no optimizer |
| EthFS FileStore | `0xFe1411d6864592549AdE050215482e4385dFa0FB` | (existing) |
| Viewer on EthFS | `frameworks_v5_viewer_v1.min.html` | 112 KB, 6 chunks |

Deployer: `0x0109b80E1a417DbDddafaF8B025B47b6C1820C7C`

## Frame map

```
1       genesis command set    43 components: 42 bindings + name
2–43    the bindings           contents = the character ("f", "F", "d", …)
44      "genesis"              the name frame bound to CTX_CALLED of frame 1

45      composition            chars = "1fw[ART]2fw[NETWORK]5fw[KNOWLEDGE]v7"
                               CTX_COMMAND_SET -> 1
46,47,48  ART, NETWORK, KNOWLEDGE   the three f-frames
49,50,51  their name frames
```

Binding order in frame 1 matches `PRIMITIVE_ORDER` in `frameworks-v5-mint.html`
and the mint order in `DeployFrameworks.s.sol`. The chain stores characters
only; which primitive index *i* names is the client's convention. Reordering
`PRIMITIVE_ORDER` without reminting silently rebinds everything.

## Reading it

```bash
# names, without rendering anything
cast call 0x281C60Fafa8eaDCdfa16d58e919a1e3507eFA140 \
  'frameNames(uint256)(string[])' 45 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
# -> ["ART", "NETWORK", "KNOWLEDGE"]

# the string as typed
cast call 0x5ae53901f5a39528ac4bc8e8cba54deb830b880f \
  'chars(uint256)(string)' 45 --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# pull the artifact and open it
node view.mjs 45
```

Or use **Read Contract** on Etherscan — both are verified.

## What is stored, and what is not

```
f              makes a frame real          -> minted on-chain
w / W          name and contents           -> written on-chain
d + transforms give it shape               -> cast in the browser, never stored
```

Composition 45 is 36 characters and 3 frames. `50f(dR,4000)` would be 50
frames on-chain and 200,000 in the browser, for ~2.6M gas — the multiplicity
is a function of the string, so it costs nothing to store.

---

## Reproducing this — read before redeploying

**The two contracts were compiled by different projects, and neither is in
this repo.** Frameworks was deployed from a scratch Foundry project (solc
0.8.28, optimizer off, Foundry defaults); the renderer from `WebGPU/deploy`,
whose `foundry.toml` pins solc 0.8.24. That is why Etherscan shows different
compiler versions.

Consequences:

- Verifying from the wrong directory fails with *"Compiled contract deployment
  bytecode does NOT match"*. That error means wrong compiler settings, not
  drifted source — check `solc` and optimizer before assuming the source
  changed.
- Nothing in this repo currently rebuilds Frameworks with the settings it was
  deployed under. Building it in `WebGPU/deploy` produces different bytecode.

To make this reproducible, copy into the deploy project:

```
frameworks on ethereum/Frameworks.sol            -> WebGPU/deploy/src/
frameworks on ethereum/FrameworksRenderer.sol    -> WebGPU/deploy/src/
frameworks on ethereum/DeployFrameworks.s.sol    -> WebGPU/deploy/script/
frameworks on ethereum/ComposeExample.s.sol      -> WebGPU/deploy/script/
```

and redeploy — the pinned 0.8.24 will not match what is live. Do this before
mainnet.

## Two traps hit while deploying

**Wrong EthFS address.** `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245` appears
in the root-level `FrameworksRendererV4.sol`, but the *deployed* V4 renderer
and `upload-to-ethfs.mjs` both use `0xFe1411d6…`. Both have code on Sepolia,
so a renderer pointed at the wrong one deploys fine and fails at read time.

**ScriptyBuilder is the wrong tool here.** Assembling the page via
`getEncodedHTML` reverts — the viewer is a complete 112 KB HTML document, not
script tags to compose. The renderer reads EthFS directly and injects
`autoExecuteCommand` before `</head>`, which is what the working V4 does.

## Pipeline (v5 scripts, v4 untouched)

```bash
python3 deploy/script/derive-viewer-v5.py     # 21 sanity checks
node    deploy/script/minify-viewer-v5.mjs    # -> viewer/frameworks_v5_viewer_v1.min.html
node    deploy/script/upload-to-ethfs-v5.mjs  # 6 chunk txs + register
forge script script/DeployFrameworksRenderer.s.sol --broadcast
```

`derive-viewer-v5.py` adds a v5-only pass that strips the chain command-set
read: the viewer has no ethers CDN, so `fetchCommandSet` could never run
there. **The builder reads its command set from chain; the artifact pins the
one it was derived against.**

## Note on the CLAUDE.md palette check

The documented pre-deploy check

```bash
grep -n "const palette\b" ... ; grep -n "paletteBuf" ...
```

gives a **false positive**. It matches `paletteBuf` (a GPU buffer) before
`const palette`, and reports the bug on the deployed, working v4 viewer too.
The real check is whether `palette` is *used* before its declaration:

```bash
awk 'NR<DECL_LINE && /[^a-zA-Z_.]palette[^a-zA-Z_(]/' frameworks-v5-viewer.html
```

On v5 the only earlier hits are CSS selectors.

## Still open

- **Copy layer** — payment, receipts, splits. `d` across an authorship
  boundary needs to record the reference payment attaches to.
- **No image** — `uri()` has no `image` field, so wallets and marketplaces
  show nothing. Needs an on-chain SVG preview or an off-chain capture.
- **Artifact pins its command set** — see above. A viewer that read its own
  set would need a bundled RPC client.
