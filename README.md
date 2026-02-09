# Frameworks V3

A spatial content structure tool for constructing compositions in 3D space using frames with 6-dimensional coordinates (position + orientation).

## Version

**v3.1.0-dev** - Context system architecture and enhanced features (2026-01-12)

## Quick Start

### Development
```bash
# Edit individual modules in src/
# Test with modular loading
open test-modular.html

# Build combined version
node scripts/build-combined.js

# Test combined build
open test-combined.html
```

### Production Deployment
```bash
# 1. Build
node scripts/build-combined.js

# 2. Upload to ETHFS
npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia

# 3. Deploy renderer (if needed)
npx hardhat run scripts/deploy-renderer-quick.js --network sepolia

# 4. Mint test token
npx hardhat run scripts/mint-quick.js --network sepolia
```

See **[WORKFLOW.md](WORKFLOW.md)** for complete development workflow.

### Basic Usage

1. **Create frames**: Press `f` to create a frame at the cursor
2. **Switch views**: Press `1-6` to change the active working plane
3. **Move frames**: Press `t` then `ijkl` to translate selected frames
4. **Rotate frames**: Press `r` (90°) or `R` (45°) to rotate around the active plane's axis
5. **Duplicate**: Press `d` to duplicate selected frames
6. **Select all**: Press `A` to select all frames

### Test Sequence

Try this sequence to verify orthogonal coordinate system rendering:
```
1fp5fpp2fppp tiiiiiillllll 5tiiiiii RRRRRRRR 1R
```

This creates three orthogonal frames, translates them, rotates around Y axis 8×45°, then rotates around Z axis 45°. The frames should maintain visual 90° angles throughout.

## Architecture

```
frameworks-v3/
├── index-instanced.html      # Main application entry point
├── src/
│   ├── core.js               # Frame, Cursor, Framework classes
│   ├── commands.js           # Command parser and executor
│   ├── renderer-instanced.js # GPU-accelerated renderer with GLSL shaders
│   ├── palette.js            # Color palette manager
│   ├── command-tree.js       # 2D command history navigation
│   ├── context-*.js          # Context system modules
│   └── ...
├── ROADMAP.md                # Development priorities and next steps
├── COORDINATE_SYSTEMS.md     # Detailed coordinate system documentation
├── CONTEXT_SYSTEM.md         # Context navigation architecture
├── COMMAND_INTERFACE.md      # Command editor and compaction system
├── CHANGELOG.md              # Version history and bug fixes
├── CLAUDE.md                 # Design philosophy and project vision
└── README.md                 # This file
```

## Key Features

### 6D Coordinate System
- **Position**: (x, y, z) in world space
- **Orientation**: (î, ĵ, k̂) normal vector defining which direction frame faces
- **Roll**: Rotation angle within frame's own plane

### View System
Work in 6 cardinal planes while maintaining 3D spatial awareness:
- View 1: Front (XY plane, normal +Z)
- View 2: Right (YZ plane, normal +X)
- View 3: Back (XY plane, normal -Z)
- View 4: Left (YZ plane, normal -X)
- View 5: Top (XZ plane, normal +Y)
- View 6: Bottom (XZ plane, normal -Y)

Camera always stays in spatial 3D view with orbit controls. Active view determines:
1. Which plane new frames are created in
2. How ijkl keys map to XYZ movements
3. Which axis rotations occur around

### Rendering Pipeline
High-performance GPU-accelerated instanced rendering:
1. **Scale**: Base geometry scaled by frame size
2. **Roll**: Rotate in local XY plane around Z axis
3. **Orient**: Transform to world space using normal-based orthonormal basis
4. **Translate**: Move to world position

The orientation matrix uses world +Y as a consistent reference, ensuring frames with the same roll value align visually regardless of their normal direction.

## Command Reference

### Frame Creation
- `f` - Create frame at cursor in active plane

### Translation
- `t` + `ijkl` - Translate selected frames
- `T` + `ijkl` - Translate cursor

### Rotation
- `r` - Rotate 90° counter-clockwise around active plane's normal
- `R` - Rotate 45° counter-clockwise around active plane's normal

### Reflection
- `e` - Reflect horizontally (across vertical plane at cursor)
- `E` - Reflect vertically (across horizontal plane at cursor)

