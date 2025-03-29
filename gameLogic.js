import { BOARD, COLORS } from './constants.js';
import { eventManager } from './eventManager.js';
import { GameEvents } from './eventTypes.js';
import { moveHistory } from './moveHistory.js';

// Axial direction vectors for neighboring hexes
const DIRECTIONS = [
    { q: 1, r: 0 },  // East
    { q: 1, r: -1 }, // Northeast
    { q: 0, r: -1 }, // Northwest
    { q: -1, r: 0 }, // West
    { q: -1, r: 1 }, // Southwest
    { q: 0, r: 1 }   // Southeast
];

export class GameState {
    constructor(rows, cols, players) {
        this.rows = rows || CONFIG.BOARD_SIZE;
        this.cols = cols || CONFIG.BOARD_SIZE;
        this.players = players || {};
        this.currentPlayerIndex = 0;
        this.lastUsedColor = null;
        this.currentPlayerColor = null;
        this.gameOver = false;
        this.winner = null;
        this.stateHistory = [];
        this.maxHistoryLength = 10;
        this.boardState = {}; // Initialize empty board state
    }

    createInitialBoard(seed) {
        const board = {};
        const colors = CONFIG.GAME_COLORS;
        const seededRandom = this.createSeededRandom(seed);
        
        // Create board with consistent random colors
        for (let q = 0; q < this.cols; q++) {
            for (let r = 0; r < this.rows; r++) {
                const colorIndex = Math.floor(seededRandom() * colors.length);
                board[`${q},${r}`] = {
                    q, r,
                    color: colors[colorIndex],
                    owner: null,
                    baseColor: colors[colorIndex]
                };
            }
        }

        // Set initial positions
        if (board['0,15']) {
            board['0,15'].owner = 'P1';  // Bottom left
            board['0,15'].baseColor = board['0,15'].color;
        }
        if (board['15,0']) {
            board['15,0'].owner = 'P2';  // Top right
            board['15,0'].baseColor = board['15,0'].color;
        }

        this.boardState = board;
        return board;
    }

    initializePlayerPositions(player1Id, player2Id) {
        // Player 1 (current player) always starts bottom-left
        const player1Pos = `0,${this.rows - 1}`;
        const player2Pos = `${this.cols - 1},0`; // Top-right

        // Assign random colors from available colors for starting positions
        const startColor1 = CONFIG.GAME_COLORS[Math.floor(Math.random() * CONFIG.GAME_COLORS.length)];
        let startColor2;
        do {
            startColor2 = CONFIG.GAME_COLORS[Math.floor(Math.random() * CONFIG.GAME_COLORS.length)];
        } while (startColor2 === startColor1);

        // Set initial positions and colors
        this.board[player1Pos].owner = player1Id;
        this.board[player1Pos].color = startColor1;
        this.board[player1Pos].baseColor = startColor1;

        this.board[player2Pos].owner = player2Id;
        this.board[player2Pos].color = startColor2;
        this.board[player2Pos].baseColor = startColor2;

        // Update last used color
        this.lastUsedColor = null; // Reset on game start
    }

    // New method: Get available colors for current turn
    getAvailableColors() {
        return CONFIG.GAME_COLORS.filter(color => color !== this.lastUsedColor);
    }

    // New method: Find capturable tiles for a color
    findCapturableTiles(playerId, selectedColor) {
        const capturable = new Set();
        const checked = new Set();

        // Start from player's territory
        Object.entries(this.boardState)
            .filter(([_, tile]) => tile.owner === playerId)
            .forEach(([key, _]) => {
                this.findAdjacentMatchingColor(key, selectedColor, capturable, checked);
            });

        return Array.from(capturable);
    }

    // Recursive function to find adjacent matching colors
    findAdjacentMatchingColor(startKey, targetColor, capturable, checked) {
        if (checked.has(startKey)) return;
        checked.add(startKey);

        const [q, r] = startKey.split(',').map(Number);
        const neighbors = this.getNeighbors(q, r);

        neighbors.forEach(neighbor => {
            const key = `${neighbor.q},${neighbor.r}`;
            const tile = this.boardState[key];
            if (tile && tile.baseColor === targetColor && !tile.owner) {
                capturable.add(key);
                this.findAdjacentMatchingColor(key, targetColor, capturable, checked);
            }
        });
    }

