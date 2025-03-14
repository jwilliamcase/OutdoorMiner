// Game configuration
const CONFIG = {
  // Server URL - change based on environment
  SERVER_URL: 'https://outdoor-miner-server.onrender.com', // You'll update this when you deploy
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
    "😈 Up your ass you dumbbitch!",
    "🔥 Feel the burn fatty!",
    "💥 I will blow up your car!",
    "🙄 Your are a garbage person!",
    "🤣 GET FUCKED HUMAN!",
    "👑 I will hide your head!",
    "🍀 Death is funny!",
    "🧨 I know where you live!",
    "🎯 STUPID PIECE OF SHIT!",
    "🎮 I OWN YOUR SOUL!"
  ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
