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
    // Fixed hex size calculation for 16x16 board
    const padding = 0.9; // 90% of container
    const effectiveWidth = (cols * 1.5 + 0.5) * padding;
    const effectiveHeight = (rows * Math.sqrt(3) + 1) * padding;

    // Calculate maximum size that fits
    const maxWidth = containerWidth / effectiveWidth;
    const maxHeight = containerHeight / effectiveHeight;
    
    // Get optimal size
    const size = Math.min(maxWidth, maxHeight);
    
    // Ensure minimum size
    return Math.max(size, 20);
};

// Update BOARD with dynamic spacing getters
export const getHexSpacing = (hexSize) => ({
    VERTICAL: hexSize * Math.sqrt(3),
    HORIZONTAL: hexSize * 1.5,
    STAGGER_OFFSET: hexSize * Math.sqrt(3) / 2
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
