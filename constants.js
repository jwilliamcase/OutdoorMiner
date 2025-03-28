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
    // Calculate maximum possible hex size that will fit the grid
    const maxHorizontalSize = (containerWidth * 0.9) / (cols * 1.5);
    const maxVerticalSize = (containerHeight * 0.9) / (rows * Math.sqrt(3));
    
    // Use the smaller of the two to ensure board fits both dimensions
    return Math.min(maxHorizontalSize, maxVerticalSize, BOARD.HEX_SIZE);
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
