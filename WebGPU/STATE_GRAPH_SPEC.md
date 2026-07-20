# STATE_GRAPH_SPEC.md
# Building a Harel Statechart Layer on top of Frameworks V4.1

This document is written for an agent building a state machine authoring and execution system.
Frameworks V4.1 (`frameworks-v4.1-mint.html`) is the substrate. You are adding a layer on top of it,
not replacing or rewriting it. Read this document before touching any code.

---

## 1. What Frameworks Is

Frameworks is a 3D spatial composition tool rendered via WebGPU. Everything is a **frame**: a flat
rectangular geometry placed in 3D space with a full orientation basis. Frames can contain other frames
(superframes/subframes). The entire program is a single self-contained HTML file with no build step.

Your job is to give frames statechart semantics — states, transitions, guards, actions — while leaving
the existing spatial composition system intact. The two layers coexist: the spatial layer is always
visible; the statechart layer is an interpretation of the same frame objects.

---

## 2. The Frame Data Model

### 2a. Binary layout (64 bytes per frame, `FLOATS_PER_INSTANCE = 16`)

Every frame is 16 x 32-bit words in a flat `ArrayBuffer`. Two typed array views alias the same buffer:

```
store.f32  — Float32Array  (positions, basis vectors, scale)
store.u32  — Uint32Array   (color index, flags, frame ID)
```

Word offsets (constants `F` and `U` defined at top of script):

```
Offset  Name            Type    Notes
──────  ──────────────  ──────  ─────────────────────────────────────────
F.PX=0  position.x      f32
F.PY=1  position.y      f32
F.PZ=2  position.z      f32
F.SCALE=3  scale        f32     world units; frame half-width = scale/2
F.RX=4  right.x         f32     \
F.RY=5  right.y         f32      > basis X-axis (right vector)
F.RZ=6  right.z         f32     /
        (word 7 = U.COLOR_INDEX)
F.UX=8  up.x            f32     \
F.UY=9  up.y            f32      > basis Y-axis (up vector)
F.UZ=10 up.z            f32     /
        (word 11 = U.FLAGS)
F.NX=12 normal.x        f32     \
F.NY=13 normal.y        f32      > basis Z-axis (facing direction)
F.NZ=14 normal.z        f32     /
        (word 15 = U.FRAME_ID)

U.COLOR_INDEX=7   u32   palette index 0–79; NOT a hex color
U.FLAGS=11        u32   bit 0: FLAG_SELECTED (1), bit 1: FLAG_VISIBLE (2)
U.FRAME_ID=15     u32   monotonic counter; stable across deletions; never reused
```

To read frame `i`:
```js
const o = store._o(i);        // = i * 16
const x  = store.f32[o + F.PX];
const id = store.u32[o + U.FRAME_ID];
```

### 2b. Metadata (parallel JS array, not in GPU buffer)

Each frame has a JS metadata object at `store.metadata[i]`:

```js
{
  called:      string,    // name/title — use this for state name
  contents:    string,    // body text — use this for entry/exit/do actions OR command string
  contexts:    number[],  // array of frame IDs — repurpose for transition endpoints
  components:  number[],  // array of frame IDs — reserved for annotations
  parentId:    number|null, // frame ID of parent (null = root context)
  isSuperframe: bool,     // true if this frame has been used as a superframe
  localCamera: object|null, // saved camera state when inside this context
}
```

`contexts` and `components` are currently unused by the core engine — they are the natural place to
store statechart edge data.

### 2c. Frame IDs vs. array indices

**Never use array index `i` as a stable identity.** Indices shift on deletion.
Use `store.u32[store._o(i) + U.FRAME_ID]` as the stable ID.

To find a frame by ID:
```js
function findByFrameId(store, frameId) {
    for (let i = 0; i < store.count; i++) {
        if (store.u32[store._o(i) + U.FRAME_ID] === frameId) return i;
    }
    return -1;
}
```
(This also exists as `executor._findByFrameId(frameId)`.)

