# Frameworks

**A self-hosting spatial composition system for building structures in 3D space**

"Everything is a framework. Frameworks are made of frames. It's frameworks all the way down."

---

## Overview

Frameworks is a tool for constructing spatial content structures where **frames** serve as both objects and functions. The system is self-hosting: Frameworks builds itself, using frames to define transformations, interfaces, and behaviors that operate on other frames.

### Core Philosophy

- **Self-referential**: The interface to manipulate Frameworks must be built IN Frameworks
- **Composable**: Contexts provide importable capability sets that stack together
- **Reinterpretable**: Representation depends on imported contexts; the same frame data can render differently
- **On-chain native**: Commands and frame data stored on Ethereum, enabling minting and ownership

---

## The Frame Object

A Frame is the fundamental unit with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `count` | integer | Global unique ID |
| `coordinates` | 6D (xyz, î ĵ k̂) | Position and orientation in space |
| `contents` | string | Body content (markdown-like text or executable code) |
| `called` | string | Name/title of the frame |
| `color` | hex | Color value |
| `size` | integer | Scale (1, 2, 3, 4...) |
| `chosen` | boolean | Selection state |
| `contexts` | array of frame IDs | Contexts this frame imports/uses |
| `components` | array of frame IDs | Child frames (like sticky notes or subheadings) |

---

## Coordinate System (6D)

Frames exist in 6-dimensional space defining both position and orientation:

### xyz - Global Position (3D)
The center point of the frame in 3D space.

### î ĵ k̂ - Normal Direction (3D unit vector)
Which way the frame "faces" in space. Frames are planar surfaces (like cards or sheets of paper) with a facing direction. These are **i-hat, j-hat, k-hat** - the standard unit vectors defining the frame's local coordinate system.

**Example**: A frame in the xy-plane has normal `k̂ = (0, 0, 1)` pointing in the +z direction.

**Note on terminology**: The unit vectors î ĵ k̂ are **different from the keyboard keys** `ijkl` used in commands. The keys i/j/k/l are physical keyboard inputs (up/left/down/right) chosen for ergonomic reasons - they're easy to reach without looking. The coordinate system î ĵ k̂ describes the mathematical orientation of frames in space.

---

## The Cursor

The cursor is a special frame that starts at the global origin `(0,0,0)`. It serves three critical roles:

1. **Origin point** for new frames created with `f`
2. **Pivot point** for rotations and reflections
3. **Reference point** for relative transformations

### Cursor vs Frame Movement
- `t ijkl` - translate selected frames (i=up, j=left, k=down, l=right)
- `T ijkl` - translate the cursor itself

**Note**: In commands, `ijkl` refers to physical keyboard keys for directional input, relative to the current view (1-6). These are **not** the same as the coordinate unit vectors î ĵ k̂.

---

## Contexts: The Composability Engine

**Contexts are the most critical feature.** A Framework without contexts is meaningless—it has no way to transform frames or define behaviors.

### What Are Contexts?

Contexts are **importable capability sets** built as frameworks themselves:
- Created by composing frames in space with specific properties
- Imported into other frameworks via reframing
- Stack together (frames can have multiple contexts)
- Define how frames are interpreted, rendered, or transformed

### How Contexts Work

1. **Context as Framework**: A context is a framework where the main frame's `called` field names the context (e.g., "color", "commands")
2. **Components define behavior**: The component frames of the context hold the data (e.g., hex codes for colors, command mappings)
3. **Contents hold logic**: The main frame's `contents` field contains code (DSL or JavaScript) that defines how other frameworks use this context

### Example: Building a Color Context

**Creating Framework 123 (Color Context)**
```
f w"color"           # Frame 1234, called "color"
f w"#FFE1D5" tlll   # Frame 1235, component 1
f w"#FFCABB" tlll   # Frame 1236, component 2
f w"#FDB2A2" tlll   # Frame 1237, component 3
```