### Selection
- `A` - Select all frames
- `a` - Select all frames of same color
- `space` - Snap selected frames to cursor

### Scale
- `s` + `i/k` - Scale individual frames up/down
- `S` + `i/k` - Scale entire selection up/down

### Duplication & Deletion
- `d` / `D` - Duplicate selected frames in place
- `x` - Delete selected frames

### View Control
- `0` - Spatial view (default)
- `1` - Front view (XY plane)
- `2` - Right view (YZ plane)
- `3` - Back view (XY plane)
- `4` - Left view (YZ plane)
- `5` - Top view (XZ plane)
- `6` - Bottom view (XZ plane)

### Cursor
- `z` - Snap cursor to origin

### Color
- `p` - Cycle to next color in palette

### Command History & Undo
- `u` - Enter command context (undo/fork navigation mode)
  - `ijkl` - Navigate command history (j=back, l=forward, i=up branch, k=down branch)
  - Any other key - Exit context and execute/fork
- `/` - Enter compound command input overlay
- `n` - Repeat last compound command

### Mode Control
- `Escape` - Exit current mode (translate, scale, etc.)

## Technical Details

### Frame Properties
```javascript
{
  x, y, z,           // Position in world space
  ihat, jhat, khat,  // Normal direction (unit vector)
  roll,              // Rotation within frame's plane (radians)
  size,              // Frame scale factor
  color,             // Hex color
  selected,          // Boolean selection state
  visible,           // Boolean visibility
  called,            // Name/title
  contents,          // Body content
  contexts,          // Array of context frame IDs
  components,        // Array of component frame IDs
  count              // Global frame ID
}
```

### Rotation Behavior
When frames are rotated:
1. **Position rotates** around cursor in 3D space
2. **Normal rotates** according to rotation matrix (always preserves orthogonality)
3. **Roll updates** only if rotating in frame's own plane (axis parallel to normal)

### Coordinate System Correctness
The system guarantees:
- Orthogonal normals remain orthogonal after any sequence of rotations
- Visual rendering matches mathematical correctness
- Frames with roll=0 align consistently in world space
- Right-handed coordinate system throughout

## Performance

- Supports 100,000+ frames at 60 FPS
- GPU-accelerated instanced rendering
- Single draw call for all frames
- Pre-allocated buffers for maximum performance

## Testing

Run the orthogonality test:
```bash
node test-normals-simple.js
```

This verifies that frame normals remain mathematically orthogonal through various rotation sequences.

## Development Notes

### Shader Details
The custom GLSL vertex shader (`src/renderer-instanced.js`) handles:
- Per-instance attribute processing
- Orientation matrix construction with world-relative basis
- Roll rotation in local space
- Final transformation to clip space

### Critical Implementation Decisions

1. **Roll before orientation**: Applying roll in local space before orienting to world space ensures independent control of in-plane rotation.

2. **World-relative basis**: Using world +Y as reference when building the orientation matrix ensures consistent frame alignment across different orientations.

3. **Normal vector rotation**: Always rotating the normal with the position ensures mathematical correctness of frame orientation.

## Documentation

- **ROADMAP.md** - Development priorities and next steps for contributors
- **COORDINATE_SYSTEMS.md** - Detailed explanation of 6-view system and coordinate mappings
- **CONTEXT_SYSTEM.md** - Universal context navigation architecture (command history, color palettes, etc.)
- **COMMAND_INTERFACE.md** - Command editor system with automatic compaction and pattern detection
- **CHANGELOG.md** - Version history and critical bug fixes
- **CLAUDE.md** - Design philosophy and project vision

## Recent Enhancements (v3.1.0-dev)

- ✅ Command tree with 2D navigation (undo/fork system)
- ✅ Compound command input (/ key)
- ✅ Command repeat (n key)
- ✅ Delete command (x key)
- ✅ View-relative reflections with normal flipping
- ✅ Duplicate with d/D (both keys)
- ✅ Context system architecture documented

## On-Chain Deployment

### FrameworksRendererV3 (Sepolia Testnet)

**Contract Address**: `0x6970B8b97AD1247F4e5Fb34a4E1b5c58Cac1BCed`
**Type**: Monolithic (single combined file)

