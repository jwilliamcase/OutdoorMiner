// Core hex geometry constants - using Red Blob Games formulas
export const BOARD = {
    SIZE: 16,
    HEX_SIZE: 25,
    
    // Base hex geometry
    get WIDTH() { return 2 * this.HEX_SIZE; },
    get HEIGHT() { return Math.sqrt(3) * this.HEX_SIZE; },
    
    // Spacing (pointy-top hexagons)
    get COL_SPACING() { return this.WIDTH * 3/4; },        // horizontal distance
    get ROW_SPACING() { return this.HEIGHT; },             // vertical distance
    get ROW_HEIGHT() { return this.HEIGHT; },              // for convenience
    
    PADDING: 40
};

// Simplified hex size calculator
export const calculateOptimalHexSize = (width, height, cols, rows) => {
    // Calculate size that would fit width
    const widthSize = (width - BOARD.PADDING * 2) / (cols * 1.5 + 0.5);
    
    // Calculate size that would fit height
    const heightSize = (height - BOARD.PADDING * 2) / ((rows + 0.5) * Math.sqrt(3));
    
    // Use smaller size, capped between 15 and 25
    return Math.min(Math.max(Math.min(widthSize, heightSize), 15), 25);
};

// Get exact hex measurements for given size
export const getHexMetrics = (size) => ({
    width: size * 2,
    height: size * Math.sqrt(3),
    // Exact vertex positions for pointy-top hex
    vertices: Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i;
        return {
            x: size * Math.cos(angle),
            y: size * Math.sin(angle)
        };
    })
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
