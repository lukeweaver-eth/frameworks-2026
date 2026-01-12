// frameworks-commands-v3.0.js
// Command parser and executor for Frameworks V3

/**
 * Command executor
 * Handles keyboard input and modifies framework state
 */
class CommandExecutor {
    constructor(framework, paletteManager, renderer = null) {
        this.framework = framework;
        this.palette = paletteManager;
        this.renderer = renderer; // Optional: for view switching
        this.lastCommand = '';
    }

    /**
     * Execute a single-character command
     */
    executeKey(key) {
        const fw = this.framework;

        // Mode-dependent commands (ijkl)
        if (fw.mode === 'translate') {
            // If in translate mode, check if key is ijkl
            if (['i', 'j', 'k', 'l'].includes(key)) {
                return this.handleTranslate(key);
            }
            // Any other key exits translate mode and executes normally
            fw.mode = 'normal';
            console.log('Exiting translate mode');
        } else if (fw.mode === 'translateCursor') {
            // If in translate cursor mode, check if key is ijkl
            if (['i', 'j', 'k', 'l'].includes(key)) {
                return this.handleTranslateCursor(key);
            }
            // Any other key exits translate cursor mode and executes normally
            fw.mode = 'normal';
            console.log('Exiting translate cursor mode');
        } else if (fw.mode === 'scale') {
            // If in scale mode, check if key is ik
            if (['i', 'k'].includes(key)) {
                return this.handleScale(key);
            }
            // Any other key exits scale mode and executes normally
            fw.mode = 'normal';
            console.log('Exiting scale mode');
        } else if (fw.mode === 'scaleSelection') {
            // If in scale selection mode, check if key is ik
            if (['i', 'k'].includes(key)) {
                return this.handleScaleSelection(key);
            }
            // Any other key exits scale selection mode and executes normally
            fw.mode = 'normal';
            console.log('Exiting scale selection mode');
        }

        // Normal mode commands
        switch (key) {
            // Frame creation
            case 'f':
                this.createFrame();
                break;

            // Duplication
            case 'd':
                this.duplicateSelected();
                break;

            // Translation modes
            case 't':
                fw.mode = 'translate';
                console.log('Translate mode (frames)');
                break;
            case 'T':
                fw.mode = 'translateCursor';
                console.log('Translate mode (cursor)');
                break;

            // Scale modes
            case 's':
                fw.mode = 'scale';
                console.log('Scale mode (individual frames)');
                break;
            case 'S':
                fw.mode = 'scaleSelection';
                console.log('Scale mode (entire selection)');
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
            case ' ':
                this.snapSelectionToCursor();
                break;

            // Color
            case 'p':
                this.cycleColorForward();
                break;

            // Views (0 = spatial, 1-6 = orthographic)
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                this.setView(parseInt(key));
                break;

            // Escape - exit modes
            case 'Escape':
                fw.mode = 'normal';
                console.log('Normal mode');
                break;

            default:
                console.log('Unknown command:', key);
        }

        // Record command
        this.lastCommand = key;
        fw.commandHistory.push(key);
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

        console.log('Created frame at', fw.cursor.x, fw.cursor.y, fw.cursor.z, 'normal:', ihat, jhat, khat);
    }

    /**
     * Duplicate all selected frames
     */
    duplicateSelected() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) {
            console.log('No frames selected');
            return;
        }

        // Deselect originals
        fw.deselectAll();

        // Duplicate each frame in place (same position)
        selected.forEach(original => {
            const dup = original.duplicate();
            fw.addFrame(dup);
        });

        console.log('Duplicated', selected.length, 'frames in place');
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

        console.log('Rotated', selected.length, 'frames by', angle, 'radians around', axis, 'axis');
    }

    /**
     * Reflect selected frames horizontally around cursor
     */
    reflectSelectedH() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        selected.forEach(frame => {
            frame.reflectH(fw.cursor.x, fw.cursor.y);
        });

        console.log('Reflected', selected.length, 'frames horizontally');
    }

    /**
     * Reflect selected frames vertically around cursor
     */
    reflectSelectedV() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        selected.forEach(frame => {
            frame.reflectV(fw.cursor.x, fw.cursor.y);
        });

        console.log('Reflected', selected.length, 'frames vertically');
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

        console.log('Selected all frames with color', targetColor);
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

        console.log('Snapped selection to cursor');
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

        console.log('Changed color to', newColor);
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
        console.log('Scaled frames by', scaleFactor);
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
        console.log('Scaled entire selection by', scaleFactor);
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
        console.log('Cursor moved to', fw.cursor.x, fw.cursor.y, fw.cursor.z);
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
        console.log('View:', viewNames[viewNumber]);
    }

    /**
     * Execute a command string (for replay)
     */
    executeCommandString(cmdString) {
        for (let i = 0; i < cmdString.length; i++) {
            this.executeKey(cmdString[i]);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommandExecutor };
}
