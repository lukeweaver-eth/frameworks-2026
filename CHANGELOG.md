# Frameworks V3 Changelog

## Version 3.0.0 - 2026-01-12

### Core Features
- **6D Coordinate System**: Frames have position (x, y, z) and orientation (î, ĵ, k̂ normal vector)
- **Roll Angle**: Frames can rotate within their own plane independent of orientation
- **6 View System**: Work in 6 cardinal planes (Front XY, Right YZ, Back XY, Left YZ, Top XZ, Bottom XZ)
- **Spatial View**: Free 3D perspective camera with orbit controls
- **Instanced Rendering**: GPU-accelerated rendering supporting 100,000+ frames at 60 FPS

### Key Commands
- `f` - Create frame at cursor in active view plane
- `t + ijkl` - Translate selected frames
- `T + ijkl` - Translate cursor
- `r/R` - Rotate selected frames 90°/45° around active plane's normal axis
- `d` - Duplicate selected frames
- `1-6` - Switch active working plane (camera stays in spatial view)
- `A` - Select all frames
- `p` - Cycle color palette

### Critical Bug Fixes

#### Rotation and Orientation System (2026-01-12)
**Problem**: Frames forming orthogonal coordinate systems appeared non-orthogonal after multiple 45° rotations, despite normals being mathematically correct.

**Root Cause**: Shader orientation matrix used arbitrary helper vectors, causing frames with same roll values to align differently in world space.

**Solution**:
1. **Consistent Orientation Basis**: Shader now uses world +Y as reference "up" direction when building orthonormal basis
2. **Correct Transformation Order**: Roll applied in local space BEFORE orientation to world space
3. **World-Relative Alignment**: Ensures frames with roll=0 align consistently regardless of normal direction

**Technical Details**:
- Modified `createOrientationMatrix()` in shader to use `worldUp = vec3(0.0, 1.0, 0.0)` as reference
- Changed transformation order: Scale → Roll (local) → Orient (world) → Translate
- Normal vector rotation always preserves orthogonality (verified with comprehensive tests)

**Impact**:
- Orthogonal coordinate systems now render correctly at all rotation angles
- Visual appearance matches mathematical correctness
- Frames maintain proper 90° angles after complex rotation sequences

### Architecture

**Data Model** (`src/core.js`):
- `Frame` class: Stores position, normal, roll, size, color, metadata
- `Cursor` class: Reference point for transformations
- `Framework` class: Container for frames and application state

**Rendering** (`src/renderer-instanced.js`):
- Custom GLSL vertex shader with per-instance transformations
- Orientation matrix built from frame normal with world-relative basis
- Rodrigues' rotation formula for arbitrary axis rotations (legacy, now using simpler local roll)

**Commands** (`src/commands.js`):
- View-relative translation mappings for all 6 planes
- Rotation axis selection based on active view
- Frame creation with view-dependent normals

### Testing
- Comprehensive orthogonality tests verify normals remain orthogonal through all rotations
- Shader transformation tests verify geometry preservation
- Manual test sequence: `1fp5fpp2fppptiiiiiillllll5tiiiiiiRRRRRRRR1R`

### Known Limitations
- Maximum 100,000 frames (pre-allocated buffer)
- No undo/redo yet
- No context system implementation yet
- No save/load functionality yet

### Next Steps
- Implement context system for custom frame transformations
- Add component frames (sticky notes within frames)
- Implement save/load to/from blockchain
- Add animation and interpolation system
- Implement line thickness controls
- Add additional palette management
