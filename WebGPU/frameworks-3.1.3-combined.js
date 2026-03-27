// === core.js ===
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


// === palette.js ===
// frameworks-palette-v3.0.js
// Color palettes for Frameworks V3

/**
 * Color palettes
 * Each palette is an array of hex color strings
 */
const PALETTES = {
    // Palette 0: EightyColors (from Checks - VisualizeValue)
    // 80 colors in gradient arrangement, displayed as 8x10 grid
    eightyColors: [
        '#E84AA9', '#F2399D', '#DB2F96', '#E73E85', '#FF7F8E', '#FA5B67', '#E8424E', '#D5332F',
        '#C23532', '#F2281C', '#D41515', '#9D262F', '#DE3237', '#DA3321', '#EA3A2D', '#EB4429',
        '#EC7368', '#FF8079', '#FF9193', '#EA5B33', '#D05C35', '#ED7C30', '#EF9933', '#EF8C37',
        '#F18930', '#F09837', '#F9A45C', '#F2A43A', '#F2A840', '#F2A93C', '#FFB340', '#F2B341',
        '#FAD064', '#F7CA57', '#F6CB45', '#FFAB00', '#F4C44A', '#FCDE5B', '#F9DA4D', '#F9DA4A',
        '#FAE272', '#F9DB49', '#FAE663', '#FBEA5B', '#A7CA45', '#B5F13B', '#94E337', '#63C23C',
        '#86E48E', '#77E39F', '#5FCD8C', '#83F1AE', '#9DEFBF', '#2E9D9A', '#3EB8A1', '#5FC9BF',
        '#77D3DE', '#6AD1DE', '#5ABAD3', '#4291A8', '#33758D', '#45B2D3', '#81D1EC', '#A7DDF9',
        '#9AD9FB', '#A4C8EE', '#60B1F4', '#2480BD', '#4576D0', '#3263D0', '#2E4985', '#25438C',
        '#525EAA', '#3D43B3', '#322F92', '#4A2387', '#371471', '#3B088C', '#6C31D7', '#9741DA'
    ],

    // Palette 1: Checks (vibrant colors from V2)
    checks: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
        '#E76F51', '#2A9D8F', '#E9C46A', '#F4A261', '#E63946',
        '#A8DADC', '#457B9D', '#1D3557', '#F1FAEE', '#E07A5F'
    ],

    // Palette 2: Flexoki (from V2)
    flexoki: [
        '#D4C5B9', '#E4DDD3', '#F4F0E8', '#FFFCF0',
        '#CECDC3', '#E5E4DD', '#F2F0E5', '#FFFEF8',
        '#403E3A', '#575653', '#6F6E69', '#878580',
        '#B7B5AC', '#D8D5C9', '#F4F0E8', '#FFFCF0'
    ],

    // Palette 3: Grayscale
    grayscale: [
        '#000000', '#1A1A1A', '#333333', '#4D4D4D',
        '#666666', '#808080', '#999999', '#B3B3B3',
        '#CCCCCC', '#E6E6E6', '#F2F2F2', '#FFFFFF'
    ],

    // Palette 4: Warm
    warm: [
        '#FF0000', '#FF4500', '#FF6347', '#FF7F50',
        '#FFA500', '#FFD700', '#FFFF00', '#ADFF2F',
        '#7FFF00', '#00FF00', '#00FA9A', '#00CED1'
    ]
};

/**
 * Palette manager
 */
class PaletteManager {
    constructor(paletteName = 'eightyColors') {
        this.currentPalette = PALETTES[paletteName] || PALETTES.eightyColors;
        this.currentIndex = 0;
        this.paletteName = paletteName;
    }

    /**
     * Get current color
     */
    getCurrentColor() {
        return this.currentPalette[this.currentIndex];
    }

    /**
     * Get next color in palette
     */
    getNextColor() {
        this.currentIndex = (this.currentIndex + 1) % this.currentPalette.length;
        return this.getCurrentColor();
    }

    /**
     * Get random color from palette
     */
    getRandomColor() {
        const index = Math.floor(Math.random() * this.currentPalette.length);
        return this.currentPalette[index];
    }

    /**
     * Get color at specific index
     */
    getColorAtIndex(index) {
        return this.currentPalette[index % this.currentPalette.length];
    }

    /**
     * Shift color by n positions
     */
    shiftColor(n) {
        this.currentIndex = (this.currentIndex + n + this.currentPalette.length) % this.currentPalette.length;
        return this.getCurrentColor();
    }

    /**
     * Set palette by name
     */
    setPalette(paletteName) {
        if (PALETTES[paletteName]) {
            this.currentPalette = PALETTES[paletteName];
            this.currentIndex = 0;
        }
    }

    /**
     * Get all palette names
     */
    getPaletteNames() {
        return Object.keys(PALETTES);
    }

    /**
     * Reset palette index to start
     */
    reset() {
        this.currentIndex = 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PALETTES, PaletteManager };
}


// === context-color.js ===
// context-color.js
// Color palette context for Frameworks V3
// 1D array with implicit 2D layout (8 columns × 10 rows)

class ColorContext {
    constructor(framework, paletteManager) {
        this.framework = framework;
        this.palette = paletteManager;
        this.active = false;

        // Color array configuration
        this.colors = this.palette.currentPalette;
        this.numColors = this.colors.length;
        this.cols = 8;  // 8 colors per row
        this.rows = Math.ceil(this.numColors / this.cols);  // 10 rows for 80 colors

        // Current position in 1D array
        this.currentIndex = 0;
        this.startingIndex = 0;  // Track where we started for shift calculation
    }

    /**
     * Enter color context
     * Initialize position based on selected frames' colors
     */
    enter() {
        this.active = true;

        // Find current color in palette
        const selected = this.framework.getSelectedFrames();
        if (selected.length > 0) {
            // Use first selected frame's color (normalize to uppercase)
            const targetColor = selected[0].color.toUpperCase();
            const colorIndex = this.colors.findIndex(c => c.toUpperCase() === targetColor);

            if (colorIndex >= 0) {
                this.currentIndex = colorIndex;
                // console.log('Found frame color at index', colorIndex, targetColor);
            } else {
                // console.log('Frame color not found in palette:', targetColor);
            }
        }

        // Save starting position for calculating shift
        this.startingIndex = this.currentIndex;

        // console.log('Entered color context at index', this.currentIndex);
    }

    /**
     * Exit color context
     */
    exit() {
        this.active = false;
        // console.log('Exited color context');
    }

    /**
     * Navigate in color space with ijkl
     * 1D array with implicit 2D layout:
     * - l: +1 (right, wraps)
     * - j: -1 (left, wraps)
     * - k: +8 (down, wraps)
     * - i: -8 (up, wraps)
     */
    navigate(key) {
        let oldIndex = this.currentIndex;

        switch (key) {
            case 'l': // Right (+1)
                this.currentIndex = (this.currentIndex + 1) % this.numColors;
                break;

            case 'j': // Left (-1)
                this.currentIndex = (this.currentIndex - 1 + this.numColors) % this.numColors;
                break;

            case 'k': // Down (+8)
                this.currentIndex = (this.currentIndex + this.cols) % this.numColors;
                break;

            case 'i': // Up (-8)
                this.currentIndex = (this.currentIndex - this.cols + this.numColors) % this.numColors;
                break;

            default:
                return false;
        }

        // console.log('Color navigation:', key, 'from', oldIndex, 'to', this.currentIndex);
        return true;
    }

    /**
     * Get current color
     */
    getCurrentColor() {
        return this.colors[this.currentIndex];
    }

    /**
     * Get 2D position from 1D index (for rendering)
     */
    getGridPosition(index = this.currentIndex) {
        return {
            row: Math.floor(index / this.cols),
            col: index % this.cols
        };
    }

    /**
     * Apply current color to selected frames
     * If multiple frames selected, shift all by the same amount
     */
    apply() {
        const selected = this.framework.getSelectedFrames();

        if (selected.length > 0) {
            // Calculate shift amount from starting position
            const shift = this.currentIndex - this.startingIndex;

            // Apply shift to all selected frames
            selected.forEach(frame => {
                // Find current color index in palette
                const frameColor = frame.color.toUpperCase();
                const currentColorIndex = this.colors.findIndex(c => c.toUpperCase() === frameColor);

                if (currentColorIndex >= 0) {
                    // Apply shift with wrapping
                    const newIndex = (currentColorIndex + shift + this.numColors) % this.numColors;
                    frame.color = this.colors[newIndex];
                } else {
                    // If color not in palette, just use current color
                    frame.color = this.getCurrentColor();
                }
            });

            // console.log('Shifted', selected.length, 'frames by', shift, 'color positions');
        } else {
            // Update palette index for next frame creation
            this.palette.currentIndex = this.currentIndex;
            // console.log('Set palette index to', this.currentIndex);
        }
    }

    /**
     * Get indices of colors used by selected frames
     */
    getSelectedFrameColorIndices() {
        const selected = this.framework.getSelectedFrames();
        const indices = new Set();

        selected.forEach(frame => {
            // Normalize both frame color and palette colors for comparison
            const frameColor = frame.color.toUpperCase();
            const index = this.colors.findIndex(c => c.toUpperCase() === frameColor);
            if (index >= 0) {
                indices.add(index);
            }
        });

        return Array.from(indices);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ColorContext };
}


// === context-camera.js ===
// context-camera.js
// Camera context for Frameworks V3
// Handles view snapping, zoom, FOV, and projection mode

class CameraContext {
    constructor(framework, renderer) {
        this.framework = framework;
        this.renderer = renderer;
        this.active = false;

        // Camera state
        this.currentView = 0; // 0=spatial, 1-6=cardinal, 7=isometric, 9=auto-orbit
        this.orthographic = false; // Toggle for ortho/perspective
        this.autoOrbit = false; // Auto-orbit mode
        this.autoOrbitAngle = 0; // Current angle for auto-orbit

        // Orbit rotation velocities (for v8 mode)
        this.orbitVelocityTheta = 0; // Longitude rotation speed (radians/sec)
        this.orbitVelocityPhi = 0;   // Latitude rotation speed (radians/sec)
        this.orbitTheta = 0;          // Current longitude angle
        this.orbitPhi = Math.PI / 4;  // Current latitude angle

        // Zoom settings
        this.zoomLevel = 50; // Distance from origin
        this.zoomStep = 5; // Normal zoom step
        this.zoomStepLarge = 10; // 2x zoom step
        this.minZoom = 5;
        this.maxZoom = 500;

        // FOV settings
        this.fov = 75; // Default FOV in degrees
        this.fovStep = 5;
        this.fovStepLarge = 10; // Shift for 2x FOV step
        this.minFov = 10;
        this.maxFov = 120;
    }

    /**
     * Enter camera context
     */
    enter() {
        this.active = true;
        // console.log('Entered camera context');
    }

    /**
     * Exit camera context
     */
    exit() {
        this.active = false;
        // console.log('Exited camera context');
    }

