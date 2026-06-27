# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **WebGPU port** (V4) of Frameworks V3 — a spatial content structure tool for constructing compositions in 3D space. The migration replaces Three.js with native WebGPU for performance and control.

No build step. All files are standalone HTML or plain JS modules. Open in Chrome 113+ or Edge 113+ (WebGPU required).

## Two-File Architecture

- **`frameworks-v4-mint.html`** — local builder. Has ethers CDN, wallet connect, Mint panel. Never uploaded to EthFS. **This is the source of truth** — edit here, then derive the viewer.
- **`frameworks-v4-viewer.html`** — on-chain artifact. **Do not edit directly.** Derived from mint via `deploy/script/derive-viewer.py`. Full interactivity (all keyboard commands, command bar, export) minus chain-interaction buttons, wallet, and PNG export. Wrapped in an IIFE.
- Minified output (~68KB) is what gets uploaded to EthFS. The renderer contract serves this to token holders.

`frameworks-3.1.3-combined.js` is the V3 reference implementation (Three.js-based). `modules/` contains minified V3 modules for drop-in reuse.

### Viewer derivation workflow

`frameworks-v4-viewer.html` is **generated** from mint — do not hand-edit it:

```bash
# From repo root (WebGPU/)
python3 deploy/script/derive-viewer.py
# Runs 18+ removal/replacement passes and prints sanity-check results.
# All checks must pass before proceeding to minify.
```

What `derive-viewer.py` removes/replaces from mint:
- ethers CDN `<script>` tag
- Mint panel CSS, HTML div, and toggle button
- PNG/SVG export key handlers (`o`/`O`) and capture infrastructure
- `buildPaletteGrid`, `mintCommandString`, mint panel DOM refs
- `doRenderPass` refactor → simple inline render pass
- Adds IIFE wrap around `<script>` block

**Verification sequence** (tests V3 parity — should create three orthogonal frames at 90° angles):
```
1fp5fpp2fppp tiiiiiillllll 5tiiiiii RRRRRRRR 1R
```

## Architecture

### Data Model

Every frame is 64 bytes (16 × f32/u32) in a flat `ArrayBuffer`, mirroring the WebGPU storage buffer exactly:

```
Offset  Field      Type   Notes
──────  ─────────  ─────  ──────────────────────────────
0-2     position   vec3
3       scale      f32
4-6     right      vec3   Basis X-axis
7       colorIndex u32    Palette index (0-79), NOT hex string
8-10    up         vec3   Basis Y-axis
11      flags      u32    bit 0: selected, bit 1: visible
12-14   normal     vec3   Basis Z-axis
15      frameId    u32    Monotonic ID, stable across deletions
```

**Full basis is stored, not normal+roll.** V3 rotates all three basis vectors independently. Reconstructing from normal+roll after rotation loses in-plane orientation. Do not add a `reconstructBasisFromNormal` call anywhere in the rotation path.

### GPU Pipeline

```
CPU: FrameStore (typed array) → dirty range → writeBuffer (partial upload)
GPU compute: frustum cull → visible[] + indirect draw args
GPU render: drawIndexedIndirect → vertex shader reads basis → mat3x3 transform
```

Frame geometry: 4 crosshatch line-quads (16 vertices, 24 indices) rendered as triangles. Line width is world-space. 4× MSAA is enabled on the render pipeline to fix aliasing.

### Context / Command System

All keyboard input routes through a modal context system. The active context consumes `ijkl` for its purpose; non-handled keys exit the context and re-dispatch to normal mode.

```
Normal mode → t/T → TranslateContext (ijkl moves frames/cursor)
            → s/S → ScaleContext (i/k scales)
            → p   → ColorContext (ijkl navigates 8×10 palette grid, p applies)
            → v   → CameraContext (ijkl orbits, 0-6 presets)
            → u   → CommandTreeContext (ijkl navigates 2D fork tree)
            → #   → SelectionContext (bracket input [1,5,9])
            → m   → AnimationContext (ijkl direction/speed)
```

