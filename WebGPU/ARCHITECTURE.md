# Frameworks WebGPU Renderer — Architecture Plan

## The Blinking Problem

The flicker comes from two sources:

1. **No MSAA.** Your frame lines are 0.036 world-units wide (2 × LINE_HALF_W). At any
   camera distance, subpixel quads alias frame-to-frame. During orbit the aliasing pattern
   shifts, producing shimmer. Fix: create the render target with `sampleCount: 4` and add
   a resolve target. This is ~10 lines of config change.

2. **Possible readback stall.** The async `mapAsync` on the readback buffer can
   occasionally block the queue if the GPU hasn't finished. Fix: double-buffer the readback
   (two staging buffers, alternate each frame) or just read less frequently.

---

## Key Architecture Decisions

### 1. Normal + Roll instead of Quaternion

Your existing system uses `(î, ĵ, k̂)` normal vector + roll angle. The current WebGPU
prototype uses quaternions. These are equivalent, but your command system and coordinate
docs are written around normal+roll, and it matches how the view system works (frame
creation assigns a normal based on view plane, rotation updates roll when in-plane).

**Decision:** Store `normal (vec3) + roll (f32)` per instance. Build the orientation
matrix in the vertex shader using the same algorithm as your Three.js renderer:

```
1. basis = orthonormal_basis_from_normal(normal, world_up)
2. apply roll rotation within that basis
3. scale by instance scale
4. translate to position
```

This keeps the GPU data layout aligned with your command semantics.

### 2. Instance Data Layout (48 bytes)

```
struct FrameInstance {          // 48 bytes, 12 × f32-aligned
    position:   vec3<f32>,      // 0..11    world position
    scale:      f32,            // 12..15   uniform scale
    normal:     vec3<f32>,      // 16..27   orientation normal
    roll:       f32,            // 28..31   in-plane rotation (radians)
    colorIndex: u32,            // 32..35   palette index (0..79)
    flags:      u32,            // 36..39   bit 0=selected, bit 1=visible, ...
    _pad0:      u32,            // 40..43
    _pad1:      u32,            // 44..47
}
```

The `flags` field packs selection, visibility, and future per-instance state (animation
active, locked, etc.) into a single u32, avoiding separate buffers.

### 3. Compute Culling Pipeline

```
CPU (once):          writeBuffer(instances)   — only on dirty
CPU (every frame):   writeBuffer(cullUniforms) — frustum planes + count
                     writeBuffer(indirectArgs) — reset instanceCount to 0

GPU command buffer:
  1. Compute pass:   cull_main   — test each instance against 6 planes,
                                   atomicAdd to indirect.instanceCount,
                                   write surviving index to visible[]
  2. Render pass:    vs_frame    — read visible[instance_index] → instance data
                     fs_frame    — palette lookup, selection highlight
                     drawIndexedIndirect(indirectBuf)
```

### 4. Module Boundaries

Each module is a single JS file with a clear responsibility. No build step required —
use ES module `import` in the browser. A single `main.js` wires everything together.

---

## Module Plan