**Frame 1234's structure:**
- `called`: "color"
- `components`: [1235, 1236, 1237]
- `contents`: Code defining how frames pull colors:
  ```javascript
  // Example logic (implementation TBD)
  function getColor(frameIndex) {
    return this.components[frameIndex % this.components.length].called;
  }
  ```

**Importing the context into Framework 567:**
```
F[123]               # Reframe Framework 123
```

This duplicates Frame 1234 and all its components into Framework 567:
- Original: Frames 1234, 1235, 1236, 1237
- Duplicated: Frames 5679, 5680, 5681, 5682

**Using the context:**
```
f w"composition"     # Frame 6000
C[5679]              # Add color context to frame 6000
# Enter frame 6000 and create child frames
f                    # New frame pulls color from context
```

When new frames are created within the composition, they pull properties from imported contexts according to the logic defined in each context's `contents` field.

---

## Context Types

### Commands Context
Maps characters to frame transformations (duplicate, rotate, translate, etc.). Different command contexts allow users to customize hotkeys and workflows.

### Color Context
Defines a palette by storing hex codes in component frames. Controls how new frames select colors (sequential, random, indexed, etc.).

### Renderer Context
Contains HTML/JS code for visualizing frameworks (Three.js, SVG, Canvas, ASCII art, etc.). Multiple renderer contexts can interpret the same frame data differently.

### Future Contexts
- Typography (font faces, sizes, weights)
- Physics (gravity, collision, constraints)
- Cost/Commerce (pricing, licensing)
- Audio (synthesis, samples, effects)

**Design principle**: Contexts should be tight and composable. A good color context only modifies color. Conflicting contexts indicate bad design or incompatibility—users learn which contexts work together.

---

## Frame Counting (Global vs Local)

### Global Count
Every frame has a unique global `count` ID, assigned sequentially across all frameworks:
- Framework 123, main frame: 1234
- First component: 1235
- Second component: 1236

### Local Count (within components)
Components are locally indexed 0, 1, 2, 3... but have global IDs.

### Reframing
When you reframe Framework 123 into Framework 567 using `F[123]`:
- Original frames 1234, 1235, 1236 are duplicated
- New frames get sequential global IDs: 5679, 5680, 5681
- Relationships (components, contexts) are preserved in the duplicates

---

## Commands (Default Command Context)

Commands are single-character keys triggering frame transformations. Case-sensitive (lowercase/uppercase perform related operations).

### Framework & Frame Creation
- `F` - Create new framework
- `f` - Create new frame at cursor

### Spatial Transformations
- `t ijkl` - Translate selected frames (up/left/down/right)
- `T ijkl` - Translate cursor
- `s ik` - Scale chosen frames
- `S ik` - Scale entire structure
- `r` - Rotate 90° around cursor
- `R` - Rotate 45° around cursor
- `e` - Reflect horizontal around cursor
- `E` - Reflect vertical around cursor
- `z` - Snap cursor to center
- `Z` - Snap structure to cursor

### Selection & Organization
- `a` - Select all frames of same color
- `A` - Select all frames
- `q` - Cycle cursor through corners
- `Q` - Snap corner to Q selection
- `#` - Frame selection with modifiers (i/k shift, j/l extend/retract)

### Content & Context
- `w` - Edit name (`called` field)
- `W` - Edit contents
- `c` - Edit context
- `C` - Snap cursor to center

### Duplication
- `d` - Duplicate selected frames
- `D` - (TBD)

### View & Output
- `v ijkl` - Zoom/pan view
- `V ijkl` - Adjust perspective
- `1` - Front camera
- `2` - Right camera
- `3` - Back camera
- `4` - Left camera
- `5` - Top camera
- `6` - Bottom camera
- `7` - Dolly camera
- `8` - Figure-8 camera path
- `9` - Orbit camera
- `0` - (TBD)
- `o` - Export SVG
- `O` - Export PNG
- `h` - Hide selected
- `H` - (TBD)

### Animation & Repetition
- `m` - Toggle animation
- `M` - Change interpolation mode
- `n` - Repeat last command
- `N` - Repeat N times

