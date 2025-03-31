// Core hex geometry constants
export const BOARD = {
    SIZE: 16,
    BASE_SIZE: 25,
    PADDING: 40,
    MIN_SIZE: 15,
    MAX_SIZE: 25
};

// Exact hex measurements calculator
export const getHexGeometry = (size) => ({
    height: 2 * size,
    width: Math.sqrt(3) * size,
    colSpacing: (Math.sqrt(3) * size) * 3/4,
    rowSpacing: 2 * size,
    vertices: Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6; // Start at 30° for pointy-top
        return {
            x: size * Math.cos(angle),
            y: size * Math.sin(angle)
        };
    })
});

// Simplified hex size calculator
export const calculateOptimalHexSize = (width, height, cols, rows) => {
    // Calculate size that would fit width
    const widthSize = (width - BOARD.PADDING * 2) / (cols * 1.5 + 0.5);
    
    // Calculate size that would fit height
    const heightSize = (height - BOARD.PADDING * 2) / ((rows + 0.5) * Math.sqrt(3));
    
    // Use smaller size, capped between 15 and 25
    return Math.min(Math.max(Math.min(widthSize, heightSize), BOARD.MIN_SIZE), BOARD.MAX_SIZE);
};

// Game Colors
export const COLORS = {
    RED: '#F76C6C',
    BLUE: '#374785',
    YELLOW: '#F8E9A1',
    GREEN: '#50C878',
    PURPLE: '#9B59B6'
};

// Convert to array for iteration
export const COLOR_LIST = Object.values(COLORS);

// Remove EVENTS export as it's now handled by eventTypes.js