The FrameworksRendererV3 contract enables fully on-chain generative art using the Frameworks command system. All code executes from Ethereum storage via ETHFS.

#### Dependencies
- **Three.js**: `three-v0.147.0.min.js.gz` (ETHFS)
- **Frameworks Library**: `frameworks-v3.1-instanced.min.js` (ETHFS, 47 KB monolithic)
- **ETHFS FileStore**: `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245`
- **ArtifactReader Library**: `0x4722F16408aF27378a782eda6cE88F46905e5227`

### FrameworksRendererV3_1 (Sepolia Testnet) - **Latest**

**Contract Address**: `0xfAa1F870212cF3d461fd5cC955901A7F14c32DFb`
**Type**: Modular (8 separate components)
**Version**: v3.1.0

The V3.1 renderer uses a modular architecture for easier maintenance and updates. Each component is stored separately on ETHFS with semantic versioning.

#### Modular Components (v3.1.0)
1. `frameworks-v3.1.0-core.min.js` (4.5 KB) - Frame, Cursor, Framework classes
2. `frameworks-v3.1.0-palette.min.js` (2.3 KB) - Color palette manager
3. `frameworks-v3.1.0-context-color.min.js` (1.7 KB) - Color selection context
4. `frameworks-v3.1.0-context-camera.min.js` (2.7 KB) - Camera controls
5. `frameworks-v3.1.0-context-selection.min.js` (2.9 KB) - Frame selection
6. `frameworks-v3.1.0-command-tree.min.js` (1.8 KB) - Command history navigation
7. `frameworks-v3.1.0-commands.min.js` (16.6 KB) - Command executor
8. `frameworks-v3.1.0-renderer-instanced.min.js` (13.2 KB) - GPU renderer

**Total Size**: 45.7 KB (vs 47 KB monolithic)

#### Benefits of Modular Architecture
- **Easier Updates**: Individual modules can be updated without re-uploading entire library
- **Better Caching**: Browser caches each module separately
- **Clearer Dependencies**: Load order explicitly shows component relationships
- **Future Flexibility**: Easy to add new contexts or swap implementations

#### Usage

To mint a Frameworks artwork, encode your artifact data as:
```solidity
abi.encode(imageDataURI, commandString)
```

**Parameters**:
- `imageDataURI`: Static preview image (PNG data URI or IPFS link)
- `commandString`: Frameworks commands (e.g., `"ftil(dR,8)"`)

**Example commands**:
- `"f"` - Single frame
- `"ftd"` - Frame, translate, duplicate
- `"ftil(dR,8)"` - Frame, tile, duplicate and rotate 8 times
- `"fp5fpp2fppp"` - Create frames in multiple views with color cycling

The renderer automatically:
1. Loads Three.js and Frameworks from ETHFS
2. Initializes the 3D environment
3. Executes your command string
4. Returns both static image and interactive animation URL

#### Command Notation

Commands support repeat notation for compactness:
- `(command,count)` - Repeat command count times
- Example: `(dR,8)` = `dRdRdRdRdRdRdRdR`

#### Deployment Scripts

**Monolithic V3**:
```bash
npx hardhat run scripts/deploy-frameworks-renderer-v3.js --network sepolia
```

**Modular V3.1** (recommended):
```bash
# 1. Build modular components
npx hardhat run scripts/build-modular-ethfs.js

# 2. Upload to ETHFS
npx hardhat run scripts/upload-modular-ethfs.js --network sepolia

# 3. Deploy renderer
npx hardhat run scripts/deploy-frameworks-renderer-v3_1.js --network sepolia
```

See `contracts/FrameworksRendererV3.sol` and `contracts/FrameworksRendererV3_1.sol` for implementation details.

## Future Enhancements

- [ ] Color palette context (p + ijkl navigation)
- [ ] Camera preset context (c + ijkl navigation)
- [ ] Component frames (nested content)
- [ ] Content/writing context (w key)
- [ ] Save/load functionality
- [x] Blockchain integration for command storage (FrameworksRendererV3)
- [ ] Animation system with IJKL continuous playback
- [ ] Line thickness controls
- [ ] Named selections
- [ ] Interactive on-chain rendering (keyboard controls in minted tokens)

## License

See parent project license.

## Credits

Built with Three.js for WebGL rendering.
