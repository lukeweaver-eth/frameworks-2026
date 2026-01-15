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