```
frameworks-webgpu/
├── index.html              # Shell: canvas + HUD markup + <script type="module" src="main.js">
├── main.js                 # Init, wire modules, render loop
│
├── gpu/
│   ├── device.js           # requestAdapter, requestDevice, canvas config
│   ├── buffers.js          # Buffer creation + management (instance, visible, indirect, uniform, palette)
│   ├── pipelines.js        # Render + compute pipeline creation
│   └── shaders.js          # WGSL source strings (render + cull)
│
├── core/
│   ├── frame-store.js      # Typed-array instance storage (add, remove, bulk ops, grow)
│   ├── frame-geometry.js   # Build the 4-line crosshatch quad geometry
│   ├── palette.js          # 80-color palette data + GPU buffer upload
│   ├── views.js            # 7 view plane definitions (ijkl→xyz mappings, normals, rotation axes)
│   └── math.js             # vec3, mat4, quat utilities (all pure functions, no allocations in hot path)
│
├── camera/
│   ├── orbital-camera.js   # Spherical coords, mouse drag orbit/pan, scroll zoom
│   └── frustum.js          # Extract 6 frustum planes from viewProj matrix
│
├── commands/
│   ├── executor.js         # Execute single keys and compound command strings
│   ├── notation.js         # Parse repeat notation: (dR,3), nested (d(R2R1,23),4)
│   ├── command-tree.js     # 2D undo/fork tree (branches[], currentRow, currentCol)
│   ├── compaction.js       # IJKL accumulator, pattern detection, suffix splitting
│   └── command-ui.js       # Textarea sidebar, chunk display, edit→rebuild cycle
│
├── contexts/
│   ├── context-manager.js  # Central dispatcher: enter/exit/handleKey routing
│   ├── normal.js           # Default mode: f, d, x, r, R, e, E, a, A, z, Z, space, 0-6, etc.
│   ├── translate.js        # t/T + ijkl modes
│   ├── scale.js            # s/S + ik modes
│   ├── color.js            # p → ijkl palette navigation → p to apply
│   ├── camera-ctx.js       # v → ijkl orbit/zoom, number presets → v to exit
│   ├── command-ctx.js      # u → ijkl tree navigation → any key to fork/exit
│   ├── selection.js        # # → bracket input + ijkl nav → apply
│   └── animation.js        # m → ijkl color cycling direction/speed
│
└── ui/
    ├── hud.js              # Mode display, cursor info, selection count, FPS
    ├── palette-overlay.js  # Color grid overlay during color context
    └── view-indicator.js   # Colored cube showing active working plane
```

---

## Module Details

### `gpu/device.js`

```js
export async function initGPU(canvas) → { device, context, format }
```

Handles WebGPU capability detection, adapter selection (high-performance), device
creation with required limits, canvas configuration. Returns the three things every
other GPU module needs.

### `gpu/buffers.js`

```js
export class GPUBufferManager {
    constructor(device, maxInstances)

    instanceBuffer      // STORAGE | COPY_DST — all instance data
    visibleBuffer       // STORAGE | COPY_DST — u32 indices written by compute
    indirectBuffer      // INDIRECT | STORAGE | COPY_DST — drawIndexedIndirect args
    uniformBuffer       // UNIFORM | COPY_DST — viewProj + cursor + flags
    cullUniformBuffer   // UNIFORM | COPY_DST — frustum planes + instance count
    paletteBuffer       // STORAGE | COPY_DST — 80 × vec4

    uploadInstances(data, byteLength)
    uploadUniforms(viewProj, cursor, showCursor)
    uploadCullUniforms(frustumPlanes, instanceCount)
    resetIndirectArgs(indexCount)
}
```

Centralizes all GPU memory. The key insight: `uploadInstances` only runs when the
frame store's dirty flag is set. Every other upload is cheap (< 200 bytes).

### `gpu/pipelines.js`

Creates the render pipeline (frame + cursor) and compute pipeline (cull).

**MSAA config** lives here — the render pipeline's `multisample.count = 4` and the
render pass gets a multisample texture + resolve target. This fixes the blinking.

### `gpu/shaders.js`

Two WGSL shader strings:

**Render shader** — vertex shader builds orientation matrix from normal+roll:
```wgsl
fn build_basis(normal: vec3<f32>, roll: f32) -> mat3x3<f32> {
    let up = select(vec3(0,1,0), vec3(1,0,0), abs(dot(normal, vec3(0,1,0))) > 0.99);
    let right = normalize(cross(up, normal));
    let corrected_up = cross(normal, right);
    // Apply roll
    let cr = cos(roll); let sr = sin(roll);
    let rolled_right = cr * right + sr * corrected_up;
    let rolled_up = -sr * right + cr * corrected_up;
    return mat3x3(rolled_right, rolled_up, normal);
}
```

