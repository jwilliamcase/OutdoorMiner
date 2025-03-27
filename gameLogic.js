// Constants related to hexagon geometry
export const HEX_SIZE = 30; // Slightly larger for better visibility
export const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
export const HEX_WIDTH = 2 * HEX_SIZE;
export const VERTICAL_SPACING = HEX_HEIGHT;
export const HORIZONTAL_SPACING = HEX_WIDTH * 0.75;

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
        this.rows = rows;
        this.cols = cols;
        this.board = this.createInitialBoard(rows, cols);
        this.players = players || {};
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.gameOver = false;
        this.winner = null;
    }

    createInitialBoard(rows, cols) {
        const board = {};
        
        // Initialize empty board
        for (let r = 0; r < rows; r++) {
            for (let q = 0; q < cols; q++) {
                board[`${q},${r}`] = {
                    q, r,
                    owner: null,
                    color: '#cccccc',
                    captured: false
                };
            }
        }

        // Set starting positions at opposite corners
        // Player 1 starts at bottom-left (0, rows-1)
        const p1Start = `0,${rows-1}`;
        board[p1Start] = {
            q: 0,
            r: rows-1,
            owner: 'player1',
            color: '#F76C6C',
            captured: true
        };

        // Player 2 starts at top-right (cols-1, 0)
        const p2Start = `${cols-1},0`;
        board[p2Start] = {
            q: cols-1,
            r: 0,
            owner: 'player2',
            color: '#374785',
            captured: true
        };

        return board;
    }

    // Get valid moves for current player
    getValidMoves(playerId) {
        const validMoves = new Set();
        
        // Check all owned cells for valid neighbors
        Object.entries(this.board).forEach(([key, tile]) => {
            if (tile.owner === playerId) {
                // Get unclaimed neighbors
                this.getNeighbors(tile.q, tile.r).forEach(neighbor => {
                    const neighborKey = `${neighbor.q},${neighbor.r}`;
                    const neighborTile = this.board[neighborKey];
                    if (neighborTile && !neighborTile.owner) {
                        validMoves.add(neighborKey);
                    }
                });
            }
        });

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

    // Make a move
    makeMove(q, r, playerId) {
        const key = `${q},${r}`;
        const tile = this.board[key];

        // Validate move
        if (!tile || tile.owner || !this.isValidMove(q, r, playerId)) {
            return false;
        }

        // Place the tile
        tile.owner = playerId;
        tile.color = this.players[playerId].color;
        tile.captured = true;

        // Update scores
        this.updateScores();

        // Switch turns
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % Object.keys(this.players).length;
        this.turnNumber++;

        // Check for game over
        this.checkGameOver();

        return true;
    }

    // Check if a move is valid
    isValidMove(q, r, playerId) {
        // Must be adjacent to an owned tile
        return this.getNeighbors(q, r).some(neighbor => {
            const neighborKey = `${neighbor.q},${neighbor.r}`;
            const neighborTile = this.board[neighborKey];
            return neighborTile && neighborTile.owner === playerId;
        });
    }

    // Update player scores based on owned tiles
    updateScores() {
        // Reset scores
        for (const playerId in this.players) {
            this.players[playerId].score = 0;
        }
        // Recalculate scores
        for (const key in this.board) {
            const tile = this.board[key];
            if (tile.owner && this.players[tile.owner]) {
                this.players[tile.owner].score++;
            }
        }
        console.log("Scores updated:", this.players);
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
}


// --- Hex Grid Geometry Functions ---

// Get the pixel coordinates of the center of a hex cell
export function getHexCenter(q, r) {
    const x = q * HORIZONTAL_SPACING + HEX_SIZE;
    const y = r * VERTICAL_SPACING + HEX_SIZE + (q % 2) * (VERTICAL_SPACING / 2);
    return { x, y };
}

// Convert pixel coordinates (world space) to hex coordinates (q, r) - Approximate
// This implementation uses axial coordinates and rounding. Might need refinement.
export function worldToHex(x, y) {
    // Adjust for the offset/origin if necessary (assuming origin is top-left of canvas)

    // Convert pixel coordinates to fractional axial coordinates
    const q_frac = (2 / 3 * x) / HEX_SIZE;
    const r_frac = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / HEX_SIZE;
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
    const approx_q = (x - HEX_SIZE) / HORIZONTAL_SPACING;
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