    /**
     * Navigate with number keys (view selection)
     * 0 = spatial, 1-6 = cardinal, 7 = isometric, 8 = auto-orbit, 9 = toggle ortho
     */
    selectView(viewNum) {
        switch(viewNum) {
            case 0: // Spatial view (free orbit)
                this.currentView = 0;
                this.autoOrbit = false;
                this.renderer.setCameraView(0, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 1: // Front
            case 2: // Right
            case 3: // Back
            case 4: // Left
            case 5: // Top
            case 6: // Bottom
                this.currentView = viewNum;
                this.autoOrbit = false;
                this.renderer.setCameraView(viewNum, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 7: // Isometric
                this.currentView = 7;
                this.autoOrbit = false;
                this.renderer.setCameraView(7, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 8: // Auto-orbit mode (smooth rotation with IJKL control)
                this.currentView = 8;
                this.autoOrbit = true;

                // Initialize from current camera position
                const currentPos = this.renderer.getCurrentCameraSpherical();
                this.orbitTheta = currentPos.theta;
                this.orbitPhi = currentPos.phi;
                this.zoomLevel = currentPos.radius;

                this.orbitVelocityTheta = 0;  // Reset rotation velocities
                this.orbitVelocityPhi = 0;
                this.renderer.setCameraView(8, this.orthographic, this.zoomLevel, this.fov);
                // Camera is already at current position, no need to set initial position
                // console.log('Auto-orbit mode activated from current position');
                break;

            case 9: // Toggle orthographic/perspective
                this.orthographic = !this.orthographic;
                // console.log('Projection:', this.orthographic ? 'orthographic' : 'perspective');
                this.renderer.setCameraView(this.currentView, this.orthographic, this.zoomLevel, this.fov);
                break;
        }

        // console.log('Camera view:', viewNum);
    }

    /**
     * Navigate with ijkl
     * In auto-orbit mode (v8): IJKL controls rotation velocity (smooth rotation)
     * Otherwise: zoom (i/k) and FOV (j/l)
     */
    navigate(key, shift = false) {
        // Auto-orbit mode: control rotation velocity
        if (this.currentView === 8 && this.autoOrbit) {
            const rotationSpeed = 0.5; // radians per second

            switch(key) {
                case 'J': // Rotate left (longitude) - uppercase
                    this.orbitVelocityTheta = -rotationSpeed;
                    return true;

                case 'L': // Rotate right (longitude) - uppercase
                    this.orbitVelocityTheta = rotationSpeed;
                    return true;

                case 'I': // Rotate up (latitude) - uppercase
                    this.orbitVelocityPhi = -rotationSpeed;
                    return true;

                case 'K': // Rotate down (latitude) - uppercase
                    this.orbitVelocityPhi = rotationSpeed;
                    return true;

                // Lowercase stops rotation in that axis
                case 'j':
                case 'l':
                    this.orbitVelocityTheta = 0;
                    return true;

                case 'i':
                case 'k':
                    this.orbitVelocityPhi = 0;
                    return true;
            }
            return false;
        }

        // Default behavior: zoom and FOV
        switch(key) {
            case 'i': // Zoom in
                const zoomInStep = shift ? this.zoomStepLarge : this.zoomStep;
                this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - zoomInStep);
                this.renderer.setCameraZoom(this.zoomLevel);
                // console.log('Zoom in:', this.zoomLevel);
                return true;

            case 'k': // Zoom out
                const zoomOutStep = shift ? this.zoomStepLarge : this.zoomStep;
                this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + zoomOutStep);
                this.renderer.setCameraZoom(this.zoomLevel);
                // console.log('Zoom out:', this.zoomLevel);
                return true;

            case 'j': // Widen FOV
                const widenStep = shift ? this.fovStepLarge : this.fovStep;
                this.fov = Math.min(this.maxFov, this.fov + widenStep);
                this.renderer.setCameraFOV(this.fov);
                // console.log('FOV:', this.fov, shift ? '(+10°)' : '(+5°)');
                return true;

            case 'l': // Narrow FOV
                const narrowStep = shift ? this.fovStepLarge : this.fovStep;
                this.fov = Math.max(this.minFov, this.fov - narrowStep);
                this.renderer.setCameraFOV(this.fov);
                // console.log('FOV:', this.fov, shift ? '(-10°)' : '(-5°)');
                return true;
        }
        return false;
    }

    /**
     * Update auto-orbit (called from animation loop)
     * In v8 mode, applies smooth rotation based on IJKL velocity controls
     */
    updateAutoOrbit(deltaTime) {
        if (!this.autoOrbit) return;

        // In v8 mode, apply velocity-based smooth rotation
        if (this.currentView === 8) {
            // Update angles based on velocities
            this.orbitTheta += this.orbitVelocityTheta * deltaTime;
            this.orbitPhi += this.orbitVelocityPhi * deltaTime;

            // No clamping or wrapping - phi can continue indefinitely
            // The spherical-to-cartesian conversion naturally handles continuous rotation
            // When phi > PI, the camera goes over the pole and continues on the other side

            // Update camera position
            this.renderer.setManualOrbitPosition(this.orbitTheta, this.orbitPhi, this.zoomLevel);
            return;
        }

        // Automatic rotation for other auto-orbit scenarios (if any)
        this.autoOrbitAngle += deltaTime * 0.5; // 0.5 radians per second
        this.renderer.setAutoOrbitAngle(this.autoOrbitAngle, this.zoomLevel);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CameraContext };
}


// === context-selection.js ===
// context-selection.js
// Frame selection context for Frameworks V3
// Bracket notation: [123], [1,5,9], [10:20], [1:5,10,15:20]

class FrameSelectionContext {
    constructor(framework) {
        this.framework = framework;
        this.active = false;
        this.bracketInputActive = false;
        this.bracketInput = '';
    }

    /**
     * Enter selection context
     */
    enter() {
        this.active = true;
        // console.log('Entered frame selection context');
    }

    /**
     * Exit selection context
     */
    exit() {
        this.active = false;
        this.bracketInputActive = false;
        this.bracketInput = '';
        // console.log('Exited frame selection context');
    }

    /**
     * Open bracket input mode
     */
    openBracketInput() {
        this.bracketInputActive = true;
        this.bracketInput = '';
        // console.log('Bracket input mode opened');
    }

    /**
     * Close bracket input and apply selection
     */
    closeBracketInput() {
        if (this.bracketInput.length > 0) {
            this.parseAndApplyBracketNotation(this.bracketInput);
        }
        this.bracketInputActive = false;
        this.bracketInput = '';
        // console.log('Bracket input mode closed');
    }

    /**
     * Parse bracket notation and apply selection
     * Examples: "123", "1,5,9", "10:20", "1:5,10,15:20"
     */
    parseAndApplyBracketNotation(input) {
        const fw = this.framework;
        const frameIndices = new Set();

        // Split by comma for multiple selections
        const parts = input.split(',');

        parts.forEach(part => {
            part = part.trim();

            if (part.includes(':')) {
                // Range notation: "10:20"
                const [startStr, endStr] = part.split(':');
                const start = parseInt(startStr.trim());
                const end = parseInt(endStr.trim());

                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                        frameIndices.add(i);
                    }
                }
            } else {
                // Single frame: "123"
                const frameCount = parseInt(part);
                if (!isNaN(frameCount)) {
                    frameIndices.add(frameCount);
                }
            }
        });

        // Apply selection
        fw.deselectAll();
        fw.frames.forEach(frame => {
            if (frameIndices.has(frame.count)) {
                frame.selected = true;
            }
        });

        // console.log('Selected frames:', Array.from(frameIndices).sort((a, b) => a - b).join(', '));
    }

    /**
     * Get current selection bounds (min and max frame count)
     */
    getSelectionBounds() {
        const selected = this.framework.getSelectedFrames();
        if (selected.length === 0) {
            return { min: null, max: null, count: 0 };
        }

        const counts = selected.map(f => f.count).sort((a, b) => a - b);
        return {
            min: counts[0],
            max: counts[counts.length - 1],
            count: selected.length
        };
    }

    /**
     * Expand selection downward (include previous frame by count with wraparound)
     */
    expandDown() {
        const fw = this.framework;
        const bounds = this.getSelectionBounds();

        if (bounds.min === null) {
            // No selection - select lowest frame
            const minFrame = fw.frames.reduce((min, f) => f.count < min.count ? f : min, fw.frames[0]);
            if (minFrame) minFrame.selected = true;
        } else {
            const minFrameCount = Math.min(...fw.frames.map(f => f.count));
            const maxFrameCount = Math.max(...fw.frames.map(f => f.count));

            // Try to expand down by 1
            let targetCount = bounds.min - 1;

            // If we go below the minimum, wrap to the maximum
            if (targetCount < minFrameCount) {
                targetCount = maxFrameCount;
            }

            const nextFrame = fw.frames.find(f => f.count === targetCount);
            if (nextFrame) {
                nextFrame.selected = true;
                // console.log('Expanded down to frame', nextFrame.count);
            }
        }
    }

    /**
     * Expand selection upward (include next frame by count with wraparound)
     */
    expandUp() {
        const fw = this.framework;
        const bounds = this.getSelectionBounds();

        if (bounds.max === null) {
            // No selection - select lowest frame
            const minFrame = fw.frames.reduce((min, f) => f.count < min.count ? f : min, fw.frames[0]);
            if (minFrame) minFrame.selected = true;
        } else {
            const minFrameCount = Math.min(...fw.frames.map(f => f.count));
            const maxFrameCount = Math.max(...fw.frames.map(f => f.count));

            // Try to expand up by 1
            let targetCount = bounds.max + 1;

            // If we go above the maximum, wrap to the minimum
            if (targetCount > maxFrameCount) {
                targetCount = minFrameCount;
            }

            const nextFrame = fw.frames.find(f => f.count === targetCount);
            if (nextFrame) {
                nextFrame.selected = true;
                // console.log('Expanded up to frame', nextFrame.count);
            }
        }
    }

    /**
     * Contract lower bound (remove frame with lowest count)
     */
    contractLower() {
        const fw = this.framework;
        const bounds = this.getSelectionBounds();

        if (bounds.min !== null) {
            const minFrame = fw.frames.find(f => f.count === bounds.min && f.selected);
            if (minFrame) {
                minFrame.selected = false;
                // console.log('Contracted lower bound, removed frame', minFrame.count);
            }
        }
    }

    /**
     * Contract upper bound (remove frame with highest count)
     */
    contractUpper() {
        const fw = this.framework;
        const bounds = this.getSelectionBounds();

        if (bounds.max !== null) {
            const maxFrame = fw.frames.find(f => f.count === bounds.max && f.selected);
            if (maxFrame) {
                maxFrame.selected = false;
                // console.log('Contracted upper bound, removed frame', maxFrame.count);
            }
        }
    }

    /**
     * Shift entire selection down (select previous N frames with wraparound)
     */
    shiftDown() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();
        if (selected.length === 0 || fw.frames.length === 0) return;

        const counts = selected.map(f => f.count);
        const minFrameCount = Math.min(...fw.frames.map(f => f.count));
        const maxFrameCount = Math.max(...fw.frames.map(f => f.count));
        const range = maxFrameCount - minFrameCount + 1;

        fw.deselectAll();
        counts.forEach(count => {
            // Shift down with modulo wraparound
            let newCount = count - 1;
            if (newCount < minFrameCount) {
                // Wrap around to the end
                newCount = maxFrameCount - (minFrameCount - newCount - 1);
            }

            const frame = fw.frames.find(f => f.count === newCount);
            if (frame) frame.selected = true;
        });

        // console.log('Shifted selection down (with wraparound)');
    }

    /**
     * Shift entire selection up (select next N frames with wraparound)
     */
    shiftUp() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();
        if (selected.length === 0 || fw.frames.length === 0) return;

        const counts = selected.map(f => f.count);
        const minFrameCount = Math.min(...fw.frames.map(f => f.count));
        const maxFrameCount = Math.max(...fw.frames.map(f => f.count));
        const range = maxFrameCount - minFrameCount + 1;

        fw.deselectAll();
        counts.forEach(count => {
            // Shift up with modulo wraparound
            let newCount = count + 1;
            if (newCount > maxFrameCount) {
                // Wrap around to the beginning
                newCount = minFrameCount + (newCount - maxFrameCount - 1);
            }

            const frame = fw.frames.find(f => f.count === newCount);
            if (frame) frame.selected = true;
        });

        // console.log('Shifted selection up (with wraparound)');
    }

    /**
     * Select all frames of the same color as currently selected
     */
    selectAllSameColor() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) return;

        const targetColor = selected[0].color;
        fw.frames.forEach(frame => {
            if (frame.color === targetColor) {
                frame.selected = true;
            }
        });

        // console.log('Selected all frames with color', targetColor);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrameSelectionContext };
}


// === command-tree.js ===
// command-tree.js
// 2D navigable command history system for undo/redo/fork/replay

/**
 * CommandTree manages a 2D array of command histories
 * - Horizontal (j/l): Navigate backward/forward in current branch
 * - Vertical (i/k): Navigate between different forked branches
 * - New commands at non-head positions create forks (new rows)
 */
class CommandTree {
    constructor() {
        // 2D array: each row is a branch, each element is a command character
        this.branches = [[]];  // Start with one empty branch

        // Current position in the tree
        this.currentRow = 0;      // Which branch we're on
        this.currentCol = -1;     // Position in that branch (-1 = before first command)

        // Mode tracking
        this.inCommandContext = false;
    }

    /**
     * Add a command to the current position
     * If we're not at the head of the current branch, this creates a fork
     */
    addCommand(char) {
        const currentBranch = this.branches[this.currentRow];
        const atHead = (this.currentCol === currentBranch.length - 1);

        if (atHead || currentBranch.length === 0) {
            // We're at the head of the current branch - just append
            currentBranch.push(char);
            this.currentCol++;
        } else {
            // We're in the middle of a branch - create a fork
            this.createFork(char);
        }
    }

    /**
     * Create a new fork from the current position
     * Copies all commands up to current position, then adds the new command
     * New branch goes BELOW, pushing current branch UP in the display
     */
    createFork(char) {
        const sourceBranch = this.branches[this.currentRow];

        // Copy commands from start up to and including current position
        const newBranch = sourceBranch.slice(0, this.currentCol + 1);

        // Add the new command
        newBranch.push(char);

        // Insert new branch BELOW current branch (higher index = lower in display)
        this.branches.splice(this.currentRow + 1, 0, newBranch);

        // Move to the new branch at the new command position
        this.currentRow++;
        this.currentCol = newBranch.length - 1;

        // console.log(`Created fork at row ${this.currentRow}, column ${this.currentCol}`);
    }

