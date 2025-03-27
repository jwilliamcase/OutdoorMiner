// Game Board Constants
export const BOARD = {
    SIZE: 16,
    HEX_SIZE: 30,
    HEX_HEIGHT: Math.sqrt(3) * 30,
    HEX_WIDTH: 2 * 30,
    VERTICAL_SPACING: Math.sqrt(3) * 30,
    HORIZONTAL_SPACING: 2 * 30 * 0.75,
};

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
