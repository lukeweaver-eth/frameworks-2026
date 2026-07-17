# Frameworks Contexts — Design Document

## Long-Term Vision

Frameworks is a self-referential recursive structure that uses itself
to build itself.

A frame has content and contexts. A context is a frame. The palette
is a frame whose content is 80 sub-frames colored with the Checks
palette. The camera presets are a frame whose content is 7 sub-frames
arranged as an unfolded cube. The selection strip is a frame whose
content mirrors the composition's array order.

These context-frames are data — they could be stored on-chain alongside
the composition, as part of the protocol. A renderer reads a context-
frame's content and knows how to display it, how to map commands to
mutations within it. The command string doesn't just build a
composition — it navigates a graph of contexts, each of which is
itself a frame structure.

The protocol becomes: frames define contexts, contexts produce frames,
those frames can define new contexts. Frameworks is the medium, the
tool, and the output simultaneously.

This is the eventual goal. It doesn't need to be built now. But every
near-term decision should be compatible with it.

## What That Means for Near-Term Architecture

Three constraints follow from the long-term vision:

**1. Context visualizations are data, not code.**

The palette grid shouldn't be a hardcoded `for (let i = 0; i < 80; i++)`
loop that places frames at calculated positions. It should be a data
structure — an array of frame positions and colors — that the renderer
displays. Today that data structure is constructed in JS at startup.
Eventually it's read from an on-chain frame. The rendering path is
identical in both cases.

Practically: define each context's visual layout as a plain array of
`{ x, y, colorIndex, flags }` objects (or directly as FrameStore
entries). A function builds the array. The renderer consumes it.
Swapping the function for an on-chain read later requires no renderer
changes.

**2. The rendering layer is generic.**

There shouldn't be a "palette renderer" and a "selection renderer."
There's a single context renderer that draws whatever frames are in
its instance buffer. Context-specific logic lives in the update
functions that populate the buffer, not in the draw call.

**3. Contexts compose the same way frames compose.**

A context-frame can contain other context-frames. The keyboard context
contains sub-regions for different key groups. The composition context
is the "root" context. This nesting doesn't need to work in the MVP,
but the data model (frames containing frames, contexts containing
contexts) shouldn't be precluded by the architecture.

## Context Model

```
COMPOSITION (root context, always active)
  │
  ├── p ──→ COLOR CONTEXT
  │           content: 80 frames, 10×8 grid
  │           commands: ijkl navigates, p applies + exits
  │
  ├── # ──→ SELECTION CONTEXT
  │           content: N frames mirroring composition array
  │           commands: ijkl window, IJKL reorder/contract
  │
  ├── v ──→ CAMERA CONTEXT
  │           content: 7 frames, cube cross layout
  │           commands: 0-9 select, ijkl adjust
  │
  ├── u ──→ COMMAND CONTEXT
  │           content: M frames, command history strip
  │           commands: ijkl navigate branches
  │
  └── t,s,m,y ──→ MODAL CONTEXTS (translate, scale, animation, line)
                   brief modes — ijkl acts, any other key exits
                   content: 4 frames (i/j/k/l directional indicator)
```

A command string is a sequence of context transitions and within-
context mutations. `plv5` reads: enter color (`p`), shift color (`l`),
enter camera (`v`), select top view (`5`).

The visual interface shows whichever context is active. When `p` is
pressed, the color context's frame composition appears. When it exits,
it disappears.

## Rendering Architecture

### What Exists Now

```
Render pass:
  1. Compute pass: frustum cull composition instances
  2. Draw composition frames (perspective, indirect, culled)
  3. Draw cursor
```

### What the MVP Adds

```
Render pass:
  1. Compute pass: frustum cull composition instances
  2. Draw composition frames (perspective, indirect, culled)
  3. Draw cursor
  4. Draw context frames (orthographic, direct, depth off)
```

Step 4 is a single instanced draw call. Same vertex shader, same
fragment shader, same frame geometry. Different bind group pointing at:

| Resource | Source |
|----------|--------|
| Uniform buffer | Orthographic VP, cursor at (0,0,0) |
| Instance buffer | Context FrameStore (~200 frames max) |
| Visible buffer | Identity array [0, 1, 2, ...N] |
| Palette buffer | Shared with composition |

One new pipeline variant: `depthCompare: 'always'`, `depthWriteEnabled:
false`. Everything else reused.

### Coordinate System