    /**
     * Navigate backward in current branch (undo direction)
     * Returns false if already at the start
     */
    moveBack() {
        if (this.currentCol > -1) {
            this.currentCol--;
            // console.log(`Moved back to position ${this.currentCol} in branch ${this.currentRow}`);
            return true;
        }
        // console.log('Already at start of branch');
        return false;
    }

    /**
     * Navigate forward in current branch (redo direction)
     * Returns false if already at the end
     */
    moveForward() {
        const currentBranch = this.branches[this.currentRow];
        if (this.currentCol < currentBranch.length - 1) {
            this.currentCol++;
            // console.log(`Moved forward to position ${this.currentCol} in branch ${this.currentRow}`);
            return true;
        }
        // console.log('Already at end of branch');
        return false;
    }

    /**
     * Navigate to an older branch (up in the UI)
     * Returns false if already at the first branch
     */
    moveUp() {
        if (this.currentRow > 0) {
            this.currentRow--;
            // Clamp column to valid range in new branch
            const newBranch = this.branches[this.currentRow];
            this.currentCol = Math.min(this.currentCol, newBranch.length - 1);
            // console.log(`Moved up to branch ${this.currentRow}, position ${this.currentCol}`);
            return true;
        }
        // console.log('Already at first branch');
        return false;
    }

    /**
     * Navigate to a newer branch (down in the UI)
     * Returns false if already at the last branch
     */
    moveDown() {
        if (this.currentRow < this.branches.length - 1) {
            this.currentRow++;
            // Clamp column to valid range in new branch
            const newBranch = this.branches[this.currentRow];
            this.currentCol = Math.min(this.currentCol, newBranch.length - 1);
            // console.log(`Moved down to branch ${this.currentRow}, position ${this.currentCol}`);
            return true;
        }
        // console.log('Already at last branch');
        return false;
    }

    /**
     * Get the current command sequence (from start to current position)
     * This is what should be replayed to reconstruct the current state
     */
    getCurrentCommandSequence() {
        const currentBranch = this.branches[this.currentRow];
        return currentBranch.slice(0, this.currentCol + 1);
    }

    /**
     * Get the full current branch (for display purposes)
     */
    getCurrentBranch() {
        return this.branches[this.currentRow];
    }

    /**
     * Get all branches (for display purposes)
     */
    getAllBranches() {
        return this.branches;
    }

    /**
     * Get current position info
     */
    getPosition() {
        return {
            row: this.currentRow,
            col: this.currentCol,
            totalRows: this.branches.length,
            totalCols: this.branches[this.currentRow].length
        };
    }

    /**
     * Check if the next command in the current branch matches the given character
     * Used to detect if we should fork or continue
     */
    peekNextCommand() {
        const currentBranch = this.branches[this.currentRow];
        const nextCol = this.currentCol + 1;

        if (nextCol < currentBranch.length) {
            return currentBranch[nextCol];
        }
        return null;  // At the end of the branch
    }

    /**
     * Toggle command context mode
     */
    toggleCommandContext() {
        this.inCommandContext = !this.inCommandContext;
        // console.log('Command context:', this.inCommandContext ? 'ACTIVE' : 'INACTIVE');
        return this.inCommandContext;
    }

    /**
     * Enter command context mode explicitly
     */
    enterCommandContext() {
        this.inCommandContext = true;
        // console.log('Entered command context mode');
    }

    /**
     * Exit command context mode explicitly
     */
    exitCommandContext() {
        this.inCommandContext = false;
        // console.log('Exited command context mode');
    }

    /**
     * Format the tree for display
     * Returns an array of strings showing each branch with position indicator
     */
    formatForDisplay() {
        return this.branches.map((branch, rowIdx) => {
            let display = `Row ${rowIdx}: `;

            branch.forEach((cmd, colIdx) => {
                if (rowIdx === this.currentRow && colIdx === this.currentCol) {
                    display += `[${cmd}] `;  // Current position
                } else {
                    display += `${cmd} `;
                }
            });

            // Show position marker if we're at this row
            if (rowIdx === this.currentRow) {
                display += ' ← YOU ARE HERE';
            }

            return display;
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommandTree };
}


// === commands.js ===
// frameworks-commands-v3.0.js
// Command parser and executor for Frameworks V3

/**
 * Command executor
 * Handles keyboard input and modifies framework state
 */
class CommandExecutor {
    constructor(framework, paletteManager, renderer = null, commandTree = null, colorContext = null, cameraContext = null, selectionContext = null) {
        this.framework = framework;
        this.palette = paletteManager;
        this.renderer = renderer; // Optional: for view switching
        this.commandTree = commandTree; // Optional: for command tree navigation
        this.colorContext = colorContext; // Optional: for color context navigation
        this.cameraContext = cameraContext; // Optional: for camera context navigation
        this.selectionContext = selectionContext; // Optional: for frame selection context
        this.lastCommand = '';
        this.cornerIndex = 0; // Current corner position (0-7)
        this.uiVisible = true; // Track UI visibility state

        // Animation state
        this.animationActive = false; // Whether animation is running
        this.animationDirection = null; // Direction: 'i', 'j', 'k', 'l'
        this.animationInterval = 500; // Time between color shifts in ms (30/60s = 0.5s)
        this.animationTimer = 0; // Accumulator for time
        this.animationStep = 1000/60; // Step size for speed adjustment (1/60s in ms)
        this.animationMinInterval = 1000/60; // Fastest: 1/60s
        this.animationMaxInterval = 50*1000/60; // Slowest: 50/60s
    }

    /**
     * Execute a single-character command
     */
    executeKey(key, shift = false) {
        const fw = this.framework;
        // console.log('executeKey called - key:', key, 'shift:', shift, 'mode:', fw.mode);

        // If camera context is enabled and active
        if (this.cameraContext && this.cameraContext.active) {
            return this.handleCameraContextNavigation(key, shift);
        }

        // If color context is enabled and active
        if (this.colorContext && this.colorContext.active) {
            return this.handleColorContextNavigation(key);
        }

        // If selection context is enabled and active
        if (this.selectionContext && this.selectionContext.active) {
            return this.handleSelectionContextNavigation(key, shift);
        }

        // If command tree is enabled and we're in command context mode
        if (this.commandTree && this.commandTree.inCommandContext) {
            return this.handleCommandContextNavigation(key);
        }

        // Mode-dependent commands (ijkl)
        if (fw.mode === 'animation') {
            // console.log('Animation mode - key:', key, 'shift:', shift);
            // If in animation mode, check if key is ijkl or JL (speed control)
            if (['i', 'j', 'k', 'l'].includes(key.toLowerCase())) {
                // Check if shift is pressed for speed control
                if ((key === 'J' || (key === 'j' && shift))) {
                    // console.log('Speed up detected!');
                    return this.handleAnimationSpeedUp();
                } else if ((key === 'L' || (key === 'l' && shift))) {
                    // console.log('Slow down detected!');
                    return this.handleAnimationSlowDown();
                } else {
                    // Regular direction keys (no shift)
                    // console.log('Direction key:', key.toLowerCase());
                    return this.handleAnimationDirection(key.toLowerCase());
                }
            }
            // Any other key exits animation mode and executes normally
            fw.mode = 'normal';
            // console.log('Exiting animation mode');
        } else if (fw.mode === 'translate') {
            // If in translate mode, check if key is ijkl
            if (['i', 'j', 'k', 'l'].includes(key)) {
                return this.handleTranslate(key);
            }
            // Any other key exits translate mode and executes normally
            fw.mode = 'normal';
            // console.log('Exiting translate mode');
        } else if (fw.mode === 'translateCursor') {
            // If in translate cursor mode, check if key is ijkl
            if (['i', 'j', 'k', 'l'].includes(key)) {
                return this.handleTranslateCursor(key);
            }
            // Any other key exits translate cursor mode and executes normally
            fw.mode = 'normal';
            // console.log('Exiting translate cursor mode');
        } else if (fw.mode === 'scale') {
            // If in scale mode, check if key is ik
            if (['i', 'k'].includes(key)) {
                return this.handleScale(key);
            }
            // Any other key exits scale mode and executes normally
            fw.mode = 'normal';
            // console.log('Exiting scale mode');
        } else if (fw.mode === 'scaleSelection') {
            // If in scale selection mode, check if key is ik
            if (['i', 'k'].includes(key)) {
                return this.handleScaleSelection(key);
            }
            // Any other key exits scale selection mode and executes normally
            fw.mode = 'normal';
            // console.log('Exiting scale selection mode');
        }

        // Normal mode commands
        switch (key) {
            // Frame creation
            case 'f':
                this.createFrame();
                break;

            // Duplication
            case 'd':
            case 'D':
                this.duplicateSelected();
                break;

            // Translation modes
            case 't':
                fw.mode = 'translate';
                // console.log('Translate mode (frames)');
                break;
            case 'T':
                fw.mode = 'translateCursor';
                // console.log('Translate mode (cursor)');
                break;

            // Scale modes
            case 's':
                fw.mode = 'scale';
                // console.log('Scale mode (individual frames)');
                break;
            case 'S':
                fw.mode = 'scaleSelection';
                // console.log('Scale mode (entire selection)');
                break;

            // Rotation
            case 'r':
                this.rotateSelected(Math.PI / 2); // 90° CCW
                break;
            case 'R':
                this.rotateSelected(Math.PI / 4); // 45° CCW
                break;

            // Reflection
            case 'e':
                this.reflectSelectedH();
                break;
            case 'E':
                this.reflectSelectedV();
                break;

            // Selection
            case 'a':
                this.selectAllOfColor();
                break;
            case 'A':
                fw.selectAll();
                break;

            // Cursor
            case 'z':
                fw.cursor.snapToOrigin();
                break;
            case 'Z':
                this.centerStructureToCursor();
                break;
            case ' ':
                this.snapSelectionToCursor();
                break;

            // Delete
            case 'x':
                this.deleteSelected();
                break;

            // Color context
            case 'p':
                if (this.colorContext) {
                    this.colorContext.enter();
                    // Reset mode when entering color context
                    fw.mode = 'normal';
                    // console.log('Entered color context');
                } else {
                    // Fallback to cycle color if no context
                    this.cycleColorForward();
                }
                break;

            // Frame selection context
            case '#':
                if (this.selectionContext) {
                    this.selectionContext.enter();
                    // Reset mode when entering selection context
                    fw.mode = 'normal';
                    // console.log('Entered frame selection context');
                }
                break;

            // Corner cycling
            case 'q':
                this.cycleCorner();
                break;

            // Toggle UI visibility
            case '?':
                this.toggleUI();
                break;

            // Camera context
            case 'v':
                if (this.cameraContext) {
                    this.cameraContext.enter();
                    // Reset mode when entering camera context
                    fw.mode = 'normal';
                    // console.log('Entered camera context');
                } else {
                    // console.log('Camera context not enabled');
                }
                break;

            // Animation mode
            case 'm':
                fw.mode = 'animation';
                // console.log('Animation mode - press i/j/k/l to set direction');
                break;

            // Command context (undo/fork navigation)
            case 'u':
                if (this.commandTree) {
                    this.commandTree.toggleCommandContext();
                    // Reset mode when entering command context
                    if (this.commandTree.inCommandContext) {
                        fw.mode = 'normal';
                        // console.log('Entered command context - mode reset to normal');
                    }
                } else {
                    // console.log('Command tree not enabled');
                }
                break;

            // View selection (for transformation plane, not camera position)
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                fw.currentView = parseInt(key);
                // console.log('Transformation view:', fw.currentView);
                break;

            // Escape - exit modes
            case 'Escape':
                fw.mode = 'normal';
                // console.log('Normal mode');
                break;

            default:
                // console.log('Unknown command:', key);
        }

        // Record command
        this.lastCommand = key;
        fw.commandHistory.push(key);

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }
    }

    /**
     * Handle translation mode ijkl keys
     * Movement is relative to the active view plane
     */
    handleTranslate(key) {
        const fw = this.framework;
        const step = fw.gridSize;
        const view = fw.currentView;
        let dx = 0, dy = 0, dz = 0;

        // Map ijkl to view-relative movement
        // i = up in view, k = down in view
        // j = left in view, l = right in view

        switch (view) {
            case 0: // Spatial - default to front view mapping
            case 1: // Front view (XY plane, looking from +Z)
                // i/k = Y axis, j/l = X axis
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dx = -step;
                else if (key === 'l') dx = step;
                break;

            case 2: // Right view (YZ plane, looking from +X)
                // i/k = Y axis, j/l = Z axis
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dz = step;   // Left in view = +Z
                else if (key === 'l') dz = -step;  // Right in view = -Z
                break;

            case 3: // Back view (XY plane, looking from -Z)
                // i/k = Y axis, j/l = X axis (reversed)
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dx = step;   // Left in view = +X (reversed)
                else if (key === 'l') dx = -step;  // Right in view = -X (reversed)
                break;

            case 4: // Left view (YZ plane, looking from -X)
                // i/k = Y axis, j/l = Z axis (reversed)
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dz = -step;  // Left in view = -Z
                else if (key === 'l') dz = step;   // Right in view = +Z
                break;

            case 5: // Top view (XZ plane, looking from +Y)
                // i/k = Z axis (up/down in view), j/l = X axis
                // When looking from above, +Z points DOWN on screen
                if (key === 'i') dz = -step;       // Up in view = -Z
                else if (key === 'k') dz = step;   // Down in view = +Z
                else if (key === 'j') dx = -step;  // Left in view = -X
                else if (key === 'l') dx = step;   // Right in view = +X
                break;

            case 6: // Bottom view (XZ plane, looking from -Y)
                // i/k = Z axis, j/l = X axis
                // When looking from below, +Z points UP on screen
                if (key === 'i') dz = step;        // Up in view = +Z
                else if (key === 'k') dz = -step;  // Down in view = -Z
                else if (key === 'j') dx = -step;  // Left in view = -X
                else if (key === 'l') dx = step;   // Right in view = +X
                break;

            default:
                return;
        }

        // Apply translation to selected frames
        fw.getSelectedFrames().forEach(frame => {
            frame.translate(dx, dy, dz);
        });

        fw.commandHistory.push(key);

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }
    }

