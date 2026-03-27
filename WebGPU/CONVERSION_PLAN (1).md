# V3 → V4 Conversion Plan

## What stays identical (copy with minimal changes)

These modules have zero rendering dependency. They operate on abstract data
and can be dropped into V4 as-is:

### 1. `CommandTree` (lines 1298-1520)
Copy verbatim. It operates on string arrays — no Three.js types anywhere.

### 2. `FrameSelectionContext` (lines 1006-1290)
Copy verbatim. It reads/writes `frame.selected` and `frame.count` — pure data.

### 3. `ColorContext` (lines 616-780)
Copy verbatim. It navigates a color array and sets `frame.color`.

### 4. `PaletteManager` + `PALETTES` (lines 482-613)
Copy verbatim. Pure data + index management.

### 5. `CommandExecutor.expandRepeats()` / `condenseCommandString()` (lines 2700-2830)
Copy verbatim. String parsing, no dependencies.

### 6. Corner system `getCornerCoordinates()` (lines 2222-2318)
Copy verbatim. Pure coordinate math from bounding box.

---

## What changes: Data Model

### V3: Frame class (object per frame)
```js
class Frame {
    x, y, z                    // position
    rightX, rightY, rightZ     // basis X-axis
    upX, upY, upZ              // basis Y-axis
    ihat, jhat, khat           // basis Z-axis (normal)
    size                       // scale
    color                      // hex string '#FF6B6B'
    selected                   // boolean
    visible                    // boolean
    count                      // integer ID
    called, contents           // metadata strings
}
```

### V4: Flat typed array (GPU-aligned)
```
Per instance: 64 bytes (16 × f32)

Offset  Field           Type
──────  ──────────────  ────────
0       position.x      f32
4       position.y      f32
8       position.z      f32
12      scale           f32
16      right.x         f32
20      right.y         f32
24      right.z         f32
28      colorIndex      u32     ← index into palette, not hex string
32      up.x            f32
36      up.y            f32
40      up.z            f32
44      flags           u32     ← bit 0: selected, bit 1: visible
48      normal.x        f32
52      normal.y        f32
56      normal.z        f32
60      _pad            u32
```

**Why store full basis instead of normal+roll:**
Your Frame.rotate() rotates all 3 basis vectors independently via the rotation
matrix. If we stored only normal+roll, we'd need to extract roll from the
rotated basis after every rotation — possible but adds complexity and potential
for floating-point drift. Storing the full basis matches V3 exactly.

**Why colorIndex instead of hex string:**
Palette lookup on GPU. The WGSL shader reads `palette[colorIndex]` from a
storage buffer. Conversion happens once at frame creation, not per-frame.

### V4: Metadata sidecar (CPU-only)
Frame metadata that doesn't go to GPU stays in a parallel array:
```js
// CPU-side metadata per instance
metadata[i] = {
    count: 0,        // global frame ID
    called: '',       // name/title
    contents: '',     // body content
    contexts: [],     // context frame IDs
    components: [],   // component frame IDs
}
```

---

## What changes: Rendering

### V3: Three.js InstancedBufferGeometry + LineSegments
```
- 8 vertices (4 line pairs) as LineSegments
- 7 separate InstancedBufferAttributes (offset, right, up, normal, scale, color, selected)
- Custom GLSL vertex shader builds mat3 from right/up/normal
- Every frame: copy all Frame objects → typed arrays → mark needsUpdate
- Three.js handles: camera matrices, orbit controls, frustum culling (disabled), draw calls
```

### V4: WebGPU Storage Buffer + Compute Cull + Indirect Draw
```
- 16 vertices (4 line quads, 24 indices) as triangles — gives line width control
- 1 storage buffer containing all instances as contiguous struct array
- WGSL vertex shader reads basis vectors directly from struct
- Only uploads changed byte ranges (dirty tracking)
- Compute shader: frustum cull → writes visible[] + indirect draw args
- drawIndexedIndirect: GPU decides how many to draw
- MSAA (4×) for flicker-free thin lines
```

### Shader translation (GLSL → WGSL)