---

## 3. The Context / Hierarchy System

### 3a. What a context is

A **context** is any frame that other frames have been placed inside. There is no separate "context"
type — any frame can be a context. A frame's `metadata[i].parentId` holds the frame ID of its parent
context, or `null` if it lives at the root level.

The active context is tracked in a module-level stack:

```js
const contextStack = [{ frameId: null }];    // null = root
function currentContextId() {
    return contextStack[contextStack.length - 1].frameId;
}
```

Navigating contexts:
- `ck` → push a new entry onto `contextStack` (enter the selected frame as a sub-context)
- `ci` → pop from `contextStack` (exit to parent context)
- `cj`/`cl` → cycle between sibling frames in the current context

When you enter a context, the camera is restored to the last saved position inside that frame.
When you exit, the previous camera is restored.

**Harel mapping**: context = superstate. `contextStack` at any moment is the active state configuration
path from root to the current leaf. `ci`/`ck` are your enter/exit state primitives.

### 3b. What "current context" scopes

The current context ID affects:
1. **Creation**: `f` and `F` place new frames with `parentId = currentContextId()`
2. **Selection**: `A` (select all), `#[n]` (positional select), `a` (select by color) — all scoped to
   frames whose `parentId === currentContextId()`
3. **Layers pane**: shows only frames in the current context

It does **not** affect rendering — all frames render regardless of context. Hiding is done explicitly
via `h` (FLAG_VISIBLE bit).

### 3c. World vs. local coordinates

Children store their position in **parent-local space**. Every render frame, `computeWorldTransforms()`
walks the `parentId` chain and produces world-space positions in `worldData` (a `Float32Array` with the
same layout as `store.f32`). The GPU reads world-space positions from `worldBuf`; `store.f32` always
holds local coords.

**Critical for statechart rendering**: when you draw arrows between states, use world positions, not
`store.f32` positions. World positions are available in `store.lastWorldF32` (set each frame) or by
calling `computeWorldTransforms(store, new Float32Array(store.count * 16))` yourself.

---

## 4. The FrameStore API

All mutation goes through `FrameStore` methods. Never write to `store.f32`/`store.u32` directly from
your layer — use the methods below so dirty tracking stays correct.

### 4a. Reading frames

```js
store.count                          // total number of frames
store._o(i)                          // byte word offset for frame i (= i * 16)
store.f32[store._o(i) + F.PX]       // x position (local space)
store.u32[store._o(i) + U.FRAME_ID] // stable frame ID
store.u32[store._o(i) + U.FLAGS]    // FLAG_SELECTED (1) | FLAG_VISIBLE (2)
store.metadata[i]                    // { called, contents, contexts, components, parentId, ... }
store.isSelected(i)                  // bool
store.getFrameId(i)                  // u32 frame ID
store.getColorIndex(i)               // u32 palette index
```

### 4b. Adding frames

```js
// addFrame(x, y, z, nx, ny, nz, scale, colorIndex) → array index
const idx = store.addFrame(0, 0, 0,  0, 0, 1,  2.0,  palette.currentIndex);
store.metadata[idx].parentId = currentContextId();  // must set manually
store.metadata[idx].called = 'StateName';
```

`addFrame` automatically assigns a new `FRAME_ID`, sets `FLAG_SELECTED | FLAG_VISIBLE`, and marks dirty.
The returned value is the current array index — store the `FRAME_ID` if you need to reference it later.

### 4c. Selection

```js
store.setSelected(i, true/false)   // select/deselect one frame, marks dirty
store.deselectAll()                // clears FLAG_SELECTED on all frames
store.selectAll(contextId)         // selects all frames with parentId === contextId
store.isSelected(i)                // bool
store.getSelectedCount()           // number of selected frames
```

### 4d. Mutation

