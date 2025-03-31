import { BOARD, COLORS } from './constants.js';
import { eventManager } from './eventManager.js';
import { GameEvents } from './eventTypes.js';
import { moveHistory } from './moveHistory.js';
import { HexService } from './services/HexService.js';

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
        this.stateTimestamp = Date.now();
        this.stateVersion = 0;
        this.rows = rows || CONFIG.BOARD_SIZE;
        this.cols = cols || CONFIG.BOARD_SIZE;
        this.players = players || {};
        this.currentPlayerIndex = 0;
        this.lastUsedColor = null;
        this.boardState = {};
        this.initialized = false;
    }

    initializeState(serverState, playerId) {
        if (!serverState || !playerId) {
            console.error('Missing required initialization data');
            return false;
        }

        try {
            // Deep copy the server state
            Object.assign(this, JSON.parse(JSON.stringify(serverState)));
            
            // Store local player info
            this.localPlayerId = playerId;
            this.playerSymbol = this.players.P1?.socketId === playerId ? 'P1' : 'P2';
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('State initialization failed:', error);
            return false;
        }
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

        // First get all tiles owned by the player
        const playerTiles = Object.entries(this.boardState)
            .filter(([_, tile]) => tile.owner === playerId)
            .map(([key, _]) => {
                const [q, r] = key.split(',').map(Number);
                return { q, r };
            });

        // Find all unclaimed tiles of the selected color that are adjacent to player territory
        playerTiles.forEach(tile => {
            const neighbors = HexService.getNeighbors(tile.q, tile.r);
            neighbors.forEach(neighbor => {
                const key = `${neighbor.q},${neighbor.r}`;
                const neighborTile = this.boardState[key];
                
                if (neighborTile && 
                    !neighborTile.owner && 
                    neighborTile.color === selectedColor &&
                    !capturable.has(key)) {
                    
                    // Add this tile and find its connected color group
                    capturable.add(key);
                    const connected = HexService.findConnectedColorGroup(
                        neighbor,
                        this.boardState,
                        selectedColor
                    );
                    connected.forEach(connectedKey => capturable.add(connectedKey));
                }
            });
        });

        return Array.from(capturable);
    }

    findConnectedColorChain(startKey, targetColor, capturable, checked) {
        if (checked.has(startKey)) return;
        checked.add(startKey);

        const [q, r] = startKey.split(',').map(Number);
        
        // Define the six adjacent hex directions
        const directions = [
            {q: 1, r: 0},   // East
            {q: 1, r: -1},  // Northeast
            {q: 0, r: -1},  // Northwest
            {q: -1, r: 0},  // West
            {q: -1, r: 1},  // Southwest
            {q: 0, r: 1}    // Southeast
        ];

        // Check each neighboring hex
        directions.forEach(dir => {
            const nq = q + dir.q;
            const nr = r + dir.r;
            const neighborKey = `${nq},${nr}`;

            // Validate position is within board bounds
            if (nq >= 0 && nq < this.boardSize && nr >= 0 && nr < this.boardSize) {
                const neighborTile = this.boardState[neighborKey];
                
                // If the neighbor matches our target color and isn't owned
                if (neighborTile && 
                    neighborTile.color === targetColor && 
                    !neighborTile.owner) {
                    
                    // Add to capture set
                    capturable.add(neighborKey);
                    
                    // Recursively check this tile's neighbors
                    // This is what creates the chain reaction effect
                    this.findConnectedColorChain(neighborKey, targetColor, capturable, checked);
                }
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
        return HexService.isValidPosition(q, r, this.boardSize);
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

        // Initialize board if needed
        if (!this.boardState || Object.keys(this.boardState).length === 0) {
            this.gameSeed = this.gameSeed || Date.now(); // Use existing seed or create new one
            this.boardState = this.createInitialBoard(this.gameSeed);
        }

        // Render board state
        Object.entries(this.boardState).forEach(([coord, tile]) => {
            if (tile && typeof tile.q !== 'undefined' && typeof tile.r !== 'undefined') {
                const { x, y } = getHexCenter(tile.q, tile.r);
                renderFn(ctx, x, y, tile.color, tile.owner !== null);  // Color passed here
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

    handleColorSelection(playerId, selectedColor) {
        console.log('Processing color selection:', {
            playerId,
            selectedColor,
            currentPlayer: this.currentPlayer,
            lastUsedColor: this.lastUsedColor
        });

        try {
            // Find all capturable tiles including chains
            const capturedTiles = this.findCapturableTiles(playerId, selectedColor);
            
            // Track all tiles that need updating (both captured and existing territory)
            const tilesToUpdate = new Set([...capturedTiles]);

            // Add existing territory to the update set
            Object.entries(this.boardState).forEach(([key, tile]) => {
                if (tile.owner === playerId) {
                    tilesToUpdate.add(key);
                }
            });

            // Update ALL tiles to new color
            tilesToUpdate.forEach(key => {
                if (this.boardState[key]) {
                    this.boardState[key].owner = playerId;
                    this.boardState[key].color = selectedColor;
                }
            });

            // Log capture results
            console.log('Capture complete:', {
                capturedCount: capturedTiles.length,
                totalUpdated: tilesToUpdate.size
            });

            return {
                success: true,
                capturedTiles: Array.from(capturedTiles),
                updatedTiles: Array.from(tilesToUpdate)
            };
        } catch (error) {
            console.error('Error in handleColorSelection:', error);
            return { success: false, message: 'Error processing move' };
        }
    }

    validateState(serverState) {
        if (!serverState) return false;
        
        // Check if server state is newer
        if (serverState.stateVersion <= this.stateVersion) {
            console.warn("Received outdated state version");
            return false;
        }

        // Validate critical properties
        const requiredProps = ['boardState', 'players', 'currentPlayer', 'lastUsedColor'];
        if (!requiredProps.every(prop => prop in serverState)) {
            console.error("Missing required state properties");
            return false;
        }

        return true;
    }

    updateFromServer(serverState) {
        if (!this.validateState(serverState)) {
            eventManager.dispatchEvent(NetworkEvents.SYNC_ERROR, {
                message: "Invalid state received",
                currentVersion: this.stateVersion,
                receivedVersion: serverState.stateVersion
            });
            return false;
        }

        // Update state version
        this.stateVersion = serverState.stateVersion;
        this.stateTimestamp = Date.now();

        // Deep copy critical state
        this.boardState = JSON.parse(JSON.stringify(serverState.boardState));
        this.players = JSON.parse(JSON.stringify(serverState.players));
        this.currentPlayer = serverState.currentPlayer;
        this.lastUsedColor = serverState.lastUsedColor;

        return true;
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