**V3 GLSL vertex shader:**
```glsl
mat3 orientation = mat3(
    frameRight.x, frameRight.y, frameRight.z,
    frameUp.x, frameUp.y, frameUp.z,
    frameNormal.x, frameNormal.y, frameNormal.z
);
vec3 pos = orientation * (position * scale);
pos += offset;
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
```

**V4 WGSL equivalent:**
```wgsl
let basis = mat3x3<f32>(
    vec3(inst.rx, inst.ry, inst.rz),     // right (column 0)
    vec3(inst.ux, inst.uy, inst.uz),     // up (column 1)
    vec3(inst.nx, inst.ny, inst.nz),     // normal (column 2)
);
var p = basis * (local_pos * inst.scale);
p += vec3(inst.px, inst.py, inst.pz);
out.pos = u.viewProj * vec4(p, 1.0);
```

Almost identical. The only differences:
1. WGSL mat3x3 is column-major (same as GLSL mat3)
2. viewProj is pre-multiplied on CPU (V3 uses Three.js projectionMatrix * modelViewMatrix)
3. Instance data comes from a storage buffer, not per-instance attributes

---

## What changes: Camera

### V3: Custom orbit controls wrapping Three.js Spherical + Camera
- Mouse drag → update spherical coords → camera.position.setFromSpherical
- Three.js handles matrix computation
- Separate perspective + orthographic cameras
- View presets position camera at fixed locations

### V4: 60-line orbital camera
- Mouse drag → update theta/phi → compute eye position
- Manual mat4LookAt + mat4Perspective (already built)
- View presets set theta/phi/distance directly
- No Three.js dependency

**CameraContext needs small changes:**
- Replace `this.renderer.setCameraView(...)` calls with direct camera state changes
- Replace `this.renderer.setCameraZoom(...)` with `camera.dist = ...`
- Replace `this.renderer.setCameraFOV(...)` with `camera.fov = ...`
- The context logic (navigate, selectView, autoOrbit) stays the same

---

## What changes: Frame operations

### Frame.rotate() → in-place typed array rotation

V3 rotates Frame object properties. V4 rotates values in the typed array:

```js
// V3
frame.rotate(cx, cy, cz, angle, 'z');
// internally modifies: frame.x, frame.y, frame.rightX, frame.rightY, ...

// V4
function rotateInstance(store, idx, cx, cy, cz, angle, axis) {
    const o = idx * 16;  // 16 floats per instance
    // Read position
    let dx = store.f32[o] - cx;
    let dy = store.f32[o+1] - cy;
    let dz = store.f32[o+2] - cz;
    // Rotate position, right, up, normal around axis
    // Write back to same offsets
    store.dirty = true;
}
```

The math is identical — just array indexing instead of property access.

### Frame.duplicate() → memcpy

```js
// V3
const dup = frame.duplicate();  // creates new Frame object
fw.addFrame(dup);

// V4
function duplicateInstance(store, srcIdx) {
    const newIdx = store.count++;
    store._grow(store.count);
    const src = srcIdx * 16;
    const dst = newIdx * 16;
    // Copy 16 floats
    for (let i = 0; i < 16; i++) store.f32[dst+i] = store.f32[src+i];
    return newIdx;
}
```

### Frame color: hex string → palette index

V3: `frame.color = '#E84AA9'` (hex string, compared with string matching)
V4: `store.u32[o + 7] = 0` (palette index, compared with integer)

The ColorContext.apply() shift logic stays the same — it already works with
palette indices internally.

---

## What changes: CommandExecutor

The CommandExecutor (lines 1528-3095) is the biggest module. It needs these changes:

1. **Replace `this.framework.getSelectedFrames()` iteration:**
   V3: `fw.getSelectedFrames().forEach(frame => { frame.rotate(...) })`
   V4: iterate frame store with selection check:
   ```js
   for (let i = 0; i < store.count; i++) {
       if (store.u32[store._off(i) + 11] & 1) {  // check selected flag
           rotateInstance(store, i, ...);
       }
   }
   ```

