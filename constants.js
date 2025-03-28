// Game Board Constants
export const BOARD = {
    SIZE: 16,
    HEX_SIZE: 30,
    HEX_HEIGHT: Math.sqrt(3) * 30,
    HEX_WIDTH: 2 * 30,
    VERTICAL_SPACING: Math.sqrt(3) * 30,
    HORIZONTAL_SPACING: 2 * 30 * 0.75,
};

// Add responsive sizing helpers
export const calculateOptimalHexSize = (containerWidth, containerHeight, cols, rows) => {
    // Account for the staggered nature of hex grid
    const effectiveWidth = cols * 1.5 + 0.5; // Add 0.5 for last column
    const effectiveHeight = rows * Math.sqrt(3) + (Math.sqrt(3) / 2); // Add half hex for stagger

    // Calculate size constraints with padding
    const maxWidth = (containerWidth * 0.9) / effectiveWidth;
    const maxHeight = (containerHeight * 0.9) / effectiveHeight;

    // Get base size and ensure it's not too small
    const baseSize = Math.min(maxWidth, maxHeight);
    return Math.max(baseSize, 20); // Minimum hex size of 20px
};

// Update BOARD with dynamic spacing getters
export const getHexSpacing = (hexSize) => ({
    VERTICAL: hexSize * Math.sqrt(3),
    HORIZONTAL: hexSize * 1.5
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