Context frames use normalized screen coordinates:
- Origin (0, 0) at bottom-left of viewport
- (1, 1) at top-right
- Frame size specified as fraction of viewport height

The orthographic matrix maps these to clip space:
```javascript
// orthoVP: maps (0,0)-(aspectRatio, 1) to clip space
function orthoProjection(out, aspect) {
    // left=0, right=aspect, bottom=0, top=1, near=-1, far=1
    out.fill(0);
    out[0] = 2 / aspect;
    out[5] = 2;
    out[10] = -1;
    out[12] = -1;
    out[13] = -1;
    out[15] = 1;
}
```

Context frames are positioned in this space. A frame at (0.05, 0.05)
with scale 0.02 sits in the bottom-left corner at 2% of viewport height.

## MVP Specification

The MVP is the minimum that feels frame-native and proves the
rendering architecture works. It covers Phase 1 (infrastructure) and
a minimal Phase 2 (one or two visual indicators).

### MVP Scope

**In scope:**
- Context renderer: second pipeline, uniform buffer, instance buffer,
  bind group, ortho projection, draw call wired into render loop
- Mode indicator: a small cluster of frames that shows the current
  context through color
- Palette indicator: when color context is active, a compact color
  swatch (not the full 80-frame grid yet) showing the current and
  adjacent colors

**Out of scope for MVP:**
- Full 80-frame palette grid (Phase 3)
- Selection strip (Phase 4)
- Camera context visualization (Phase 5)
- Command history visualization (Phase 6)
- Data-driven context definitions
- Removing any existing DOM overlays (coexist during transition)

### MVP Implementation Plan

#### Step 1: ContextRenderer class

```javascript
class ContextRenderer {
    constructor(device, frameVB, frameIB, frameIdxCount, paletteBuf) {
        this.device = device;
        this.maxFrames = 256;

        // Instance data for context frames
        this.store = new FrameStore(this.maxFrames);

        // Instance buffer (GPU)
        this.instanceBuf = device.createBuffer({
            size: this.maxFrames * BYTES_PER_INSTANCE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Identity visible buffer [0, 1, 2, ...N]
        this.visibleBuf = device.createBuffer({
            size: this.maxFrames * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const identity = new Uint32Array(this.maxFrames);
        for (let i = 0; i < this.maxFrames; i++) identity[i] = i;
        device.queue.writeBuffer(this.visibleBuf, 0, identity);

        // Orthographic uniform buffer
        this.uniformBuf = device.createBuffer({
            size: 80, // same layout as composition uniforms
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Build pipeline (same shaders, depth off)
        // ... (uses existing renderBGL layout, new bind group)

        // Bind group referencing context-specific buffers
        // ... this.bindGroup = ...
    }

    // Rebuild ortho projection on resize
    resize(canvasWidth, canvasHeight) {
        const aspect = canvasWidth / canvasHeight;
        const uniformData = new Float32Array(20);
        // Build orthographic VP matrix
        orthoProjection(uniformData, aspect);
        // cursor at origin, showCursor = 0
        uniformData[16] = 0; uniformData[17] = 0;
        uniformData[18] = 0; uniformData[19] = 0;
        this.device.queue.writeBuffer(this.uniformBuf, 0, uniformData);
    }

    // Called each tick: read executor state, rebuild context frames
    update(executor, compositionStore) {
        this.store.clear();
        // ... populate frames based on active context
    }

    // Upload instance data to GPU
    upload() {
        if (this.store.count === 0) return;
        const bytes = this.store.count * BYTES_PER_INSTANCE;
        this.device.queue.writeBuffer(
            this.instanceBuf, 0,
            this.store.data, 0, bytes
        );
    }

    // Draw in the render pass (called after composition draw)
    draw(renderPass) {
        if (this.store.count === 0) return;
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.frameVB);
        renderPass.setIndexBuffer(this.frameIB, 'uint16');
        renderPass.drawIndexed(this.frameIdxCount, this.store.count);
    }
}
```

#### Step 2: Mode indicator

A row of 5-7 small frames in the bottom-left corner. Each frame
represents a context. The active context's frame is highlighted
(selected flag) and colored brightly. Inactive contexts are dim.

```
  ■  ■  ■  ■  ■  ■
  n  t  s  p  #  v      (normal, translate, scale, color, select, camera)
     ↑
     active (bright, selected)
```

