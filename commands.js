// Command system for keystroke-driven transformations
import { Frame } from './frame.js';
import { transformFrame, duplicateFrame, translateXY, translateZ, rotateXY, rotateXZ, reflectH, reflectV } from './transforms.js';

class CommandSystem {
    constructor(framework, camera) {
        this.framework = framework;
        this.camera = camera;
        this.commandLog = [];
        this.cursor = { x: 0, y: 0, z: 1 };
        this.mode = null; // Current transformation mode: 'translate', 'scale', 'select'
        this.selectionRange = { start: 0, end: 0 }; // For # selection
    }

    // Execute a command based on keystroke
    execute(key) {
        const chosen = this.framework.filter(f => f.chosen);

        // Log command with accumulated mode keys
        if (this.mode && ['i', 'j', 'k', 'l', 'I', 'J', 'K', 'L'].includes(key)) {
            // Accumulate within mode
            if (!this.modeCommand) {
                this.modeCommand = this.mode.charAt(0); // 't', 's', or '#'
            }
            this.modeCommand += key;
            this.commandLog[this.commandLog.length - 1] = this.modeCommand;
            console.log('Command:', this.modeCommand);
        } else {
            // New command
            this.commandLog.push(key);
            this.modeCommand = null;
            console.log('Command:', key);
        }

        // Handle mode-based navigation
        if (this.mode === 'translate') {
            if (['i', 'j', 'k', 'l', 'I', 'J', 'K', 'L'].includes(key)) {
                const amount = (key === key.toUpperCase()) ? 0.04 : 0.02; // 2x for uppercase
                this.translate(chosen, key.toLowerCase(), amount);
                return;
            } else if (key === 't' || key === 'T') {
                return; // Stay in translate mode
            } else {
                this.mode = null;
                this.modeCommand = null; // Exit mode
            }
        }

        if (this.mode === 'scale') {
            if (key === 'i') {
                // Increase individual frame sizes
                chosen.forEach(frame => frame.scaleUp());
                return;
            } else if (key === 'k') {
                // Decrease individual frame sizes
                chosen.forEach(frame => frame.scaleDown());
                return;
            } else if (key === 'I') {
                // Increase extensions
                chosen.forEach(frame => frame.extendUp());
                return;
            } else if (key === 'K') {
                // Decrease extensions
                chosen.forEach(frame => frame.extendDown());
                return;
            } else if (key === 's') {
                return; // Stay in scale mode
            } else {
                this.mode = null;
                this.modeCommand = null; // Exit mode
            }
        }

        if (this.mode === 'scaleStructure') {
            if (key === 'i') {
                // Scale entire structure up (expand from center)
                this.scaleStructureUp(chosen);
                return;
            } else if (key === 'k') {
                // Scale entire structure down (contract to center)
                this.scaleStructureDown(chosen);
                return;
            } else if (key === 'S') {
                return; // Stay in scale structure mode
            } else {
                this.mode = null;
                this.modeCommand = null; // Exit mode
            }
        }

        if (this.mode === 'select') {
            if (key === 'l') {
                this.selectionRange.end++;
                this.updateSelection();
                return;
            } else if (key === 'j') {
                this.selectionRange.start--;
                this.updateSelection();
                return;
            } else if (key === 'i') {
                this.selectionRange.start++;
                this.updateSelection();
                return;
            } else if (key === 'k') {
                this.selectionRange.end--;
                this.updateSelection();
                return;
            } else if (key === 'L') {
                this.selectionRange.start++;
                this.selectionRange.end++;
                this.updateSelection();
                return;
            } else if (key === 'J') {
                this.selectionRange.start--;
                this.selectionRange.end--;
                this.updateSelection();
                return;
            } else if (key === '#') {
                return; // Stay in select mode
            } else {
                this.mode = null;
                this.modeCommand = null; // Exit mode
            }
        }

        switch(key.toLowerCase()) {
            // Frame operations
            case 'f':
                if (key === 'f') this.createFrame();
                else this.reframe();
                break;

            // Duplicate
            case 'd':
                this.duplicate(chosen);
                break;

            // Scale - enter scale mode
            case 's':
                if (key === 's') {
                    this.mode = 'scale';
                } else {
                    this.mode = 'scaleStructure';
                }
                return;

            // Select all
            case 'a':
                this.selectAll();
                break;

            // Reflect
            case 'e':
                if (key === 'e') this.reflect(chosen, 'h');
                else this.reflect(chosen, 'v');
                break;

            // Rotate
            case 'r':
                if (key === 'r') this.rotate(chosen, Math.PI/2);
                else this.rotate(chosen, Math.PI/4);
                break;

            // Translate - enter translate mode
            case 't':
                this.mode = 'translate';
                return;

            // Selection range mode
            case '#':
                this.mode = 'select';
                this.selectionRange = { start: 0, end: 0 };
                this.updateSelection();
                return;

            // Delete
            case 'x':
                this.delete(chosen);
                break;

            // Snap cursor
            case 'z':
                if (key === 'z') this.snapCursorToCenter(chosen);
                else this.snapStructureToCursor();
                break;

            // Line thickness
            case 'l':
                // Needs follow-up key for operation (i/j/k/l)
                return 'awaiting_line_operation';

            default:
                console.log('Unknown command:', key);
        }
    }

