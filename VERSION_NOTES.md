# Frameworks V3.0.0 - Release Notes

## Release Date
January 12, 2026

## Summary

This is the first stable release of Frameworks V3, featuring a complete 6D coordinate system with orthogonally-correct rendering. The system allows building complex 3D structures by working in 6 cardinal planes while maintaining a spatial 3D perspective.

## What's New

### Core System
- **6D Frames**: Position (x,y,z) + Orientation (î,ĵ,k̂) + Roll angle
- **6-View System**: Work in Front/Right/Back/Left/Top/Bottom planes
- **Spatial Camera**: Free 3D perspective with orbit controls
- **Instanced Rendering**: 100,000+ frames at 60 FPS

### Critical Fix: Orthogonal Frame Rendering
**Problem**: Frames forming orthogonal coordinate systems appeared visually non-orthogonal after multiple 45° rotations.

**Solution**:
- Shader now uses world +Y as consistent reference when building orientation matrix
- Transformation order: Scale → Roll (local) → Orient (world) → Translate
- Ensures frames with same roll align consistently regardless of normal direction

**Result**: Orthogonal coordinate systems now render correctly at all rotation angles.

## What's Working

✅ **6D Coordinate System**
- Frames have position (x, y, z) and orientation (î, ĵ, k̂)
- Roll angle for in-plane rotation
- Normal vectors always remain orthogonal after rotations

✅ **6-View System**
- Work in 6 cardinal planes (Front, Right, Back, Left, Top, Bottom)
- View-relative translations (ijkl maps to different XYZ axes per view)
- View-relative rotations around plane normal
- Spatial camera stays in 3D perspective with orbit controls

✅ **Instanced Rendering**
- GPU-accelerated rendering
- 100,000+ frames at 60 FPS
- Single draw call per frame
- Custom GLSL shaders with correct orientation

✅ **Orthogonal Frame System**
- Frames maintain 90° angles through all rotations
- Normal vectors always preserve orthogonality
- World-relative orientation ensures consistent alignment
- Verified with comprehensive test suite

## Summary

Your **Frameworks V3.0.0** is now stable and versioned!

### What's Working:
✅ 6D coordinate system with position and orientation
✅ 6-view system with spatial camera
✅ Correct orthogonal frame rendering after rotations
✅ GPU-accelerated instanced rendering
✅ Complete documentation (README, CHANGELOG, COORDINATE_SYSTEMS)
✅ Comprehensive test suite
✅ Git repository initialized with tagged v3.0.0 release

### Files Created/Updated:
- ✅ **CHANGELOG.md** - Complete version history
- ✅ **README.md** - Updated with v3.0.0 features
- ✅ **COORDINATE_SYSTEMS.md** - Updated shader implementation details
- ✅ **Git commit** - Full commit with detailed description
- ✅ **Git tag** - v3.0.0 tagged for easy reference

Your stable v3.0.0 version is now saved with git! You can:
- Return to this version anytime with `git checkout v3.0.0`
- Create a new branch for experimentation: `git checkout -b feature-name`
- View commit: `git show v3.0.0`

Ready to proceed with new features! What would you like to work on next?