**Cull shader** — unchanged from current, sphere-vs-frustum test.

### `core/frame-store.js`

```js
export class FrameStore {
    // Typed array storage, same layout as GPU buffer
    count: number
    capacity: number
    data: ArrayBuffer
    f32: Float32Array
    u32: Uint32Array
    dirty: boolean
    dirtyRange: [start, end]  // Track dirty byte range for partial upload

    add(pos, normal, roll, scale, colorIndex) → index
    addBulk(n, positionsFn, colorFn, normalFn) → startIndex
    remove(indices: Set)
    get/set position, normal, roll, scale, color, flags

    // Dirty tracking: only upload changed byte range
    markDirty(index)
    markRangeDirty(start, count)
    getDirtyRange() → { offset, length } | null
    clearDirty()
}
```

**Critical optimization over current code:** partial dirty range tracking. When you
translate 5 selected frames, only those 5 × 48 bytes need re-uploading, not the entire
buffer. `uploadInstances` in BufferManager calls `writeBuffer(buf, offset, data, offset, length)`.

### `core/views.js`

```js
export const VIEWS = [
    {
        id: 0, name: 'Spatial',
        normal: [0,0,1],
        i: [0,1,0], k: [0,-1,0], j: [-1,0,0], l: [1,0,0],
        rotationAxis: [0,0,1],
    },
    // ... views 1-6 matching COORDINATE_SYSTEMS.md exactly
];

export function getCornerPositions(viewId, bbox) → [8 × vec3]
// Per CORNER_SYSTEM.md: TR-near, TL-near, BL-near, BR-near, then far plane
```

### `camera/orbital-camera.js`

Same as current implementation. Left-drag orbit, right-drag/alt-drag pan, scroll zoom.
Exposes `viewProj`, `eye`, `update(aspect)`.

### `camera/frustum.js`

```js
export function extractFrustumPlanes(viewProj: Float32Array) → Float32Array(24)
```

Pure function, extracts 6 normalized planes from column-major viewProj. Used by
`BufferManager.uploadCullUniforms`.

---

## Context System

### `contexts/context-manager.js`

```js
export class ContextManager {
    constructor(frameStore, camera, commandTree, palette)

    activeContext: Context | null
    contexts: Map<string, Context>

    register(name, context)
    enter(name)           // Exit current, enter new, update HUD
    exit()                // Return to normal mode
    handleKey(key, shift) // Route to active context or normal mode

    getModeName() → string  // For HUD display
}
```

Every context implements:
```js
interface Context {
    name: string
    enter(manager)        // Setup state, show UI
    exit(manager)         // Cleanup, apply changes, hide UI
    handleKey(key, shift) // Process input, return true if consumed
}
```

### `contexts/normal.js` — Normal Mode

This is the "root" context. Most single-key commands live here:

| Key | Action | Notes |
|-----|--------|-------|
| `f` | Create frame at cursor | Normal, roll from view |
| `d`/`D` | Duplicate selected | |
| `x` | Delete selected | |
| `r` | Rotate 90° CCW | Around view's rotation axis, pivot=cursor |
| `R` | Rotate 45° CCW | |
| `e` | Reflect horizontal | Across vertical plane through cursor |
| `E` | Reflect vertical | Across horizontal plane through cursor |
| `a` | Select same color | |
| `A` | Select all | |
| `z` | Cursor → origin | |
| `Z` | Center structure → cursor | |
| `Space` | Snap selection → cursor | |
| `q` | Cycle cursor through bbox corners | Per CORNER_SYSTEM.md |
| `0-6` | Set view plane | |
| `t` | Enter translate context | |
| `T` | Enter translate-cursor context | |
| `s` | Enter scale context | |
| `S` | Enter scale-all context | |
| `p` | Enter color context | |
| `v` | Enter camera context | |
| `u` | Enter command-tree context | |
| `#` | Enter selection context | |
| `m` | Enter animation context | |
| `/` | Open compound command input | |
| `n` | Repeat last compound command | |
| `?` | Toggle HUD | |

