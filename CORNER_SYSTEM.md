# Corner Cycling System (q command)

## Overview
The `q` command cycles the cursor through the 8 corners of the structure's bounding box in a view-dependent order.

## Corner Order
Each view cycles through corners in this order:
1. Top-Right Near (TR-near)
2. Top-Left Near (TL-near)
3. Bottom-Left Near (BL-near)
4. Bottom-Right Near (BR-near)
5. Top-Right Far (TR-far)
6. Top-Left Far (TL-far)
7. Bottom-Left Far (BL-far)
8. Bottom-Right Far (BR-far)

## Global Coordinates by View

### View 0/1: Front (Camera at +Z, looking -Z)
- **Depth:** Z-axis (near=maxZ, far=minZ)
- **Horizontal:** X-axis (right=maxX, left=minX)
- **Vertical:** Y-axis (top=maxY, bottom=minY)

| Corner | Position | Global Coordinates |
|--------|----------|-------------------|
| 0 | TR-near | (maxX, maxY, maxZ) |
| 1 | TL-near | (minX, maxY, maxZ) |
| 2 | BL-near | (minX, minY, maxZ) |
| 3 | BR-near | (maxX, minY, maxZ) |
| 4 | TR-far  | (maxX, maxY, minZ) |
| 5 | TL-far  | (minX, maxY, minZ) |
| 6 | BL-far  | (minX, minY, minZ) |
| 7 | BR-far  | (maxX, minY, minZ) |

### View 2: Right (Camera at +X, looking -X)
- **Depth:** X-axis (near=maxX, far=minX)
- **Horizontal:** Z-axis (right=minZ, left=maxZ) ← right-hand rule: -X × +Y = -Z
- **Vertical:** Y-axis (top=maxY, bottom=minY)

| Corner | Position | Global Coordinates |
|--------|----------|-------------------|
| 0 | TR-near | (maxX, maxY, minZ) ✓ |
| 1 | TL-near | (maxX, maxY, maxZ) ✓ |
| 2 | BL-near | (maxX, minY, maxZ) ✓ |
| 3 | BR-near | (maxX, minY, minZ) ✓ |
| 4 | TR-far  | (minX, maxY, minZ) ✓ |
| 5 | TL-far  | (minX, maxY, maxZ) ✓ |
| 6 | BL-far  | (minX, minY, maxZ) ✓ |
| 7 | BR-far  | (minX, minY, minZ) ✓ |

### View 3: Back (Camera at -Z, looking +Z)
- **Depth:** Z-axis (near=minZ, far=maxZ)
- **Horizontal:** X-axis (right=minX, left=maxX) - flipped
- **Vertical:** Y-axis (top=maxY, bottom=minY)

| Corner | Position | Global Coordinates |
|--------|----------|-------------------|
| 0 | TR-near | (minX, maxY, minZ) |
| 1 | TL-near | (maxX, maxY, minZ) |
| 2 | BL-near | (maxX, minY, minZ) |
| 3 | BR-near | (minX, minY, minZ) |
| 4 | TR-far  | (minX, maxY, maxZ) |
| 5 | TL-far  | (maxX, maxY, maxZ) |
| 6 | BL-far  | (maxX, minY, maxZ) |
| 7 | BR-far  | (minX, minY, maxZ) |

### View 4: Left (Camera at -X, looking +X)
- **Depth:** X-axis (near=minX, far=maxX)
- **Horizontal:** Z-axis (right=maxZ, left=minZ) ← right-hand rule: +X × +Y = +Z
- **Vertical:** Y-axis (top=maxY, bottom=minY)

| Corner | Position | Global Coordinates |
|--------|----------|-------------------|
| 0 | TR-near | (minX, maxY, maxZ) ✓ |
| 1 | TL-near | (minX, maxY, minZ) ✓ |
| 2 | BL-near | (minX, minY, minZ) ✓ |
| 3 | BR-near | (minX, minY, maxZ) ✓ |
| 4 | TR-far  | (maxX, maxY, maxZ) ✓ |
| 5 | TL-far  | (maxX, maxY, minZ) ✓ |
| 6 | BL-far  | (maxX, minY, minZ) ✓ |
| 7 | BR-far  | (maxX, minY, maxZ) ✓ |

