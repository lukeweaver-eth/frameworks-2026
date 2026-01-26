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