### `contexts/translate.js`

```js
class TranslateContext {
    // mode: 'frames' | 'cursor'
    enter(manager) { /* set mode based on whether t or T triggered */ }

    handleKey(key) {
        if ('ijkl'.includes(key)) {
            const axis = VIEWS[currentView][key];
            if (this.mode === 'frames') translateSelected(axis);
            else translateCursor(axis);
            return true;
        }
        // Any non-ijkl key: exit and let normal mode handle it
        this.manager.exit();
        return false; // re-dispatch to normal
    }
}
```

**Design note:** Translation stays modal (you press `t` once, then `ijkl` repeatedly)
matching your existing behavior. Escape or any non-ijkl key exits. The command interface
captures the full sequence: `t(i,5)(l,3)`.

### `contexts/color.js`

```js
class ColorContext {
    // 2D navigation in 8×10 palette grid
    row: number
    col: number

    enter() { row = floor(currentColor/10); col = currentColor%10; showPaletteOverlay(); }

    handleKey(key) {
        if (key === 'i') row = max(0, row-1);
        if (key === 'k') row = min(7, row+1);
        if (key === 'j') col = max(0, col-1);
        if (key === 'l') col = min(9, col+1);
        if (key === 'p') { applyColor(); manager.exit(); }
        return true;
    }

    exit() { hidePaletteOverlay(); }
}
```

Matches CONTEXT_SYSTEM.md: `p` enters, `ijkl` navigates, `p` again applies+exits.
Command string captures as `p(i,3)(l,2)p` etc.

### `contexts/camera-ctx.js`

```js
class CameraContext {
    handleKey(key) {
        if (key === 'v') { manager.exit(); return true; }
        if (key === 'i') camera.phi += 0.1;    // orbit up
        if (key === 'k') camera.phi -= 0.1;    // orbit down
        if (key === 'j') camera.theta -= 0.1;  // orbit left
        if (key === 'l') camera.theta += 0.1;  // orbit right
        if ('0123456789'.includes(key)) loadPreset(key);
        return true;
    }
}
```

### `contexts/command-ctx.js`

```js
class CommandTreeContext {
    // Navigate the 2D branch tree from COMMAND_INTERFACE.md
    handleKey(key) {
        if (key === 'u') { manager.exit(); return true; }
        if (key === 'j') commandTree.moveBack();
        if (key === 'l') commandTree.moveForward();
        if (key === 'i') commandTree.moveBranchUp();
        if (key === 'k') commandTree.moveBranchDown();
        // Any non-nav key: fork at current position, exit
        if (!'ijkl'.includes(key)) {
            commandTree.fork();
            manager.exit();
            return false; // re-dispatch key to normal mode
        }
        return true;
    }
}
```

### `contexts/selection.js`

Bracket input `[1,5,9]` + `ijkl` expand/contract. From CONTEXT_SYSTEM.md.

### `contexts/animation.js`

```js
class AnimationContext {
    // m + ijkl sets direction, speed
    // Per-instance animation state stored in a separate CPU-side array
    // Compute shader could handle color cycling on GPU
    handleKey(key) {
        if (key === 'i') setDirection('colorUp');
        if (key === 'k') setDirection('colorDown');
        if (key === 'j') setDirection('cycleBack');
        if (key === 'l') setDirection('cycleFwd');
        if (key === 'J') speedUp();
        if (key === 'L') slowDown();
        // Same direction key again = stop
    }
}
```

---

## Command System

### `commands/executor.js`

```js
export class CommandExecutor {
    constructor(frameStore, contextManager, views, palette)

    executeKey(key, shift)           // Single keypress
    executeCommandString(cmdString)  // Full compound string like "d(R2R1,23)"

    // Hooks for command interface tracking
    onKeyExecuted: (key) => void
    onCompoundExecuted: (str) => void
}
```