Command strings record every keypress. The notation `(dR,3)` means repeat `dR` three times. Nested repeats are supported. `CommandTree` stores the full 2D fork history for undo/redo.

## Key Files

### `frame-store.js`
Complete FrameStore implementation. Key methods:
- `addFrame(x, y, z, nx, ny, nz, scale, colorIndex)` — creates frame, assigns frameId
- `translateSelected(dx, dy, dz)` / `rotateSelected(cx, cy, cz, angle, view)`
- `duplicateSelected()` / `deleteSelected()`
- `reflectSelectedH()` / `reflectSelectedV()` — flips position + normal only (NOT right/up)
- `scaleSelected(factor)` / `scaleSelectionGroup(factor)`
- `shiftSelectedColors(shift, paletteSize)`
- `getDirtyRange()` / `clearDirty()` — partial GPU upload tracking

### `ARCHITECTURE.md`
Full module breakdown for the planned modular refactor (`gpu/`, `core/`, `camera/`, `commands/`, `contexts/`, `ui/`). Reference this when splitting the step HTML files into separate modules. **Note:** `ARCHITECTURE.md` predates the 64-byte full-basis layout — it describes the old 48-byte normal+roll layout. The data model section in this CLAUDE.md is authoritative.

### `CONVERSION_PLAN (1).md`
Detailed V3→V4 mapping. Documents which V3 modules copy verbatim (CommandTree, FrameSelectionContext, ColorContext, PaletteManager) vs. which need adaptation (CommandExecutor, CameraContext, renderer).

## Critical Gotchas

### Reflection is intentionally left-handed
`reflectSelectedH/V` flips the position and the matching normal component only. Right/up vectors are NOT flipped. The resulting basis has a flipped determinant (left-handed). The WGSL shader reads stored vectors as-is — do not "fix" this or it breaks V3 round-trip fidelity.

### Frame IDs vs. array indices
`frameId` (offset 15) is a monotonic counter that never changes. Array indices shift on deletion. `FrameSelectionContext` uses frame IDs for bracket notation; use `store.findByFrameId()` / `store.selectByFrameIds()`.

### Color: integer indices only
V4 stores palette indices (u32), never hex strings. All V3 code paths that produce hex strings (`palette.getNextColor()`) must be replaced with `palette.currentIndex`. Clamp imported colors with `colorIndex % paletteSize`.

### WGSL struct must match instance layout exactly
Any file still using the 48-byte quaternion layout (quaternion `qrot()` in vertex shader) is the original prototype and has not been updated. The correct 64-byte WGSL struct is:

```wgsl
struct Instance {
    px: f32, py: f32, pz: f32, scale: f32,
    rx: f32, ry: f32, rz: f32, colorIdx: u32,
    ux: f32, uy: f32, uz: f32, flags: u32,
    nx: f32, ny: f32, nz: f32, frameId: u32,
};
// Orientation:
let basis = mat3x3<f32>(
    vec3(inst.rx, inst.ry, inst.rz),
    vec3(inst.ux, inst.uy, inst.uz),
    vec3(inst.nx, inst.ny, inst.nz),
);
var p = basis * (local_pos * inst.scale);
```

### Dirty tracking scope
`getDirtyRange()` returns a byte-offset range for `writeBuffer`. Only upload the dirty range — at 1M frames this is the difference between uploading 64MB/frame vs. ~320 bytes after a 5-frame translate.

## Deployment (from `deploy/` directory)

All deploy commands run from `deploy/`. Requires `.env` with `PRIVATE_KEY` and `ETH_RPC_URL`.

**When mint HTML changes** → Steps 0–4 below.
**When only renderer contract changes** → Steps 2–4.
**When only builder HTML changes** → no redeploy needed.