    /**
     * Create a new frame at cursor
     * Frame plane depends on current view
     */
    createFrame() {
        const fw = this.framework;
        const color = this.palette.getNextColor();

        // Determine normal direction based on current view
        // The normal points TOWARD the camera (opposite of view direction)
        let ihat, jhat, khat;

        switch (fw.currentView) {
            case 0: // Spatial view - default to front plane (XY)
            case 1: // Front view (XY plane, camera at +Z)
                ihat = 0; jhat = 0; khat = 1; // Normal points toward +Z
                break;
            case 2: // Right view (YZ plane, camera at +X)
                ihat = 1; jhat = 0; khat = 0; // Normal points toward +X
                break;
            case 3: // Back view (XY plane, camera at -Z)
                ihat = 0; jhat = 0; khat = -1; // Normal points toward -Z
                break;
            case 4: // Left view (YZ plane, camera at -X)
                ihat = -1; jhat = 0; khat = 0; // Normal points toward -X
                break;
            case 5: // Top view (XZ plane, camera at +Y)
                ihat = 0; jhat = 1; khat = 0; // Normal points toward +Y
                break;
            case 6: // Bottom view (XZ plane, camera at -Y)
                ihat = 0; jhat = -1; khat = 0; // Normal points toward -Y
                break;
            default:
                ihat = 0; jhat = 0; khat = 1; // Default to front view
        }

        const frame = new Frame(
            fw.cursor.x,
            fw.cursor.y,
            fw.cursor.z,
            ihat, jhat, khat,
            1,        // size
            color
        );

        // Deselect all, add and select new frame
        fw.deselectAll();
        fw.addFrame(frame);

        // console.log('Created frame at', fw.cursor.x, fw.cursor.y, fw.cursor.z, 'normal:', ihat, jhat, khat);
    }

