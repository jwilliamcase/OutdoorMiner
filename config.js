export const CONFIG = {
    SERVER_URL: 'http://localhost:3000',
    BOARD_SIZE: 16,
    GAME_COLORS: ['#F76C6C', '#374785', '#F8E9A1', '#50C878', '#9B59B6'],
    DEBUG: true
};

// Improve logging format
if (CONFIG.DEBUG) {
    console.log('Configuration loaded:', {
        BOARD_SIZE: CONFIG.BOARD_SIZE,
        DEBUG: CONFIG.DEBUG,
        GAME_COLORS: CONFIG.GAME_COLORS,
        SERVER_URL: CONFIG.SERVER_URL
    });
}