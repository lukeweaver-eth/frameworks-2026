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
