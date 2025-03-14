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
    "😈 Better luck next time!",
    "🔥 Feel the burn!",
    "💥 Boom! Did that hurt?",
    "🙄 Is that all you've got?",
    "🤣 Nice try!",
    "👑 Bow down to the champion!",
    "🍀 Luck is on my side!",
    "🧨 Another mine with your name on it!",
    "🎯 Direct hit!",
    "🎮 Get on my level!"
  ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}