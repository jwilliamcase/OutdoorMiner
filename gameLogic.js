// Constants related to hexagon geometry
export const HEX_SIZE = 20; // Size of the hexagon (distance from center to corner)
export const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
export const HEX_WIDTH = 2 * HEX_SIZE;
export const VERTICAL_SPACING = HEX_HEIGHT;
export const HORIZONTAL_SPACING = HEX_WIDTH * 3 / 4;

// --- GameState Class ---
export class GameState {
    /**
     * Creates a new game state.
     * @param {number} rows - Number of rows in the board.
     * @param {number} cols - Number of columns in the board.
     * @param {object} players - Map of player IDs to player info.
     */
    constructor(rows, cols, players) {
        this.rows = rows;
        this.cols = cols;
        this.board = this.createInitialBoard(rows, cols);
        this.players = players; // { id: { color: string, score: number }, ... }
        this.currentPlayerIndex = 0; // Index for this.players array/object keys
        this.turnNumber = 1;
        this.gameOver = false;
        this.winner = null;
        // Removed power-up related properties
    }

    // Reset game state
    reset(rows, cols, players) {
        this.rows = rows;
        this.cols = cols;
        this.board = this.createInitialBoard(rows, cols);
        this.players = players;
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.gameOver = false;
        this.winner = null;
    }


    // Create the initial board state
    createInitialBoard(rows, cols) {
        const board = {};
        for (let r = 0; r < rows; r++) {
            for (let q = 0; q < cols; q++) {
                const key = `${q},${r}`;
                board[key] = { q, r, owner: null, color: '#cccccc' };
            }
        }
        return board; // Return the board object, not a key string
    }

    // Method to get the owner of a tile (useful for checking wins, etc.)
    getTileOwner(q, r) {
        const key = this.getKey(q, r);
        return this.board[key] ? this.board[key].owner : null;
    }

    // Helper method to determine current player ID based on turn number
    getCurrentPlayerId() {
        if (!this.players || typeof this.turn === 'undefined' || this.turn === null) {
            console.warn("Cannot get current player ID: players or turn info missing", this.players, this.turn);
            return null;
        }
        // Find the player entry ( [id, playerObject] ) whose playerNumber matches the current turn
        const playerEntry = Object.entries(this.players).find(([id, player]) => player.playerNumber === this.turn);
        return playerEntry ? playerEntry[0] : null; // Return the socket ID (the key)
    // Removed misplaced return statement

        const playerColor = this.players[playerId]?.color;
        if (!playerColor) {
            console.error(`Invalid player ID ${playerId} or player has no color.`);
            return { success: false, capturedCount: 0, message: "Invalid player ID." };
        }

        // Check if it's the player's turn
        const playerIDs = Object.keys(this.players);
        const expectedPlayerId = playerIDs[this.currentPlayerIndex];
        if (playerId !== expectedPlayerId) {
             console.log(`Not player ${playerId}'s turn. It's ${expectedPlayerId}'s turn.`);
             return { success: false, capturedCount: 0, message: "Not your turn." };
        }


        // Place the tile
        this.board[key].owner = playerId;
        this.board[key].color = playerColor;
        console.log(`Tile placed at ${q},${r} by player ${playerId}`);

        // Capture adjacent tiles
        let capturedCount = 0;
        const neighbors = getNeighbors(q, r);
        neighbors.forEach(neighbor => {
            const nKey = `${neighbor.q},${neighbor.r}`;
            const tile = this.board[nKey];
            if (tile && tile.owner !== null && tile.owner !== playerId) {
                console.log(`Checking neighbor at ${nKey}: Owner=${tile.owner}, PlayerId=${playerId}`);
                // Check if the neighbor is surrounded
                 if (this.isSurrounded(neighbor.q, neighbor.r, playerId)) {
                    console.log(`Capturing tile at ${neighbor.q},${neighbor.r} originally owned by ${tile.owner}`);
                     tile.owner = playerId;
                     tile.color = playerColor;
                     capturedCount++;
                 }
            }
        });

         // Update scores
         this.updateScores();


        // Switch turn
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playerIDs.length;
        this.turnNumber++;
        console.log(`Turn switched to player ${playerIDs[this.currentPlayerIndex]}. Turn number: ${this.turnNumber}`);


        // Check for game over condition (e.g., board full)
        this.checkGameOver();

        // Return placement details
         // Return placement details including whether the move was successful
        return {
            success: true,
            q,
            r,
            playerId,
            playerColor,
            capturedCount,
            newState: this.serialize() // Send updated state back
        };

    }


    // Check if a tile at (q, r) is surrounded by playerId
    isSurrounded(q, r, capturingPlayerId) {
        const neighbors = getNeighbors(q, r);
        for (const neighbor of neighbors) {
            const nKey = `${neighbor.q},${neighbor.r}`;
            const tile = this.board[nKey];
             // If there's no tile, or the tile is owned by someone other than the capturing player,
             // then it's not surrounded by the capturing player.
            if (!tile || (tile.owner !== capturingPlayerId && tile.owner !== null /* allow empty neighbors */)) {
                 // If the neighbor is empty or owned by a different player, it's not surrounded
                 // Correction: Check if the *neighbor* owner is NOT the capturing player
                if (!tile || tile.owner !== capturingPlayerId) {
                    // This seems wrong. A tile is surrounded if *all* its neighbors
                    // belong to the capturing player. Let's rethink.

                    // A tile (q,r) owned by player P1 is captured by player P2 if ALL
                    // neighbors of (q,r) are either owned by P2 or are off-board/non-existent.

                    // Let's adjust the logic based on the capturing player:
                    // The tile at (q,r) - which does NOT belong to capturingPlayerId - is captured
                    // if all its neighbors are owned by capturingPlayerId.

                    const tileToCheck = this.board[`${q},${r}`];
                    if (!tileToCheck || tileToCheck.owner === capturingPlayerId) return false; // Can't capture own/empty tiles this way

                    // Check all neighbors of the tile we might capture
                    const neighborsOfTarget = getNeighbors(q, r);
                    for (const neighborCoord of neighborsOfTarget) {
                        const neighborKey = `${neighborCoord.q},${neighborCoord.r}`;
                        const neighborTile = this.board[neighborKey];
                        // If a neighbor doesn't exist, or is NOT owned by the capturing player, then the tile is not surrounded.
                        if (!neighborTile || neighborTile.owner !== capturingPlayerId) {
                            return false; // Found a neighbor not owned by the capturing player, so not surrounded.
                        }
                    }
                     // If we went through all neighbors and all are owned by capturingPlayerId, it's surrounded.
                    return true;

                }

            }
        }
        // Original logic seemed flawed, replaced above.
        // If we iterate through all neighbors and none break the condition, it's surrounded.
         // return true; // Should not be reached with the corrected logic above.
         return false; // Default return if initial checks fail or loop finishes unexpectedly
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
            // Removed power-up related properties
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
            // Removed power-up related properties

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
    const x = HEX_SIZE + q * HORIZONTAL_SPACING;
    // Offset every other row (odd rows)
    const y = HEX_SIZE + r * VERTICAL_SPACING + (q % 2 === 1 ? VERTICAL_SPACING / 2 : 0);
     // Or using axial coordinates directly:
     // const x = HEX_SIZE * (3./2 * q) ;
     // const y = HEX_SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r); // Requires adjustment based on grid alignment
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