    // Get valid moves for current player
    getValidMoves(playerId) {
        const validMoves = new Set();
        const playerTerritory = this.territories.get(playerId);
        
        if (!playerTerritory) return [];

        // Check all hexes adjacent to player's territory
        for (const hex of playerTerritory) {
            const [q, r] = hex.split(',').map(Number);
            const neighbors = this.getNeighbors(q, r);
            
            neighbors.forEach(neighbor => {
                const key = `${neighbor.q},${neighbor.r}`;
                if (this.isValidPosition(neighbor.q, neighbor.r) && !this.board[key].owner) {
                    validMoves.add(key);
                }   
            });
        }

        return Array.from(validMoves);
    }

    // Get neighbors for a hex position
    getNeighbors(q, r) {
        return DIRECTIONS
            .map(dir => ({ q: q + dir.q, r: r + dir.r }))
            .filter(pos => this.isValidPosition(pos.q, pos.r));
    }

    // Check if a position is within board bounds
    isValidPosition(q, r) {
        return q >= 0 && q < this.cols && r >= 0 && r < this.rows;
    }

    // Single consolidated makeMove method
    makeMove(playerId, selectedColor) {
        console.log('Processing move:', {
            playerId,
            selectedColor,
            currentPlayer: this.currentPlayer,
            board: this.boardState
        });

        // Get owned tiles for current player
        const ownedTiles = Object.entries(this.boardState)
            .filter(([_, tile]) => tile.owner === playerId)
            .map(([key]) => key);

        console.log('Current owned tiles:', ownedTiles);

        // Find capturable tiles
        const tilesToCapture = this.findCapturableTiles(ownedTiles, selectedColor);
        console.log('Tiles to capture:', tilesToCapture);

        // Update board state
        [...tilesToCapture, ...ownedTiles].forEach(key => {
            this.boardState[key].owner = playerId;
            this.boardState[key].color = selectedColor;
        });

        // Update game state
        this.lastUsedColor = selectedColor;
        this.currentPlayer = this.currentPlayer === 'P1' ? 'P2' : 'P1';

        return {
            success: true,
            capturedTiles: tilesToCapture,
            newState: this.getSerializableState()
        };
    }

    findCapturableTiles(startingTiles, selectedColor) {
        const capturable = new Set();
        const checked = new Set();

        // For each owned tile
        startingTiles.forEach(startKey => {
            const [q, r] = startKey.split(',').map(Number);
            
            // Get neighbors
            const neighbors = this.getNeighbors(q, r);
            
            // Check each neighbor
            neighbors.forEach(({q: nq, r: nr}) => {
                const neighborKey = `${nq},${nr}`;
                const tile = this.boardState[neighborKey];
                
                // If tile exists, isn't owned, and matches color
                if (tile && !tile.owner && tile.color === selectedColor) {
                    capturable.add(neighborKey);
                    this.findMatchingNeighbors(nq, nr, selectedColor, capturable, checked);
                }
            });
        });

        return Array.from(capturable);
    }

    findMatchingNeighbors(q, r, color, capturable, checked) {
        const key = `${q},${r}`;
        if (checked.has(key)) return;
        checked.add(key);

        const neighbors = this.getNeighbors(q, r);
        neighbors.forEach(({q: nq, r: nr}) => {
            const neighborKey = `${nq},${nr}`;
            const tile = this.boardState[neighborKey];
            if (tile && !tile.owner && tile.color === color && !capturable.has(neighborKey)) {
                capturable.add(neighborKey);
                this.findMatchingNeighbors(nq, nr, color, capturable, checked);
            }
        });
    }

    validateMove(playerId, selectedColor) {
        if (this.gameOver) {
            return { valid: false, reason: 'Game is over' };
        }
        if (this.getCurrentPlayerId() !== playerId) {
            return { valid: false, reason: 'Not your turn' };
        }
        if (selectedColor === this.lastUsedColor) {
            return { valid: false, reason: 'Color was just used' };
        }
        if (this.findCapturableTiles(playerId, selectedColor).length === 0) {
            return { valid: false, reason: 'No valid captures' };
        }
        return { valid: true };
    }