    // Create new frame at cursor
    createFrame() {
        const newFrame = new Frame(this.framework.length);
        newFrame.x = this.cursor.x;
        newFrame.y = this.cursor.y;
        newFrame.z = this.cursor.z;
        this.framework.push(newFrame);
    }

    // Reframe (reset chosen frames)
    reframe() {
        this.framework.forEach(f => {
            if (f.chosen) {
                f.size = 2;
                f.ext = 0.5;
            }
        });
    }

    // Duplicate chosen frames
    duplicate(chosen) {
        chosen.forEach(frame => {
            const copy = duplicateFrame(frame, this.framework.length);
            this.framework.push(copy);
        });
    }

    // Scale chosen frames
    scaleFrames(chosen) {
        chosen.forEach(frame => frame.scaleUp());
    }

    // Scale entire structure
    scaleStructure() {
        this.framework.forEach(frame => frame.scaleUp());
    }

    // Select all frames of same color as chosen
    selectByColor(chosen) {
        if (chosen.length === 0) return;
        const color = chosen[0].color;
        this.framework.forEach(f => {
            if (f.color === color) f.chosen = true;
        });
    }

    // Select all frames
    selectAll() {
        this.framework.forEach(f => f.chosen = true);
    }

    // Reflect frames
    reflect(chosen, direction) {
        const reflectFn = direction === 'h' ? reflectH : reflectV;
        chosen.forEach(frame => transformFrame(frame, reflectFn));
    }

    // Rotate frames
    rotate(chosen, angle) {
        chosen.forEach(frame => transformFrame(frame, p => rotateXY(p, angle)));
    }

    // Translate frames (camera-aware)
    translate(chosen, direction, amount) {
        // Direction in camera space
        const cameraDir = {
            'i': { x: 0, y: amount, z: 0 },    // up in camera
            'j': { x: -amount, y: 0, z: 0 },   // left in camera
            'k': { x: 0, y: -amount, z: 0 },   // down in camera
            'l': { x: amount, y: 0, z: 0 }     // right in camera
        }[direction];

        // Transform to world space
        const worldDir = this.camera.transformDirection(cameraDir);

        // Apply translation
        chosen.forEach(frame => {
            frame.x += worldDir.x;
            frame.y += worldDir.y;
            frame.z += worldDir.z;
        });
    }

    // Delete chosen frames
    delete(chosen) {
        const chosenIds = new Set(chosen.map(f => f.count));
        this.framework = this.framework.filter(f => !chosenIds.has(f.count));
    }

    // Snap cursor to center of chosen frames
    snapCursorToCenter(chosen) {
        if (chosen.length === 0) return;
        const avgX = chosen.reduce((sum, f) => sum + f.x, 0) / chosen.length;
        const avgY = chosen.reduce((sum, f) => sum + f.y, 0) / chosen.length;
        const avgZ = chosen.reduce((sum, f) => sum + f.z, 0) / chosen.length;
        this.cursor = { x: avgX, y: avgY, z: avgZ };
    }

    // Snap structure to cursor
    snapStructureToCursor() {
        const chosen = this.framework.filter(f => f.chosen);
        if (chosen.length === 0) return;

        const avgX = chosen.reduce((sum, f) => sum + f.x, 0) / chosen.length;
        const avgY = chosen.reduce((sum, f) => sum + f.y, 0) / chosen.length;

        const dx = this.cursor.x - avgX;
        const dy = this.cursor.y - avgY;

        chosen.forEach(frame => {
            frame.x += dx;
            frame.y += dy;
        });
    }

    // Scale entire structure up (expand from center)
    scaleStructureUp(chosen) {
        if (chosen.length === 0) return;

        // Find center of selection
        const centerX = chosen.reduce((sum, f) => sum + f.x, 0) / chosen.length;
        const centerY = chosen.reduce((sum, f) => sum + f.y, 0) / chosen.length;

        // Scale positions and sizes
        chosen.forEach(frame => {
            // Scale position relative to center
            const dx = frame.x - centerX;
            const dy = frame.y - centerY;
            frame.x = centerX + dx * 2;
            frame.y = centerY + dy * 2;

            // Scale size
            frame.scaleUp();
        });
    }

    // Scale entire structure down (contract to center)
    scaleStructureDown(chosen) {
        if (chosen.length === 0) return;

        // Find center of selection
        const centerX = chosen.reduce((sum, f) => sum + f.x, 0) / chosen.length;
        const centerY = chosen.reduce((sum, f) => sum + f.y, 0) / chosen.length;

        // Scale positions and sizes
        chosen.forEach(frame => {
            // Scale position relative to center
            const dx = frame.x - centerX;
            const dy = frame.y - centerY;
            frame.x = centerX + dx / 2;
            frame.y = centerY + dy / 2;

            // Scale size
            frame.scaleDown();
        });
    }

    // Update selection based on range
    updateSelection() {
        // Deselect all first
        this.framework.forEach(f => f.chosen = false);

        // Clamp range to valid indices
        const start = Math.max(0, Math.min(this.selectionRange.start, this.framework.length - 1));
        const end = Math.max(0, Math.min(this.selectionRange.end, this.framework.length - 1));

        // Select range (inclusive)
        const min = Math.min(start, end);
        const max = Math.max(start, end);

        for (let i = min; i <= max && i < this.framework.length; i++) {
            this.framework[i].chosen = true;
        }
    }

    // Get command history (for blockchain storage)
    getCommandLog() {
        return this.commandLog;
    }
}

export { CommandSystem };
