// Game Board Constants
export const BOARD = {
    SIZE: 16,
    HEX_SIZE: 25, // Reduced from 30
    get HEX_HEIGHT() { return Math.sqrt(3) * this.HEX_SIZE; },
    get HEX_WIDTH() { return 2 * this.HEX_SIZE; },
    // Further reduce spacing to eliminate overlap
    get VERTICAL_SPACING() { return this.HEX_HEIGHT * 0.85; },  // Reduced from 0.86
    get HORIZONTAL_SPACING() { return this.HEX_WIDTH * 0.73; }, // Reduced from 0.74
    PADDING: 40 // Add padding for centering
};

// Add responsive sizing helpers
export const calculateOptimalHexSize = (containerWidth, containerHeight, cols, rows) => {
    // More conservative sizing - use 85% of container
    const padding = 0.85;
    
    // Account for hex overlap and margins
    const effectiveWidth = (cols * 1.5) * padding;
    const effectiveHeight = (rows * Math.sqrt(3)) * padding;

    // Calculate max size that will fit
    const maxWidth = containerWidth / effectiveWidth;
    const maxHeight = containerHeight / effectiveHeight;
    
    // Use smaller size and enforce max size of 25
    const size = Math.min(maxWidth, maxHeight, 25);
    return Math.max(size, 15); // Set minimum size to 15
};

// Fix spacing calculation
export const getHexSpacing = (hexSize) => ({
    VERTICAL: hexSize * Math.sqrt(3) * 0.85,    // Match board constant
    HORIZONTAL: hexSize * 1.46,                 // Further reduced
    STAGGER_OFFSET: hexSize * Math.sqrt(3) / 2.2 // Adjusted stagger
});

// Game Colors
export const COLORS = {
    RED: '#F76C6C',
    BLUE: '#374785',
    YELLOW: '#F8E9A1',
    GREEN: '#50C878',
    PURPLE: '#9B59B6'
};

// Event Names
export const EVENTS = {
    TURN_START: 'turn:start',
    TURN_END: 'turn:end',
    MOVE_MADE: 'move:made'
};