```js
store.translate(i, dx, dy, dz)              // local-space translate
store.translateSelected(dx, dy, dz)         // translate all selected frames
store.setColorIndex(i, colorIndex)          // set palette color
store.shiftSelectedColors(shift, size)      // shift selected frames' colors by offset
store.toggleHideSelected()                  // toggle FLAG_VISIBLE on selected
store.deleteSelected()                      // removes selected + all descendants, compacts array
store.duplicateSelected()                   // deep-copies selected frames + subtrees
```

### 4e. Dirty tracking

The store tracks which byte range of `store.data` has changed. The render loop calls
`store.getDirtyRange()` / `store.clearDirty()` to do partial GPU uploads. You don't need to manage
this — any `store.*` method call handles it. If you write `store.f32`/`store.u32` directly (avoid
this), call `store._markDirty(i)` or `store._markAllDirty()` afterward.

### 4f. Batch mode

During `executeCommandString`, `store._batchMode = true` suppresses per-frame dirty tracking.
`_markAllDirty()` is called at the end. If you add frames programmatically in a loop, set
`store._batchMode = true` first and call `store._markAllDirty()` when done.

---

## 5. The Command System

### 5a. CommandExecutor

The `CommandExecutor` class (instantiated as `executor`) is the single entry point for all user
interaction. It owns:
- `executor.store` — the FrameStore
- `executor.palette` — PaletteManager
- `executor.camera` — Camera
- `executor.cursor` — `{x, y, z}` — the 3D cursor position
- `executor.mode` — current modal state: `'normal'|'translate'|'translateCursor'|'scale'|'scaleSelection'|'animation'|'contextNav'`
- `executor.colorContext` — ColorContext (active when `p` is pressed)
- `executor.selectionContext` — FrameSelectionContext (active when `#` is pressed)
- `executor.cameraContext` — CameraContext (active when `v` is pressed)

### 5b. Executing commands

```js
// Execute a full command string (synchronous, headless-safe)
executor.executeCommandString('Ff(dtklpk,3)ciAqdEck#[2]');

// Execute a single interactive keypress
executor.executeKey('f', false);            // (key, shiftKey)
executor.executeKey('R', true);             // shift+R
```

### 5c. Command string syntax

Commands are single characters. Two-character sequences for context navigation: `ci`, `ck`, `cj`, `cl`.

Repeat groups: `(cmd,n)` expands `cmd` n times. Example: `(dtkl,3)` = `dtkldtkldtkl`.
Nested repeats are supported.

Key commands:
```
f/F   — create frame (f) / create superframe and enter it (F)
d/D   — duplicate selected
x     — delete selected
t/T   — enter translate mode (t=frames, T=cursor) then ijkl to move
s/S   — enter scale mode (s=frames, S=selection group) then ik to scale
r/R   — rotate 90° / 45°
e/E   — reflect horizontal / vertical
p     — enter color context, then ijkl to navigate palette, p again to apply
#     — enter selection context, then [n] to select by 1-based position
A/a   — select all in context / select all of same color
ci    — context up (exit to parent)
ck    — context down (enter selected frame)
cj/cl — cycle prev/next sibling in current context
z/Z   — reset cursor to origin / snap structure center to cursor
C     — snap cursor to selection center
q/Q   — cycle corner of selection bbox / structure bbox to cursor
h     — toggle hide selected
w/W   — name frame / set contents (opens text overlay interactively)
```

### 5d. Adding new commands

Add a `case` to the `switch(key)` block inside `executeKey` (around line 2420) AND a matching case
in the `switch(key)` block inside `executeKeyNormal` (around line 2783). The former handles interactive
use with `commandTree.addCommand(key)`; the latter handles replay via `executeCommandString`.

If your command is two characters (like `ci`), handle it in both the `executeCommandString` loop
(check `key === 'x' && expanded[i+1] === 'y'`, consume both) and in the `executeKey` modal mode
system (set a mode on first char, consume second char in the mode block).

---

## 6. The Rendering Pipeline

### 6a. Overview