This is ~7 frames. Positioned at roughly (0.03, 0.03) with scale
~0.018 and spacing ~0.025. Updates every tick by reading
`executor.mode` and the active context flags.

Each context gets a signature color:
- Normal: white/neutral
- Translate: blue (palette index ~60)
- Scale: green (palette index ~46)
- Color: the currently selected palette color
- Selection: orange (palette index ~22)
- Camera: purple (palette index ~74)
- Command: red (palette index ~10)

#### Step 3: Palette swatch (when color context active)

When `executor.colorContext.active`, add a small horizontal strip of
~11 frames above the mode indicator showing the neighborhood of the
current palette position: 5 colors before, the current color
(highlighted), 5 colors after.

```
  ■ ■ ■ ■ ■ ▓ ■ ■ ■ ■ ■
              ↑ current color (selected)
```

This is 11 frames. Appears only when color context is active.
Positioned at (0.03, 0.07). Updates when `colorContext.currentIndex`
changes.

#### Step 4: Wire into render loop

In `main()`, after creating the render pipeline:

```javascript
const ctxRenderer = new ContextRenderer(
    device, frameVB, frameIB, frameIdxCount, paletteBuf
);

// In resize():
ctxRenderer.resize(canvas.width, canvas.height);

// In frame():
ctxRenderer.update(executor, store);
ctxRenderer.upload();

// In render pass, after composition + cursor draws:
ctxRenderer.draw(rp);
```

### MVP Deliverables

| File | What changes |
|------|-------------|
| `frameworks-v4.html` | Add `ContextRenderer` class, second pipeline + bind group, wire into render loop |
| No new files | Everything fits in the single HTML |

### MVP Frame Budget

| Element | Frames | When visible |
|---------|--------|-------------|
| Mode indicator | 7 | Always |
| Palette swatch | 11 | Color context active |
| **Total** | **≤18** | |

18 frames. Under 1.2 KB of instance data. One draw call.

## Phase Roadmap (Post-MVP)

### Phase 3: Full Palette Context

Replace the 11-frame swatch with the full 80-frame 10×8 grid.
Replace the DOM `#palette-overlay` element. Delete the CSS.

The grid is positioned center-screen (or offset to not obscure the
composition). Navigation highlight tracks `colorContext.currentIndex`.

### Phase 4: Selection Context

A horizontal strip of up to 80 frames mirroring the composition array.
Each strip frame's color matches its composition counterpart. Selected
frames highlighted. Reorder operations (`I`/`K`) visually slide frames
within the strip.

This replaces the HUD `Sel: X / Y` text and makes array order visible.

### Phase 5: Camera Context

7 frames in cube-cross layout. Active view highlighted. This is small
and self-contained — could be done anytime after Phase 3.

### Phase 6: Command Context

A strip showing command history and branch position. Most complex
visually due to branching. Lower priority.

### Phase 7: Keyboard Context

The full QWERTY frame layout with per-context key illumination.
This is the most frames (~30) and the most update logic (mapping
every context's key bindings to frame states). High value but also
high effort. Do after the per-context visuals are proven.

### Phase 8: Data-Driven Contexts

Replace the hardcoded `update()` functions with context definitions
that are themselves frame data. A context definition specifies:
- Layout (frame positions)
- Content mapping (what each frame represents)
- Command mapping (what keys do within this context)

This is where the system becomes recursive. A context definition is
a frame. Building a new context is the same as building a composition.

### Phase 9: On-Chain Contexts

Store context definitions on-chain as frame data. The renderer reads
them. New contexts can be created by anyone and registered, the same
way new renderers are registered on Mint collections.

Frameworks becomes an open protocol for spatial context construction.

## What to Build Today

1. **The ContextRenderer class** — second pipeline, ortho projection,
   instance buffer, bind group. This is pure infrastructure, ~100 lines.

2. **The mode indicator** — 7 frames, always visible. Updates every tick.
   Proves the rendering path works end to end.

3. **The palette swatch** — 11 frames, context-triggered. Proves that
   context activation/deactivation drives the visual layer.

That's it. ~18 frames, one draw call, no DOM changes, no existing
behavior modified. The composition, the command executor, the keyboard
input, the command string — all unchanged. You're adding a visual layer
that reads state and renders frames.

Once those 18 frames are on screen and updating correctly, every
subsequent phase is just "add more frames to the context store and
update them in the tick function." The architecture doesn't change.