    /**
     * Duplicate all selected frames
     */
    duplicateSelected() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) {
            // console.log('No frames selected');
            return;
        }

        // Deselect originals
        fw.deselectAll();

        // Duplicate each frame in place (same position)
        selected.forEach(original => {
            const dup = original.duplicate();
            fw.addFrame(dup);
        });

        // console.log('Duplicated', selected.length, 'frames in place');
    }

    /**
     * Delete all selected frames
     */
    deleteSelected() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) {
            // console.log('No frames selected');
            return;
        }

        // Remove selected frames from the framework
        fw.frames = fw.frames.filter(frame => !frame.selected);

        // console.log('Deleted', selected.length, 'frames');
    }

    /**
     * Rotate selected frames around cursor
     * Rotation axis depends on the active view plane
     */
    rotateSelected(angle) {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();
        const view = fw.currentView;

        // Determine rotation axis based on active view
        // Rotation is around the normal axis of the view plane
        let axis;
        switch (view) {
            case 0: // Spatial - default to Z axis (XY plane)
            case 1: // Front (XY plane) - rotate around Z axis
            case 3: // Back (XY plane) - rotate around Z axis
                axis = 'z';
                break;

            case 2: // Right (YZ plane) - rotate around X axis
            case 4: // Left (YZ plane) - rotate around X axis
                axis = 'x';
                break;

            case 5: // Top (XZ plane) - rotate around Y axis
            case 6: // Bottom (XZ plane) - rotate around Y axis
                axis = 'y';
                break;

            default:
                axis = 'z';
        }

        selected.forEach(frame => {
            frame.rotate(fw.cursor.x, fw.cursor.y, fw.cursor.z, angle, axis);
        });

        // console.log('Rotated', selected.length, 'frames by', angle, 'radians around', axis, 'axis');
    }

    /**
     * Reflect selected frames horizontally (left/right) around cursor
     * View-relative: reflects across a vertical PLANE passing through cursor
     */
    reflectSelectedH() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();
        const view = fw.currentView;

        // Determine which axis coordinate to flip based on view
        // e = horizontal reflection (across a vertical plane in the view)
        // View 1/3: reflect across YZ plane (flip X)
        // View 2/4: reflect across XY plane (flip Z)
        // View 5/6: reflect across YZ plane (flip X)
        let reflectAxis;
        switch (view) {
            case 0: // Spatial - default to front view
            case 1: // Front (XY plane) - reflect across YZ plane (flip X)
            case 3: // Back (XY plane) - reflect across YZ plane (flip X)
                reflectAxis = 'x';
                break;
            case 2: // Right (YZ plane) - reflect across XY plane (flip Z)
            case 4: // Left (YZ plane) - reflect across XY plane (flip Z)
                reflectAxis = 'z';
                break;
            case 5: // Top (XZ plane) - reflect across YZ plane (flip X)
            case 6: // Bottom (XZ plane) - reflect across YZ plane (flip X)
                reflectAxis = 'x';
                break;
            default:
                reflectAxis = 'x';
        }

        selected.forEach(frame => {
            switch (reflectAxis) {
                case 'x':
                    // Reflect position across YZ plane
                    const dx = frame.x - fw.cursor.x;
                    frame.x = fw.cursor.x - dx;
                    // Reflect normal vector (flip X component)
                    frame.ihat = -frame.ihat;
                    break;
                case 'z':
                    // Reflect position across XY plane
                    const dz = frame.z - fw.cursor.z;
                    frame.z = fw.cursor.z - dz;
                    // Reflect normal vector (flip Z component)
                    frame.khat = -frame.khat;
                    break;
            }
        });

        // console.log('Reflected', selected.length, 'frames horizontally across', reflectAxis, 'coordinate at cursor');
    }

    /**
     * Reflect selected frames vertically (up/down) around cursor
     * View-relative: reflects across a horizontal PLANE passing through cursor
     */
    reflectSelectedV() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();
        const view = fw.currentView;

        // Determine which axis coordinate to flip based on view
        // E = vertical reflection (across a horizontal plane in the view)
        // View 1/3: reflect across XZ plane (flip Y)
        // View 2/4: reflect across XZ plane (flip Y)
        // View 5/6: reflect across XY plane (flip Z)
        let reflectAxis;
        switch (view) {
            case 0: // Spatial - default to front view
            case 1: // Front (XY plane) - reflect across XZ plane (flip Y)
            case 2: // Right (YZ plane) - reflect across XZ plane (flip Y)
            case 3: // Back (XY plane) - reflect across XZ plane (flip Y)
            case 4: // Left (YZ plane) - reflect across XZ plane (flip Y)
                reflectAxis = 'y';
                break;
            case 5: // Top (XZ plane) - reflect across XY plane (flip Z)
            case 6: // Bottom (XZ plane) - reflect across XY plane (flip Z)
                reflectAxis = 'z';
                break;
            default:
                reflectAxis = 'y';
        }

        selected.forEach(frame => {
            switch (reflectAxis) {
                case 'y':
                    // Reflect position across XZ plane
                    const dy = frame.y - fw.cursor.y;
                    frame.y = fw.cursor.y - dy;
                    // Reflect normal vector (flip Y component)
                    frame.jhat = -frame.jhat;
                    break;
                case 'z':
                    // Reflect position across XY plane
                    const dz = frame.z - fw.cursor.z;
                    frame.z = fw.cursor.z - dz;
                    // Reflect normal vector (flip Z component)
                    frame.khat = -frame.khat;
                    break;
            }
        });

        // console.log('Reflected', selected.length, 'frames vertically across', reflectAxis, 'coordinate at cursor');
    }

    /**
     * Select all frames of the same color as currently selected
     */
    selectAllOfColor() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) return;

        const targetColor = selected[0].color;
        fw.frames.forEach(frame => {
            if (frame.color === targetColor) {
                frame.selected = true;
            }
        });

        // console.log('Selected all frames with color', targetColor);
    }

    /**
     * Snap selected frames to cursor
     */
    snapSelectionToCursor() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        // Calculate center of selection
        if (selected.length === 0) return;

        const centerX = selected.reduce((sum, f) => sum + f.x, 0) / selected.length;
        const centerY = selected.reduce((sum, f) => sum + f.y, 0) / selected.length;
        const centerZ = selected.reduce((sum, f) => sum + f.z, 0) / selected.length;

        // Calculate offset to cursor
        const dx = fw.cursor.x - centerX;
        const dy = fw.cursor.y - centerY;
        const dz = fw.cursor.z - centerZ;

        // Move all selected frames
        selected.forEach(frame => {
            frame.translate(dx, dy, dz);
        });

        // console.log('Snapped selection to cursor');
    }

    /**
     * Center entire structure to cursor (Z command)
     * Calculates bounding box of all frames and translates everything
     * so the center of the bounding box aligns with the cursor
     */
    centerStructureToCursor() {
        const fw = this.framework;

        if (fw.frames.length === 0) {
            // console.log('No frames to center');
            return;
        }

        // Get bounding box of all frames
        const bbox = fw.getBoundingBox();

        // Calculate offset to move structure center to cursor
        const dx = fw.cursor.x - bbox.centerX;
        const dy = fw.cursor.y - bbox.centerY;
        const dz = fw.cursor.z - bbox.centerZ;

        // Translate all frames
        fw.frames.forEach(frame => {
            frame.translate(dx, dy, dz);
        });

        // console.log(`Centered structure to cursor: bbox center (${bbox.centerX.toFixed(2)}, ${bbox.centerY.toFixed(2)}, ${bbox.centerZ.toFixed(2)}) → cursor (${fw.cursor.x}, ${fw.cursor.y}, ${fw.cursor.z})`);
    }

    /**
     * Get corner coordinates based on current view and corner index
     * Corner order: TR-near, TL-near, BL-near, BR-near, TR-far, TL-far, BL-far, BR-far
     *
     * @param {number} cornerIndex - Corner index (0-7)
     * @returns {object} - {x, y, z} coordinates of the corner
     */
    getCornerCoordinates(cornerIndex) {
        const bbox = this.framework.getBoundingBox();
        const view = this.framework.currentView;

        // Define corner patterns based on view
        // Pattern: [near/far axis, top/bottom, left/right]
        const corners = [];

        switch (view) {
            case 0: // Spatial - default to front view
            case 1: // Front view (camera at +Z, looking at -Z)
                // Near = maxZ, Far = minZ
                // Right = maxX, Left = minX
                // Top = maxY, Bottom = minY
                corners[0] = {x: bbox.maxX, y: bbox.maxY, z: bbox.maxZ}; // TR-near
                corners[1] = {x: bbox.minX, y: bbox.maxY, z: bbox.maxZ}; // TL-near
                corners[2] = {x: bbox.minX, y: bbox.minY, z: bbox.maxZ}; // BL-near
                corners[3] = {x: bbox.maxX, y: bbox.minY, z: bbox.maxZ}; // BR-near
                corners[4] = {x: bbox.maxX, y: bbox.maxY, z: bbox.minZ}; // TR-far
                corners[5] = {x: bbox.minX, y: bbox.maxY, z: bbox.minZ}; // TL-far
                corners[6] = {x: bbox.minX, y: bbox.minY, z: bbox.minZ}; // BL-far
                corners[7] = {x: bbox.maxX, y: bbox.minY, z: bbox.minZ}; // BR-far
                break;

            case 2: // Right view (camera at +X, looking at -X)
                // Near = maxX, Far = minX
                // Right = minZ, Left = maxZ (right-hand rule: -X × +Y = -Z)
                // Top = maxY, Bottom = minY
                corners[0] = {x: bbox.maxX, y: bbox.maxY, z: bbox.minZ}; // TR-near
                corners[1] = {x: bbox.maxX, y: bbox.maxY, z: bbox.maxZ}; // TL-near
                corners[2] = {x: bbox.maxX, y: bbox.minY, z: bbox.maxZ}; // BL-near
                corners[3] = {x: bbox.maxX, y: bbox.minY, z: bbox.minZ}; // BR-near
                corners[4] = {x: bbox.minX, y: bbox.maxY, z: bbox.minZ}; // TR-far
                corners[5] = {x: bbox.minX, y: bbox.maxY, z: bbox.maxZ}; // TL-far
                corners[6] = {x: bbox.minX, y: bbox.minY, z: bbox.maxZ}; // BL-far
                corners[7] = {x: bbox.minX, y: bbox.minY, z: bbox.minZ}; // BR-far
                break;

            case 3: // Back view (camera at -Z, looking at +Z)
                // Near = minZ, Far = maxZ
                // Right = minX (flipped), Left = maxX
                // Top = maxY, Bottom = minY
                corners[0] = {x: bbox.minX, y: bbox.maxY, z: bbox.minZ}; // TR-near
                corners[1] = {x: bbox.maxX, y: bbox.maxY, z: bbox.minZ}; // TL-near
                corners[2] = {x: bbox.maxX, y: bbox.minY, z: bbox.minZ}; // BL-near
                corners[3] = {x: bbox.minX, y: bbox.minY, z: bbox.minZ}; // BR-near
                corners[4] = {x: bbox.minX, y: bbox.maxY, z: bbox.maxZ}; // TR-far
                corners[5] = {x: bbox.maxX, y: bbox.maxY, z: bbox.maxZ}; // TL-far
                corners[6] = {x: bbox.maxX, y: bbox.minY, z: bbox.maxZ}; // BL-far
                corners[7] = {x: bbox.minX, y: bbox.minY, z: bbox.maxZ}; // BR-far
                break;

            case 4: // Left view (camera at -X, looking at +X)
                // Near = minX, Far = maxX
                // Right = maxZ, Left = minZ (right-hand rule: +X × +Y = +Z)
                // Top = maxY, Bottom = minY
                corners[0] = {x: bbox.minX, y: bbox.maxY, z: bbox.maxZ}; // TR-near
                corners[1] = {x: bbox.minX, y: bbox.maxY, z: bbox.minZ}; // TL-near
                corners[2] = {x: bbox.minX, y: bbox.minY, z: bbox.minZ}; // BL-near
                corners[3] = {x: bbox.minX, y: bbox.minY, z: bbox.maxZ}; // BR-near
                corners[4] = {x: bbox.maxX, y: bbox.maxY, z: bbox.maxZ}; // TR-far
                corners[5] = {x: bbox.maxX, y: bbox.maxY, z: bbox.minZ}; // TL-far
                corners[6] = {x: bbox.maxX, y: bbox.minY, z: bbox.minZ}; // BL-far
                corners[7] = {x: bbox.maxX, y: bbox.minY, z: bbox.maxZ}; // BR-far
                break;

            case 5: // Top view (camera at +Y, looking at -Y)
                // Near = maxY, Far = minY
                // Right = maxX, Left = minX
                // Top = minZ (up in view when looking down), Bottom = maxZ
                corners[0] = {x: bbox.maxX, y: bbox.maxY, z: bbox.minZ}; // TR-near
                corners[1] = {x: bbox.minX, y: bbox.maxY, z: bbox.minZ}; // TL-near
                corners[2] = {x: bbox.minX, y: bbox.maxY, z: bbox.maxZ}; // BL-near
                corners[3] = {x: bbox.maxX, y: bbox.maxY, z: bbox.maxZ}; // BR-near
                corners[4] = {x: bbox.maxX, y: bbox.minY, z: bbox.minZ}; // TR-far
                corners[5] = {x: bbox.minX, y: bbox.minY, z: bbox.minZ}; // TL-far
                corners[6] = {x: bbox.minX, y: bbox.minY, z: bbox.maxZ}; // BL-far
                corners[7] = {x: bbox.maxX, y: bbox.minY, z: bbox.maxZ}; // BR-far
                break;

            case 6: // Bottom view (camera at -Y, looking at +Y)
                // Near = minY, Far = maxY
                // Right = maxX, Left = minX
                // Top = maxZ (up in view when looking up), Bottom = minZ
                corners[0] = {x: bbox.maxX, y: bbox.minY, z: bbox.maxZ}; // TR-near
                corners[1] = {x: bbox.minX, y: bbox.minY, z: bbox.maxZ}; // TL-near
                corners[2] = {x: bbox.minX, y: bbox.minY, z: bbox.minZ}; // BL-near
                corners[3] = {x: bbox.maxX, y: bbox.minY, z: bbox.minZ}; // BR-near
                corners[4] = {x: bbox.maxX, y: bbox.maxY, z: bbox.maxZ}; // TR-far
                corners[5] = {x: bbox.minX, y: bbox.maxY, z: bbox.maxZ}; // TL-far
                corners[6] = {x: bbox.minX, y: bbox.maxY, z: bbox.minZ}; // BL-far
                corners[7] = {x: bbox.maxX, y: bbox.maxY, z: bbox.minZ}; // BR-far
                break;
        }

        return corners[cornerIndex % 8];
    }

    /**
     * Cycle to next corner and move cursor there
     */
    cycleCorner() {
        const fw = this.framework;

        if (fw.frames.length === 0) {
            // console.log('No frames - cannot cycle corners');
            return;
        }

        // Get current corner coordinates
        const corner = this.getCornerCoordinates(this.cornerIndex);

        // Move cursor to corner
        fw.cursor.x = corner.x;
        fw.cursor.y = corner.y;
        fw.cursor.z = corner.z;

        // console.log(`Moved cursor to corner ${this.cornerIndex}: (${corner.x.toFixed(2)}, ${corner.y.toFixed(2)}, ${corner.z.toFixed(2)})`);

        // Increment corner index (wraps 0-7)
        this.cornerIndex = (this.cornerIndex + 1) % 8;
    }

    /**
     * Toggle UI visibility (cursor, view helpers, panels)
     */
    toggleUI() {
        this.uiVisible = !this.uiVisible;

        // Update renderer if available
        if (this.renderer && this.renderer.setUIVisible) {
            this.renderer.setUIVisible(this.uiVisible);
        }

        // console.log('UI visibility:', this.uiVisible ? 'shown' : 'hidden');
    }

    /**
     * Handle animation direction (i/j/k/l in animation mode)
     * Toggle animation on/off with the specified direction
     */
    handleAnimationDirection(key) {
        const fw = this.framework;

        // If already animating in this direction, stop animation and exit animation mode
        if (this.animationActive && this.animationDirection === key) {
            this.animationActive = false;
            this.animationDirection = null;
            this.animationTimer = 0;
            // console.log('Animation stopped');
            fw.mode = 'normal';
        } else {
            // Start/change animation direction
            this.animationActive = true;
            this.animationDirection = key;
            this.animationTimer = 0;

            const directions = {
                'i': 'up (next palette color)',
                'k': 'down (previous palette color)',
                'j': 'left (structure backward)',
                'l': 'right (structure forward)'
            };
            // console.log('Animation started:', directions[key], `at ${this.animationInterval.toFixed(1)}ms interval`);
            // Keep animation mode active so user can adjust speed with J/L
            // (don't set fw.mode = 'normal' here)
        }

        // Record command
        fw.commandHistory.push(key);
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }
    }

    /**
     * Speed up animation (J in animation mode)
     * Decrease interval by 1/60s
     */
    handleAnimationSpeedUp() {
        const fw = this.framework;

        // Decrease interval (faster)
        this.animationInterval = Math.max(
            this.animationMinInterval,
            this.animationInterval - this.animationStep
        );

        const fps = (1000 / this.animationInterval).toFixed(1);
        // console.log(`Animation speed: ${this.animationInterval.toFixed(1)}ms (${fps} shifts/sec)`);

        // Record command
        fw.commandHistory.push('J');
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand('J');
        }
    }

    /**
     * Slow down animation (L in animation mode)
     * Increase interval by 1/60s
     */
    handleAnimationSlowDown() {
        const fw = this.framework;

        // Increase interval (slower)
        this.animationInterval = Math.min(
            this.animationMaxInterval,
            this.animationInterval + this.animationStep
        );

        const fps = (1000 / this.animationInterval).toFixed(1);
        // console.log(`Animation speed: ${this.animationInterval.toFixed(1)}ms (${fps} shifts/sec)`);

        // Record command
        fw.commandHistory.push('L');
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand('L');
        }
    }

    /**
     * Update animation timer and execute color shifts
     * Called from main animation loop with deltaTime in ms
     */
    updateAnimation(deltaTime) {
        if (!this.animationActive || !this.animationDirection) {
            return;
        }

        // Accumulate time
        this.animationTimer += deltaTime;

        // Check if it's time to execute a color shift
        if (this.animationTimer >= this.animationInterval) {
            this.animationTimer -= this.animationInterval;

            // Execute color shift via color context
            if (this.colorContext) {
                const fw = this.framework;

                // Apply to ALL frames (not just selected)
                if (fw.frames.length > 0) {
                    // For each frame, shift its color in the specified direction
                    fw.frames.forEach(frame => {
                        // Find current color index in palette
                        const frameColor = frame.color.toUpperCase();
                        const currentIndex = this.colorContext.colors.findIndex(c => c.toUpperCase() === frameColor);

                        if (currentIndex >= 0) {
                            let newIndex = currentIndex;

                            // Apply direction shift
                            switch (this.animationDirection) {
                                case 'l': // Right (+1)
                                    newIndex = (currentIndex + 1) % this.colorContext.numColors;
                                    break;
                                case 'j': // Left (-1)
                                    newIndex = (currentIndex - 1 + this.colorContext.numColors) % this.colorContext.numColors;
                                    break;
                                case 'k': // Down (+8)
                                    newIndex = (currentIndex + this.colorContext.cols) % this.colorContext.numColors;
                                    break;
                                case 'i': // Up (-8)
                                    newIndex = (currentIndex - this.colorContext.cols + this.colorContext.numColors) % this.colorContext.numColors;
                                    break;
                            }

                            frame.color = this.colorContext.colors[newIndex];
                        }
                    });
                    // console.log('Animated', fw.frames.length, 'frames in direction:', this.animationDirection);
                }
            }
        }
    }

    /**
     * Cycle to next color in palette
     */
    cycleColorForward() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) {
            // Just advance the palette
            this.palette.getNextColor();
            return;
        }

        // Change color of selected frames
        const newColor = this.palette.getNextColor();
        selected.forEach(frame => {
            frame.color = newColor;
        });

        // console.log('Changed color to', newColor);
    }

    /**
     * Handle scale mode (individual frames)
     */
    handleScale(key) {
        const fw = this.framework;
        const scaleStep = 0.1; // Scale by 10% increments
        let scaleFactor = 1;

        switch (key) {
            case 'i': // scale up
                scaleFactor = 1 + scaleStep;
                break;
            case 'k': // scale down
                scaleFactor = 1 - scaleStep;
                break;
            default:
                return;
        }

        // Apply scale to each selected frame individually
        fw.getSelectedFrames().forEach(frame => {
            frame.size *= scaleFactor;
        });

        fw.commandHistory.push(key);

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }

        // console.log('Scaled frames by', scaleFactor);
    }

    /**
     * Handle scale selection mode (entire selection scaled together)
     */
    handleScaleSelection(key) {
        const fw = this.framework;
        const scaleStep = 0.1;
        let scaleFactor = 1;

        switch (key) {
            case 'i': // scale up
                scaleFactor = 1 + scaleStep;
                break;
            case 'k': // scale down
                scaleFactor = 1 - scaleStep;
                break;
            default:
                return;
        }

        const selected = fw.getSelectedFrames();
        if (selected.length === 0) return;

        // Calculate center of selection
        const centerX = selected.reduce((sum, f) => sum + f.x, 0) / selected.length;
        const centerY = selected.reduce((sum, f) => sum + f.y, 0) / selected.length;
        const centerZ = selected.reduce((sum, f) => sum + f.z, 0) / selected.length;

        // Scale both position (relative to center) and size
        selected.forEach(frame => {
            // Scale position relative to center
            const dx = frame.x - centerX;
            const dy = frame.y - centerY;
            const dz = frame.z - centerZ;

            frame.x = centerX + dx * scaleFactor;
            frame.y = centerY + dy * scaleFactor;
            frame.z = centerZ + dz * scaleFactor;

            // Scale size
            frame.size *= scaleFactor;
        });

        fw.commandHistory.push(key);

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }

        // console.log('Scaled entire selection by', scaleFactor);
    }

    /**
     * Handle translate cursor mode ijkl keys
     * Moves cursor in 3D space based on current view plane
     */
    handleTranslateCursor(key) {
        const fw = this.framework;
        const step = fw.gridSize;
        const view = fw.currentView;
        let dx = 0, dy = 0, dz = 0;

        // Use same mapping as frame translation
        switch (view) {
            case 0: // Spatial - default to front view mapping
            case 1: // Front view (XY plane)
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dx = -step;
                else if (key === 'l') dx = step;
                break;

            case 2: // Right view (YZ plane)
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dz = step;
                else if (key === 'l') dz = -step;
                break;

            case 3: // Back view (XY plane, reversed)
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dx = step;
                else if (key === 'l') dx = -step;
                break;

            case 4: // Left view (YZ plane, reversed)
                if (key === 'i') dy = step;
                else if (key === 'k') dy = -step;
                else if (key === 'j') dz = -step;
                else if (key === 'l') dz = step;
                break;

            case 5: // Top view (XZ plane)
                // When looking from above, +Z points DOWN on screen
                if (key === 'i') dz = -step;
                else if (key === 'k') dz = step;
                else if (key === 'j') dx = -step;
                else if (key === 'l') dx = step;
                break;

            case 6: // Bottom view (XZ plane)
                // When looking from below, +Z points UP on screen
                if (key === 'i') dz = step;
                else if (key === 'k') dz = -step;
                else if (key === 'j') dx = -step;
                else if (key === 'l') dx = step;
                break;

            default:
                return;
        }

        // Move cursor
        fw.cursor.translate(dx, dy, dz);
        fw.commandHistory.push(key);

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }

        // console.log('Cursor moved to', fw.cursor.x, fw.cursor.y, fw.cursor.z);
    }

    /**
     * Set camera view (0 = spatial, 1-6 = orthographic)
     */
    setView(viewNumber) {
        const fw = this.framework;

        if (viewNumber < 0 || viewNumber > 6) {
            console.warn('Invalid view number:', viewNumber);
            return;
        }

        fw.currentView = viewNumber;

        // Update renderer if available
        if (this.renderer && this.renderer.setView) {
            this.renderer.setView(viewNumber);
        }

        const viewNames = ['Spatial', 'Front', 'Right', 'Back', 'Left', 'Top', 'Bottom'];
        // console.log('View:', viewNames[viewNumber]);
    }

    /**
     * Expand repeat notation: (command,count)
     * Supports nesting: (d(R2R1,23),81)
     *
     * @param {string} cmdString - Command string with optional repeat notation
     * @returns {string} - Expanded command string without repeat notation
     */
    expandRepeats(cmdString) {
        let result = '';
        let i = 0;

        while (i < cmdString.length) {
            if (cmdString[i] === '(') {
                // Find matching closing paren and comma separator
                let depth = 0;
                let commaPos = -1;
                let j = i;

                while (j < cmdString.length) {
                    if (cmdString[j] === '(') depth++;
                    if (cmdString[j] === ')') {
                        depth--;
                        if (depth === 0) break;
                    }
                    // Find comma at depth 1 (directly inside this group)
                    if (cmdString[j] === ',' && depth === 1) {
                        commaPos = j;
                    }
                    j++;
                }

                if (commaPos === -1) {
                    console.warn('Invalid repeat syntax: no comma found in group');
                    result += cmdString[i];
                    i++;
                    continue;
                }

                // Extract command and count
                const command = cmdString.substring(i + 1, commaPos);
                const countStr = cmdString.substring(commaPos + 1, j);
                const count = parseInt(countStr);

                if (isNaN(count)) {
                    console.warn('Invalid repeat count:', countStr);
                    result += cmdString[i];
                    i++;
                    continue;
                }

                // Recursively expand the inner command, then repeat it
                const expandedCommand = this.expandRepeats(command);
                result += expandedCommand.repeat(count);

                i = j + 1; // Skip past the closing paren
            } else {
                // Regular character
                result += cmdString[i];
                i++;
            }
        }

        return result;
    }

    /**
     * Condense a command string by grouping consecutive identical characters
     * Example: "ijijij" -> "(i,3)(j,3)"
     * Example: "ftiiijjjjRRd" -> "ft(i,3)(j,4)(R,2)d"
     *
     * @param {string} cmdString - Raw command string
     * @returns {string} - Condensed command string with repeat notation
     */
    condenseCommandString(cmdString) {
        if (!cmdString || cmdString.length === 0) return '';

        let result = '';
        let i = 0;

        while (i < cmdString.length) {
            const currentChar = cmdString[i];
            let count = 1;

            // Count consecutive identical characters
            while (i + count < cmdString.length && cmdString[i + count] === currentChar) {
                count++;
            }

            // If count is 1, just append the character
            // If count >= 2, use repeat notation
            if (count === 1) {
                result += currentChar;
            } else {
                result += `(${currentChar},${count})`;
            }

            i += count;
        }

        return result;
    }

    /**
     * Get condensed command history from framework
     * @returns {string} - Condensed command string
     */
    getCondensedCommands() {
        const rawCommands = this.framework.commandHistory.join('');
        return this.condenseCommandString(rawCommands);
    }

    /**
     * Execute a command string (for replay)
     * Supports repeat notation: (command,count)
     */
    executeCommandString(cmdString) {
        // First expand any repeat notation
        const expanded = this.expandRepeats(cmdString);
        // console.log('Executing command string:', cmdString);
        if (cmdString !== expanded) {
            // console.log('Expanded to:', expanded);
        }

        // Execute each character
        for (let i = 0; i < expanded.length; i++) {
            this.executeKey(expanded[i]);
        }
    }

    /**
     * Handle command context navigation (ijkl in command context mode)
     */
    handleCommandContextNavigation(key) {
        const tree = this.commandTree;
        const fw = this.framework;

        // Check if this is a navigation key
        const isNavKey = ['i', 'j', 'k', 'l'].includes(key);

        if (!isNavKey) {
            // Non-navigation key pressed in command context
            // Check if this matches the next command in history
            const nextCmd = tree.peekNextCommand();

            if (key === nextCmd) {
                // Continue along current branch
                tree.moveForward();
                tree.exitCommandContext();

                // Execute the command normally
                fw.mode = 'normal'; // Ensure we're in normal mode
                this.executeKeyNormal(key);
            } else {
                // Different command - create fork and exit command context
                tree.exitCommandContext();
                tree.addCommand(key);

                // Reconstruct state from new branch
                this.reconstructState();

                // Execute the new command
                fw.mode = 'normal';
                this.executeKeyNormal(key);
            }
            return;
        }

        // Handle navigation
        switch (key) {
            case 'j': // Move back in history
                tree.moveBack();
                this.reconstructState();
                break;

            case 'l': // Move forward in history
                tree.moveForward();
                this.reconstructState();
                break;

            case 'i': // Move up to older branch
                tree.moveUp();
                this.reconstructState();
                break;

            case 'k': // Move down to newer branch
                tree.moveDown();
                this.reconstructState();
                break;
        }
    }

    /**
     * Handle camera context navigation (numbers + ijkl in camera context mode)
     */
    handleCameraContextNavigation(key, shift = false) {
        const ctx = this.cameraContext;
        const fw = this.framework;

        // Check if this is a number key (view selection)
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key)) {
            ctx.selectView(parseInt(key));

            // Record in command tree
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Check if this is a navigation key (zoom/FOV or orbit control)
        const isNavKey = ['i', 'I', 'j', 'J', 'k', 'K', 'l', 'L'].includes(key);

        if (isNavKey) {
            // Navigate (zoom/FOV adjustments or orbit control in v8 mode)
            // Pass the key as-is to let context-camera.js handle uppercase/lowercase
            ctx.navigate(key, shift);

            // Record navigation in command tree
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Check if pressing 'v' again (exit)
        if (key === 'v') {
            ctx.exit();

            // Record command
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Any other key exits camera context and continues
        ctx.exit();

        // Let the key execute normally
        fw.mode = 'normal';
        this.executeKeyNormal(key);

        // Record command
        fw.commandHistory.push(key);
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }
    }

    /**
     * Handle color context navigation (ijkl in color context mode)
     */
    handleColorContextNavigation(key) {
        const ctx = this.colorContext;
        const fw = this.framework;

        // Check if this is a navigation key
        const isNavKey = ['i', 'j', 'k', 'l'].includes(key);

        if (isNavKey) {
            // Navigate in color space
            ctx.navigate(key);

            // Record navigation in command tree
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Check if pressing 'p' again (exit and apply)
        if (key === 'p') {
            ctx.apply();
            ctx.exit();

            // Record command
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Any other key exits color context and continues
        ctx.apply();
        ctx.exit();

        // Let the key execute normally
        fw.mode = 'normal';
        this.executeKeyNormal(key);

        // Record command
        fw.commandHistory.push(key);
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }
    }

    /**
     * Handle selection context navigation (ijkl/JL and [] in selection context mode)
     */
    handleSelectionContextNavigation(key, shift = false) {
        const ctx = this.selectionContext;
        const fw = this.framework;

        // Check if opening bracket input
        if (key === '[') {
            ctx.openBracketInput();
            // Show bracket input UI (via global function that sets the active flag)
            if (typeof window.openBracketInput === 'function') {
                window.openBracketInput();
            }
            return;
        }

        // Check if this is a navigation key (ijkl)
        const isNavKey = ['i', 'j', 'k', 'l'].includes(key.toLowerCase());

        if (isNavKey) {
            const lowerKey = key.toLowerCase();
            const isShift = key !== lowerKey || shift;

            if (isShift && (lowerKey === 'j' || lowerKey === 'l')) {
                // Shift operations (J/L) - contract bounds
                if (lowerKey === 'j') {
                    ctx.contractLower();
                } else if (lowerKey === 'l') {
                    ctx.contractUpper();
                }
            } else if (isShift && (lowerKey === 'i' || lowerKey === 'k')) {
                // TODO: I/K operations - available for new functions
                // console.log('I/K pressed - not yet implemented');
            } else {
                // Regular navigation (ijkl)
                switch (lowerKey) {
                    case 'l': // Expand upward
                        ctx.expandUp();
                        break;
                    case 'j': // Expand downward
                        ctx.expandDown();
                        break;
                    case 'i': // Shift selection up
                        ctx.shiftUp();
                        break;
                    case 'k': // Shift selection down
                        ctx.shiftDown();
                        break;
                }
            }

            // Record navigation
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Check if 'a' (select all same color)
        if (key === 'a') {
            ctx.selectAllSameColor();
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Check if pressing '#' again (exit)
        if (key === '#') {
            ctx.exit();
            fw.commandHistory.push(key);
            if (this.commandTree && !this.commandTree.inCommandContext) {
                this.commandTree.addCommand(key);
            }
            return;
        }

        // Any other key exits selection context and continues
        ctx.exit();
        fw.mode = 'normal';
        this.executeKeyNormal(key);

        // Record command
        fw.commandHistory.push(key);
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }
    }

    /**
     * Reconstruct framework state from current command tree position
     * Clears the framework and replays commands from the start
     */
    reconstructState() {
        const cmdSequence = this.commandTree.getCurrentCommandSequence();

        // console.log('Reconstructing state from', cmdSequence.length, 'commands');

        // Clear the framework
        this.framework.clear();

        // Reset the palette to ensure consistent colors
        this.palette.reset();

        // Temporarily disable command tree recording
        const wasInCommandContext = this.commandTree.inCommandContext;
        this.commandTree.inCommandContext = true;

        // Replay all commands up to current position
        for (let i = 0; i < cmdSequence.length; i++) {
            this.executeKeyNormal(cmdSequence[i]);
        }

        // Restore command context state
        this.commandTree.inCommandContext = wasInCommandContext;

        // console.log('State reconstructed:', this.framework.frames.length, 'frames');
    }

    /**
     * Execute a key command without command tree recording
     * Used for internal replay during state reconstruction
     */
    executeKeyNormal(key) {
        const fw = this.framework;

        // Mode-dependent commands (ijkl)
        if (fw.mode === 'translate') {
            if (['i', 'j', 'k', 'l'].includes(key)) {
                return this.handleTranslate(key);
            }
            fw.mode = 'normal';
        } else if (fw.mode === 'translateCursor') {
            if (['i', 'j', 'k', 'l'].includes(key)) {
                return this.handleTranslateCursor(key);
            }
            fw.mode = 'normal';
        } else if (fw.mode === 'scale') {
            if (['i', 'k'].includes(key)) {
                return this.handleScale(key);
            }
            fw.mode = 'normal';
        } else if (fw.mode === 'scaleSelection') {
            if (['i', 'k'].includes(key)) {
                return this.handleScaleSelection(key);
            }
            fw.mode = 'normal';
        }

        // Normal mode commands (same as executeKey but without tree recording)
        switch (key) {
            case 'f':
                this.createFrame();
                break;
            case 'd':
            case 'D':
                this.duplicateSelected();
                break;
            case 'x':
                this.deleteSelected();
                break;
            case 't':
                fw.mode = 'translate';
                break;
            case 'T':
                fw.mode = 'translateCursor';
                break;
            case 's':
                fw.mode = 'scale';
                break;
            case 'S':
                fw.mode = 'scaleSelection';
                break;
            case 'r':
                this.rotateSelected(Math.PI / 2);
                break;
            case 'R':
                this.rotateSelected(Math.PI / 4);
                break;
            case 'e':
                this.reflectSelectedH();
                break;
            case 'E':
                this.reflectSelectedV();
                break;
            case 'a':
                this.selectAllOfColor();
                break;
            case 'A':
                fw.selectAll();
                break;
            case 'z':
                fw.cursor.snapToOrigin();
                break;
            case 'Z':
                this.centerStructureToCursor();
                break;
            case ' ':
                this.snapSelectionToCursor();
                break;
            case 'p':
                this.cycleColorForward();
                break;
            case 'q':
                this.cycleCorner();
                break;
            case '?':
                this.toggleUI();
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                fw.currentView = parseInt(key);
                break;
            case 'Escape':
                fw.mode = 'normal';
                break;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommandExecutor };
}


// === renderer-instanced.js ===
// frameworks-renderer-instanced-v3.0.js
// High-performance instanced renderer for Frameworks V3

/**
 * Instanced renderer using Three.js for maximum performance
 * Can handle 100,000+ frames at 60 FPS
 */
class FrameworksInstancedRenderer {
    constructor(framework, containerId = 'container') {
        this.framework = framework;
        this.container = document.getElementById(containerId);

        // Three.js objects
        this.scene = null;
        this.perspectiveCamera = null;
        this.orthographicCamera = null;
        this.camera = null; // Active camera (will be set by view mode)
        this.controls = null; // Orbit controls for spatial view
        this.renderer = null;
        this.instancedMesh = null;
        this.cursorMesh = null;
        this.referenceCube = null;

        // Instance data buffers
        this.maxFrames = 100000; // Pre-allocate for max expected frames
        this.offsets = null;
        this.rotations = null;
        this.scales = null;
        this.colors = null;
        this.selected = null;

        // Rendering settings
        this.backgroundColor = 0x0a0a0a;

        // Camera state
        this.currentZoom = 50;
        this.currentFOV = 75;
        this.autoOrbitMode = false;

        this.init();
    }

    /**
     * Initialize Three.js scene with instanced geometry
     */
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.backgroundColor);

        // Perspective camera for spatial view (view 0)
        this.perspectiveCamera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.perspectiveCamera.position.set(50, 50, 50);
        this.perspectiveCamera.lookAt(0, 0, 0);

        // Orthographic camera for flat views (views 1-6)
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 10;
        this.orthographicCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );

        // Start in spatial view (view 0)
        this.camera = this.perspectiveCamera;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(50, 50, 50);
        this.scene.add(directionalLight);

        // Orbit controls (for spatial view only)
        this.controls = this.createOrbitControls(this.perspectiveCamera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 500;

        // Create reference cube
        this.createReferenceCube();

        // Create instanced geometry
        this.createInstancedGeometry();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Global scroll handler for zoom (works in all views, including orthographic)
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();

            // Adjust zoom based on scroll direction
            const zoomDelta = e.deltaY * 0.05;
            this.currentZoom = Math.max(5, Math.min(500, this.currentZoom + zoomDelta));
            this.setCameraZoom(this.currentZoom);
        }, { passive: false });
    }

    /**
     * Create simple orbit controls for spatial view
     */
    createOrbitControls(camera, domElement) {
        const controls = {
            camera: camera,
            domElement: domElement,
            enabled: true,
            enableDamping: true,
            dampingFactor: 0.05,
            minDistance: 10,
            maxDistance: 500,

            // Internal state
            spherical: new THREE.Spherical(50, Math.PI / 4, Math.PI / 4),
            target: new THREE.Vector3(0, 0, 0),
            rotating: false,
            lastMouse: { x: 0, y: 0 },

            update: function() {
                if (this.enableDamping && this.enabled) {
                    // Update camera position from spherical coordinates
                    const pos = new THREE.Vector3();
                    pos.setFromSpherical(this.spherical);
                    pos.add(this.target);
                    this.camera.position.copy(pos);
                    this.camera.lookAt(this.target);
                }
            }
        };

        // Mouse event handlers
        domElement.addEventListener('mousedown', (e) => {
            if (!controls.enabled) return;
            controls.rotating = true;
            controls.lastMouse = { x: e.clientX, y: e.clientY };
        });

        domElement.addEventListener('mousemove', (e) => {
            if (!controls.enabled || !controls.rotating) return;

            const deltaX = e.clientX - controls.lastMouse.x;
            const deltaY = e.clientY - controls.lastMouse.y;

            controls.spherical.theta -= deltaX * 0.01;
            controls.spherical.phi -= deltaY * 0.01;

            // Clamp phi to avoid gimbal lock
            controls.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, controls.spherical.phi));

            controls.lastMouse = { x: e.clientX, y: e.clientY };
        });

        domElement.addEventListener('mouseup', () => {
            controls.rotating = false;
        });

        domElement.addEventListener('mouseleave', () => {
            controls.rotating = false;
        });

        // Note: Scroll zoom is now handled by global wheel handler in init()
        // This allows zoom to work in all views (perspective and orthographic)

        return controls;
    }

    /**
     * Create reference cube showing the 6 cardinal planes
     */
    createReferenceCube() {
        const size = 20; // Cube size
        const halfSize = size / 2;

        // Create a group to hold all cube faces
        const cubeGroup = new THREE.Group();

        // Edge colors for each face
        const edgeColors = {
            front: 0x4ECDC4,  // Front (+Z) - cyan
            back: 0xFF6B6B,   // Back (-Z) - red
            right: 0x95E1D3,  // Right (+X) - light green
            left: 0xFFA07A,   // Left (-X) - orange
            top: 0xF9ED69,    // Top (+Y) - yellow
            bottom: 0xAA96DA  // Bottom (-Y) - purple
        };

        // Create each face with light grey transparent material
        const createFace = (position, rotation) => {
            const geometry = new THREE.PlaneGeometry(size, size);
            const material = new THREE.MeshBasicMaterial({
                color: 0xcccccc,  // Light grey
                transparent: true,
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.copy(rotation);
            return mesh;
        };

        // Create colored outline for a face (4 edges)
        const createFaceOutline = (color, position, rotation) => {
            const points = [];
            const h = halfSize;

            // Create square outline
            points.push(new THREE.Vector3(-h, -h, 0));
            points.push(new THREE.Vector3(h, -h, 0));
            points.push(new THREE.Vector3(h, h, 0));
            points.push(new THREE.Vector3(-h, h, 0));
            points.push(new THREE.Vector3(-h, -h, 0)); // Close the loop

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: color,
                linewidth: 2
            });
            const line = new THREE.Line(geometry, material);

            line.position.copy(position);
            line.rotation.copy(rotation);

            return line;
        };

        // Front face (+Z) - light grey with cyan outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, 0, halfSize),
            new THREE.Euler(0, 0, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.front,
            new THREE.Vector3(0, 0, halfSize),
            new THREE.Euler(0, 0, 0)
        ));

        // Back face (-Z) - light grey with red outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, 0, -halfSize),
            new THREE.Euler(0, Math.PI, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.back,
            new THREE.Vector3(0, 0, -halfSize),
            new THREE.Euler(0, Math.PI, 0)
        ));

        // Right face (+X) - light grey with light green outline
        cubeGroup.add(createFace(
            new THREE.Vector3(halfSize, 0, 0),
            new THREE.Euler(0, Math.PI / 2, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.right,
            new THREE.Vector3(halfSize, 0, 0),
            new THREE.Euler(0, Math.PI / 2, 0)
        ));

        // Left face (-X) - light grey with orange outline
        cubeGroup.add(createFace(
            new THREE.Vector3(-halfSize, 0, 0),
            new THREE.Euler(0, -Math.PI / 2, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.left,
            new THREE.Vector3(-halfSize, 0, 0),
            new THREE.Euler(0, -Math.PI / 2, 0)
        ));

        // Top face (+Y) - light grey with yellow outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, halfSize, 0),
            new THREE.Euler(-Math.PI / 2, 0, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.top,
            new THREE.Vector3(0, halfSize, 0),
            new THREE.Euler(-Math.PI / 2, 0, 0)
        ));

        // Bottom face (-Y) - light grey with purple outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, -halfSize, 0),
            new THREE.Euler(Math.PI / 2, 0, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.bottom,
            new THREE.Vector3(0, -halfSize, 0),
            new THREE.Euler(Math.PI / 2, 0, 0)
        ));

        this.referenceCube = cubeGroup;
        this.referenceCube.userData.faceOutlines = {
            1: cubeGroup.children[1],   // Front outline
            2: cubeGroup.children[5],   // Right outline
            3: cubeGroup.children[3],   // Back outline
            4: cubeGroup.children[7],   // Left outline
            5: cubeGroup.children[9],   // Top outline
            6: cubeGroup.children[11]   // Bottom outline
        };
        this.scene.add(this.referenceCube);
    }

    /**
     * Create instanced frame geometry and buffers
     */
    createInstancedGeometry() {
        // Create base frame geometry (4 lines with extensions)
        const ext = 0.125; // Extension beyond corners
        const vertices = new Float32Array([
            // Top line (with extensions)
            -0.5 - ext, -0.5, 0,
            0.5 + ext, -0.5, 0,

            // Bottom line
            -0.5 - ext, 0.5, 0,
            0.5 + ext, 0.5, 0,

            // Left line
            -0.5, -0.5 - ext, 0,
            -0.5, 0.5 + ext, 0,

            // Right line
            0.5, -0.5 - ext, 0,
            0.5, 0.5 + ext, 0
        ]);

        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

        // Create instance attribute buffers (pre-allocated for maxFrames)
        this.offsets = new Float32Array(this.maxFrames * 3);
        this.rights = new Float32Array(this.maxFrames * 3); // Right vector (X-axis)
        this.ups = new Float32Array(this.maxFrames * 3); // Up vector (Y-axis)
        this.normals = new Float32Array(this.maxFrames * 3); // Normal vector (Z-axis)
        this.scales = new Float32Array(this.maxFrames);
        this.colors = new Float32Array(this.maxFrames * 3);
        this.selected = new Float32Array(this.maxFrames);

        // Add instance attributes
        geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(this.offsets, 3));
        geometry.setAttribute('frameRight', new THREE.InstancedBufferAttribute(this.rights, 3));
        geometry.setAttribute('frameUp', new THREE.InstancedBufferAttribute(this.ups, 3));
        geometry.setAttribute('frameNormal', new THREE.InstancedBufferAttribute(this.normals, 3));
        geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(this.scales, 1));
        geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(this.colors, 3));
        geometry.setAttribute('instanceSelected', new THREE.InstancedBufferAttribute(this.selected, 1));

        // Custom shader material
        const vertexShader = `
            attribute vec3 offset;
            attribute vec3 frameRight;   // X-axis of frame (tangent)
            attribute vec3 frameUp;      // Y-axis of frame (bitangent)
            attribute vec3 frameNormal;  // Z-axis of frame (normal)
            attribute float scale;
            attribute vec3 instanceColor;
            attribute float instanceSelected;

            varying vec3 vColor;
            varying float vSelected;

            void main() {
                // Scale the base geometry
                vec3 pos = position * scale;

                // Build orientation matrix directly from stored basis vectors
                // The frame stores a complete orthonormal basis (right, up, normal)
                // which defines its full 3D orientation
                mat3 orientation = mat3(
                    frameRight.x, frameRight.y, frameRight.z,      // X-axis
                    frameUp.x, frameUp.y, frameUp.z,                // Y-axis
                    frameNormal.x, frameNormal.y, frameNormal.z    // Z-axis
                );

                // Transform from local XY plane to world orientation
                pos = orientation * pos;

                // Translate to instance position
                pos += offset;

                // Apply camera transform
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

                // Pass color and selection to fragment shader
                vColor = instanceColor;
                vSelected = instanceSelected;
            }
        `;

        const fragmentShader = `
            varying vec3 vColor;
            varying float vSelected;

            void main() {
                vec3 color = vColor;

                // Add glow for selected frames
                if (vSelected > 0.5) {
                    color = mix(vColor, vec3(1.0), 0.3);
                }

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

        // Create instanced mesh
        this.instancedMesh = new THREE.LineSegments(geometry, material);
        this.instancedMesh.frustumCulled = false;
        this.scene.add(this.instancedMesh);

        // Initialize with 0 instances
        geometry.instanceCount = 0;
    }

    /**
     * Update instance buffers from framework data
     */
    updateInstanceData() {
        const frames = this.framework.frames;
        const count = Math.min(frames.length, this.maxFrames);

        // Update instance count
        this.instancedMesh.geometry.instanceCount = count;

        // Fill instance buffers
        for (let i = 0; i < count; i++) {
            const frame = frames[i];

            // Position
            this.offsets[i * 3] = frame.x;
            this.offsets[i * 3 + 1] = frame.y;
            this.offsets[i * 3 + 2] = frame.z;

            // Right vector (X-axis of frame)
            this.rights[i * 3] = frame.rightX;
            this.rights[i * 3 + 1] = frame.rightY;
            this.rights[i * 3 + 2] = frame.rightZ;

            // Up vector (Y-axis of frame)
            this.ups[i * 3] = frame.upX;
            this.ups[i * 3 + 1] = frame.upY;
            this.ups[i * 3 + 2] = frame.upZ;

            // Normal vector (Z-axis of frame)
            this.normals[i * 3] = frame.ihat;
            this.normals[i * 3 + 1] = frame.jhat;
            this.normals[i * 3 + 2] = frame.khat;

            // Scale
            this.scales[i] = frame.size;

            // Color (convert hex to RGB)
            const color = new THREE.Color(frame.color);
            this.colors[i * 3] = color.r;
            this.colors[i * 3 + 1] = color.g;
            this.colors[i * 3 + 2] = color.b;

            // Selection
            this.selected[i] = frame.selected ? 1.0 : 0.0;
        }

        // Mark attributes as needing update
        this.instancedMesh.geometry.attributes.offset.needsUpdate = true;
        this.instancedMesh.geometry.attributes.frameRight.needsUpdate = true;
        this.instancedMesh.geometry.attributes.frameUp.needsUpdate = true;
        this.instancedMesh.geometry.attributes.frameNormal.needsUpdate = true;
        this.instancedMesh.geometry.attributes.scale.needsUpdate = true;
        this.instancedMesh.geometry.attributes.instanceColor.needsUpdate = true;
        this.instancedMesh.geometry.attributes.instanceSelected.needsUpdate = true;
    }

    /**
     * Create cursor visualization
     */
    createCursorMesh() {
        const cursor = this.framework.cursor;
        const size = 0.2;

        // Create small crosshair
        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        const points = [
            new THREE.Vector3(cursor.x - size, cursor.y, cursor.z),
            new THREE.Vector3(cursor.x + size, cursor.y, cursor.z),
            new THREE.Vector3(cursor.x, cursor.y, cursor.z), // Center
            new THREE.Vector3(cursor.x, cursor.y - size, cursor.z),
            new THREE.Vector3(cursor.x, cursor.y + size, cursor.z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.LineSegments(geometry, material);

        return line;
    }

    /**
     * Update scene to match framework state
     */
    update() {
        // Update instanced frame data
        this.updateInstanceData();

        // Update cursor
        if (this.framework.cursor.visible) {
            // Remove old cursor
            const oldCursor = this.scene.getObjectByName('cursor');
            if (oldCursor) {
                this.scene.remove(oldCursor);
            }

            // Add new cursor
            const cursorMesh = this.createCursorMesh();
            cursorMesh.name = 'cursor';
            this.scene.add(cursorMesh);
        }
    }

    /**
     * Render loop
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;

        // Update perspective camera
        this.perspectiveCamera.aspect = aspect;
        this.perspectiveCamera.updateProjectionMatrix();

        // Update orthographic camera
        const frustumSize = 10;
        this.orthographicCamera.left = frustumSize * aspect / -2;
        this.orthographicCamera.right = frustumSize * aspect / 2;
        this.orthographicCamera.top = frustumSize / 2;
        this.orthographicCamera.bottom = frustumSize / -2;
        this.orthographicCamera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // Update orbit controls if enabled
        if (this.controls && this.controls.enabled) {
            this.controls.update();
        }

        this.update();
        this.render();
    }

    /**
     * Start rendering
     */
    start() {
        this.animate();
    }

    /**
     * Set UI visibility (cursor, reference cube, HTML panels)
     */
    setUIVisible(visible) {
        // Show/hide cursor
        const cursor = this.scene.getObjectByName('cursor');
        if (cursor) {
            cursor.visible = visible;
        }

        // Show/hide reference cube
        if (this.referenceCube) {
            this.referenceCube.visible = visible;
        }

        // Show/hide HTML UI panels
        const panels = ['#ui', '#help', '#command-history', '#perf', '#color-palette-overlay'];
        panels.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = visible ? '' : 'none';
            }
        });

        // console.log('UI elements', visible ? 'shown' : 'hidden');
    }

    /**
     * Set camera view with orthographic/perspective toggle
     * @param {number} viewNumber - 0=spatial, 1-6=cardinal, 7=isometric, 9=auto-orbit
     * @param {boolean} orthographic - Use orthographic projection
     * @param {number} zoom - Distance from origin
     * @param {number} fov - Field of view (for perspective)
     */
    setCameraView(viewNumber, orthographic = false, zoom = 50, fov = 75) {
        this.currentZoom = zoom;
        this.currentFOV = fov;
        this.autoOrbitMode = (viewNumber === 9);

        const viewNames = ['Spatial', 'Front', 'Right', 'Back', 'Left', 'Top', 'Bottom', 'Isometric', '', 'Auto-Orbit'];

        // Choose camera type based on orthographic flag
        if (orthographic) {
            this.camera = this.orthographicCamera;
            this.controls.enabled = false;
        } else {
            this.camera = this.perspectiveCamera;
            this.perspectiveCamera.fov = fov;
            this.perspectiveCamera.updateProjectionMatrix();
            // All views now have orbit controls enabled (spatial by default)
            this.controls.enabled = true;
        }

        // Set camera position based on view
        switch (viewNumber) {
            case 0: // Spatial (free orbit)
                // Keep current orbit position, just enable controls
                this.controls.enabled = !orthographic;
                this.dimAllFaceOutlines();
                break;

            case 1: // Front (looking from +Z) - snaps to view but allows orbit
                this.positionCamera(0, 0, zoom, 0, 1, 0);
                this.syncOrbitControlsToCamera();
                this.highlightFace(1);
                break;

            case 2: // Right (looking from +X) - snaps to view but allows orbit
                this.positionCamera(zoom, 0, 0, 0, 1, 0);
                this.syncOrbitControlsToCamera();
                this.highlightFace(2);
                break;

            case 3: // Back (looking from -Z) - snaps to view but allows orbit
                this.positionCamera(0, 0, -zoom, 0, 1, 0);
                this.syncOrbitControlsToCamera();
                this.highlightFace(3);
                break;

            case 4: // Left (looking from -X) - snaps to view but allows orbit
                this.positionCamera(-zoom, 0, 0, 0, 1, 0);
                this.syncOrbitControlsToCamera();
                this.highlightFace(4);
                break;

            case 5: // Top (looking from +Y) - snaps to view but allows orbit
                this.positionCamera(0, zoom, 0, 0, 0, -1);
                this.syncOrbitControlsToCamera();
                this.highlightFace(5);
                break;

            case 6: // Bottom (looking from -Y) - snaps to view but allows orbit
                this.positionCamera(0, -zoom, 0, 0, 0, 1);
                this.syncOrbitControlsToCamera();
                this.highlightFace(6);
                break;

            case 7: // Isometric (45° from XZ plane, 45° from XY plane) - snaps to view but allows orbit
                const isoDistance = zoom * Math.sqrt(3);
                this.positionCamera(isoDistance / Math.sqrt(3), isoDistance / Math.sqrt(3), isoDistance / Math.sqrt(3), 0, 1, 0);
                this.syncOrbitControlsToCamera();
                this.dimAllFaceOutlines();
                break;

            case 8: // Auto-orbit mode - disable controls, manual orbit with ijkl
                this.controls.enabled = false;  // Disable mouse orbit in auto-orbit mode
                this.dimAllFaceOutlines();
                break;
        }

        // console.log('View:', viewNames[viewNumber], orthographic ? '(orthographic)' : '(perspective)');
    }

    /**
     * Position camera at specific location
     */
    positionCamera(x, y, z, upX, upY, upZ) {
        this.camera.position.set(x, y, z);
        this.camera.up.set(upX, upY, upZ);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Sync orbit controls spherical coordinates to match current camera position
     * Call this after manually positioning the camera to enable smooth orbiting from that position
     */
    syncOrbitControlsToCamera() {
        if (!this.controls || !this.controls.spherical) return;

        // Calculate spherical coordinates from camera position
        const position = new THREE.Vector3().copy(this.camera.position);
        position.sub(this.controls.target);

        this.controls.spherical.setFromVector3(position);
    }

    /**
     * Highlight a specific face outline
     */
    highlightFace(faceNumber) {
        if (!this.referenceCube) return;
        const outlines = this.referenceCube.userData.faceOutlines;

        // Reset all to dim
        for (let key in outlines) {
            outlines[key].material.opacity = 0.3;
            outlines[key].material.transparent = true;
        }

        // Highlight specified face
        if (outlines[faceNumber]) {
            outlines[faceNumber].material.opacity = 1.0;
        }
    }

    /**
     * Dim all face outlines
     */
    dimAllFaceOutlines() {
        if (!this.referenceCube) return;
        const outlines = this.referenceCube.userData.faceOutlines;
        for (let key in outlines) {
            outlines[key].material.opacity = 0.3;
            outlines[key].material.transparent = true;
        }
    }

    /**
     * Set camera zoom (distance from origin for perspective, frustum size for orthographic)
     */
    setCameraZoom(zoom) {
        this.currentZoom = zoom;

        if (this.camera === this.perspectiveCamera) {
            // Perspective: update camera distance while preserving direction
            const direction = new THREE.Vector3();
            direction.copy(this.camera.position).normalize();
            this.camera.position.copy(direction.multiplyScalar(zoom));

            // Update orbit controls spherical radius
            if (this.controls.spherical) {
                this.controls.spherical.radius = zoom;
            }
        } else if (this.camera === this.orthographicCamera) {
            // Orthographic: adjust frustum size (smaller frustum = more zoomed in)
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = zoom * 0.2; // Scale factor for orthographic zoom

            this.orthographicCamera.left = frustumSize * aspect / -2;
            this.orthographicCamera.right = frustumSize * aspect / 2;
            this.orthographicCamera.top = frustumSize / 2;
            this.orthographicCamera.bottom = frustumSize / -2;
            this.orthographicCamera.updateProjectionMatrix();
        }
    }

    /**
     * Set camera FOV (field of view)
     */
    setCameraFOV(fov) {
        this.currentFOV = fov;
        if (this.camera === this.perspectiveCamera) {
            this.perspectiveCamera.fov = fov;
            this.perspectiveCamera.updateProjectionMatrix();
        }
    }

    /**
     * Set auto-orbit angle (automatic rotation)
     */
    setAutoOrbitAngle(angle, radius) {
        if (!this.autoOrbitMode) return;

        // Position camera in a circle around Y axis
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = radius * 0.5; // Slight elevation

        this.camera.position.set(x, y, z);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Set manual orbit position (for ijkl control in v8 mode)
     * @param {number} theta - Azimuth angle (longitude, around Y axis)
     * @param {number} phi - Polar angle (latitude, from north pole)
     * @param {number} radius - Distance from origin
     */
    setManualOrbitPosition(theta, phi, radius) {
        // Convert spherical to cartesian
        const x = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.cos(theta);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Get current camera position as spherical coordinates
     * @returns {object} - {theta, phi, radius} spherical coordinates
     */
    getCurrentCameraSpherical() {
        const position = new THREE.Vector3().copy(this.camera.position);
        const radius = position.length();

        // Convert to spherical coordinates
        // theta = azimuth (longitude) around Y axis
        // phi = polar angle (latitude) from north pole
        const theta = Math.atan2(position.x, position.z);
        const phi = Math.acos(position.y / radius);

        return { theta, phi, radius };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrameworksInstancedRenderer };
}