```
CPU: store.f32 (local coords)
  → computeWorldTransforms() → worldData (Float32Array, world coords)
  → device.queue.writeBuffer(worldBuf, ...)

GPU compute: cull_main shader reads worldBuf, writes visibleBuf + indirectBuf
GPU render:  vs_frame reads worldBuf[visibleBuf[instanceIndex]], transforms verts
```

The render pipeline runs in `frame()` (the `requestAnimationFrame` callback, around line 4419).

### 6b. What the render pipeline draws

One pipeline (`framePipeline`) draws frame geometry — the crosshatch line quads. Each frame is 4 line
quads (16 vertices, 24 indices) drawn as triangles. Lines are world-space width (a known perf issue at
large scale / zoom). Colors come from `paletteBuf` indexed by `U.COLOR_INDEX`.

A second pipeline (`cursorPipeline`) draws the 3D cursor.

### 6c. Where to inject a second render pass (arrows/overlays)

The render pass is built in `frame()` after the cull compute pass. The structure is:

```js
const enc = device.createCommandEncoder();
// ... cull compute pass ...
const rp = enc.beginRenderPass(...);
rp.setPipeline(framePipeline);
// ... draw frames ...
rp.setPipeline(cursorPipeline);
// ... draw cursor ...
rp.end();
enc.finish();
```

**To add a transition arrow pass**: create a new `GPURenderPipeline` with a line-list or triangle-list
topology. Insert `rp.setPipeline(arrowPipeline); rp.draw(...)` before `rp.end()`. The arrows need
world-space endpoint positions — read them from `store.lastWorldF32` (updated each frame before the
render pass begins).

### 6d. Label canvas

A 2D canvas (`labelCanvas`) overlays the WebGL canvas for text. It's drawn in the `frame()` loop
when `showLabels` is true. You can use this for state name labels and transition event labels without
a GPU text pipeline. Access via `labelCtx` (the 2D context) inside `frame()`.

---

## 7. Proposed Statechart Data Model

This section describes the **recommended additions** to implement Harel statechart semantics.

### 7a. Frame kinds

Add a `kind` field to each frame's metadata. Default is `'state'` for all existing frames.

```js
// In addFrame or immediately after:
store.metadata[idx].kind = 'state';    // normal state (default)
store.metadata[idx].kind = 'super';    // superstate (has children — can be inferred from parentId refs)
store.metadata[idx].kind = 'trans';    // transition (edge between two states)
store.metadata[idx].kind = 'initial';  // initial pseudostate (black dot)
store.metadata[idx].kind = 'final';    // final pseudostate (bullseye)
store.metadata[idx].kind = 'history';  // history pseudostate (H or H*)
```

You can infer `'super'` at runtime (any frameId that appears as a `parentId` in the store is a
superstate) rather than storing it explicitly.

### 7b. Transition frames

A transition is a frame with `kind = 'trans'`. It uses the existing `contexts` array as edge endpoints:

```js
store.metadata[transIdx].kind     = 'trans';
store.metadata[transIdx].called   = 'click [isValid]';   // event [guard]
store.metadata[transIdx].contents = '(dtlll)';            // action: a command string
store.metadata[transIdx].contexts = [sourceFrameId, targetFrameId];
store.metadata[transIdx].parentId = currentContextId();   // lives in same context as its states
```

Transition frames participate in the frame store normally — they can be selected, deleted, duplicated.
The render pipeline filters them out of the geometry draw (no crosshatch for `kind === 'trans'`) and
instead draws them as arrows in the overlay pass.

### 7c. Initial state designation

Store the initial substate ID on the parent superframe's metadata:

```js
store.metadata[superfIdx].initialStateId = childFrameId;
```

Add `initialStateId: null` to the metadata initialization in `addFrame` (line ~550).

### 7d. Action semantics

A transition's `contents` field holds a Frameworks command string. When the transition fires during
statechart execution:

```js
const action = store.metadata[transIdx].contents;  // e.g. '(dtlll)'
if (action) executor.executeCommandString(action);
```