    applyMoveChanges(playerId, selectedColor, capturedTiles, changes) {
        // Apply captures
        capturedTiles.forEach(key => {
            this.board[key].owner = playerId;
            this.board[key].color = selectedColor;
            changes.captured.push(key);
        });

        // Update territory
        Object.entries(this.board)
            .filter(([_, tile]) => tile.owner === playerId)
            .forEach(([key, tile]) => {
                tile.color = selectedColor;
                changes.territory.push(key);
            });

        // Update game state
        this.lastUsedColor = selectedColor;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % Object.keys(this.players).length;

        // Calculate scores
        this.updateScores();
        changes.scores = this.getScores();

        // Check win condition
        if (this.checkGameOver()) {
            eventManager.dispatchEvent(GameEvents.GAME_OVER, {
                winner: this.winner,
                scores: changes.scores
            });
        }

        // Emit state update
        eventManager.dispatchEvent(GameEvents.STATE_UPDATE, {
            state: this.serialize(),
            changes
        });

        return { success: true };
    }

    isValidMove(playerId, selectedColor) {
        return (
            this.getCurrentPlayerId() === playerId &&
            selectedColor !== this.lastUsedColor &&
            this.findCapturableTiles(playerId, selectedColor).length > 0
        );
    }

    getInvalidMoveMessage(playerId, selectedColor) {
        if (this.getCurrentPlayerId() !== playerId) return "Not your turn";
        if (selectedColor === this.lastUsedColor) return "Color was just used";
        if (this.findCapturableTiles(playerId, selectedColor).length === 0) return "No captures possible";
        return "Invalid move";
    }

    // New helper method to handle capture logic
    performCapture(playerId, selectedColor, tilesToCapture) {
        // Track which tiles need visual updating
        const updatedTiles = new Set(tilesToCapture);

        // First capture new tiles
        tilesToCapture.forEach(key => {
            this.board[key].owner = playerId;
            this.board[key].color = selectedColor;
            this.board[key].baseColor = this.board[key].color; // Store original color
        });

        // Then update all existing territory to new color
        Object.entries(this.board)
            .filter(([_, tile]) => tile.owner === playerId)
            .forEach(([key, tile]) => {
                tile.color = selectedColor;
                updatedTiles.add(key);
            });

        return Array.from(updatedTiles); // Return affected tiles for UI update
    }

    // Update player scores based on owned tiles
    updateScores() {
        // Reset scores
        Object.values(this.players).forEach(player => player.score = 0);
        
        // Count owned tiles
        Object.values(this.board).forEach(tile => {
            if (tile.owner && this.players[tile.owner]) {
                this.players[tile.owner].score++;
            }   
        });
    }

    // Check if the game is over
    checkGameOver() {
        // Simple condition: board is full
        const totalTiles = this.rows * this.cols;
        let occupiedTiles = 0;
        for (const key in this.board) {
            if (this.board[key].owner !== null) {
                occupiedTiles++;
            }
        }

        if (occupiedTiles >= totalTiles) {
            this.gameOver = true;
            // Determine winner based on score
            let highestScore = -1;
            let winners = [];
            for (const playerId in this.players) {
                if (this.players[playerId].score > highestScore) {
                    highestScore = this.players[playerId].score;
                    winners = [playerId];
                } else if (this.players[playerId].score === highestScore) {
                    winners.push(playerId);
                }
            }
            this.winner = winners.length === 1 ? winners[0] : 'draw'; // Handle ties
            console.log(`Game Over! Winner: ${this.winner}`);
        }
    }

    /**
     * Returns the current player's ID based on the turn number and player assignment.
     * @returns {string|null} The player ID of the current player or null if unavailable.
     */
    getCurrentPlayerId() {
        if (!this.players || !this.turn) return null;
        const playerEntry = Object.entries(this.players).find(
            ([id, player]) => player.playerNumber === this.turn
        );
        return playerEntry ? playerEntry[0] : null;
    }