2. **Replace `new Frame(...)` construction:**
   V3: `const frame = new Frame(x, y, z, ihat, jhat, khat, size, color);`
   V4: `const idx = store.addFrame(pos, normal, scale, colorIndex);`

3. **Replace `frame.x`, `frame.y`, etc. property access:**
   V4: use store accessor methods or direct array indexing.

4. **Replace color string operations:**
   V3: `frame.color = this.palette.getNextColor()` (hex string)
   V4: `store.setColor(idx, this.palette.currentIndex)` (integer)

5. **CameraContext calls:**
   V3: `this.renderer.setCameraView(viewNum, ortho, zoom, fov)`
   V4: direct camera state mutation

**Everything else in CommandExecutor stays the same:** the key routing logic,
context enter/exit, mode switching, the entire command string parser.

---

## Conversion Order

### Step 1: FrameStore (typed array backend)
Replace Frame class + Framework.frames[] with a flat typed array store.
Implement: add, remove, duplicate, getPos, setPos, rotate, reflect, etc.
All operating on the flat buffer with the 64-byte layout.

### Step 2: WebGPU renderer
Port the existing WebGPU prototype to use the new 64-byte layout with
full basis vectors. The WGSL shader reads right/up/normal directly.
Add MSAA. Add compute culling. Add indirect draw.

### Step 3: Camera
Use the existing orbital camera from the prototype. Add CameraContext
integration (view presets, zoom, FOV, auto-orbit).

### Step 4: CommandExecutor adaptation
Search-and-replace Frame object access with FrameStore array access.
The routing logic, context dispatching, and command tree integration
stay identical.

### Step 5: Contexts
Drop in ColorContext, FrameSelectionContext, CommandTree unchanged.
Adapt CameraContext to use the new camera.

### Step 6: UI + HUD
Port the HTML overlay (palette grid, mode display, command tree panel)
from the existing prototype. Wire to CommandExecutor callbacks.

---

## Performance comparison

|                          | V3 (Three.js)              | V4 (WebGPU)                    |
|--------------------------|----------------------------|--------------------------------|
| Instance storage         | Object per frame           | 64 bytes in typed array        |
| Per-frame upload         | Copy all instances → attrs | Upload only dirty byte range   |
| Draw calls               | 1 (instanced)              | 1 (indirect)                   |
| Culling                  | None (frustumCulled=false) | GPU compute shader             |
| Line rendering           | LineSegments (1px only)    | Quad-expanded (variable width) |
| Antialiasing             | WebGL MSAA (if enabled)    | Explicit 4× MSAA               |
| Max practical instances  | ~100k                      | ~2M                            |
| Camera                   | Three.js Spherical         | 60-line manual orbit           |
| JS framework overhead    | ~600KB (Three.js)          | 0                              |

---

## Files affected

```
V3 (copy unchanged):
  PaletteManager, PALETTES          → palette.js
  ColorContext                      → context-color.js
  FrameSelectionContext             → context-selection.js
  CommandTree                       → command-tree.js
  expandRepeats(), condenseCommandString() → notation.js

V3 (adapt):
  Frame + Framework                 → frame-store.js (typed array)
  CommandExecutor                   → executor.js (array access instead of objects)
  CameraContext                     → context-camera.js (direct camera mutation)
  FrameworksInstancedRenderer       → DELETED (replaced by WebGPU pipeline)

V4 (new):
  gpu/device.js, buffers.js, pipelines.js, shaders.js
  camera/orbital-camera.js, frustum.js
  main.js (init + render loop)
  index.html (canvas + HUD)
```

---

## Handoff Files

1. **`frameworks-3_1_3-combined.js`** — V3 source (reference implementation)
2. **`frameworks-scaled.html`** — Working WebGPU prototype with compute culling,
   MSAA, orbital camera, stress test buttons. Use as renderer starting point.
3. **`frame-store.js`** — Complete FrameStore implementation with all V3 Frame
   operations ported to typed arrays. Drop-in replacement for Frame + Framework.
