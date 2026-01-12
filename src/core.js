// frameworks-core-v3.0.js
// Core data structures for Frameworks V3

/**
 * Frame class - represents a planar object in 3D space
 * Coordinates: 6D (x, y, z, î, ĵ, k̂)
 * - xyz: global position (center point)
 * - î ĵ k̂: normal direction (unit vector defining which way frame faces)
 */
class Frame {
    constructor(x, y, z, ihat, jhat, khat, size = 1, color = '#ffffff') {
        // Position
        this.x = x;
        this.y = y;
        this.z = z;

        // Normal direction (unit vector)
        this.ihat = ihat;
        this.jhat = jhat;
        this.khat = khat;

        // Roll angle (rotation around normal, in radians)
        // For XY plane, this is rotation in the plane itself
        this.roll = 0;

        // Properties
        this.size = size;
        this.color = color;
        this.selected = true;  // New frames start selected
        this.visible = true;

        // Metadata
        this.called = '';      // Name/title
        this.contents = '';    // Body content

        // Future: contexts and components
        this.contexts = [];    // Array of context frame IDs
        this.components = [];  // Array of component frame IDs

        // Global ID (set when added to framework)
        this.count = null;
    }

    /**
     * Get the 4 corner points of this frame
     * Returns array of [x, y, z] coordinates
     */
    getCorners() {
        // Calculate local right and down vectors with roll angle
        // For a frame in XY plane:
        // - Start with right = (1, 0, 0) and up = (0, -1, 0)
        // - Rotate both by roll angle
        const halfSize = this.size / 2;
        const cos = Math.cos(this.roll);
        const sin = Math.sin(this.roll);

        // Right vector (horizontal): (1, 0) rotated by roll
        const rightX = cos * halfSize;
        const rightY = sin * halfSize;

        // Up vector (vertical): (0, -1) rotated by roll
        // Perpendicular to right, rotated 90° CCW from right
        const upX = -sin * halfSize;
        const upY = cos * halfSize;

        // Four corners: top-left, top-right, bottom-left, bottom-right
        return [
            // top-left = center - right + up
            [this.x - rightX + upX, this.y - rightY + upY, this.z],
            // top-right = center + right + up
            [this.x + rightX + upX, this.y + rightY + upY, this.z],
            // bottom-left = center - right - up
            [this.x - rightX - upX, this.y - rightY - upY, this.z],
            // bottom-right = center + right - up
            [this.x + rightX - upX, this.y + rightY - upY, this.z]
        ];
    }

    /**
     * Translate frame by delta amounts
     */
    translate(dx, dy, dz) {
        this.x += dx;
        this.y += dy;
        this.z += dz;
    }