```bash
# Step 0: Derive viewer from mint (run from repo root WebGPU/)
python3 deploy/script/derive-viewer.py
# All sanity checks must print ✓ before continuing

# Step 1: Bump version in three places (EthFS names are immutable):
#   deploy/script/minify-viewer.mjs  → OUTPUT filename (e.g. frameworks_v4_viewer_v17.min.html)
#   deploy/src/FrameworksRendererV4.sol → bodyTags[1].name = "frameworks_v4_viewer_v17.min.html"
#   deploy/REDEPLOY.md → add row to deployment history

# Step 2: Minify viewer (run from deploy/)
npm run minify
# Output: viewer/frameworks_v4_viewer_vN.min.html (~68KB)

# Step 3: Upload to EthFS (run from deploy/)
export PRIVATE_KEY=0x...
export ETH_RPC_URL=https://sepolia.infura.io/v3/...
npm run upload

# Step 4: Deploy renderer contract (run from deploy/)
forge script script/DeployRenderer.s.sol --rpc-url $ETH_RPC_URL --private-key $PRIVATE_KEY --broadcast

# Step 5: Register renderer — must use OWNER wallet (different from deployer), via Etherscan/Rabby
# Call: registerRenderer(rendererAddress) on collection 0xc3D5853bC409156C0AaC4E3d6F96d307C2E7Fb40

# Step 6: Update mint-renderer-idx in frameworks-v4-mint.html to new index
```

**Key addresses (Sepolia):**
- Collection: `0xc3D5853bC409156C0AaC4E3d6F96d307C2E7Fb40`
- EthFS FileStore: `0xFe1411d6864592549AdE050215482e4385dFa0FB`
- ScriptyBuilderV2: `0xD7587F110E08F4D120A231bA97d3B577A81Df022`
- Latest renderer (v20): `0x20CBaD40EcE732870db8D811B524c6dA0eFA9c16` at index 20 (pending owner wallet registration)

Next deploy: bump to `frameworks_v4_viewer_v17.html`, renderer index 21. EthFS filenames v4–v11 are burned (failed attempts).

See `deploy/REDEPLOY.md` for full deployment history and versioning steps.

### Critical: Pre-deploy checklist (verify before every upload)

Two bugs that silently pass locally but break in the on-chain iframe proxy:

1. **`palette` must be declared before `paletteBuf`** — check with:
   ```bash
   grep -n "const palette\b" frameworks-v4-viewer.html | head -1
   grep -n "paletteBuf" frameworks-v4-viewer.html | head -1
   # palette line number must be LOWER
   ```

2. **Script must be wrapped in an IIFE** — the proxy loads the HTML twice in the same window scope. Without it, `Identifier 'CommandExecutor' has already been declared`.
   ```bash
   # Line after <script> must be: (function() {
   # Line before </script> must be: })();
   ```

### Critical: Terser flags for minification

Do NOT use default terser settings. These flags are required to prevent TDZ reordering and class rename errors:
```
compress.join_vars: false   — prevents reordering that creates TDZ violations
mangle.keep_classnames: true — prevents WebGPU class name mangling errors
```
These are already set in `deploy/script/minify-viewer.mjs`. Do not change them.

## Known Performance Limitations

### World-space line width (fragment-bound at large scales)

Frame lines are expanded as world-space quads (`lp.z, lp.w` perp offset in the vertex shader). This means fragment cost scales with zoom level and frame scale — large frames or close camera = more screen pixels covered = more fragment + MSAA resolve work. At 127k frames, this causes ~30% fps drop when zoomed in vs. zoomed out.

**Fix:** switch to screen-space line width — project the centerline first, then offset in clip/NDC space. Lines would be a fixed pixel width regardless of zoom. This is a vertex shader change only; no CPU-side changes needed.

## Remaining Work (Phase 3–4)

- Modular refactor: extract `gpu/`, `core/`, `camera/`, `commands/`, `contexts/` per `ARCHITECTURE.md`
- Corner cycling (`q` command, per `CORNER_SYSTEM.md`)
- `n` key repeat conversion
- View indicator overlay (colored cube showing active working plane)
- Save/load (URL hash, localStorage, command string export)
- Export (SVG, PNG)
- On-chain command string storage (mint protocol)