4. **`ARCHITECTURE.md`** — Module plan and data flow diagrams.
5. **`CONVERSION_PLAN.md`** — This file.
6. **V3 documentation** — COORDINATE_SYSTEMS.md, CORNER_SYSTEM.md, CONTEXT_SYSTEM.md,
   COMMAND_INTERFACE.md, README.md, ROADMAP.md

---

## Gotchas

### 1. Reflection only flips normal, not right/up

V3 `reflectSelectedH` flips the position along one axis AND flips only the
corresponding component of the **normal vector**. It does NOT flip the right
or up vectors. This is intentional but mathematically incomplete — after
reflection, the basis is no longer a proper orthonormal frame (the determinant
of the 3×3 basis matrix flips sign, making it left-handed).

The V3 GLSL shader doesn't care — it just reads the stored vectors and builds
a mat3. The V4 WGSL shader should do the same. Do NOT add a
`reconstructBasisFromNormal` call after reflection — that would change the
frame's in-plane rotation, breaking round-trip fidelity.

If you later want mathematically correct reflection, you'd also flip the
right vector's corresponding component. But that changes V3 behavior.

### 2. Color: hex strings → palette indices

V3 stores `frame.color = '#E84AA9'` (hex string). V4 stores
`colorIndex = 0` (integer). Conversion points:

- **Frame creation** (`CommandExecutor.createFrame`): V3 calls
  `this.palette.getNextColor()` which returns a hex string. V4 should call
  `this.palette.currentIndex` (already an integer) and pass it to
  `store.addFrame(...)`.

- **ColorContext.apply()**: V3 does string comparison to find each frame's
  current palette index, then applies a shift. V4 reads the integer directly
  from the store — the string lookup becomes unnecessary. But keep ColorBridge
  for any UI that needs to display hex colors.

- **Animation** (`updateAnimation`): V3 does a hex→index lookup per frame per
  tick. V4 just does integer arithmetic — much faster. Use
  `store.animateAllColors(direction, cols, paletteSize)`.

- **Edge case**: V3's `ColorContext.apply()` has a fallback when a frame's
  color isn't found in the palette (line 748: `frame.color = this.getCurrentColor()`).
  In V4, every frame's color IS a palette index, so this case can't happen.
  But frames imported from V3 command strings might have stale colors. Handle
  by clamping: `colorIndex % paletteSize`.

### 3. Frame IDs survive deletion but indices don't

V3's `frame.count` is a monotonically increasing ID that never changes after
creation. Array indices, however, shift after deletion. The FrameStore preserves
both: `frameId` (stored at offset 15) stays constant, while the array index
changes during compaction.

`FrameSelectionContext` selects by `frame.count` (bracket notation `[1,5,9]`).
Use `store.findByFrameId()` and `store.selectByFrameIds()`.

`CommandTree` replay creates frames in the same order, so frame IDs match.
But if you ever implement out-of-order operations, the ID→index mapping
becomes critical.

### 4. V3 stores full basis, not normal+roll

The ARCHITECTURE.md initially proposed `normal + roll`. After reading V3,
the FrameStore uses the full 9-component basis (right, up, normal). This is
because V3's `Frame.rotate()` rotates all 3 vectors independently. After a
sequence of rotations, the actual right/up vectors diverge from what
`reconstructBasisFromNormal()` would produce (because reconstruction always
uses a canonical reference up, while rotation preserves the actual up).

The instance layout is 64 bytes instead of 48. The GPU buffer is 33% larger
per instance. At 1M frames that's 64MB vs 48MB — still fine.

### 5. WGSL shader must match the instance layout exactly

The WebGPU prototype (`frameworks-scaled.html`) uses a 48-byte layout with
quaternions. The new layout is 64 bytes with right/up/normal. The WGSL struct
MUST be updated:

```wgsl
struct Instance {
    px: f32, py: f32, pz: f32, scale: f32,        // 0-3
    rx: f32, ry: f32, rz: f32, colorIdx: u32,     // 4-7
    ux: f32, uy: f32, uz: f32, flags: u32,        // 8-11
    nx: f32, ny: f32, nz: f32, frameId: u32,      // 12-15
};
```

