# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **WebGPU port** (V4) of Frameworks V3 — a spatial content structure tool for constructing compositions in 3D space. The migration replaces Three.js with native WebGPU for performance and control.

No build step. All files are standalone HTML or plain JS modules. Open in Chrome 113+ or Edge 113+ (WebGPU required).

## Two-File Architecture

- **`frameworks-v4-mint.html`** — local builder. Has ethers CDN, wallet connect, Mint panel. Never uploaded to EthFS. **This is the source of truth** — edit here, then derive the viewer.
- **`frameworks-v4.1-mint.html`** — next mainnet version in progress. Same architecture as `frameworks-v4-mint.html` but with features not yet deployed (context renderer, etc.). Will become the source of truth for the next deploy cycle (`frameworks_4.1.min.html`).
- **`frameworks-v4-viewer.html`** — on-chain artifact. **Do not edit directly.** Derived from mint via `deploy/script/derive-viewer.py`. Full interactivity (all keyboard commands, command bar, export) minus chain-interaction buttons, wallet, and PNG export. Wrapped in an IIFE.
- **`frameworks-v5-mint.html`** — v4.1 plus the command set as data. The keymap is no longer a switch statement: `PRIMITIVES` (35 named operations, hardcoded) and `GENESIS_COMMAND_SET` (42 `{char, primitive}` bindings, data) are compiled into a dispatch table, and `loadCommandSet()` swaps the bindings at runtime. On startup it fetches the set from the Frameworks contract on Sepolia. **v4.1 is unchanged and is still what to use with the Frames collection.**
- **`frameworks-v5-viewer.html`** — derived from v5 via `deploy/script/derive-viewer-v5.py`. Same as the v4 viewer plus a v5-only pass that strips the chain read (no ethers CDN there, so `fetchCommandSet` could never run). **The builder reads its command set from chain; the artifact pins the one it was derived against.**
- Minified output (~68KB for v4, ~110KB for v5) is what gets uploaded to EthFS. The renderer contract serves this to token holders.

See `../frameworks on ethereum/DEPLOYMENT.md` for the deployed Frameworks + renderer addresses, the frame map, and the reproducibility caveat.

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

**Hung view pipeline:** A second render pipeline (`hvPipeline`) draws textured quads for hung views. Each hung view has a frozen 1024×1024 texture, a per-instance storage buffer (world-space basis from the parent frame), and its own bind group with a sampler + texture. The `HUNG_VIEW_SHADER` positions a 4-vertex quad using the frame's world-space basis and samples the frozen texture. Drawn after crosshatch frames and cursor in the same render pass.

### Context / Command System

All keyboard input routes through a modal context system. The active context consumes `ijkl` for its purpose; non-handled keys exit the context and re-dispatch to normal mode.

```
Normal mode → t/T → TranslateContext (ijkl moves frames/cursor)
            → s/S → ScaleContext (i/k scales)
            → p   → ColorContext (ijkl navigates 8×10 palette grid, p applies)
            → v   → CameraContext (ijkl orbits, 0-6 presets)
            → V   → captureHungView (freeze current view as textured picture frame)
            → u   → CommandTreeContext (ijkl navigates 2D fork tree)
            → #   → SelectionContext (bracket input [1,5,9])
            → m   → AnimationContext (ijkl direction/speed)
```

Command strings record every keypress. The notation `(dR,3)` means repeat `dR` three times. Nested repeats are supported. `CommandTree` stores the full 2D fork history for undo/redo.

## Key Files

### FrameStore (inline in `frameworks-v4-mint.html`)
`frame-store.js` does not exist as a separate file — FrameStore is defined inline. Key methods:
- `addFrame(x, y, z, nx, ny, nz, scale, colorIndex)` — creates frame, assigns frameId
- `translateSelected(dx, dy, dz)` / `rotateSelected(cx, cy, cz, angle, view)`
- `duplicateSelected()` / `deleteSelected()`
- `reflectSelectedH()` / `reflectSelectedV()` — flips position + normal only (NOT right/up)
- `scaleSelected(factor)` / `scaleSelectionGroup(factor)`
- `selectAllOfColor()` / `invertSelection()` / `selectAll()`
- `shiftSelectedColors(shift, paletteSize)`
- `getDirtyRange()` / `clearDirty()` — partial GPU upload tracking
- `findByFrameId(id)` — linear scan, returns array index or -1
- `snapshot()` / `loadSnapshot(snap)` — deep copy/restore of entire store (data buffer + metadata), used for hung view context entry/exit

