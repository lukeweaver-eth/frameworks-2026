/**
 * FrameStore — GPU-aligned typed array backend for Frameworks V4
 *
 * Replaces V3's Frame class + Framework.frames[] with a flat typed array.
 * Each instance is 64 bytes (16 × f32), matching the WebGPU storage buffer layout.
 *
 * Memory layout per instance (64 bytes):
 *
 *   Offset  Field          Type    V3 equivalent
 *   ──────  ─────────────  ──────  ─────────────────────────
 *   0       position.x     f32     frame.x
 *   1       position.y     f32     frame.y
 *   2       position.z     f32     frame.z
 *   3       scale          f32     frame.size
 *   4       right.x        f32     frame.rightX
 *   5       right.y        f32     frame.rightY
 *   6       right.z        f32     frame.rightZ
 *   7       colorIndex     u32     palette index (V3 used hex string)
 *   8       up.x           f32     frame.upX
 *   9       up.y           f32     frame.upY
 *   10      up.z           f32     frame.upZ
 *   11      flags          u32     bit 0: selected, bit 1: visible
 *   12      normal.x       f32     frame.ihat
 *   13      normal.y       f32     frame.jhat
 *   14      normal.z       f32     frame.khat
 *   15      frameId        u32     frame.count (global ID)
 *
 * The WGSL vertex shader reads this struct and builds a mat3x3 from
 * columns [right, up, normal], identical to the V3 GLSL shader.
 *
 * IMPORTANT: V3 stores the full orthonormal basis (right, up, normal).
 * After creation, rotation updates all 3 vectors via the rotation matrix.
 * We do NOT reconstruct from normal+roll — the stored basis IS the truth.
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const FLOATS_PER_INSTANCE = 16;
const BYTES_PER_INSTANCE = 64;

// Float32 offsets within one instance
const F = {
    PX: 0,  PY: 1,  PZ: 2,  SCALE: 3,
    RX: 4,  RY: 5,  RZ: 6,  // right vector
    // offset 7 is colorIndex (u32)
    UX: 8,  UY: 9,  UZ: 10,  // up vector
    // offset 11 is flags (u32)
    NX: 12, NY: 13, NZ: 14,  // normal vector
    // offset 15 is frameId (u32)
};

// Uint32 offsets for integer fields
const U = {
    COLOR_INDEX: 7,
    FLAGS: 11,
    FRAME_ID: 15,
};

// Flag bits
const FLAG_SELECTED = 1;
const FLAG_VISIBLE  = 2;


// ============================================================
// FRAME STORE
// ============================================================

class FrameStore {
    constructor(initialCapacity = 4096) {
        this.count = 0;
        this.capacity = initialCapacity;
        this._frameIdCounter = 0;

        // GPU-aligned typed array
        this.data = new ArrayBuffer(this.capacity * BYTES_PER_INSTANCE);
        this.f32 = new Float32Array(this.data);
        this.u32 = new Uint32Array(this.data);

        // CPU-side metadata (not sent to GPU)
        this.metadata = [];

        // Dirty tracking for partial GPU upload
        this._dirtyMin = Infinity;  // byte offset
        this._dirtyMax = 0;         // byte offset (exclusive)
        this._fullDirty = false;    // if true, upload entire buffer
    }

    // ── Capacity management ──

    _grow(needed) {
        while (this.capacity < needed) this.capacity *= 2;
        if (this.capacity > this.f32.length / FLOATS_PER_INSTANCE) {
            const oldBytes = this.data.byteLength;
            const newBuf = new ArrayBuffer(this.capacity * BYTES_PER_INSTANCE);
            new Uint8Array(newBuf).set(new Uint8Array(this.data, 0, oldBytes));
            this.data = newBuf;
            this.f32 = new Float32Array(this.data);
            this.u32 = new Uint32Array(this.data);
            this._fullDirty = true;
        }
    }

    // ── Offset helpers ──

    /** Float32/Uint32 offset for instance i */
    _o(i) { return i * FLOATS_PER_INSTANCE; }

    /** Byte offset for instance i */
    _b(i) { return i * BYTES_PER_INSTANCE; }

    // ── Dirty range tracking ──

    _markDirty(instanceIndex) {
        const lo = this._b(instanceIndex);
        const hi = lo + BYTES_PER_INSTANCE;
        if (lo < this._dirtyMin) this._dirtyMin = lo;
        if (hi > this._dirtyMax) this._dirtyMax = hi;
    }

    _markRangeDirty(startIdx, count) {
        const lo = this._b(startIdx);
        const hi = this._b(startIdx + count);
        if (lo < this._dirtyMin) this._dirtyMin = lo;
        if (hi > this._dirtyMax) this._dirtyMax = hi;
    }

    _markAllDirty() {
        this._fullDirty = true;
    }

    /**
     * Get the dirty byte range for GPU upload.
     * Returns { offset, length } or null if nothing dirty.
     * After calling this, call clearDirty().
     */
    getDirtyRange() {
        if (this._fullDirty) {
            return { offset: 0, length: this.count * BYTES_PER_INSTANCE };
        }
        if (this._dirtyMin < this._dirtyMax) {
            return { offset: this._dirtyMin, length: this._dirtyMax - this._dirtyMin };
        }
        return null;
    }

    clearDirty() {
        this._dirtyMin = Infinity;
        this._dirtyMax = 0;
        this._fullDirty = false;
    }

    // ════════════════════════════════════════════════════════════
    // FRAME CREATION
    // ════════════════════════════════════════════════════════════

    /**
     * Reconstruct right and up vectors from a normal vector.
     * Ported from V3 Frame.reconstructBasisFromNormal() (lines 59-128).
     *
     * Uses world +Y as reference up, falls back to +X when normal is ±Y.
     * Returns { rx, ry, rz, ux, uy, uz } (right and up vectors).
     */
    static basisFromNormal(nx, ny, nz) {
        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0.0001) { nx /= len; ny /= len; nz /= len; }

        // Default case: normal is (0,0,1) → identity basis
        if (Math.abs(nx) < 0.001 && Math.abs(ny) < 0.001 && Math.abs(nz - 1) < 0.001) {
            return { rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0 };
        }

        // Choose reference vector
        let refX, refY, refZ;
        const dotWithY = Math.abs(ny);  // abs(dot(normal, [0,1,0]))
        if (dotWithY > 0.999) {
            refX = 1; refY = 0; refZ = 0;  // fallback to +X
        } else {
            refX = 0; refY = 1; refZ = 0;  // world +Y
        }

        // right = cross(reference, normal)
        let rx = refY * nz - refZ * ny;
        let ry = refZ * nx - refX * nz;
        let rz = refX * ny - refY * nx;
        const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
        if (rLen > 0.0001) { rx /= rLen; ry /= rLen; rz /= rLen; }

        // up = cross(normal, right)
        let ux = ny * rz - nz * ry;
        let uy = nz * rx - nx * rz;
        let uz = nx * ry - ny * rx;
        const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz);
        if (uLen > 0.0001) { ux /= uLen; uy /= uLen; uz /= uLen; }

        return { rx, ry, rz, ux, uy, uz };
    }

    /**
     * Add a new frame. Equivalent to V3 Framework.addFrame(new Frame(...)).
     *
     * @param {number} x, y, z       — world position
     * @param {number} nx, ny, nz    — normal vector (will be normalized)
     * @param {number} scale          — frame size (default 1)
     * @param {number} colorIndex     — palette index (integer)
     * @returns {number} index of the new frame
     */
    addFrame(x, y, z, nx, ny, nz, scale, colorIndex) {
        const i = this.count++;
        this._grow(this.count);
        const o = this._o(i);

        // Position + scale
        this.f32[o + F.PX] = x;
        this.f32[o + F.PY] = y;
        this.f32[o + F.PZ] = z;
        this.f32[o + F.SCALE] = scale ?? 1;

        // Basis from normal
        const basis = FrameStore.basisFromNormal(nx, ny, nz);
        this.f32[o + F.RX] = basis.rx;
        this.f32[o + F.RY] = basis.ry;
        this.f32[o + F.RZ] = basis.rz;
        this.f32[o + F.UX] = basis.ux;
        this.f32[o + F.UY] = basis.uy;
        this.f32[o + F.UZ] = basis.uz;

        // Normal (normalized)
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        this.f32[o + F.NX] = len > 0.0001 ? nx / len : 0;
        this.f32[o + F.NY] = len > 0.0001 ? ny / len : 0;
        this.f32[o + F.NZ] = len > 0.0001 ? nz / len : 1;

        // Integer fields
        this.u32[o + U.COLOR_INDEX] = colorIndex ?? 0;
        this.u32[o + U.FLAGS] = FLAG_SELECTED | FLAG_VISIBLE;  // new frames start selected + visible
        this.u32[o + U.FRAME_ID] = this._frameIdCounter++;

        // CPU metadata
        this.metadata[i] = { called: '', contents: '', contexts: [], components: [] };

        this._markDirty(i);
        return i;
    }

    // ════════════════════════════════════════════════════════════
    // FIELD ACCESSORS
    // ════════════════════════════════════════════════════════════

    getPos(i)      { const o = this._o(i); return [this.f32[o], this.f32[o+1], this.f32[o+2]]; }
    getScale(i)    { return this.f32[this._o(i) + F.SCALE]; }
    getColor(i)    { return this.u32[this._o(i) + U.COLOR_INDEX]; }
    getFrameId(i)  { return this.u32[this._o(i) + U.FRAME_ID]; }
    getNormal(i)   { const o = this._o(i); return [this.f32[o+F.NX], this.f32[o+F.NY], this.f32[o+F.NZ]]; }
    getRight(i)    { const o = this._o(i); return [this.f32[o+F.RX], this.f32[o+F.RY], this.f32[o+F.RZ]]; }
    getUp(i)       { const o = this._o(i); return [this.f32[o+F.UX], this.f32[o+F.UY], this.f32[o+F.UZ]]; }

    isSelected(i)  { return (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) !== 0; }
    isVisible(i)   { return (this.u32[this._o(i) + U.FLAGS] & FLAG_VISIBLE) !== 0; }

    setPos(i, x, y, z) {
        const o = this._o(i);
        this.f32[o] = x; this.f32[o+1] = y; this.f32[o+2] = z;
        this._markDirty(i);
    }

    setScale(i, s) {
        this.f32[this._o(i) + F.SCALE] = s;
        this._markDirty(i);
    }

    setColor(i, colorIndex) {
        this.u32[this._o(i) + U.COLOR_INDEX] = colorIndex;
        this._markDirty(i);
    }

    setSelected(i, selected) {
        const o = this._o(i) + U.FLAGS;
        if (selected) this.u32[o] |= FLAG_SELECTED;
        else          this.u32[o] &= ~FLAG_SELECTED;
        this._markDirty(i);
    }

    setVisible(i, visible) {
        const o = this._o(i) + U.FLAGS;
        if (visible) this.u32[o] |= FLAG_VISIBLE;
        else         this.u32[o] &= ~FLAG_VISIBLE;
        this._markDirty(i);
    }

    // ════════════════════════════════════════════════════════════
    // SELECTION
    // ════════════════════════════════════════════════════════════

    /** Deselect all frames. V3: framework.deselectAll() */
    deselectAll() {
        for (let i = 0; i < this.count; i++) {
            this.u32[this._o(i) + U.FLAGS] &= ~FLAG_SELECTED;
        }
        this._markRangeDirty(0, this.count);
    }

    /** Select all frames. V3: framework.selectAll() */
    selectAll() {
        for (let i = 0; i < this.count; i++) {
            this.u32[this._o(i) + U.FLAGS] |= FLAG_SELECTED;
        }
        this._markRangeDirty(0, this.count);
    }

    /**
     * Iterate selected frame indices.
     * Returns an array of indices — avoids allocation in hot paths if you
     * just loop inline, but useful for CommandExecutor compatibility.
     */
    getSelectedIndices() {
        const result = [];
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) result.push(i);
        }
        return result;
    }

    /** Get count of selected frames */
    getSelectedCount() {
        let n = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) n++;
        }
        return n;
    }

    /**
     * Select all frames with the same color as the first selected frame.
     * V3: CommandExecutor.selectAllOfColor()
     */
    selectAllOfColor() {
        const sel = this.getSelectedIndices();
        if (sel.length === 0) return;
        const targetColor = this.u32[this._o(sel[0]) + U.COLOR_INDEX];
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.COLOR_INDEX] === targetColor) {
                this.u32[this._o(i) + U.FLAGS] |= FLAG_SELECTED;
            }
        }
        this._markRangeDirty(0, this.count);
    }

    // ════════════════════════════════════════════════════════════
    // TRANSLATE
    // Ported from V3 Frame.translate() and CommandExecutor.handleTranslate()
    // ════════════════════════════════════════════════════════════

    /** Translate a single frame by dx, dy, dz */
    translate(i, dx, dy, dz) {
        const o = this._o(i);
        this.f32[o + F.PX] += dx;
        this.f32[o + F.PY] += dy;
        this.f32[o + F.PZ] += dz;
        this._markDirty(i);
    }

    /** Translate all selected frames by dx, dy, dz */
    translateSelected(dx, dy, dz) {
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                this.translate(i, dx, dy, dz);
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // ROTATE
    // Ported from V3 Frame.rotate() (lines 178-301)
    //
    // CRITICAL DETAIL: V3 rotates ALL THREE basis vectors (right, up, normal)
    // using the same rotation matrix, then re-normalizes each to prevent drift.
    // This is NOT a normal+roll system — the full basis IS the orientation truth.
    // ════════════════════════════════════════════════════════════

    /**
     * Rotate a single frame around a pivot point.
     *
     * @param {number} i         — frame index
     * @param {number} cx,cy,cz  — pivot (cursor position)
     * @param {number} angle     — radians, counter-clockwise
     * @param {string} axis      — 'x', 'y', or 'z'
     */
    rotateFrame(i, cx, cy, cz, angle, axis) {
        const o = this._o(i);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // ── 1. Rotate position around pivot ──
        const dx = this.f32[o + F.PX] - cx;
        const dy = this.f32[o + F.PY] - cy;
        const dz = this.f32[o + F.PZ] - cz;

        let px, py, pz;
        switch (axis) {
            case 'x': px = dx;                    py = dy*cos - dz*sin;  pz = dy*sin + dz*cos;  break;
            case 'y': px = dx*cos + dz*sin;       py = dy;               pz = -dx*sin + dz*cos; break;
            case 'z': px = dx*cos - dy*sin;        py = dx*sin + dy*cos;  pz = dz;               break;
        }
        this.f32[o + F.PX] = cx + px;
        this.f32[o + F.PY] = cy + py;
        this.f32[o + F.PZ] = cz + pz;

        // ── 2. Rotate right vector ──
        const rx = this.f32[o + F.RX], ry = this.f32[o + F.RY], rz = this.f32[o + F.RZ];
        switch (axis) {
            case 'x': this.f32[o+F.RX] = rx;           this.f32[o+F.RY] = ry*cos - rz*sin; this.f32[o+F.RZ] = ry*sin + rz*cos; break;
            case 'y': this.f32[o+F.RX] = rx*cos+rz*sin; this.f32[o+F.RY] = ry;              this.f32[o+F.RZ] = -rx*sin+rz*cos;  break;
            case 'z': this.f32[o+F.RX] = rx*cos-ry*sin; this.f32[o+F.RY] = rx*sin+ry*cos;   this.f32[o+F.RZ] = rz;              break;
        }

        // ── 3. Rotate up vector ──
        const ux = this.f32[o + F.UX], uy = this.f32[o + F.UY], uz = this.f32[o + F.UZ];
        switch (axis) {
            case 'x': this.f32[o+F.UX] = ux;           this.f32[o+F.UY] = uy*cos - uz*sin; this.f32[o+F.UZ] = uy*sin + uz*cos; break;
            case 'y': this.f32[o+F.UX] = ux*cos+uz*sin; this.f32[o+F.UY] = uy;              this.f32[o+F.UZ] = -ux*sin+uz*cos;  break;
            case 'z': this.f32[o+F.UX] = ux*cos-uy*sin; this.f32[o+F.UY] = ux*sin+uy*cos;   this.f32[o+F.UZ] = uz;              break;
        }

        // ── 4. Rotate normal vector ──
        const nx = this.f32[o + F.NX], ny = this.f32[o + F.NY], nz = this.f32[o + F.NZ];
        switch (axis) {
            case 'x': this.f32[o+F.NX] = nx;           this.f32[o+F.NY] = ny*cos - nz*sin; this.f32[o+F.NZ] = ny*sin + nz*cos; break;
            case 'y': this.f32[o+F.NX] = nx*cos+nz*sin; this.f32[o+F.NY] = ny;              this.f32[o+F.NZ] = -nx*sin+nz*cos;  break;
            case 'z': this.f32[o+F.NX] = nx*cos-ny*sin; this.f32[o+F.NY] = nx*sin+ny*cos;   this.f32[o+F.NZ] = nz;              break;
        }

        // ── 5. Re-normalize all basis vectors to prevent floating-point drift ──
        this._normalizeVec3At(o + F.RX);
        this._normalizeVec3At(o + F.UX);
        this._normalizeVec3At(o + F.NX);

        this._markDirty(i);
    }

    /** Normalize 3 consecutive floats in-place */
    _normalizeVec3At(offset) {
        const x = this.f32[offset], y = this.f32[offset+1], z = this.f32[offset+2];
        const len = Math.sqrt(x*x + y*y + z*z);
        if (len > 0.0001) {
            this.f32[offset]   = x / len;
            this.f32[offset+1] = y / len;
            this.f32[offset+2] = z / len;
        }
    }

    /**
     * Rotate all selected frames around cursor.
     * V3: CommandExecutor.rotateSelected() (lines 1996-2030)
     *
     * @param {number} cx,cy,cz — cursor position (pivot)
     * @param {number} angle    — radians
     * @param {number} view     — current view (0-6), determines axis
     */
    rotateSelected(cx, cy, cz, angle, view) {
        let axis;
        switch (view) {
            case 0: case 1: case 3: axis = 'z'; break;  // Front/Back → Z axis
            case 2: case 4:         axis = 'x'; break;  // Right/Left → X axis
            case 5: case 6:         axis = 'y'; break;  // Top/Bottom → Y axis
            default:                axis = 'z';
        }
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                this.rotateFrame(i, cx, cy, cz, angle, axis);
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // REFLECT
    // Ported from V3 CommandExecutor.reflectSelectedH/V (lines 2036-2138)
    //
    // CRITICAL DETAIL: V3 reflection flips the position along one axis AND
    // flips ONLY the corresponding component of the normal vector.
    // It does NOT touch the right or up vectors.
    // This is intentional — it mirrors the visual appearance without
    // fully reflecting the basis, which would flip the frame's handedness.
    // ════════════════════════════════════════════════════════════

    /**
     * Reflect selected frames horizontally (e command).
     * V3: CommandExecutor.reflectSelectedH()
     *
     * @param {number} cx,cy,cz — cursor position (reflection plane passes through here)
     * @param {number} view     — current view (determines which axis to flip)
     */
    reflectSelectedH(cx, cy, cz, view) {
        // Determine reflect axis based on view
        // View 0/1/3/5/6: flip X (reflect across YZ plane)
        // View 2/4:       flip Z (reflect across XY plane)
        let reflectAxis;
        switch (view) {
            case 0: case 1: case 3: case 5: case 6: reflectAxis = 'x'; break;
            case 2: case 4:                          reflectAxis = 'z'; break;
            default:                                 reflectAxis = 'x';
        }

        for (let i = 0; i < this.count; i++) {
            if (!(this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED)) continue;
            const o = this._o(i);

            switch (reflectAxis) {
                case 'x': {
                    // Flip position X around cursor
                    const d = this.f32[o + F.PX] - cx;
                    this.f32[o + F.PX] = cx - d;
                    // Flip normal X component only
                    this.f32[o + F.NX] = -this.f32[o + F.NX];
                    break;
                }
                case 'z': {
                    // Flip position Z around cursor
                    const d = this.f32[o + F.PZ] - cz;
                    this.f32[o + F.PZ] = cz - d;
                    // Flip normal Z component only
                    this.f32[o + F.NZ] = -this.f32[o + F.NZ];
                    break;
                }
            }
            this._markDirty(i);
        }
    }

    /**
     * Reflect selected frames vertically (E command).
     * V3: CommandExecutor.reflectSelectedV()
     *
     * @param {number} cx,cy,cz — cursor position
     * @param {number} view     — current view
     */
    reflectSelectedV(cx, cy, cz, view) {
        // View 0/1/2/3/4: flip Y (reflect across XZ plane)
        // View 5/6:       flip Z (reflect across XY plane)
        let reflectAxis;
        switch (view) {
            case 0: case 1: case 2: case 3: case 4: reflectAxis = 'y'; break;
            case 5: case 6:                          reflectAxis = 'z'; break;
            default:                                 reflectAxis = 'y';
        }

        for (let i = 0; i < this.count; i++) {
            if (!(this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED)) continue;
            const o = this._o(i);

            switch (reflectAxis) {
                case 'y': {
                    const d = this.f32[o + F.PY] - cy;
                    this.f32[o + F.PY] = cy - d;
                    this.f32[o + F.NY] = -this.f32[o + F.NY];
                    break;
                }
                case 'z': {
                    const d = this.f32[o + F.PZ] - cz;
                    this.f32[o + F.PZ] = cz - d;
                    this.f32[o + F.NZ] = -this.f32[o + F.NZ];
                    break;
                }
            }
            this._markDirty(i);
        }
    }

    // ════════════════════════════════════════════════════════════
    // SCALE
    // Ported from V3 CommandExecutor.handleScale() and handleScaleSelection()
    // (lines 2524-2605)
    // ════════════════════════════════════════════════════════════

    /**
     * Scale individual selected frames (s + i/k).
     * Only changes frame.size, not position.
     */
    scaleSelected(factor) {
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                this.f32[this._o(i) + F.SCALE] *= factor;
                this._markDirty(i);
            }
        }
    }

    /**
     * Scale entire selection as a group (S + i/k).
     * Scales both positions (relative to selection center) and frame sizes.
     */
    scaleSelectionGroup(factor) {
        // Find selection center
        let cx = 0, cy = 0, cz = 0, n = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                const o = this._o(i);
                cx += this.f32[o]; cy += this.f32[o+1]; cz += this.f32[o+2];
                n++;
            }
        }
        if (n === 0) return;
        cx /= n; cy /= n; cz /= n;

        // Scale positions relative to center + scale sizes
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                const o = this._o(i);
                this.f32[o + F.PX] = cx + (this.f32[o + F.PX] - cx) * factor;
                this.f32[o + F.PY] = cy + (this.f32[o + F.PY] - cy) * factor;
                this.f32[o + F.PZ] = cz + (this.f32[o + F.PZ] - cz) * factor;
                this.f32[o + F.SCALE] *= factor;
                this._markDirty(i);
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // DUPLICATE
    // Ported from V3 Frame.duplicate() + CommandExecutor.duplicateSelected()
    // (lines 322-342, 1953-1972)
    //
    // V3 copies the FULL basis (right, up, normal), not just the normal.
    // We do this with a flat memcpy of the 64-byte instance, then patch
    // the frameId and selection flag.
    // ════════════════════════════════════════════════════════════

    /**
     * Duplicate all selected frames in-place.
     * New copies become selected, originals deselected.
     * Returns array of new indices.
     */
    duplicateSelected() {
        const originals = this.getSelectedIndices();
        if (originals.length === 0) return [];

        // Deselect originals first
        for (const idx of originals) {
            this.u32[this._o(idx) + U.FLAGS] &= ~FLAG_SELECTED;
            this._markDirty(idx);
        }

        // Duplicate each
        const newIndices = [];
        for (const srcIdx of originals) {
            const newIdx = this.count++;
            this._grow(this.count);

            // Copy 16 floats (64 bytes) from source to destination
            const src = this._o(srcIdx);
            const dst = this._o(newIdx);
            for (let j = 0; j < FLOATS_PER_INSTANCE; j++) {
                this.u32[dst + j] = this.u32[src + j];  // u32 copy works for both float and int
            }

            // Patch: new frame ID
            this.u32[dst + U.FRAME_ID] = this._frameIdCounter++;

            // Patch: new frame is selected
            this.u32[dst + U.FLAGS] |= FLAG_SELECTED;

            // Copy metadata
            const srcMeta = this.metadata[srcIdx];
            this.metadata[newIdx] = {
                called: srcMeta ? srcMeta.called : '',
                contents: srcMeta ? srcMeta.contents : '',
                contexts: [],
                components: [],
            };

            this._markDirty(newIdx);
            newIndices.push(newIdx);
        }
        return newIndices;
    }

    // ════════════════════════════════════════════════════════════
    // DELETE
    // Ported from V3 CommandExecutor.deleteSelected() (lines 1977-1990)
    //
    // V3 uses array filter. We do stable compaction — shift survivors down
    // to fill gaps, preserving relative order.
    // ════════════════════════════════════════════════════════════

    /**
     * Delete all selected frames. Returns number deleted.
     */
    deleteSelected() {
        let dst = 0;
        for (let src = 0; src < this.count; src++) {
            if (this.u32[this._o(src) + U.FLAGS] & FLAG_SELECTED) {
                continue;  // skip (delete)
            }
            if (dst !== src) {
                // Copy instance data
                const so = this._o(src), do_ = this._o(dst);
                for (let j = 0; j < FLOATS_PER_INSTANCE; j++) {
                    this.u32[do_ + j] = this.u32[so + j];
                }
                // Move metadata
                this.metadata[dst] = this.metadata[src];
            }
            dst++;
        }
        const deleted = this.count - dst;
        this.count = dst;
        if (deleted > 0) this._markAllDirty();
        return deleted;
    }

    // ════════════════════════════════════════════════════════════
    // SPATIAL OPERATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Snap selection center to cursor position (Space command).
     * V3: CommandExecutor.snapSelectionToCursor() (lines 2162-2183)
     */
    snapSelectionToCursor(cursorX, cursorY, cursorZ) {
        let cx = 0, cy = 0, cz = 0, n = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                const o = this._o(i);
                cx += this.f32[o]; cy += this.f32[o+1]; cz += this.f32[o+2];
                n++;
            }
        }
        if (n === 0) return;
        cx /= n; cy /= n; cz /= n;

        const dx = cursorX - cx, dy = cursorY - cy, dz = cursorZ - cz;
        this.translateSelected(dx, dy, dz);
    }

    /**
     * Center entire structure to cursor (Z command).
     * V3: CommandExecutor.centerStructureToCursor() (lines 2191-2213)
     */
    centerStructureToCursor(cursorX, cursorY, cursorZ) {
        if (this.count === 0) return;
        const bbox = this.getBoundingBox();
        const dx = cursorX - bbox.centerX;
        const dy = cursorY - bbox.centerY;
        const dz = cursorZ - bbox.centerZ;
        for (let i = 0; i < this.count; i++) {
            this.translate(i, dx, dy, dz);
        }
    }

    /**
     * Get bounding box of all frames.
     * V3: Framework.getBoundingBox() (lines 439-473)
     */
    getBoundingBox() {
        if (this.count === 0) {
            return { minX:0, maxX:0, minY:0, maxY:0, minZ:0, maxZ:0, centerX:0, centerY:0, centerZ:0 };
        }
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < this.count; i++) {
            const o = this._o(i);
            const hs = this.f32[o + F.SCALE] / 2;
            const x = this.f32[o], y = this.f32[o+1], z = this.f32[o+2];
            if (x - hs < minX) minX = x - hs;
            if (x + hs > maxX) maxX = x + hs;
            if (y - hs < minY) minY = y - hs;
            if (y + hs > maxY) maxY = y + hs;
            if (z - hs < minZ) minZ = z - hs;
            if (z + hs > maxZ) maxZ = z + hs;
        }
        return {
            minX, maxX, minY, maxY, minZ, maxZ,
            centerX: (minX+maxX)/2, centerY: (minY+maxY)/2, centerZ: (minZ+maxZ)/2,
        };
    }

    // ════════════════════════════════════════════════════════════
    // COLOR OPERATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Apply a color shift to all selected frames.
     * V3: ColorContext.apply() (lines 731-759)
     *
     * V3 calculates a shift from startingIndex to currentIndex, then applies
     * that shift to each frame's color independently. This preserves relative
     * color differences across multi-colored selections.
     *
     * @param {number} shift — signed integer offset in palette
     * @param {number} paletteSize — total colors in palette
     */
    shiftSelectedColors(shift, paletteSize) {
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                const o = this._o(i) + U.COLOR_INDEX;
                const cur = this.u32[o];
                this.u32[o] = ((cur + shift) % paletteSize + paletteSize) % paletteSize;
                this._markDirty(i);
            }
        }
    }

    /**
     * Set all selected frames to a specific color index.
     */
    setSelectedColor(colorIndex) {
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                this.u32[this._o(i) + U.COLOR_INDEX] = colorIndex;
                this._markDirty(i);
            }
        }
    }

    /**
     * Shift ALL frames' colors by 1 step in given direction.
     * Used by the animation system (m command).
     * V3: CommandExecutor.updateAnimation() (lines 2447-2497)
     *
     * @param {string} direction — 'i' (up/−cols), 'k' (down/+cols), 'j' (left/−1), 'l' (right/+1)
     * @param {number} cols — palette columns (8 for eightycolors)
     * @param {number} paletteSize — total colors
     */
    animateAllColors(direction, cols, paletteSize) {
        let shift;
        switch (direction) {
            case 'l': shift = 1; break;
            case 'j': shift = -1; break;
            case 'k': shift = cols; break;
            case 'i': shift = -cols; break;
            default: return;
        }
        for (let i = 0; i < this.count; i++) {
            const o = this._o(i) + U.COLOR_INDEX;
            const cur = this.u32[o];
            this.u32[o] = ((cur + shift) % paletteSize + paletteSize) % paletteSize;
        }
        this._markRangeDirty(0, this.count);
    }

    // ════════════════════════════════════════════════════════════
    // CLEAR / BULK
    // ════════════════════════════════════════════════════════════

    /** Clear all frames. V3: Framework.clear() */
    clear() {
        this.count = 0;
        this._frameIdCounter = 0;
        this.metadata = [];
        this._markAllDirty();
    }

    /**
     * Bulk-add frames for stress testing.
     * Not present in V3 — convenience for the WebGPU prototype.
     */
    addBulk(n, positionFn, colorFn, normalFn) {
        const start = this.count;
        this.count += n;
        this._grow(this.count);
        for (let i = 0; i < n; i++) {
            const idx = start + i;
            const o = this._o(idx);
            const pos = positionFn(i);
            const norm = normalFn ? normalFn(i) : [0, 0, 1];
            const basis = FrameStore.basisFromNormal(norm[0], norm[1], norm[2]);

            this.f32[o + F.PX] = pos[0];
            this.f32[o + F.PY] = pos[1];
            this.f32[o + F.PZ] = pos[2];
            this.f32[o + F.SCALE] = 1;
            this.f32[o + F.RX] = basis.rx; this.f32[o + F.RY] = basis.ry; this.f32[o + F.RZ] = basis.rz;
            this.f32[o + F.UX] = basis.ux; this.f32[o + F.UY] = basis.uy; this.f32[o + F.UZ] = basis.uz;
            this.f32[o + F.NX] = norm[0];  this.f32[o + F.NY] = norm[1];  this.f32[o + F.NZ] = norm[2];
            this.u32[o + U.COLOR_INDEX] = colorFn ? colorFn(i) : (i % 80);
            this.u32[o + U.FLAGS] = FLAG_VISIBLE;  // not selected for bulk add
            this.u32[o + U.FRAME_ID] = this._frameIdCounter++;
            this.metadata[idx] = { called: '', contents: '', contexts: [], components: [] };
        }
        this._markRangeDirty(start, n);
    }

    // ════════════════════════════════════════════════════════════
    // FRAME ID LOOKUP
    // Used by FrameSelectionContext which selects by frame.count (ID),
    // not by array index.
    // ════════════════════════════════════════════════════════════

    /** Find array index for a given frameId. Returns -1 if not found. */
    findByFrameId(frameId) {
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FRAME_ID] === frameId) return i;
        }
        return -1;
    }

    /** Select frames by frame ID set (for bracket notation [1,5,9]). */
    selectByFrameIds(idSet) {
        this.deselectAll();
        for (let i = 0; i < this.count; i++) {
            if (idSet.has(this.u32[this._o(i) + U.FRAME_ID])) {
                this.u32[this._o(i) + U.FLAGS] |= FLAG_SELECTED;
                this._markDirty(i);
            }
        }
    }

    /** Get min/max frameId of selected frames (for FrameSelectionContext). */
    getSelectedIdBounds() {
        let minId = Infinity, maxId = -1, count = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                const id = this.u32[this._o(i) + U.FRAME_ID];
                if (id < minId) minId = id;
                if (id > maxId) maxId = id;
                count++;
            }
        }
        return { min: count > 0 ? minId : null, max: count > 0 ? maxId : null, count };
    }

    /** Get all frameId values (for wrap-around in selection context). */
    getAllFrameIds() {
        const ids = [];
        for (let i = 0; i < this.count; i++) {
            ids.push(this.u32[this._o(i) + U.FRAME_ID]);
        }
        return ids;
    }
}


