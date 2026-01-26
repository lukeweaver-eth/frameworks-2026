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
