// frameworks-palette-v3.0.js
// Color palettes for Frameworks V3

/**
 * Color palettes
 * Each palette is an array of hex color strings
 */
const PALETTES = {
    // Palette 0: Checks (vibrant colors from V2)
    checks: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
        '#E76F51', '#2A9D8F', '#E9C46A', '#F4A261', '#E63946',
        '#A8DADC', '#457B9D', '#1D3557', '#F1FAEE', '#E07A5F'
    ],

    // Palette 1: Flexoki (from V2)
    flexoki: [
        '#D4C5B9', '#E4DDD3', '#F4F0E8', '#FFFCF0',
        '#CECDC3', '#E5E4DD', '#F2F0E5', '#FFFEF8',
        '#403E3A', '#575653', '#6F6E69', '#878580',
        '#B7B5AC', '#D8D5C9', '#F4F0E8', '#FFFCF0'
    ],

    // Palette 2: Grayscale
    grayscale: [
        '#000000', '#1A1A1A', '#333333', '#4D4D4D',
        '#666666', '#808080', '#999999', '#B3B3B3',
        '#CCCCCC', '#E6E6E6', '#F2F2F2', '#FFFFFF'
    ],

    // Palette 3: Warm
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
    constructor(paletteName = 'checks') {
        this.currentPalette = PALETTES[paletteName] || PALETTES.checks;
        this.currentIndex = 0;
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PALETTES, PaletteManager };
}
