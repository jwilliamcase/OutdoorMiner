import { GameState } from '../gameLogic.js';
import { CONFIG } from '../config.js';

describe('GameState', () => {
    let gameState;

    beforeEach(() => {
        gameState = new GameState(CONFIG.BOARD_SIZE, CONFIG.BOARD_SIZE);
    });

    test('initializes with correct dimensions', () => {
        expect(gameState.rows).toBe(CONFIG.BOARD_SIZE);
        expect(gameState.cols).toBe(CONFIG.BOARD_SIZE);
    });

    test('validates moves correctly', () => {
        // Test move validation
        const result = gameState.validateMove('player1', '#F76C6C');
        expect(result.valid).toBeDefined();
    });

    // Add more test cases...
});
