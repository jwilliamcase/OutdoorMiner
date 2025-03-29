const CONFIG = {
    SERVER_URL: window.location.hostname === 'jwilliamcase.github.io' 
        ? 'https://outdoor-miner-server.onrender.com'
        : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:10000' // Match server port
            : 'https://outdoor-miner-server.onrender.com',
    BOARD_SIZE: 16, // Change from 8 to 16
    HEX_SIZE: 30,
    GAME_COLORS: [
        '#F76C6C', // Red
        '#374785', // Blue
        '#F8E9A1', // Yellow
        '#50C878', // Green
        '#9B59B6'  // Purple
        // Removed orange to match 5-color spec
    ],
    ENABLE_CHAT: true
};

// Make it available globally for potential legacy access, though imports are preferred
window.CONFIG = CONFIG;

// Log the configuration to verify
console.log("Configuration loaded:", CONFIG);

// Export CONFIG as a named export
export { CONFIG };

// Export for use in other files (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// Ensure it's globally available in browsers
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}