// ============================================================
// COLOR UTILITIES
// Hex ↔ palette index conversion for V3 compatibility
// ============================================================

class ColorBridge {
    /**
     * Build a lookup map from hex strings to palette indices.
     * Call once at init with the palette array.
     *
     * @param {string[]} paletteHex — e.g. PALETTES.eightyColors
     * @returns {Map<string, number>} — uppercase hex → index
     */
    static buildLookup(paletteHex) {
        const map = new Map();
        for (let i = 0; i < paletteHex.length; i++) {
            map.set(paletteHex[i].toUpperCase(), i);
        }
        return map;
    }

    /**
     * Convert a hex color string to a palette index.
     * Returns -1 if not found.
     */
    static hexToIndex(hex, lookupMap) {
        return lookupMap.get(hex.toUpperCase()) ?? -1;
    }

    /**
     * Convert a palette index to a hex color string.
     */
    static indexToHex(index, paletteHex) {
        return paletteHex[index % paletteHex.length];
    }

    /**
     * Convert hex palette to Float32 RGBA for GPU upload.
     * Returns Float32Array(paletteSize * 4).
     */
    static paletteToFloat32(paletteHex) {
        const data = new Float32Array(paletteHex.length * 4);
        for (let i = 0; i < paletteHex.length; i++) {
            const hex = paletteHex[i];
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            data[i*4] = r; data[i*4+1] = g; data[i*4+2] = b; data[i*4+3] = 1;
        }
        return data;
    }
}


// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FrameStore,
        ColorBridge,
        FLOATS_PER_INSTANCE,
        BYTES_PER_INSTANCE,
        F, U,
        FLAG_SELECTED,
        FLAG_VISIBLE,
    };
}
