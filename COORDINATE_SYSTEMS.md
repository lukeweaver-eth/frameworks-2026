# Frameworks V3 Coordinate Systems

## Overview

Frameworks V3 uses a right-handed 3D coordinate system where users can work in 6 different orthographic view planes while maintaining a spatial 3D perspective. Each view defines how keyboard commands (ijkl) map to global XYZ axes.

## Global Coordinate System

- **X axis**: Horizontal (left/right)
- **Y axis**: Vertical (up/down)
- **Z axis**: Depth (forward/back)
- **Origin**: (0, 0, 0) at world center

## View System

The view system allows working in different cardinal planes without switching the camera. Instead, the active view (1-6) determines:
1. Which plane frames are created in
2. How ijkl keys map to XYZ movements
3. Which axis rotations occur around

The camera remains in **spatial view** (free 3D perspective with orbit controls), while the active view determines the **working plane**.

---

## View 1: Front (XY Plane)

**Camera perspective**: Looking at XY plane from +Z

**Cube indicator**: Cyan outline (front face)

**Frame normal**: (0, 0, 1) - pointing toward viewer

### Keyboard Mapping
- **i (up)**: +Y
- **k (down)**: -Y
- **j (left)**: -X
- **l (right)**: +X

### Rotation
- **r/R**: Rotate around Z axis (counter-clockwise when viewed from +Z)

---

## View 2: Right (YZ Plane)

**Camera perspective**: Looking at YZ plane from +X

**Cube indicator**: Light green outline (right face)

**Frame normal**: (1, 0, 0) - pointing toward viewer

### Keyboard Mapping
- **i (up)**: +Y
- **k (down)**: -Y
- **j (left)**: +Z (depth into screen in front view)
- **l (right)**: -Z (depth out of screen in front view)

### Rotation
- **r/R**: Rotate around X axis (counter-clockwise when viewed from +X)

---

## View 3: Back (XY Plane)

**Camera perspective**: Looking at XY plane from -Z

**Cube indicator**: Red outline (back face)

**Frame normal**: (0, 0, -1) - pointing toward viewer

### Keyboard Mapping
- **i (up)**: +Y
- **k (down)**: -Y
- **j (left)**: +X (reversed from front view)
- **l (right)**: -X (reversed from front view)

### Rotation
- **r/R**: Rotate around Z axis (counter-clockwise when viewed from -Z)

---

## View 4: Left (YZ Plane)

**Camera perspective**: Looking at YZ plane from -X

**Cube indicator**: Orange outline (left face)

**Frame normal**: (-1, 0, 0) - pointing toward viewer

### Keyboard Mapping
- **i (up)**: +Y
- **k (down)**: -Y
- **j (left)**: -Z (reversed from right view)
- **l (right)**: +Z (reversed from right view)

### Rotation
- **r/R**: Rotate around X axis (counter-clockwise when viewed from -X)

---

## View 5: Top (XZ Plane)

**Camera perspective**: Looking at XZ plane from +Y (looking down)

**Cube indicator**: Yellow outline (top face)

**Frame normal**: (0, 1, 0) - pointing toward viewer

### Keyboard Mapping
- **i (up)**: -Z (toward viewer, appears as "up" from top view)
- **k (down)**: +Z (away from viewer, appears as "down" from top view)
- **j (left)**: -X
- **l (right)**: +X

### Rotation
- **r/R**: Rotate around Y axis (counter-clockwise when viewed from +Y)

---

## View 6: Bottom (XZ Plane)

**Camera perspective**: Looking at XZ plane from -Y (looking up)

**Cube indicator**: Purple outline (bottom face)

**Frame normal**: (0, -1, 0) - pointing toward viewer

### Keyboard Mapping
- **i (up)**: +Z (away from viewer, appears as "up" from bottom view)
- **k (down)**: -Z (toward viewer, appears as "down" from bottom view)
- **j (left)**: -X
- **l (right)**: +X

### Rotation
- **r/R**: Rotate around Y axis (counter-clockwise when viewed from -Y)

---

## Command Reference

### Translation Commands
- **t + ijkl**: Translate selected frames in active view plane
- **T + ijkl**: Translate cursor in active view plane

### Rotation Commands
- **r**: Rotate 90° counter-clockwise around active plane's normal axis
- **R**: Rotate 45° counter-clockwise around active plane's normal axis

### Frame Creation
- **f**: Create new frame at cursor position in active plane

### View Switching
- **1-6**: Switch active working plane (camera stays in spatial view)

---

## Implementation Notes

### Frame Properties
Each frame stores:
- **Position**: (x, y, z) in global coordinates
- **Normal**: (î, ĵ, k̂) unit vector perpendicular to frame's plane
- **Roll**: Rotation angle within the frame's own plane

### Rotation Behavior
When rotating frames:
1. **Position rotates** around cursor in 3D space
2. **Roll angle updates** if rotating in the frame's own plane
3. **Normal vector rotates** if rotating to change frame orientation

Example: A frame in the XY plane (normal +Z) rotated around the X axis will:
- Change position (orbit around cursor)
- Update normal vector (now points in a different direction)
- NOT update roll (rotation is perpendicular to frame's plane)

### Shader Implementation
The renderer applies transformations in this order:
1. Scale the base geometry
2. Apply roll rotation in LOCAL space (around Z axis in frame's own plane)
3. Orient to frame's plane (using normal vector with world-relative basis)
4. Translate to frame's position

**Key Implementation Details:**

**Roll Rotation (Step 2):**
- Applied BEFORE orientation, in the frame's local XY plane
- Always rotates around the local Z axis
- This ensures roll is independent of the frame's world orientation

**Orientation Matrix (Step 3):**
- Builds an orthonormal basis using the frame's normal vector
- Uses world +Y as a consistent reference "up" direction
- When normal is parallel to ±Y, uses world +X as reference instead
- This ensures frames with the same roll value align consistently in world space

**Why This Order Matters:**
- Roll in local space → orientation to world space → translation
- Ensures that frames forming an orthogonal coordinate system remain visually orthogonal
- Prevents arbitrary basis choices from causing visual misalignment
- Maintains mathematical correctness: orthogonal normals render as orthogonal frames

---

## Verification Table

| View | Plane | Normal | i (up) | k (down) | j (left) | l (right) | Rotation Axis |
|------|-------|--------|--------|----------|----------|-----------|---------------|
| 1    | XY    | +Z     | +Y     | -Y       | -X       | +X        | Z             |
| 2    | YZ    | +X     | +Y     | -Y       | +Z       | -Z        | X             |
| 3    | XY    | -Z     | +Y     | -Y       | +X       | -X        | Z             |
| 4    | YZ    | -X     | +Y     | -Y       | -Z       | +Z        | X             |
| 5    | XZ    | +Y     | -Z     | +Z       | -X       | +X        | Y             |
| 6    | XZ    | -Y     | +Z     | -Z       | -X       | +X        | Y             |

---

## Design Philosophy

The coordinate system is designed to be **view-relative** rather than **global-absolute**:

- **Intuitive control**: ijkl always means up/down/left/right *from the perspective of the active view*
- **Spatial awareness**: The 3D camera shows how all views relate in space
- **Face indicators**: Colored outlines show which plane is active
- **Consistent behavior**: Commands work the same way in each view, relative to that view's orientation

This allows users to build complex 3D structures by switching between views and working in familiar 2D planes, while maintaining full 3D spatial awareness through the perspective camera.