    /**
     * Serializes the current game state into a JSON string.
     * @returns {string} JSON representation of the game state.
     */
    serialize() {
        // Simple JSON stringify; can be optimized if needed
        return JSON.stringify({
            rows: this.rows,
            cols: this.cols,
            board: this.board,
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            turnNumber: this.turnNumber,
            gameOver: this.gameOver,
            winner: this.winner
        });
    }

    // Deserialize game state received from network
    static deserialize(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const gameState = new GameState(data.rows, data.cols, data.players); // Initial constructor
            // Overwrite properties with received data
            gameState.board = data.board;
            gameState.currentPlayerIndex = data.currentPlayerIndex;
            gameState.turnNumber = data.turnNumber;
            gameState.gameOver = data.gameOver;
            gameState.winner = data.winner;
            // Ensure players object is correctly assigned (might need deeper copy if complex)
            gameState.players = data.players;

            // Ensure methods are available (they are via prototype)
            console.log("GameState deserialized successfully.");
            return gameState;
        } catch (error) {
            console.error("Failed to deserialize game state:", error, jsonString);
            return null; // Return null or throw error on failure
        }
    }

    saveState() {
        const currentState = {
            timestamp: Date.now(),
            state: this.serialize(),
            moveNumber: this.turnNumber
        };
        this.stateHistory.push(currentState);
        if (this.stateHistory.length > this.maxHistoryLength) {
            this.stateHistory.shift();
        }
        return currentState;
    }

    rollbackToState(timestamp) {
        const historicState = this.stateHistory.find(s => s.timestamp === timestamp);
        if (!historicState) {
            throw new Error('State not found in history');
        }
        const recoveredState = GameState.deserialize(historicState.state);
        Object.assign(this, recoveredState);
        // Remove all states after this point
        this.stateHistory = this.stateHistory.filter(s => s.timestamp <= timestamp);
        return true;
    }

    // Add method to restore from history
    restoreFromHistory(moveIndex) {
        const historicMove = moveHistory.getMoveAt(moveIndex);
        if (!historicMove) return false;

        const restoredState = GameState.deserialize(historicMove.boardState);
        Object.assign(this, restoredState);
        moveHistory.currentIndex = moveIndex;

        eventManager.dispatchEvent(GameEvents.STATE_UPDATE, {
            type: 'history_restore',
            move: historicMove
        });

        return true;
    }

    rotateCoordinatesForPlayer2(q, r) {
        // Rotate 180 degrees for player 2's view
        return {
            q: this.boardSize - 1 - q,
            r: this.boardSize - 1 - r
        };
    }

    renderForPlayer(renderFn, ctx, isPlayer2) {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        if (isPlayer2) {
            ctx.translate(ctx.canvas.width, ctx.canvas.height);
            ctx.rotate(Math.PI);
        }

        if (!this.boardState || Object.keys(this.boardState).length === 0) {
            console.warn('Creating new board state during render');
            this.createInitialBoard(Date.now());
        }

        Object.entries(this.boardState).forEach(([coord, tile]) => {
            if (tile && typeof tile.q !== 'undefined' && typeof tile.r !== 'undefined') {
                const { x, y } = getHexCenter(tile.q, tile.r);
                renderFn(ctx, x, y, tile.color, tile.owner !== null);
            }
        });

        if (isPlayer2) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }

    createSeededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }
}

class ServerGameState {
    // ...existing code...

    isValidMove(playerId, selectedColor) {
        console.log('Validating move:', {
            playerId,
            selectedColor,
            currentPlayer: this.currentPlayer,
            lastUsedColor: this.lastUsedColor
        });

        return (
            playerId === this.currentPlayer &&  // Correct player's turn
            selectedColor !== this.lastUsedColor // Not using last used color
        );
    }