`executeCommandString` uses the notation parser to expand repeats, then feeds keys
one-by-one to the context manager. The `isExecutingCompound` flag prevents the command
interface from double-tracking.

### `commands/notation.js`

Recursive descent parser for the repeat notation:

```
command_string := (token)*
token          := '(' command_string ',' count ')'
               | single_char
count          := digit+
```

```js
export function parseNotation(str) → string[]
// "(dR,3)" → ['d','R','d','R','d','R']
// "(d(R2R1,23),4)" → expands inner first, then repeats outer 4×
```

### `commands/command-tree.js`

The 2D fork tree from COMMAND_INTERFACE.md:

```js
export class CommandTree {
    branches: string[][]     // Each branch is an array of command chars
    currentRow: number
    currentCol: number
    forkPoints: Map          // row → { parentRow, forkCol }

    push(key)                // Append to current branch (or fork if diverging)
    moveBack()               // j in command context
    moveForward()            // l in command context
    moveBranchUp()           // i
    moveBranchDown()         // k
    fork()                   // Create new branch from current position
    rebuild(frameStore)      // Replay from root to current position
}
```

### `commands/compaction.js`

The IJKL accumulator and pattern detection from COMMAND_INTERFACE.md:

```js
export class CommandCompactor {
    chunks: string[]
    ijklAccumulator: { chunkIndex, prefix, iNet, jNet, INet, JNet }

    addKey(key)
    addCompound(str)
    flush()                  // Finalize current accumulator
    getDisplayLines() → string[]
    parseFromText(text) → string[]  // For textarea editing
    rebuildFromChunks(executor)     // Clear state, replay all chunks
}
```

---

## Rendering Improvements

### MSAA (fixes blinking)

```js
// In pipelines.js
const sampleCount = 4;

const msaaTexture = device.createTexture({
    size: [width, height],
    format: fmt,
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

// Render pass config
colorAttachments: [{
    view: msaaTexture.createView(),   // draw into multisample
    resolveTarget: swapChainView,     // resolve to screen
    loadOp: 'clear', storeOp: 'discard',
}]

// Pipeline multisample config
multisample: { count: sampleCount }
```

### Screen-Space Line Width (future)

Instead of world-space quads, expand lines in the vertex shader using clip-space
perpendicular. This gives consistent pixel-width lines regardless of camera distance.
Not essential for v1 but eliminates the need to tune LINE_HALF_W per scene scale.

### Partial Buffer Upload

```js
// Instead of uploading the entire instance buffer:
const range = frameStore.getDirtyRange();
if (range) {
    device.queue.writeBuffer(
        instanceBuffer,
        range.offset,
        frameStore.data,
        range.offset,
        range.length
    );
    frameStore.clearDirty();
}
```

At 1M instances this is the difference between uploading 48MB/frame vs 240 bytes
when you move 5 selected frames.

---

## Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Keyboard   │────▶│   Context    │────▶│    Command      │
│  Events     │     │   Manager    │     │    Executor     │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Command    │◀────│   Command    │◀────│   FrameStore    │
│  UI         │     │   Compactor  │     │  (typed arrays) │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │ dirty range
                                                   ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │  Orbital     │────▶│  GPU Buffer     │
                    │  Camera      │     │  Manager        │
                    └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
                                         ┌─────────────────┐
                                         │ Compute: Cull   │
                                         │ Render: Draw    │
                                         │ (single submit) │
                                         └─────────────────┘
