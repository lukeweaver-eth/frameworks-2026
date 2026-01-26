// Camera system for different orthographic views
// 1: Front (x=left/right, y=up/down, z=in/out)
// 2: Right (z=left/right, y=up/down, x=in/out)
// 3: Back (-x=left/right, y=up/down, -z=in/out)
// 4: Left (-z=left/right, y=up/down, -x=in/out)
// 5: Top (x=left/right, z=up/down, y=in/out)
// 6: Bottom (x=left/right, -z=up/down, -y=in/out)

class Camera {
    constructor() {
        this.view = 1; // Default to front view
    }

    // Transform point from world space to camera space
    // Returns {x, y, z} where x=screen horizontal, y=screen vertical, z=depth
    transform(point) {
        const {x, y, z} = point;

        switch(this.view) {
            case 1: // Front view
                return {x: x, y: y, z: z};

            case 2: // Right view (looking from right side)
                return {x: z, y: y, z: x};

            case 3: // Back view (facing origin, so x is flipped but left still means -x in world)
                return {x: x, y: y, z: -z};

            case 4: // Left view (looking from left side)
                return {x: -z, y: y, z: -x};

            case 5: // Top view (looking down)
                return {x: x, y: z, z: y};

            case 6: // Bottom view (looking up)
                return {x: x, y: -z, z: -y};

            default:
                return {x: x, y: y, z: z};
        }
    }

    // Set camera view (1-6)
    setView(viewNumber) {
        if (viewNumber >= 1 && viewNumber <= 6) {
            this.view = viewNumber;
        }
    }

    // Get current view name
    getViewName() {
        const names = ['', 'Front', 'Right', 'Back', 'Left', 'Top', 'Bottom'];
        return names[this.view];
    }

    // Transform direction for local movement
    // Takes a direction in camera space and returns world space direction
    // NOTE: z component should always be 0 since we only move in the view plane
    transformDirection(dir) {
        const {x, y} = dir; // Only x,y used (movement in view plane)

        switch(this.view) {
            case 1: // Front (XY plane)
                return {x: x, y: y, z: 0};

            case 2: // Right (ZY plane) - x=screen horizontal=world Z, y=screen vertical=world Y
                return {x: 0, y: y, z: x};

            case 3: // Back (XY plane, mirrored)
                return {x: x, y: y, z: 0};

            case 4: // Left (ZY plane) - x=screen horizontal=-world Z, y=screen vertical=world Y
                return {x: 0, y: y, z: -x};

            case 5: // Top (XZ plane) - x=screen horizontal=world X, y=screen vertical=world Z
                return {x: x, y: 0, z: y};

            case 6: // Bottom (XZ plane) - x=screen horizontal=world X, y=screen vertical=-world Z
                return {x: x, y: 0, z: -y};

            default:
                return {x: x, y: y, z: 0};
        }
    }
}

export { Camera };