### `ARCHITECTURE.md`
Full module breakdown for the planned modular refactor (`gpu/`, `core/`, `camera/`, `commands/`, `contexts/`, `ui/`). Reference this when splitting the step HTML files into separate modules. **Note:** `ARCHITECTURE.md` predates the 64-byte full-basis layout — it describes the old 48-byte normal+roll layout. The data model section in this CLAUDE.md is authoritative.

### `CONVERSION_PLAN (1).md`
Detailed V3→V4 mapping. Documents which V3 modules copy verbatim (CommandTree, FrameSelectionContext, ColorContext, PaletteManager) vs. which need adaptation (CommandExecutor, CameraContext, renderer).

### `Context Design/contexts-design.md`
Full design spec for the context renderer MVP and phase roadmap. Key points:
- Adds a second GPU pipeline (ortho projection, depth off) drawing context frames over the composition
- MVP: `ContextRenderer` class (~100 lines), mode indicator (7 frames always visible), palette swatch (11 frames when color context active) — one draw call total, no DOM changes
- Long-term: context definitions become on-chain frame data (recursive self-hosting). Every near-term architecture decision should be compatible with this.
- Phase roadmap: MVP → full palette grid (Phase 3) → selection strip (4) → camera context (5) → command history (6) → keyboard context (7) → data-driven (8) → on-chain (9)

## Hung Views (V key)

Hung views freeze a 3D composition into a 2D textured picture frame that lives in a larger 3D space. The projection chain is: **3D composition → camera projection → 2D texture → quad in meta-3D → screen**.

### How it works

1. **`V` press:** Snapshots the current FrameStore and camera. Wraps all frames in the current context into a new superframe (like `F`). Renders the pre-wrap snapshot into a frozen 1024×1024 texture via a one-shot offscreen render pass (separate command encoder, temporary buffers, cleaned up immediately). Animates camera zooming out (600ms cubic ease-in-out).

2. **Parent-space rendering:** The wrapped children are hidden from crosshatch rendering (`scale=0` in world buffer via memoized ancestor walk in `computeWorldTransforms`). The hung view frame renders as a textured quad instead — positioned by its world-space basis, textured with the frozen snapshot.

3. **`ck` to enter:** Animates camera zooming toward the picture (500ms). On completion, saves the current store (`snapshot()`), loads the frozen snapshot (`loadSnapshot()`), and restores the captured interior camera. You can navigate freely inside the 3D composition.

4. **`ci` to exit:** Restores the parent store from the context stack's `savedStore`, saves the interior camera back to the frame's `localCamera` metadata.

5. **Duplication:** `d` on a selected hung view deep-copies the frame + children and creates a new `hungViews` entry sharing the same GPU texture (different instance buffer / bind group). The `isHungView` metadata flag is preserved through duplication.

### Key data structures

- **`hungViews[]`** (GPU scope): array of `{ frameId, texture, instanceBuf, bindGroup, storeSnapshot, cameraSnapshot }`. One entry per hung view. Instance buffer updated each frame from world transforms.
- **Frame metadata `isHungView`:** boolean flag on the superframe's metadata entry. Controls hidden-child logic in `computeWorldTransforms` and triggers textured quad rendering.
- **Context stack entry `savedStore`:** frozen store snapshot, set when entering a hung view via `ck`. Restored on `ci`.

### Callbacks (executor → GPU scope)

- `onCaptureView(frameId, storeSnapshot, cameraSnapshot)` — triggers offscreen render-to-texture
- `onGetHungView(frameId)` — returns the hung view entry for context entry
- `onDuplicateHungView(srcFrameId, newFrameId)` — clones GPU resources for a duplicated hung view

### CameraTransition

`CameraTransition` class provides smooth lerp between camera states (theta, phi, dist, target, fov) over a configurable duration with cubic ease-in-out. Used for hung view enter/exit animations. Updated each frame in the render loop; during transition, `cameraContext.fov` is overridden by the interpolated value.

### Known limitations

- **Performance:** Each hung view's hidden children still exist in the store and are processed by `computeWorldTransforms` (set to scale=0). Three compositions noticeably drops fps. Future optimization: skip world transform computation entirely for hidden subtrees.
- **Texture size:** Fixed at 1024×1024 regardless of content or display size.
- **No re-capture:** Editing frames inside a hung view (via `ck`) does not update the frozen texture. The picture shows the state at capture time.

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
- Latest renderer (v23): `0x09A68103D9a349E0ab9478823B7972a2Ea9C913a` at index 23 (registered, tested ✓)
- **Mainnet renderer (v1)**: `0x3E34945ad431E4648e53e7AEBeC17b4cAbE452c8` at index 5, collection `0xba1901b542aa58f181f7ae18ed6cd79fda779c62`, EthFS file `frameworks_4.0.min.html`