This is the core insight: Frameworks command strings ARE state machine actions. A named macro frame
(a state whose `contents` is a command string like `(dtllll)`) is a reusable behavior. Entering that
state executes its command string as the entry action.

---

## 8. Statechart Execution Model

The statechart layer sits **on top of** the Frameworks composition layer. At any point in time:

- The active state configuration is a set of frameIds (one per concurrent region, if any)
- Receiving an event means finding a matching transition from the active states
- Firing a transition means: executing the action command string, then switching the active state

Suggested runtime object (add to your layer, not to Frameworks):

```js
class StatechartRuntime {
    constructor(store, executor) {
        this.store = store;
        this.executor = executor;
        this.activeStates = new Set();  // set of frameIds currently active
    }

    // Get all transitions whose source is one of the active states
    // and whose event label matches the given event string
    getEligibleTransitions(event) {
        const eligible = [];
        for (let i = 0; i < this.store.count; i++) {
            const meta = this.store.metadata[i];
            if (!meta || meta.kind !== 'trans') continue;
            const [srcId, tgtId] = meta.contexts;
            if (!this.activeStates.has(srcId)) continue;
            const [eventLabel] = meta.called.split('[');  // strip guard for now
            if (eventLabel.trim() === event) eligible.push(i);
        }
        return eligible;
    }

    fire(transIdx) {
        const meta = this.store.metadata[transIdx];
        const [srcId, tgtId] = meta.contexts;
        // Execute action
        if (meta.contents) this.executor.executeCommandString(meta.contents);
        // Switch state
        this.activeStates.delete(srcId);
        this.activeStates.add(tgtId);
    }

    send(event) {
        const eligible = this.getEligibleTransitions(event);
        if (eligible.length > 0) this.fire(eligible[0]);  // deterministic: first match wins
    }
}
```

---

## 9. Suggested New Commands

Add these to `CommandExecutor` following the pattern in section 5d:

```
→  (or X)  — connect: create a transition frame between two selected frames
             (first selected = source, second selected = target)
I          — mark selected frame as initial state of its parent superstate
.          — send an event to the statechart runtime (opens text overlay for event name)
```

For `→` (connect):
1. Collect the two selected frames' IDs
2. Create a new frame with `kind = 'trans'`, `contexts = [id1, id2]`
3. Position it at the midpoint of the two frames (for layout)
4. Set `parentId = currentContextId()`
5. Deselect everything, select the new transition frame
6. Open the name overlay for the user to type the event label

---

## 10. Rendering Transitions (Arrow Pass)

### What you need to draw

For each frame with `kind === 'trans'`:
1. Look up source and target world positions from `store.lastWorldF32`
2. Draw a curved or straight arrow from source to target
3. Draw the event label at the midpoint (use `labelCtx` 2D canvas)

### Minimal implementation (label canvas only, no GPU arrows)

In `frame()`, after the existing label drawing code:

```js
if (showLabels) {
    for (let i = 0; i < store.count; i++) {
        const meta = store.metadata[i];
        if (!meta || meta.kind !== 'trans') continue;
        const [srcId, tgtId] = meta.contexts;
        const srcIdx = findByFrameId(store, srcId);
        const tgtIdx = findByFrameId(store, tgtId);
        if (srcIdx === -1 || tgtIdx === -1) continue;

        // Project world positions to screen
        const wf32 = store.lastWorldF32;
        const so = srcIdx * 16, to_ = tgtIdx * 16;
        const sx = wf32[so], sy = wf32[so+1], sz = wf32[so+2];
        const tx = wf32[to_], ty = wf32[to_+1], tz = wf32[to_+2];

        // Use cam.vp (column-major mat4) to project
        // ... project sx,sy,sz and tx,ty,tz to screen ...
        // ... draw line and label on labelCtx ...
    }
}
```

The projection math is already in the `O` key handler (SVG export, around line 4335) — copy it.

### GPU arrow pass