    /**
     * Rotate frame around a point (typically cursor) along specified axis
     * @param {number} centerX - X coordinate of rotation center
     * @param {number} centerY - Y coordinate of rotation center
     * @param {number} centerZ - Z coordinate of rotation center
     * @param {number} angle - Rotation angle in radians (counter-clockwise)
     * @param {string} axis - Rotation axis: 'x', 'y', or 'z'
     */
    rotate(centerX, centerY, centerZ, angle, axis = 'z') {
        // Rotate position around pivot point
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const dz = this.z - centerZ;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        let newDx, newDy, newDz;

        switch (axis) {
            case 'x': // Rotate around X axis (YZ plane)
                newDx = dx;
                newDy = dy * cos - dz * sin;
                newDz = dy * sin + dz * cos;
                break;

            case 'y': // Rotate around Y axis (XZ plane)
                newDx = dx * cos + dz * sin;
                newDy = dy;
                newDz = -dx * sin + dz * cos;
                break;

            case 'z': // Rotate around Z axis (XY plane)
            default:
                newDx = dx * cos - dy * sin;
                newDy = dx * sin + dy * cos;
                newDz = dz;
                break;
        }

        // Translate back
        this.x = centerX + newDx;
        this.y = centerY + newDy;
        this.z = centerZ + newDz;

        // ALWAYS rotate the normal vector according to the rotation axis
        // The normal is a direction in 3D space and rotates with the frame
        const oldIhat = this.ihat;
        const oldJhat = this.jhat;
        const oldKhat = this.khat;

        switch (axis) {
            case 'x': // Rotating around X axis
                this.ihat = oldIhat;
                this.jhat = oldJhat * cos - oldKhat * sin;
                this.khat = oldJhat * sin + oldKhat * cos;
                break;

            case 'y': // Rotating around Y axis
                this.ihat = oldIhat * cos + oldKhat * sin;
                this.jhat = oldJhat;
                this.khat = -oldIhat * sin + oldKhat * cos;
                break;

            case 'z': // Rotating around Z axis
                this.ihat = oldIhat * cos - oldJhat * sin;
                this.jhat = oldIhat * sin + oldJhat * cos;
                this.khat = oldKhat;
                break;
        }

        // Additionally, update roll if rotating in the frame's own plane
        // This happens when the rotation axis is parallel to the frame's normal
        const rotatingInOwnPlane =
            (axis === 'z' && Math.abs(oldKhat) > 0.9) ||
            (axis === 'x' && Math.abs(oldIhat) > 0.9) ||
            (axis === 'y' && Math.abs(oldJhat) > 0.9);

        if (rotatingInOwnPlane) {
            // Frame is spinning in its own plane - update roll
            this.roll += angle;
        }

        console.log(`Rotated around ${axis}: normal (${oldIhat.toFixed(2)}, ${oldJhat.toFixed(2)}, ${oldKhat.toFixed(2)}) → (${this.ihat.toFixed(2)}, ${this.jhat.toFixed(2)}, ${this.khat.toFixed(2)}), in-plane=${rotatingInOwnPlane}, roll=${this.roll.toFixed(2)}`);
    }

    /**
     * Reflect frame horizontally around a point
     */
    reflectH(centerX, centerY) {
        const dx = this.x - centerX;
        this.x = centerX - dx;
    }

    /**
     * Reflect frame vertically around a point
     */
    reflectV(centerX, centerY) {
        const dy = this.y - centerY;
        this.y = centerY - dy;
    }

    /**
     * Duplicate this frame
     */
    duplicate() {
        const newFrame = new Frame(
            this.x, this.y, this.z,
            this.ihat, this.jhat, this.khat,
            this.size, this.color
        );
        newFrame.roll = this.roll;  // Copy rotation
        newFrame.called = this.called;
        newFrame.contents = this.contents;
        newFrame.selected = true;
        return newFrame;
    }
}

/**
 * Cursor - special frame representing the reference point
 */
class Cursor {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.visible = true;
    }

    translate(dx, dy, dz) {
        this.x += dx;
        this.y += dy;
        this.z += dz;
    }

    snapToOrigin() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }
}

/**
 * Framework - container for frames and state
 */
class Framework {
    constructor() {
        this.frames = [];
        this.cursor = new Cursor();
        this.frameCounter = 0;  // Global frame ID counter

        // State
        this.mode = 'normal';  // normal, translate, scale, etc.
        this.currentView = 1;  // 1=front (default), 2=right, etc.
        this.gridSize = 1;     // Translation step size

        // Command history
        this.commandHistory = [];
        this.actionHistory = [];
    }

    /**
     * Add a frame to the framework
     */
    addFrame(frame) {
        frame.count = this.frameCounter++;
        this.frames.push(frame);
        return frame;
    }

    /**
     * Get all selected frames
     */
    getSelectedFrames() {
        return this.frames.filter(f => f.selected);
    }

    /**
     * Deselect all frames
     */
    deselectAll() {
        this.frames.forEach(f => f.selected = false);
    }

    /**
     * Select all frames
     */
    selectAll() {
        this.frames.forEach(f => f.selected = true);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Frame, Cursor, Framework };
}
