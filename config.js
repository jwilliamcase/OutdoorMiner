// Configuration object accessible globally (legacy) and exported
const CONFIG = {
    // Use environment variables or default values
    // Note: process.env won't work directly in browser-side JS without a build tool.
    // Defaulting to localhost for typical local development.
    // Ensure this URL points to your *running* server.
    SERVER_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://your-production-server.com', // Update this with your actual production server
    BOARD_SIZE: 12,
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