When you need GPU-rendered arrows (for performance at scale):
1. Create a `GPUBuffer` for arrow vertex data (updated CPU-side each frame from `lastWorldF32`)
2. Create a render pipeline with line-list or billboard-triangle topology
3. Insert the draw call in `frame()` inside the same render pass, after frame geometry

---

## 11. Context Navigation as State Entry/Exit

The existing `ci`/`ck` commands already implement enter/exit semantics for superstates. When you
call `contextDown()` (ck), the context stack gains an entry and the camera moves to the saved
local camera of that frame. This is isomorphic to entering a superstate.

For statechart execution, you may want to separate **authoring navigation** (user pressing `ck` to
edit inside a superstate) from **runtime state activation** (the machine entering a superstate
because a transition fired). Keep these distinct: the `contextStack` is the authoring cursor; your
`StatechartRuntime.activeStates` is the runtime configuration.

---

## 12. File Structure and Extension Points

```
frameworks-v4.1-mint.html
│
├── <style>                     — CSS for all UI panels
├── <div id="layers-pane">      — layers panel (left, 200px) — add statechart panel here
├── <div id="command-bar">      — top bar with command input and sketch log
├── <script>
│   ├── Constants               — FLOATS_PER_INSTANCE, BYTES_PER_INSTANCE, F{}, U{}, FLAG_*
│   ├── FrameStore              — all frame data and mutation methods  ← your data lives here
│   ├── PaletteManager          — 80-color palette, currentIndex
│   ├── ColorContext            — modal p-key color picker
│   ├── FrameSelectionContext   — modal #-key positional selector
│   ├── CameraContext           — modal v-key camera control
│   ├── PaletteEditContext      — modal P-key palette editor
│   ├── CommandTree             — undo/redo tree of command history
│   ├── CommandExecutor         — all keyboard commands, executeKey(), executeCommandString()
│   ├── Camera                  — orbit camera, vp matrix
│   ├── contextStack            — module-level, tracks current context path  ← read this
│   ├── computeWorldTransforms  — CPU world transform pass
│   ├── RENDER_SHADER (WGSL)    — vertex + fragment shaders for frames + cursor
│   ├── CULL_SHADER (WGSL)      — compute frustum cull
│   ├── buildFrameGeo           — generates frame crosshatch vertex/index data
│   └── main()                  — WebGPU init, render loop, event wiring
│       ├── store               — FrameStore instance  ← reference this
│       ├── executor            — CommandExecutor instance  ← reference this
│       ├── palette             — PaletteManager instance
│       ├── cam                 — Camera instance
│       └── frame()             — rAF loop  ← inject your render pass here
```

**Where to add your code**: either append a `<script>` block after the existing `</script>`, or
inject within `main()` after `const executor = new CommandExecutor(...)`. The `store`, `executor`,
`palette`, `cam`, and `contextStack` are all in scope within `main()`.

---

## 13. Invariants — Do Not Break These

1. **`store.f32` holds local coords, always.** Never write world-space values into `store.f32`.
   World coords live only in `worldData`/`store.lastWorldF32` and `worldBuf`.

2. **Identify frames by `FRAME_ID`, not array index.** Array indices shift on deletion.

3. **All frame creation goes through `store.addFrame()`.** Sets up dirty tracking, frame ID counter,
   and metadata.

4. **`metadata[i].parentId` must be set after `addFrame`** — it defaults to `null` (root context).
   Forget this and your frame won't be a child of the current context.

5. **`computeWorldTransforms` is the single authority on world positions.** Don't cache or compute
   world positions elsewhere; call `computeWorldTransforms` or read `store.lastWorldF32`.

6. **The context stack is append-only during a session.** Never splice or reorder it. Push with
   `contextStack.push({frameId, savedCamera: null})`; pop with `contextStack.pop()`. Match the
   pattern in `contextDown()` and `contextUp()` exactly.

7. **Don't filter what renders based on context.** All frames always render (unless `FLAG_VISIBLE`
   is cleared). The current context only scopes creation and selection, not visibility.
