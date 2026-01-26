// frameworks-core-v3.0.js
// Core data structures for Frameworks V3

/**
 * Frame class - represents a planar object in 3D space
 * Coordinates: 6D position + 9D orientation (x, y, z, right, up, normal)
 * - xyz: global position (center point)
 * - right/up/normal: orthonormal basis vectors defining frame's 3D orientation
 */
class Frame {
    constructor(x, y, z, ihat, jhat, khat, size = 1, color = '#ffffff') {
        // Position
        this.x = x;
        this.y = y;
        this.z = z;

        // Orientation: Orthonormal basis (3 perpendicular unit vectors)
        // Right vector (X-axis of frame, tangent)
        this.rightX = 1;
        this.rightY = 0;
        this.rightZ = 0;

        // Up vector (Y-axis of frame, bitangent)
        this.upX = 0;
        this.upY = 1;
        this.upZ = 0;

        // Normal vector (Z-axis of frame)
        this.ihat = ihat;
        this.jhat = jhat;
        this.khat = khat;

        // Initialize right/up vectors from normal using canonical basis
        this.reconstructBasisFromNormal();

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
     * Reconstruct right and up vectors from normal vector
     * Uses same algorithm as shader for consistency
     */
    reconstructBasisFromNormal() {
        // Normalize normal (should already be normalized, but just in case)
        const length = Math.sqrt(this.ihat * this.ihat + this.jhat * this.jhat + this.khat * this.khat);
        if (length > 0.0001) {
            this.ihat /= length;
            this.jhat /= length;
            this.khat /= length;
        }

        // Default frame is in XY plane with normal pointing in +Z
        // If normal is already (0, 0, 1), use identity basis
        const defaultThreshold = 0.001;
        if (Math.abs(this.ihat) < defaultThreshold &&
            Math.abs(this.jhat) < defaultThreshold &&
            Math.abs(this.khat - 1) < defaultThreshold) {
            this.rightX = 1;
            this.rightY = 0;
            this.rightZ = 0;
            this.upX = 0;
            this.upY = 1;
            this.upZ = 0;
            return;
        }

        // Use world +Y as reference "up" direction for consistency
        const worldUpX = 0, worldUpY = 1, worldUpZ = 0;

        // If normal is parallel to worldUp, use worldRight as reference instead
        const dotWithWorldUp = Math.abs(this.ihat * worldUpX + this.jhat * worldUpY + this.khat * worldUpZ);
        let refX, refY, refZ;

        if (dotWithWorldUp > 0.999) {
            // Use +X when normal is ±Y
            refX = 1;
            refY = 0;
            refZ = 0;
        } else {
            refX = worldUpX;
            refY = worldUpY;
            refZ = worldUpZ;
        }

        // Right (tangent) = cross(reference, normal)
        // This gives us a consistent "right" direction
        this.rightX = refY * this.khat - refZ * this.jhat;
        this.rightY = refZ * this.ihat - refX * this.khat;
        this.rightZ = refX * this.jhat - refY * this.ihat;

        // Normalize right vector
        const rightLen = Math.sqrt(this.rightX * this.rightX + this.rightY * this.rightY + this.rightZ * this.rightZ);
        if (rightLen > 0.0001) {
            this.rightX /= rightLen;
            this.rightY /= rightLen;
            this.rightZ /= rightLen;
        }

        // Up (bitangent) = cross(normal, right)
        // This is the frame's local "up" direction
        this.upX = this.jhat * this.rightZ - this.khat * this.rightY;
        this.upY = this.khat * this.rightX - this.ihat * this.rightZ;
        this.upZ = this.ihat * this.rightY - this.jhat * this.rightX;

        // Normalize up vector
        const upLen = Math.sqrt(this.upX * this.upX + this.upY * this.upY + this.upZ * this.upZ);
        if (upLen > 0.0001) {
            this.upX /= upLen;
            this.upY /= upLen;
            this.upZ /= upLen;
        }
    }

    /**
     * Get the 4 corner points of this frame
     * Returns array of [x, y, z] coordinates
     */
    getCorners() {
        // Use stored right and up vectors (already in 3D)
        const halfSize = this.size / 2;

        // Scale right and up vectors by halfSize
        const rightX = this.rightX * halfSize;
        const rightY = this.rightY * halfSize;
        const rightZ = this.rightZ * halfSize;

        const upX = this.upX * halfSize;
        const upY = this.upY * halfSize;
        const upZ = this.upZ * halfSize;

        // Four corners: top-left, top-right, bottom-left, bottom-right
        return [
            // top-left = center - right + up
            [this.x - rightX + upX, this.y - rightY + upY, this.z - rightZ + upZ],
            // top-right = center + right + up
            [this.x + rightX + upX, this.y + rightY + upY, this.z + rightZ + upZ],
            // bottom-left = center - right - up
            [this.x - rightX - upX, this.y - rightY - upY, this.z - rightZ - upZ],
            // bottom-right = center + right - up
            [this.x + rightX - upX, this.y + rightY - upY, this.z + rightZ - upZ]
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
     * Rotates both position and full orientation basis (right, up, normal vectors)
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

        // Update position
        this.x = centerX + newDx;
        this.y = centerY + newDy;
        this.z = centerZ + newDz;

        // Rotate all three basis vectors using same rotation matrix
        // Store old values
        const oldRightX = this.rightX, oldRightY = this.rightY, oldRightZ = this.rightZ;
        const oldUpX = this.upX, oldUpY = this.upY, oldUpZ = this.upZ;
        const oldNormalX = this.ihat, oldNormalY = this.jhat, oldNormalZ = this.khat;

        // Apply rotation to right vector
        switch (axis) {
            case 'x':
                this.rightX = oldRightX;
                this.rightY = oldRightY * cos - oldRightZ * sin;
                this.rightZ = oldRightY * sin + oldRightZ * cos;
                break;
            case 'y':
                this.rightX = oldRightX * cos + oldRightZ * sin;
                this.rightY = oldRightY;
                this.rightZ = -oldRightX * sin + oldRightZ * cos;
                break;
            case 'z':
                this.rightX = oldRightX * cos - oldRightY * sin;
                this.rightY = oldRightX * sin + oldRightY * cos;
                this.rightZ = oldRightZ;
                break;
        }

        // Apply rotation to up vector
        switch (axis) {
            case 'x':
                this.upX = oldUpX;
                this.upY = oldUpY * cos - oldUpZ * sin;
                this.upZ = oldUpY * sin + oldUpZ * cos;
                break;
            case 'y':
                this.upX = oldUpX * cos + oldUpZ * sin;
                this.upY = oldUpY;
                this.upZ = -oldUpX * sin + oldUpZ * cos;
                break;
            case 'z':
                this.upX = oldUpX * cos - oldUpY * sin;
                this.upY = oldUpX * sin + oldUpY * cos;
                this.upZ = oldUpZ;
                break;
        }

        // Apply rotation to normal vector
        switch (axis) {
            case 'x':
                this.ihat = oldNormalX;
                this.jhat = oldNormalY * cos - oldNormalZ * sin;
                this.khat = oldNormalY * sin + oldNormalZ * cos;
                break;
            case 'y':
                this.ihat = oldNormalX * cos + oldNormalZ * sin;
                this.jhat = oldNormalY;
                this.khat = -oldNormalX * sin + oldNormalZ * cos;
                break;
            case 'z':
                this.ihat = oldNormalX * cos - oldNormalY * sin;
                this.jhat = oldNormalX * sin + oldNormalY * cos;
                this.khat = oldNormalZ;
                break;
        }

        // Normalize all three vectors to prevent floating-point drift
        const rightLen = Math.sqrt(this.rightX * this.rightX + this.rightY * this.rightY + this.rightZ * this.rightZ);
        if (rightLen > 0.0001) {
            this.rightX /= rightLen;
            this.rightY /= rightLen;
            this.rightZ /= rightLen;
        }

        const upLen = Math.sqrt(this.upX * this.upX + this.upY * this.upY + this.upZ * this.upZ);
        if (upLen > 0.0001) {
            this.upX /= upLen;
            this.upY /= upLen;
            this.upZ /= upLen;
        }

        const normalLen = Math.sqrt(this.ihat * this.ihat + this.jhat * this.jhat + this.khat * this.khat);
        if (normalLen > 0.0001) {
            this.ihat /= normalLen;
            this.jhat /= normalLen;
            this.khat /= normalLen;
        }

        // console.log(`Rotated around ${axis} by ${(angle * 180 / Math.PI).toFixed(1)}°`);
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

        // Copy full orientation basis
        newFrame.rightX = this.rightX;
        newFrame.rightY = this.rightY;
        newFrame.rightZ = this.rightZ;
        newFrame.upX = this.upX;
        newFrame.upY = this.upY;
        newFrame.upZ = this.upZ;
        // Normal is already copied via constructor

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

        // Command history (legacy - kept for backwards compatibility)
        this.commandHistory = [];
        this.actionHistory = [];
    }

    /**
     * Clear all frames and reset state
     * Used when reconstructing from command history or starting fresh
     */
    clear() {
        this.frames = [];
        this.cursor = new Cursor();
        this.frameCounter = 0;
        this.mode = 'normal';
        this.currentView = 1;
        this.commandHistory = [];
        this.actionHistory = [];
        // console.log('Framework cleared');
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

    /**
     * Get bounding box of all frames
     * Returns { minX, maxX, minY, maxY, minZ, maxZ, centerX, centerY, centerZ }
     * For now, uses simple approximation: position ± size/2
     * TODO: Add proper orientation-based bounding box calculation
     */
    getBoundingBox() {
        if (this.frames.length === 0) {
            return {
                minX: 0, maxX: 0,
                minY: 0, maxY: 0,
                minZ: 0, maxZ: 0,
                centerX: 0, centerY: 0, centerZ: 0
            };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        this.frames.forEach(frame => {
            const halfSize = frame.size / 2;

            // Simple approximation: treat each frame as a cube
            minX = Math.min(minX, frame.x - halfSize);
            maxX = Math.max(maxX, frame.x + halfSize);
            minY = Math.min(minY, frame.y - halfSize);
            maxY = Math.max(maxY, frame.y + halfSize);
            minZ = Math.min(minZ, frame.z - halfSize);
            maxZ = Math.max(maxZ, frame.z + halfSize);
        });

        return {
            minX, maxX,
            minY, maxY,
            minZ, maxZ,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            centerZ: (minZ + maxZ) / 2
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Frame, Cursor, Framework };
}