```

**Per frame:**
1. Keyboard → ContextManager routes to active context
2. Context calls CommandExecutor which mutates FrameStore
3. CommandCompactor records the key for display
4. FrameStore marks dirty range
5. Camera updates viewProj
6. BufferManager uploads dirty range + uniforms + frustum planes + resets indirect
7. GPU: compute culls → render draws via indirect

Steps 1-3 only happen on user input (not every frame).
Steps 4-7 happen every frame, but step 4 often uploads 0 bytes.

---

## Implementation Order

### Phase 1: Core Renderer (fix blinking, prove architecture)
1. `gpu/device.js` + `gpu/shaders.js` — init + WGSL with normal+roll orientation
2. `core/math.js` + `core/views.js` — pure math, view definitions
3. `core/frame-store.js` — typed array store with dirty range tracking
4. `core/frame-geometry.js` + `core/palette.js`
5. `gpu/buffers.js` + `gpu/pipelines.js` — MSAA enabled
6. `camera/orbital-camera.js` + `camera/frustum.js`
7. `main.js` — render loop, basic keyboard (just f, ijkl, d, x, r)

**Milestone:** Frames render without flicker, camera orbits, 500k+ at 60fps.

### Phase 2: Context System
8. `contexts/context-manager.js` + `contexts/normal.js`
9. `contexts/translate.js` + `contexts/scale.js`
10. `contexts/color.js` + `ui/palette-overlay.js`
11. `contexts/camera-ctx.js`
12. `contexts/animation.js`

**Milestone:** Full command set works through modal contexts.

### Phase 3: Command Interface
13. `commands/notation.js` — repeat notation parser
14. `commands/executor.js` — executeKey + executeCommandString
15. `commands/compaction.js` — IJKL accumulator, pattern detection
16. `commands/command-ui.js` — textarea sidebar
17. `commands/command-tree.js` — 2D undo/fork
18. `contexts/command-ctx.js` + `contexts/selection.js`

**Milestone:** Commands are replayable, editable, and compact.

### Phase 4: Polish
19. `ui/view-indicator.js` — colored cube
20. Screen-space line width in vertex shader
21. Save/load (export command strings, URL hash, localStorage)
22. Corner cycling (`q` command per CORNER_SYSTEM.md)
23. Compound command input overlay (`/` key)
24. `n` key repeat conversion

---

## Migration Notes (Three.js → WebGPU)

### What stays the same
- Command semantics (every key does exactly the same thing)
- Frame data model (position, normal, roll, scale, color)
- View plane definitions and ijkl mappings
- Coordinate system (right-handed, Y-up)
- Command notation syntax
- Context enter/exit behavior

### What changes
- Renderer: Three.js InstancedMesh → WebGPU storage buffer + indirect draw
- Orientation: same math, now in WGSL instead of GLSL
- Culling: was Three.js built-in → now explicit compute shader
- Camera: was OrbitControls → now 60-line custom orbital camera
- Selection flags: was per-instance JS object → now bit in u32 flags field
- Buffer management: was Three.js internal → now explicit typed array + writeBuffer

### What you gain
- 5-10× instance capacity (compute culling, minimal per-frame upload)
- Full control over memory layout and GPU pipeline
- No framework overhead (~600KB less)
- Command strings can drive the renderer with zero JS object allocation
- Path to WebGPU compute for animation (color cycling on GPU)

---

## Open Questions

1. **Should animation color cycling run on GPU?** If `m` triggers per-instance color
   cycling, a compute shader can increment `colorIndex` per frame without CPU involvement.
   This means animating 1M frames costs nothing on CPU. Tradeoff: animation state lives
   on GPU, harder to serialize back to command string.

2. **Command tree rebuild vs. incremental?** Currently rebuild replays all commands from
   scratch. At 1M frames built from 10k commands, this could take seconds. Alternative:
   snapshot frame store state at intervals, replay only from nearest snapshot.

3. **Selection storage at scale.** A JS `Set` with 1M entries is fine for membership
   testing but slow to iterate for flag sync. Alternative: store selection as a bitfield
   `Uint32Array(ceil(count/32))` — O(1) test, fast bulk iteration, and can be uploaded
   directly to GPU as a storage buffer for compute-shader-driven selection operations.