    handleColorSelection(playerId, selectedColor) {
        console.log('Processing color selection:', {
            playerId,
            selectedColor,
            currentState: {
                currentPlayer: this.currentPlayer,
                lastUsedColor: this.lastUsedColor
            }
        });

        // Validate move
        if (!this.isValidMove(playerId, selectedColor)) {
            return {
                success: false,
                message: 'Invalid move'
            };
        }

        // Find capturable tiles
        const capturedTiles = this.findCapturableTiles(playerId, selectedColor);
        
        // Update board state
        this.boardState = this.updateBoardState(playerId, selectedColor, capturedTiles);
        
        // Switch turns and update last used color
        this.lastUsedColor = selectedColor;
        this.currentPlayer = this.currentPlayer === 'P1' ? 'P2' : 'P1';

        // Update scores
        this.updateScores();

        return {
            success: true,
            capturedTiles: capturedTiles,
            newState: this.getSerializableState()
        };
    }
}

// --- Hex Grid Geometry Functions ---

// Get the pixel coordinates of the center of a hex cell
export function getHexCenter(q, r) {
    const x = q * BOARD.HORIZONTAL_SPACING + BOARD.HEX_SIZE;
    const y = r * BOARD.VERTICAL_SPACING + BOARD.HEX_SIZE + (q % 2) * (BOARD.VERTICAL_SPACING / 2);
    return { x, y };
}

// Convert pixel coordinates (world space) to hex coordinates (q, r) - Approximate
// This implementation uses axial coordinates and rounding. Might need refinement.
export function worldToHex(x, y) {
    // Adjust for the offset/origin if necessary (assuming origin is top-left of canvas)

    // Convert pixel coordinates to fractional axial coordinates
    const q_frac = (2 / 3 * x) / BOARD.HEX_SIZE;
    const r_frac = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / BOARD.HEX_SIZE;
    const s_frac = -q_frac - r_frac; // s = -q - r for axial coordinates

    // Round fractional coordinates to nearest integer hex coordinates
    let q = Math.round(q_frac);
    let r = Math.round(r_frac);
    let s = Math.round(s_frac);

    const q_diff = Math.abs(q - q_frac);
    const r_diff = Math.abs(r - r_frac);
    const s_diff = Math.abs(s - s_frac);

    // Reset the coordinate with the largest difference to maintain q + r + s = 0
    if (q_diff > r_diff && q_diff > s_diff) {
        q = -r - s;
    } else if (r_diff > s_diff) {
        r = -q - s;
    } else {
        s = -q - r;
    }

    // Need a mapping back from the axial system used for calculation to the storage/rendering system if different
    // Assuming the storage uses (q, r) from a "pointy top" axial grid perspective for calculation,
    // but rendering might use offset coordinates. The getHexCenter seems to use an offset approach.
    // This conversion needs to be consistent with getHexCenter and the grid structure.

    // Let's try a simpler offset coordinate conversion based on getHexCenter logic inverse:
    // This is tricky due to the staggered nature. A simpler approach might be needed,
    // perhaps iterating through nearby hex centers and finding the closest one.

    // --- Alternative: Check distance to nearest centers ---
    // Estimate rough q, r based on spacing
    const approx_q = (x - BOARD.HEX_SIZE) / BOARD.HORIZONTAL_SPACING;
     // Adjust y for potential staggering before dividing by vertical spacing
     // This depends heavily on the exact grid layout getHexCenter produces.
     // Given the complexity and potential inaccuracy, a common method is to find the
     // candidate hex from the fractional coordinates and then check its neighbors
     // to see which center is truly closest to (x, y).

     // For now, return the rounded axial coordinates. This might need adjustment.
     // TODO: Refine worldToHex conversion for accuracy with the specific grid layout.
    console.warn("worldToHex is using axial rounding, may need refinement for the offset grid.");
    return { q: q, r: r };

    // A more robust method for offset grids often involves checking the region within the hex.
    // See resources like Red Blob Games' Hexagonal Grids guide.
}

// Get the axial coordinates of the six neighbors of a hex cell
export function getNeighbors(q, r) {
    // Axial directions (pointy top)
    const directions = [
        { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 }
    ];
    const neighbors = [];
    directions.forEach(dir => {
        neighbors.push({ q: q + dir.q, r: r + dir.r });
    });
    return neighbors;
}