**IMPORTANT: The onchain EthFS version (mainnet v1 / `frameworks_4.0.min.html`) is now the live deployed artifact. Any changes to `frameworks-v4-mint.html` are local only and will NOT be reflected onchain until a new deploy cycle (Steps 0–6) is completed. Always note which features are local-only vs. deployed.**

Next Sepolia deploy: bump to `frameworks_v4_viewer_v19.min.html`, renderer index 24. EthFS filenames v4–v11 are burned (failed attempts).
Next mainnet deploy: bump to `frameworks_4.1.min.html`.

### V5 — the Frameworks contract (separate from the Frames collection)

V5 does not use the Mint protocol. It has its own contract and renderer, both
live and verified on Sepolia. See `../frameworks on ethereum/DEPLOYMENT.md`.

```
Frameworks          0x5ae53901f5a39528ac4bc8e8cba54deb830b880f
FrameworksRenderer  0x281C60Fafa8eaDCdfa16d58e919a1e3507eFA140
EthFS file          frameworks_v5_viewer_v1.min.html  (112 KB, 6 chunks)
```

Pipeline — v5 copies, so the v4 scripts are untouched:

```bash
python3 deploy/script/derive-viewer-v5.py     # 21 sanity checks
node    deploy/script/minify-viewer-v5.mjs
node    deploy/script/upload-to-ethfs-v5.mjs
forge script script/DeployFrameworksRenderer.s.sol --broadcast
```

Two traps worth knowing:

- **EthFS address.** Use `0xFe1411d6864592549AdE050215482e4385dFa0FB` — the one
  `upload-to-ethfs.mjs` writes to and the deployed V4 reads from. The
  `0x8FAA1AAb…` address in the root-level `FrameworksRendererV4.sol` is a
  different contract; both have code on Sepolia, so a renderer pointed at the
  wrong one deploys fine and fails at read time.
- **Don't use ScriptyBuilder for the v5 viewer.** `getEncodedHTML` reverts on a
  112 KB complete HTML document. Read EthFS directly and inject
  `autoExecuteCommand` before `</head>`, which is what the working V4 does.

See `deploy/REDEPLOY.md` for full deployment history and versioning steps.

### Critical: Pre-deploy checklist (verify before every upload)

Two bugs that silently pass locally but break in the on-chain iframe proxy:

1. **`palette` must not be *used* before it is declared** (TDZ).

   The old form of this check compared `const palette` against the first
   `paletteBuf` line and required palette to be lower. That is a **false
   positive** — `paletteBuf` is an unrelated GPU buffer that is legitimately
   created earlier, and the check fails on the deployed, working v4 viewer.
   Check for a real TDZ instead: no JS use of bare `palette` above its
   declaration (CSS selectors like `#palette-grid` don't count).

   ```bash
   DECL=$(grep -n "const palette\b" frameworks-v5-viewer.html | head -1 | cut -d: -f1)
   awk -v d="$DECL" 'NR<d && /[^a-zA-Z_.]palette[^a-zA-Z_(]/ {print NR": "$0}' \
     frameworks-v5-viewer.html
   # any JS (non-CSS) hit is a real TDZ bug
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

## Remaining Work

- **Context renderer MVP** — `ContextRenderer` class, second pipeline, mode indicator + palette swatch. See `Context Design/contexts-design.md` for full spec.
- **Hung view performance** — skip `computeWorldTransforms` for subtrees under hung view frames; currently all hidden children are still processed each frame.
- **Hung view re-capture** — allow updating the frozen texture after editing the interior (re-render snapshot on exit or on demand).
- **Hung view texture resolution** — adaptive sizing based on frame scale or viewport, instead of fixed 1024×1024.
- Modular refactor: extract `gpu/`, `core/`, `camera/`, `commands/`, `contexts/` per `ARCHITECTURE.md`
- Save/load (URL hash, localStorage, command string export)
- On-chain command string storage (mint protocol)

### Local-only features (not yet deployed onchain)

These exist in `frameworks-v4-mint.html` / `frameworks-v4.1-mint.html` but are NOT in the live onchain artifact (`frameworks_4.0.min.html`). They will be included in mainnet v2 (`frameworks_4.1.min.html`):
- Sketch log + commitments history (two-row command bar)
- `/` command overlay with n-repeat
- Command compression (net axis cancellation, repeat notation)
- Copy ↑ button (appends compressed sketch to commit field)
- **Hung views (`V` key)** — freeze 3D compositions into 2D textured picture frames, navigate in/out with `ck`/`ci`, duplicate with `d`, animated camera transitions
- Planned: `~` loop notation and `.` step-pause notation for animated command playback
