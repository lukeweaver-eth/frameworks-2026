// Frame data structure
// A frame is a # shape: two sets of parallel lines at right angles

class Frame {
    constructor(count = 0) {
        this.count = count;           // Integer ID

        // 8D coordinates
        this.x = 0;
        this.y = 0;
        this.z = 1;                   // Default z=1 for projection
        this.i = 0;
        this.j = 0;
        this.k = 1;
        this.l = 0;

        // Visual properties
        this.size = 16;                // Distance between parallel lines (2^n)
        this.ext = 0.5;               // Extension multiplier (fraction of size)
        this.color = "#50FF50";       // Hex color

        // Content properties
        this.contents = "";           // String content
        this.called = "";             // Name/title

        // Selection and relationships
        this.chosen = true;           // New frames are chosen by default
        this.contexts = [];           // Array of frame IDs
        this.components = [];         // Array of frame IDs
    }

    // Get the four line segments that make up the # shape
    getLines() {
        const s = this.size / 100;    // Scale to normalized coords
        const e = s * this.ext;       // Extension length

        // Center point is at (x, y, z) in 3D space
        const cx = this.x;
        const cy = this.y;
        const cz = this.z;

        // Four lines in 3D space (projected later)
        return [
            // Top horizontal line
            {
                p1: {x: cx - s/2 - e, y: cy + s/2, z: cz},
                p2: {x: cx + s/2 + e, y: cy + s/2, z: cz}
            },
            // Bottom horizontal line
            {
                p1: {x: cx - s/2 - e, y: cy - s/2, z: cz},
                p2: {x: cx + s/2 + e, y: cy - s/2, z: cz}
            },
            // Left vertical line
            {
                p1: {x: cx - s/2, y: cy - s/2 - e, z: cz},
                p2: {x: cx - s/2, y: cy + s/2 + e, z: cz}
            },
            // Right vertical line
            {
                p1: {x: cx + s/2, y: cy - s/2 - e, z: cz},
                p2: {x: cx + s/2, y: cy + s/2 + e, z: cz}
            }
        ];
    }

    // Size operations (powers of 2)
    scaleUp() {
        this.size *= 2;
    }

    scaleDown() {
        if (this.size > 1) {
            this.size /= 2;
        }
    }

    // Extension operations (powers of 2)
    extendUp() {
        this.ext *= 2;
    }

    extendDown() {
        if (this.ext > 1/32) {  // Minimum extension
            this.ext /= 2;
        }
    }
}

// Create a new Framework (starts empty)
function createFramework() {
    return [];
}

export { Frame, createFramework };
