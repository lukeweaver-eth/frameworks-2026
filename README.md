# Frameworks V3

A spatial content structure tool for constructing compositions in 3D space using frames with 6-dimensional coordinates (position + orientation).

## Version

**v3.1.0-dev** - Context system architecture and enhanced features (2026-01-12)

## Quick Start

Open `index-instanced.html` in a web browser to launch the application.

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
│   └── palette.js            # Color palette manager
├── COORDINATE_SYSTEMS.md     # Detailed coordinate system documentation
├── CHANGELOG.md              # Version history and bug fixes
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

- **COORDINATE_SYSTEMS.md** - Detailed explanation of 6-view system and coordinate mappings
- **CONTEXT_SYSTEM.md** - Universal context navigation architecture (command history, color palettes, etc.)
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

## Future Enhancements

- [ ] Color palette context (p + ijkl navigation)
- [ ] Camera preset context (c + ijkl navigation)
- [ ] Component frames (nested content)
- [ ] Content/writing context (w key)
- [ ] Save/load functionality
- [ ] Blockchain integration for command storage
- [ ] Animation system with IJKL continuous playback
- [ ] Line thickness controls
- [ ] Named selections

## License

See parent project license.

## Credits

Built with Three.js for WebGL rendering.
