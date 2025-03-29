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
    // Updated calculation to account for overlapping hexes
    const padding = 0.95; // Increase from 0.9 to 0.95 for better space usage
    
    // Account for hex overlap in width calculation
    const effectiveWidth = (cols * 1.5) * padding; // Changed multiplier
    const effectiveHeight = (rows * Math.sqrt(3)) * padding;

    const maxWidth = containerWidth / effectiveWidth;
    const maxHeight = containerHeight / effectiveHeight;
    
    const size = Math.min(maxWidth, maxHeight);
    return Math.max(size, 25); // Increased minimum size from 20 to 25
};

// Update BOARD with dynamic spacing getters
export const getHexSpacing = (hexSize) => ({
    VERTICAL: hexSize * Math.sqrt(3),
    HORIZONTAL: hexSize * 1.5, // This ensures proper overlap
    STAGGER_OFFSET: (hexSize * Math.sqrt(3)) / 2
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