### Line Properties
- `L ik` - Adjust line thickness
- `L jl` - Extend/retract line

### Color
- `p` - Change palette/cycle colors
- `P` - Select specific palette index

**Note**: Commands are themselves a context. Users can import different command contexts with alternative key mappings, just like importing color palettes.

---

## Components: Child Frames

Components are frames that exist "within" a parent frame:
- Like sticky notes in a shared space
- Can have their own `called` (title) and `contents` (body)
- Enable spatial writing environments
- Act like subheadings or nested documents

**Relationship with contexts**: Components can exist in multiple contexts simultaneously. Their representation depends on all active contexts combined.

---

## Implementation Phases

### Phase 1: Core Structure ✓
Define the Frame data structure with all required properties.

### Phase 2: Command System (In Progress)
Implement command processing so frames can be created and transformed. Design goal: "If it's pretty and intuitive, people will build frameworks just because it's fun."

### Phase 3: Interface
Build a JavaScript application that:
1. Acts as intuitive UI for building structures (3D view, command palette)
2. Logs keystrokes and converts them to commands
3. Stores commands on-chain (Ethereum)

### Phase 4: Context Ecosystem
Enable users to create, share, and import contexts:
- Color palettes
- Custom command sets
- Renderer engines
- Domain-specific tooling

---

## On-Chain Storage

**What goes on-chain:**
- Frame properties (count, coordinates, called, color, size, contexts, components)
- Command sequences executed to build frameworks

**Commands as source of truth**: The keystroke log serves as the canonical representation. Frameworks can be reconstructed by replaying commands.

**Minting**: Users mint frameworks they've created, establishing ownership and enabling marketplaces for contexts and compositions.

---

## Self-Hosting & Bootstrapping

"You build the tool to show the vision of the tool so other people can build a tool that better articulates that vision, which inspires the next vision and tool."

### Initial Bootstrap
1. Deploy Frameworks with minimal built-in functionality
2. Create the first "commands" context as a framework
3. Users import the commands context to start building
4. Users create new contexts (color, renderer, etc.) and share them

### Renderer as Context
The rendering engine itself is a context:
- Contains HTML + JavaScript (Three.js, p5.js, vanilla Canvas, etc.)
- Pulls on-chain frame data
- Executes commands through the visualization
- Multiple renderer contexts can coexist (3D, 2D, ASCII, VR, etc.)

---

## Key Design Questions (TBD)

### Context Execution Model
- How is code in the `contents` field executed? (Eval, VM, DSL interpreter?)
- What API/variables are available to context code?
- How are contexts sandboxed to prevent malicious code?

### Renderer Implementation
- Primary rendering technology? (Three.js, Babylon.js, custom WebGL?)
- How do multiple renderer contexts coordinate?
- 3D scene with 2D UI overlay, or pure 3D interface?

### On-Chain Architecture
- Smart contract structure?
- Gas optimization strategies (IPFS for large data?)
- NFT standard (ERC-721 for frameworks, ERC-1155 for contexts?)

---

## Vision

**A general-purpose spatial conceptualization tool connecting collective cognition.**

Frameworks enables thinking about:
- Dynamic systems as static structures
- Abstract concepts as spatial compositions
- Collaborative knowledge as shared 3D space

By making the tool self-hosting and context-driven, Frameworks becomes a platform for emergent creativity—users build tools that inspire new tools, creating a flywheel of innovation.

---

## Development Status

**Current phase**: Documentation and architecture planning

**Next steps**:
1. Finalize coordinate system implementation (6D: xyz position + î ĵ k̂ normal)
2. Define context execution model and API
3. Choose rendering technology stack (likely continue with p5.js from V2)
4. Implement context system (most critical missing feature)
5. Build prototype web interface with context support

**Contribution areas needed**:
- Web development (JavaScript, 3D rendering)
- Smart contract development (Solidity, on-chain storage optimization)
- Context design (creating useful, composable contexts)
- UX/UI design (intuitive spatial interface)