And the vertex shader orientation changes from `qrot()` to:
```wgsl
let basis = mat3x3<f32>(
    vec3(inst.rx, inst.ry, inst.rz),
    vec3(inst.ux, inst.uy, inst.uz),
    vec3(inst.nx, inst.ny, inst.nz),
);
var p = basis * (local_pos * inst.scale);
```

### 6. Animation state lives on CPU

V3's animation system (`CommandExecutor.updateAnimation`) runs on CPU — it
iterates all frames and shifts their color index. In V4 this could be a
compute shader for zero CPU cost, but that makes serialization harder
(the GPU-modified color indices need reading back for command tree replay).

Recommendation: keep animation on CPU using `store.animateAllColors()` for
V4 launch. Move to GPU compute in a future optimization pass.

### 7. CommandExecutor.executeKeyNormal duplication

V3 has two nearly identical key handlers: `executeKey()` (records to command
tree) and `executeKeyNormal()` (skips recording, used during replay). They
share ~95% of the same logic. In V4, factor this into one method with a
`recording` boolean parameter to avoid the duplication bug surface.

# How the pieces connect

```
V3 (what you have working)
├── CommandExecutor      ─── operates on ──→  Frame objects + Framework.frames[]
├── ColorContext          }
├── FrameSelectionContext }  pure logic,      reads/writes frame properties
├── CameraContext        }   no rendering
├── CommandTree          }
└── FrameworksInstancedRenderer  ──────────→  Three.js (gets replaced)

V4 (what gets built)
├── CommandExecutor      ─── operates on ──→  FrameStore (typed arrays)
├── ColorContext          }                   ↓
├── FrameSelectionContext }  unchanged        FrameStore.data (ArrayBuffer)
├── CameraContext        }  (minor adapter)   ↓
├── CommandTree          }  unchanged        GPU storage buffer
└── WebGPU Pipeline      ──────────────────→  compute cull → indirect draw
```

**`frame-store.js`** is the adapter layer. It exposes the same operations the CommandExecutor calls on Frame objects (`rotate`, `translate`, `duplicate`, `reflect`, `scale`) but reads/writes a flat typed array whose memory layout matches the WebGPU storage buffer. The GPU reads it directly — no per-frame conversion step.

**`frameworks-scaled.html`** is the working GPU pipeline. It currently has its own simple State class with a 48-byte quaternion layout. You replace that State class with FrameStore (64-byte basis layout), update the WGSL struct to match, and swap the `qrot()` call for a `mat3x3` basis multiply.

**The V3 contexts and CommandTree** drop in unchanged. They operate on abstract data (palette indices, frame IDs, mode strings). The only adaptation is CameraContext, which calls `this.renderer.setCameraView()` — rewire those to set camera theta/phi/distance directly.

## Next phase approach

**Step 1: Get FrameStore rendering.** Take `frameworks-scaled.html`, replace its `State` class with `FrameStore`, update the WGSL instance struct from 48→64 bytes, change the vertex shader from `qrot()` to the basis `mat3x3` multiply. Verify: create a frame with `f`, see it render, orbit around it. This is the critical integration point — everything else builds on it.

**Step 2: Wire CommandExecutor.** Port `CommandExecutor` by replacing `frame.x` property access with `store.f32[offset]` array access (or use FrameStore's accessor methods). The routing logic, mode switching, and context dispatch stay identical. Test with the V3 verification sequence: `1fp5fpp2fppp tiiiiiillllll 5tiiiiii RRRRRRRR 1R` — the three orthogonal frames should maintain 90° angles.

**Step 3: Drop in contexts.** ColorContext, FrameSelectionContext, CommandTree copy verbatim. CameraContext needs the renderer calls adapted. Test `p` + `ijkl` palette navigation, `u` + `ijkl` undo tree, `#` bracket selection.

**Step 4: Command string replay.** Wire `executeCommandString()` so you can load a command string from a URL hash or text input and rebuild the full structure. This proves the entire pipeline end-to-end.

Start with step 1. If the frame renders correctly with the basis vectors, everything else is mechanical.
