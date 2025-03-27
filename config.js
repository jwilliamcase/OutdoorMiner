// Configuration object accessible globally (legacy) and exported
const CONFIG = {
    // Use localhost when running locally, otherwise use deployed server URL
    SERVER_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://outdoor-miner-server.onrender.com', // Update with your actual deployed server URL
    BOARD_SIZE: 8, // Smaller board for faster games
    HEX_SIZE: 30,
    COMBO_THRESHOLD: 4,
    LANDMINE_COUNT: 4,
    // Game features
    ENABLE_CHAT: true,
    ENABLE_TAUNTS: true,
    // Common taunts
    TAUNTS: [
      "😈 You're going down!",
      "🔥 Feel the heat!",
      "💥 Boom! Got you!",
      "🙄 Is that all you've got?",
      "🤣 Better luck next time!",
      "👑 I'm the champion here!",
      "🍀 Thanks for the tiles!",
      "🧨 Watch out for mines!",
      "🎯 Perfect strategy!",
      "🎮 Game over for you!"
    ]
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