### View 5: Top (Camera at +Y, looking -Y)
- **Depth:** Y-axis (near=maxY, far=minY)
- **Horizontal:** X-axis (right=maxX, left=minX)
- **Vertical (screen):** Z-axis (top=minZ, bottom=maxZ)

| Corner | Position | Global Coordinates |
|--------|----------|-------------------|
| 0 | TR-near | (maxX, maxY, minZ) |
| 1 | TL-near | (minX, maxY, minZ) |
| 2 | BL-near | (minX, maxY, maxZ) |
| 3 | BR-near | (maxX, maxY, maxZ) |
| 4 | TR-far  | (maxX, minY, minZ) |
| 5 | TL-far  | (minX, minY, minZ) |
| 6 | BL-far  | (minX, minY, maxZ) |
| 7 | BR-far  | (maxX, minY, maxZ) |

### View 6: Bottom (Camera at -Y, looking +Y)
- **Depth:** Y-axis (near=minY, far=maxY)
- **Horizontal:** X-axis (right=maxX, left=minX)
- **Vertical (screen):** Z-axis (top=maxZ, bottom=minZ)

| Corner | Position | Global Coordinates |
|--------|----------|-------------------|
| 0 | TR-near | (maxX, minY, maxZ) |
| 1 | TL-near | (minX, minY, maxZ) |
| 2 | BL-near | (minX, minY, minZ) |
| 3 | BR-near | (maxX, minY, minZ) |
| 4 | TR-far  | (maxX, maxY, maxZ) |
| 5 | TL-far  | (minX, maxY, maxZ) |
| 6 | BL-far  | (minX, maxY, minZ) |
| 7 | BR-far  | (maxX, maxY, minZ) |

## Verification Examples

### View 1 (Front):
- `q` → corner 0 → (maxX, maxY, maxZ) ✓ "maxX and maxZ" near corner
- `qqqqqqq` (7 presses) → corner 6 → (minX, minY, minZ) ✓ "minX minZ" far corner

### View 2 (Right):
- `q` → corner 0 → (maxX, maxY, minZ) ✓ "maxY and minZ" near corner
- `qqq` (3 presses) → corner 2 → (maxX, minY, maxZ) ✓ "minY, [maxZ]"

Note: In View 2, looking from +X toward -X:
- The Z-axis goes left-right on screen (right=minZ, left=maxZ)
- Corner 2 is bottom-left-near, which has minY (bottom) and maxZ (left)

## Right-Hand Rule Reference

For all views, the **right-hand rule** determines screen orientation:
- **Right direction** = View Direction × Up Direction

| View | View Direction | Up | Right (calculated) | Result |
|------|----------------|----|--------------------|--------|
| 1 (Front) | -Z | +Y | (-Z) × (+Y) | +X ✓ |
| 2 (Right) | -X | +Y | (-X) × (+Y) | -Z ✓ |
| 3 (Back)  | +Z | +Y | (+Z) × (+Y) | -X ✓ |
| 4 (Left)  | +X | +Y | (+X) × (+Y) | +Z ✓ |
| 5 (Top)   | -Y | -Z | (-Y) × (-Z) | -X → right=maxX |
| 6 (Bottom)| +Y | +Z | (+Y) × (+Z) | -X → right=maxX |

## Summary

All 8 corners follow a consistent pattern across all 6 views:
1. **Near plane** (4 corners closest to camera)
   - TR, TL, BL, BR (clockwise from top-right)
2. **Far plane** (4 corners furthest from camera)
   - TR, TL, BL, BR (same order)

The global coordinates change per view, but the local screen-space ordering remains consistent.
