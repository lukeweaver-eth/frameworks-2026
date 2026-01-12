// frameworks-commands-v3.0.js
// Command parser and executor for Frameworks V3

/**
 * Command executor
 * Handles keyboard input and modifies framework state
 */
class CommandExecutor {
    constructor(framework, paletteManager, renderer = null, commandTree = null) {
        this.framework = framework;
        this.palette = paletteManager;
        this.renderer = renderer; // Optional: for view switching
        this.commandTree = commandTree; // Optional: for command tree navigation
        this.lastCommand = '';
    }

    /**
     * Execute a single-character command
     */
    executeKey(key) {
        const fw = this.framework;

        // If command tree is enabled and we're in command context mode
        if (this.commandTree && this.commandTree.inCommandContext) {
            return this.handleCommandContextNavigation(key);
        }

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
            case 'D':
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

            // Delete
            case 'x':
                this.deleteSelected();
                break;

            // Color
            case 'p':
                this.cycleColorForward();
                break;

            // Command context (undo/fork navigation)
            case 'u':
                if (this.commandTree) {
                    this.commandTree.toggleCommandContext();
                    // Reset mode when entering command context
                    if (this.commandTree.inCommandContext) {
                        fw.mode = 'normal';
                        console.log('Entered command context - mode reset to normal');
                    }
                } else {
                    console.log('Command tree not enabled');
                }
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
     * Delete all selected frames
     */
    deleteSelected() {
        const fw = this.framework;
        const selected = fw.getSelectedFrames();

        if (selected.length === 0) {
            console.log('No frames selected');
            return;
        }

        // Remove selected frames from the framework
        fw.frames = fw.frames.filter(frame => !frame.selected);

        console.log('Deleted', selected.length, 'frames');
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

        console.log('Reflected', selected.length, 'frames horizontally across', reflectAxis, 'coordinate at cursor');
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

        console.log('Reflected', selected.length, 'frames vertically across', reflectAxis, 'coordinate at cursor');
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

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }

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

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }

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

        // Add to command tree if enabled
        if (this.commandTree && !this.commandTree.inCommandContext) {
            this.commandTree.addCommand(key);
        }

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
     * Reconstruct framework state from current command tree position
     * Clears the framework and replays commands from the start
     */
    reconstructState() {
        const cmdSequence = this.commandTree.getCurrentCommandSequence();

        console.log('Reconstructing state from', cmdSequence.length, 'commands');

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

        console.log('State reconstructed:', this.framework.frames.length, 'frames');
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
            case ' ':
                this.snapSelectionToCursor();
                break;
            case 'p':
                this.cycleColorForward();
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                this.setView(parseInt(key));
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
