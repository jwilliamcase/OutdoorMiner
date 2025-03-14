// Game configuration
const CONFIG = {
  // Server URL - change based on environment
  SERVER_URL: 'https://outdoor-miner-server.onrender.com',
  // For local testing use:
  // SERVER_URL: 'http://localhost:3000',
  
  // Game settings
  MAX_PLAYERS: 2,
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

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
