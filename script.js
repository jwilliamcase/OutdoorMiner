// Global constants & game state
const HEX_SIZE = 30;
const POWER_UP_CHANCE = 0.05; // 5% chance for a power-up
const LANDMINE_CHANCE = 0.03; // 3% chance for a landmine
const POWER_UPS = ['shield', 'steal', 'bomb']; // Available power-ups
let gameState; // Will be instance of GameState
let canvas, ctx;
let selectedColor = null;
let selectedPowerUp = null;
let isMyTurn = false;
let playerName = '';
let playerNumber = -1; // 0 or 1 for online games
let gameMode = 'local'; // 'local', 'online-host', 'online-client'
let gameId = null;

const MAX_UNDO_STEPS = 5; // Allow up to 5 undo steps

// Sound effects
// Pre-loading removed, rely on playSound for dynamic loading
const sounds = {};

// Function to play sound effects (moved to top level)
function playSound(soundName) {
        // Check if sound is enabled (optional enhancement)
        // console.log(`Attempting to play sound: ${soundName}`); // Debug log
        try {
            // Correct path based on file tree
            const audio = new Audio(`sounds/${soundName}.mp3`);
            audio.play().catch(error => {
                // Autoplay was prevented, log it but don't crash
                // console.error(`Sound play failed for ${soundName}:`, error);
            });
        } catch (error) {
            console.error(`Error loading sound ${soundName}:`, error);
        }
    }

    // DOM element references (initialized in DOMContentLoaded)
    // Note: canvas, ctx are already declared globally above.
    let messageElement, setupContainer, gameScreen, playerNameInput, localGameButton, gameIdInput, // Added gameIdInput here
        createChallengeButton, joinChallengeButton, setupMessageElement, gameIdDisplay,
        player1ScoreElement, player2ScoreElement, colorSwatchesContainer, powerUpSlotsContainer,
        landmineInfoElement, chatInput, chatMessages, sendChatButton, toggleChatButton, chatContainer,
        leaveGameButton, restartGameButton; // Added restartGameButton here

    // --- State Management ---
    class GameState {
        constructor(rows = 12, cols = 12) { // Accept dimensions
        this.rows = rows;
        this.cols = cols;
        this.reset(); // Initialize board etc.
        this.playerNames = ["Player 1", "Player 2"];
        this.playerColors = ['#FF0000', '#0000FF']; // Defaults
    }

    // --- GameState Methods ---
    reset() {
        this.board = this.createInitialBoard(this.rows, this.cols);
        this.playerScores = [0, 0];
        this.currentPlayerIndex = 0;
        this.isGameOver = false;
        this.powerUpInventory = [[], []]; // [player1_powerups, player2_powerups]
        this.landmines = new Set(); // Stores "row,col" strings of mine locations
        this.revealedMines = new Set(); // Stores "row,col" strings of triggered mines
        this.protectedTiles = new Map(); // Stores "row,col" => playerIndex for shielded tiles
        this.turnNumber = 0;
        // Keep player names and colors unless specifically reset elsewhere
    }

    createInitialBoard(rows, cols) {
        const board = [];
        for (let r = 0; r < rows; r++) {
            board[r] = [];
            for (let c = 0; c < cols; c++) {
                board[r][c] = {
                    owner: -1, // -1 for unowned, 0 for player 1, 1 for player 2
                    color: '#CCCCCC', // Default unowned color
                    isStartingTile: false,
                    hasPowerUp: false,
                    hasLandmine: false, // Mark if mine is present (for rendering maybe?)
                    powerUpType: null
                };
            }
        }
        return board;
    }


    serialize() {
        // Convert Sets and Maps to arrays for JSON compatibility
        return JSON.stringify({
            rows: this.rows,
            cols: this.cols,
            board: this.board,
            playerScores: this.playerScores,
            playerNames: this.playerNames,
            playerColors: this.playerColors,
            currentPlayerIndex: this.currentPlayerIndex,
            isGameOver: this.isGameOver,
            powerUpInventory: this.powerUpInventory,
            landmines: Array.from(this.landmines),
            revealedMines: Array.from(this.revealedMines),
            protectedTiles: Array.from(this.protectedTiles.entries()),
            turnNumber: this.turnNumber
            // Note: winner is not explicitly stored, determined on game over
        });
    }

    // Rewritten deserialize method
    deserialize(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            this.rows = data.rows || 12;
            this.cols = data.cols || 12;
            this.board = data.board || this.createInitialBoard(this.rows, this.cols); // Fallback if board missing
            this.playerScores = data.playerScores || [0, 0];
            this.playerNames = data.playerNames || ["Player 1", "Player 2"];
            this.playerColors = data.playerColors || ['#FF0000', '#0000FF'];
            this.currentPlayerIndex = data.currentPlayerIndex !== undefined ? data.currentPlayerIndex : 0;
            this.isGameOver = data.isGameOver || false;
            this.powerUpInventory = data.powerUpInventory || [[], []];
            // Convert arrays back to Set/Map
            this.landmines = new Set(data.landmines || []);
            this.revealedMines = new Set(data.revealedMines || []);
            this.protectedTiles = new Map(data.protectedTiles || []);
            this.turnNumber = data.turnNumber !== undefined ? data.turnNumber : 0;
            // winner is determined dynamically, not stored/deserialized directly
             console.log("GameState deserialized successfully."); // DEBUG
        } catch (error) {
            console.error("Error deserializing game state:", error, jsonData); // DEBUG
            // Optionally reset state or handle error more gracefully
            this.reset();
        }
    }


    getTile(r, c) {
        // Check bounds BEFORE accessing array
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
            return this.board[r][c];
        }
        return null; // Return null if out of bounds
    }

    isOwnedBy(r, c, playerIndex) {
        const tile = this.getTile(r, c);
        return tile && tile.owner === playerIndex;
    }

    getOwner(r, c) {
        const tile = this.getTile(r, c);
        return tile ? tile.owner : -1;
    }

    // --- Game Logic Methods ---

    placeTile(r, c, playerIndex, color) {
        const tile = this.getTile(r, c);
        // Validate tile exists and is unowned
        if (!tile || tile.owner !== -1) {
             console.log(`Invalid placement: Tile (${r},${c}) does not exist or is already owned.`);
             return { placed: false, hitMine: false, error: "Tile not empty." };
        }
        if (this.isGameOver) {
            return { placed: false, hitMine: false, error: "Game is over." };
        }

        const coordKey = `${r},${c}`;
        // Check for landmine FIRST
        if (this.landmines.has(coordKey) && !this.revealedMines.has(coordKey)) {
            console.log(`Player ${playerIndex} hit a mine at ${r},${c}!`);
            this.revealedMines.add(coordKey);
            playSound('landmine'); // Use generic mine sound for now
            // Update the tile visually (handled in render)
            return { placed: false, hitMine: true, error: "Hit a landmine!" }; // Indicate mine hit, tile not placed
        }

        // Check if placement is valid (adjacent to existing tile of same player)
        const neighbors = getNeighbors(r, c);
        let isAdjacent = false;
        if (this.turnNumber < 2) { // First two turns can place anywhere unowned
            isAdjacent = true;
            tile.isStartingTile = true; // Mark as a starting tile
        } else {
            for (const { nr, nc } of neighbors) {
                if (this.isOwnedBy(nr, nc, playerIndex)) {
                    isAdjacent = true;
                    break;
                }
            }
        }

        if (!isAdjacent) {
            console.log("Invalid placement: Must be adjacent to your own tile (after turn 1).");
            playSound('error');
            return { placed: false, hitMine: false, error: "Must be adjacent." };
        }

        // Place the tile
        tile.owner = playerIndex;
        tile.color = color;
        playSound('placeTile');
        this.updateScores(); // Update score after placing

        // Check for power-up or landmine generation
        let awardedPowerUp = null;
        let generatedLandmine = false;
        if (Math.random() < POWER_UP_CHANCE) {
            // Check if tile doesn't already have something? Maybe not necessary if generated on placement
             tile.hasPowerUp = true; // Mark tile state
             awardedPowerUp = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
             this.givePowerUp(playerIndex, awardedPowerUp);
             playSound('powerUp');
             console.log(`Player ${playerIndex} found a ${awardedPowerUp} power-up at ${r},${c}!`);
        } else if (Math.random() < LANDMINE_CHANCE) {
            // Don't place a landmine on the tile just captured
            // Instead, place it on a *random* unowned, non-starting neighbor tile
            const validMineNeighbors = neighbors.filter(({ nr, nc }) => {
                const neighborTile = this.getTile(nr, nc);
                return neighborTile && neighborTile.owner === -1 && !neighborTile.isStartingTile;
            });

            if (validMineNeighbors.length > 0) {
                const { nr, nc } = validMineNeighbors[Math.floor(Math.random() * validMineNeighbors.length)];
                const mineCoordKey = `${nr},${nc}`;
                if (!this.landmines.has(mineCoordKey)) { // Avoid placing multiple mines on the same tile
                    this.landmines.add(mineCoordKey);
                    const mineTile = this.getTile(nr, nc);
                    if (mineTile) mineTile.hasLandmine = true; // Mark for rendering hints?
                    generatedLandmine = true;
                    console.log(`A landmine was generated nearby at ${nr},${nc}!`);
                }
            }
        }


        // Check for captures
        let capturedCount = 0;
        const opponentIndex = 1 - playerIndex;
        for (const { nr, nc } of neighbors) {
            const neighborTile = this.getTile(nr, nc);
            if (neighborTile && neighborTile.owner === opponentIndex) {
                // Check if the captured tile is protected
                 const neighborKey = `${nr},${nc}`;
                 if (this.protectedTiles.has(neighborKey) && this.protectedTiles.get(neighborKey) === opponentIndex) {
                     console.log(`Tile ${nr},${nc} is protected by a shield! Capture failed.`);
                     this.protectedTiles.delete(neighborKey); // Shield used up
                     // Add visual effect for shield breaking? (renderGameBoard handles border)
                 } else {
                    neighborTile.owner = playerIndex;
                    neighborTile.color = color; // Change to capturer's color
                    capturedCount++;
                 }
            }
        }

        if (capturedCount > 0) {
            console.log(`Player ${playerIndex} captured ${capturedCount} tiles!`);
            this.updateScores(); // Update score again after captures
        }

        this.checkForGameOver(); // Check if this move ended the game

        return { placed: true, hitMine: false, awardedPowerUp, generatedLandmine };
    }

     givePowerUp(playerIndex, powerUpType) {
        if (!this.powerUpInventory[playerIndex]) {
            this.powerUpInventory[playerIndex] = [];
        }
        this.powerUpInventory[playerIndex].push(powerUpType);
        updatePowerUpDisplay(); // Update UI
    }

    usePowerUp(playerIndex, powerUpType, targetR, targetC) {
        if (this.isGameOver) return { used: false, error: "Game is over." };
        // Allow using power-up even if not technically current player? Or enforce turn?
        // Let's enforce turn for now.
        if (this.currentPlayerIndex !== playerIndex) return { used: false, error: "Not your turn." };

        const inventory = this.powerUpInventory[playerIndex];
        if (!inventory) return { used: false, error: "No power-ups available." }; // Check if inventory exists

        const powerUpIndex = inventory.indexOf(powerUpType);

        if (powerUpIndex === -1) return { used: false, error: "Power-up not found in inventory." };

        let success = false;
        let message = "";
        const targetKey = `${targetR},${targetC}`;
        const targetTile = this.getTile(targetR, targetC);
        const opponentIndex = 1 - playerIndex;

        // Ensure target tile exists before proceeding
        if (!targetTile) return { used: false, error: "Invalid target tile." };

        switch (powerUpType) {
            case 'shield':
                if (targetTile.owner === playerIndex && !this.protectedTiles.has(targetKey)) {
                    this.protectedTiles.set(targetKey, playerIndex);
                    success = true;
                    message = `Shield applied to your tile at ${targetR},${targetC}.`;
                     playSound('powerUp'); // Or a specific shield sound
                } else {
                    message = "Cannot shield empty tiles, opponent tiles, or already shielded tiles.";
                    playSound('error');
                }
                break;

            case 'steal':
                 if (targetTile.owner === opponentIndex && !this.protectedTiles.has(targetKey)) {
                    targetTile.owner = playerIndex;
                    targetTile.color = this.playerColors[playerIndex]; // Change to stealer's color
                    this.updateScores();
                    success = true;
                    message = `Stole opponent tile at ${targetR},${targetC}!`;
                    playSound('powerUp'); // Or a specific steal sound
                } else if (this.protectedTiles.has(targetKey)) {
                     message = `Tile ${targetR},${targetC} is protected by a shield! Steal failed.`;
                     this.protectedTiles.delete(targetKey); // Shield used up
                     playSound('error'); // Or shield break sound
                 } else {
                    message = "Can only steal opponent's unprotected tiles.";
                     playSound('error');
                }
                break;

            case 'bomb':
                // Can bomb any tile (owned, unowned, opponent's)
                 if (this.protectedTiles.has(targetKey)) {
                     message = `Tile ${targetR},${targetC} is protected by a shield! Bomb failed.`;
                     this.protectedTiles.delete(targetKey); // Shield used up
                     playSound('error'); // Or shield break sound
                 } else {
                    targetTile.owner = -1; // Make it unowned
                    targetTile.color = '#CCCCCC'; // Reset color
                    targetTile.isStartingTile = false; // No longer a starting tile
                    // Check if it had a mine (bombing might reveal or destroy it?)
                    if (this.landmines.has(targetKey)) {
                        this.landmines.delete(targetKey);
                        this.revealedMines.delete(targetKey); // Ensure it's not marked as revealed if it wasn't triggered
                        targetTile.hasLandmine = false;
                        message = `Bombed tile at ${targetR},${targetC}, destroying a landmine!`;
                    } else {
                         message = `Bombed tile at ${targetR},${targetC}!`;
                    }
                    this.updateScores();
                    success = true;
                    playSound('landmine'); // Bomb sound (reuse mine sound for now)
                 }
                break;

            default:
                 message = "Unknown power-up type.";
                 playSound('error');
                 break;
        }

        if (success) {
            inventory.splice(powerUpIndex, 1); // Remove used power-up
            updatePowerUpDisplay(); // Update UI
            // It's still the player's turn after using a power-up (no turn switch here)
            return { used: true, message: message };
        } else {
            return { used: false, error: message };
        }
    }

    switchTurn() {
        if (this.isGameOver) return;
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        this.turnNumber++;
        // Update local 'isMyTurn' flag
        isMyTurn = (gameMode === 'local' || this.currentPlayerIndex === playerNumber);
        updateTurnIndicator();
        updateScoreDisplay(); // Update score display to show whose turn it is
        // Disable controls if not my turn in online mode
        toggleControls(isMyTurn);
    }

     updateScores() {
        this.playerScores = [0, 0];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.getTile(r, c); // Use getter for safety
                if (tile && tile.owner !== -1) {
                    this.playerScores[tile.owner]++;
                }
            }
        }
        updateScoreDisplay();
    }

    checkForGameOver() {
        let unownedPlaceableCount = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.getTile(r, c);
                if (tile && tile.owner === -1) {
                    // Only count unowned tiles that are placeable (adjacent to someone)
                    // unless it's the very start of the game
                    if (this.turnNumber < 2) {
                        unownedPlaceableCount++;
                        continue; // All unowned are placeable initially
                    }
                     let isPlaceable = false;
                     const neighbors = getNeighbors(r, c);
                     for(const {nr, nc} of neighbors) {
                        const neighborTile = this.getTile(nr, nc);
                        // A tile is placeable if adjacent to *any* owned tile
                        if (neighborTile && neighborTile.owner !== -1) {
                            isPlaceable = true;
                            break;
                        }
                     }
                     if (isPlaceable) {
                        unownedPlaceableCount++;
                     }
                }
            }
        }

        if (unownedPlaceableCount === 0) {
            this.isGameOver = true;
            console.log("Game Over - No more placeable tiles!");
            playSound('gameOver');
            determineWinner(); // Sets winner message in UI via updateTurnIndicator
            updateTurnIndicator(); // Show game over message
            toggleControls(false); // Disable controls on game over
            // In online mode, the server will also detect and broadcast game over
            if (gameMode !== 'local' && playerNumber === 0) { // Host notifies server (redundant if server checks too?)
                 // window.multiplayer.sendGameOver(); // Function to be defined in multiplayer.js if needed
                 console.warn("Local game over check triggered by host - server should handle this.");
            }
        }
         return this.isGameOver;
    }

    // Updated determineWinner to return message string
    determineWinner() {
        if (!this.isGameOver) return "Game not over"; // Shouldn't be called unless game is over
        const score1 = this.playerScores[0];
        const score2 = this.playerScores[1];
        const name1 = this.playerNames[0] || "Player 1";
        const name2 = this.playerNames[1] || "Player 2";

        if (score1 > score2) return `${name1} Wins! (${score1}-${score2})`;
        if (score2 > score1) return `${name2} Wins! (${score2}-${score1})`;
        return `It's a Tie! (${score1}-${score1})`;
    }

    // Removed old determineWinner implementation that returned index

} // End GameState class


// --- Drawing Functions ---

// Updated drawHexagon signature to accept tile object
function drawHexagon(ctx, r, c, x_center, y_center, size, tile) {
    const angle = Math.PI / 3; // 60 degrees

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(
            x_center + size * Math.cos(angle * i + Math.PI / 6), // Add PI/6 offset for pointy top
            y_center + size * Math.sin(angle * i + Math.PI / 6)
        );
    }
    ctx.closePath();

    // Fill with tile color
    ctx.fillStyle = tile ? tile.color : '#CCCCCC'; // Fallback color if tile missing
    ctx.fill();

    // --- Border styling ---
    let borderColor = '#555'; // Default dark border for unowned
    let borderWidth = 1;

    if (tile && tile.owner !== -1) {
        // Owned tile: Use slightly darker version of player color
        borderColor = darkenColor(tile.color, 30); // Darken by 30%
        borderWidth = 2; // Thicker border for owned tiles
    }

    const coordKey = `${r},${c}`;
     // Highlight for shield
    if (tile && gameState && gameState.protectedTiles.has(coordKey)) {
        borderColor = '#FFFF00'; // Yellow border for shield
        borderWidth = 3;
    }

    // Highlight for revealed mine
    if (tile && gameState && gameState.revealedMines.has(coordKey)) {
        borderColor = '#FF0000'; // Red border for revealed mine
        borderWidth = 3;
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();

     // Optional: Draw symbols for mines/powerups/shields after border
    if (tile && gameState && gameState.revealedMines.has(coordKey)) {
        // Draw an 'X' or explosion symbol
        ctx.font = `${size * 0.6}px Arial Black`; // Bold font
        ctx.fillStyle = '#FF0000'; // Red color for mine symbol
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥', x_center, y_center); // Explosion emoji or 'X'
    }
     else if (tile && gameState && gameState.protectedTiles.has(coordKey)) {
         // Draw shield symbol
         ctx.font = `${size * 0.6}px Arial Black`;
         ctx.fillStyle = '#FFFF00'; // Yellow for shield symbol
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText('🛡️', x_center, y_center); // Shield emoji
     }
    // Add similar logic for uncollected powerups or hidden mines if needed
}


function renderGameBoard() {
    if (!ctx || !gameState) {
        console.error("renderGameBoard: Canvas context or gameState missing."); // DEBUG
        return;
    }
     // Calculate required canvas size based on gameState dimensions
    const requiredWidth = gameState.cols * HEX_SIZE * 1.5 + HEX_SIZE * 0.5;
    const requiredHeight = gameState.rows * HEX_SIZE * Math.sqrt(3) + HEX_SIZE * Math.sqrt(3) / 2;

    // Resize canvas internal buffer if needed
    if (canvas.width !== Math.ceil(requiredWidth) || canvas.height !== Math.ceil(requiredHeight)) {
        canvas.width = Math.ceil(requiredWidth);
        canvas.height = Math.ceil(requiredHeight);
        console.log(`Resized canvas buffer to ${canvas.width}x${canvas.height}`); // DEBUG
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Center the grid drawing relative to the canvas buffer size
    // Adjust offsetX/Y if you want padding around the grid
    const offsetX = HEX_SIZE; // Start drawing first hex center at (HEX_SIZE, HEX_SIZE*sqrt(3)/2)
    const offsetY = HEX_SIZE * Math.sqrt(3) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY); // Apply translation for the grid origin

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const tile = gameState.board[r][c];
            // Calculate center coordinates for drawHexagon
            const hexX = c * HEX_SIZE * 1.5;
            const hexY = r * HEX_SIZE * Math.sqrt(3) + (c % 2 === 1 ? HEX_SIZE * Math.sqrt(3) / 2 : 0);
            // Call drawHexagon with correct arguments
            drawHexagon(ctx, r, c, hexX, hexY, HEX_SIZE, tile);
        }
    }

     ctx.restore(); // Restore context after translation

    // Update other UI elements that depend on gameState
    updateScoreDisplay();
    updateTurnIndicator();
    updatePowerUpDisplay();
    updateLandmineInfo();
    console.log("renderGameBoard completed."); // DEBUG
}


function getHexCoords(event) {
    if (!canvas || !ctx) return { r: -1, c: -1 }; // Guard against missing canvas/context

    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to match canvas internal resolution if CSS scales it
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;


     // Adjust coordinates based on the translation applied in renderGameBoard
     const offsetX = HEX_SIZE;
     const offsetY = HEX_SIZE * Math.sqrt(3) / 2;
     const transformedX = canvasX - offsetX;
     const transformedY = canvasY - offsetY;


    // Approximate conversion - needs careful checking for hex grid math
    // Using axial coordinates might be more robust, but this is simpler for now
    const q_frac = (transformedX * (2/3)) / HEX_SIZE;
    const r_frac = (-transformedX / 3 + Math.sqrt(3)/3 * transformedY) / HEX_SIZE;

    // Convert fractional axial to cube coordinates
    const x_cube = q_frac;
    const z_cube = r_frac;
    const y_cube = -x_cube - z_cube;

    // Round cube coordinates to nearest integer cube
    let rx = Math.round(x_cube);
    let ry = Math.round(y_cube);
    let rz = Math.round(z_cube);

    const x_diff = Math.abs(rx - x_cube);
    const y_diff = Math.abs(ry - y_cube);
    const z_diff = Math.abs(rz - z_cube);

    if (x_diff > y_diff && x_diff > z_diff) {
        rx = -ry - rz;
    } else if (y_diff > z_diff) {
        ry = -rx - rz;
    } else {
        rz = -rx - ry;
    }

    // Convert rounded cube coordinates back to offset coordinates (column, row)
    const col = rx; // q coordinate directly maps to column in "pointy top" offset
    const row = rz + (rx + (rx&1)) / 2; // Convert r cube coordinate back to row


    // Bounds check
    if (row >= 0 && row < gameState.rows && col >= 0 && col < gameState.cols) {
        // console.log(`Click maps to R: ${row}, C: ${col}`); // DEBUG
        return { r: row, c: col };
    }

    console.log("Click outside grid bounds."); // DEBUG
    return { r: -1, c: -1 };
};


function updateScoreDisplay() {
    // Get elements each time to ensure they are current
    const score1Elem = document.getElementById('player1-score');
    const score2Elem = document.getElementById('player2-score');
    const player1NameElem = document.getElementById('player1-name');
    const player2NameElem = document.getElementById('player2-name');
    const player1ColorSwatch = document.getElementById('player1-color-swatch');
    const player2ColorSwatch = document.getElementById('player2-color-swatch');
    const player1Container = document.getElementById('player1-score-container');
    const player2Container = document.getElementById('player2-score-container');

    if (!gameState) {
        console.warn("updateScoreDisplay: gameState not available."); // DEBUG
        return;
    }

    if (score1Elem) score1Elem.textContent = gameState.playerScores[0];
    if (score2Elem) score2Elem.textContent = gameState.playerScores[1];

    const name1 = gameState.playerNames[0] || "Player 1";
    const name2 = gameState.playerNames[1] || "Player 2";
    if (player1NameElem) player1NameElem.textContent = name1;
    if (player2NameElem) player2NameElem.textContent = name2;

    const color1 = gameState.playerColors[0] || '#FF0000';
    const color2 = gameState.playerColors[1] || '#0000FF';
    if (player1ColorSwatch) player1ColorSwatch.style.backgroundColor = color1;
    if (player2ColorSwatch) player2ColorSwatch.style.backgroundColor = color2;

    // Highlight current player
    if (player1Container && player2Container && !gameState.isGameOver) {
        if (gameState.currentPlayerIndex === 0) {
            player1Container.classList.add('current-turn');
            player2Container.classList.remove('current-turn');
        } else {
            player1Container.classList.remove('current-turn');
            player2Container.classList.add('current-turn');
        }
    } else if (player1Container && player2Container) {
         // Remove highlight if game over or state unclear
         player1Container.classList.remove('current-turn');
         player2Container.classList.remove('current-turn');
    }
}


function updateTurnIndicator() {
    const messageElem = document.getElementById('message');
    if (!messageElem || !gameState) return;

    if (gameState.isGameOver) {
        messageElem.textContent = gameState.determineWinner(); // Get winner message
        messageElem.className = 'message game-over';
    } else {
        const currentPlayerName = gameState.playerNames[gameState.currentPlayerIndex];
        messageElem.textContent = `${currentPlayerName}'s Turn`;
        // Add class for current player for styling
         messageElem.className = `message turn-p${gameState.currentPlayerIndex + 1}`;
    }
}

function updatePowerUpDisplay() {
    const playerInventories = [
        document.getElementById('player1-powerups'),
        document.getElementById('player2-powerups')
    ];

    if (!gameState || !playerInventories[0] || !playerInventories[1]) {
         console.warn("updatePowerUpDisplay: Missing gameState or inventory elements."); // DEBUG
         return;
    }


    for (let i = 0; i < 2; i++) {
        const inventoryElem = playerInventories[i];
        inventoryElem.innerHTML = ''; // Clear existing power-ups

         const counts = {};
        if (gameState.powerUpInventory[i]) {
             gameState.powerUpInventory[i].forEach(p => counts[p] = (counts[p] || 0) + 1);
        }

        POWER_UPS.forEach(powerUpType => {
            const count = counts[powerUpType] || 0;
            const powerUpSlot = document.createElement('div');
            powerUpSlot.classList.add('powerup-slot');
            powerUpSlot.dataset.powerup = powerUpType;

            // Determine if the power-up is clickable
             const playerIndexToCheck = i; // 0 for player 1, 1 for player 2 inventory
             const isCurrentPlayerInventory = (gameMode === 'local' && gameState.currentPlayerIndex === playerIndexToCheck) ||
                                              (gameMode !== 'local' && playerNumber === playerIndexToCheck);
             const isClickable = isCurrentPlayerInventory && count > 0 && isMyTurn && !gameState.isGameOver;


            if (isClickable) {
                 powerUpSlot.classList.add('active');
                 powerUpSlot.onclick = () => handlePowerUpSelection(powerUpType);
            } else {
                 powerUpSlot.classList.add('disabled');
            }

            // Add visual representation (e.g., icon or text)
            const icon = document.createElement('span');
            icon.classList.add('powerup-icon');
            // Simple text representation
            let iconText = '?';
            if (powerUpType === 'shield') iconText = '🛡️';
            if (powerUpType === 'steal') iconText = '✋';
            if (powerUpType === 'bomb') iconText = '💣';
            icon.textContent = iconText;
            powerUpSlot.appendChild(icon);


             // Add count bubble
            if (count > 0) {
                const countBubble = document.createElement('span');
                countBubble.classList.add('powerup-count');
                countBubble.textContent = count;
                powerUpSlot.appendChild(countBubble);
            }

             // Highlight if selected (only if it's the current player's selection)
             const isSelected = selectedPowerUp === powerUpType && isCurrentPlayerInventory;
            if (isSelected) {
                powerUpSlot.classList.add('selected');
            }


            inventoryElem.appendChild(powerUpSlot);
        });
    }
}


function updateLandmineInfo() {
    const landmineInfoElem = document.getElementById('landmine-info'); // Corrected variable name
    if (landmineInfoElem && gameState) {
        const activeMines = gameState.landmines.size - gameState.revealedMines.size;
         // Only show count if playing locally OR if playing online and it's NOT my turn (info about opponent)
         if (gameMode === 'local' || (gameMode !== 'local' && !isMyTurn)) {
             landmineInfoElem.textContent = `Active Mines: ${activeMines}`;
             landmineInfoElem.style.display = activeMines > 0 ? 'block' : 'none';
         } else {
             landmineInfoElem.style.display = 'none'; // Hide from current player in online mode
         }
    }
}


function updateMessage(msg, isError = false) {
    const messageElem = document.getElementById('message'); // Use correct variable
    if (messageElem) {
        messageElem.textContent = msg;
        if (isError) {
             messageElem.className = 'message error';
             playSound('error');
        } else {
             // Reset to default turn indicator styling if needed, or just keep it simple
             messageElem.className = 'message info'; // Use a generic info class
             // updateTurnIndicator(); // Don't overwrite if it's a specific message
        }
    }
}

// Enhanced toggleControls
function toggleControls(enabled) {
     // Disable/enable color palette buttons
    const colorButtons = document.querySelectorAll('#color-palette .color-button');
    colorButtons.forEach(button => {
        const parentSwatch = button.closest('.color-swatch');
        if (!enabled || gameState.isGameOver) {
             button.disabled = true; // Set disabled attribute
             if (parentSwatch) parentSwatch.classList.add('disabled');
             button.onclick = null; // Remove listener
        } else {
             button.disabled = false;
             if (parentSwatch) parentSwatch.classList.remove('disabled');
              // Ensure onclick is correctly set or re-set
              const color = button.dataset.color;
              if (color) button.onclick = () => handleColorSelection(color);
        }
    });

     // Disable/enable power-up slots (updatePowerUpDisplay handles internal logic)
     updatePowerUpDisplay();

     // Disable/enable canvas interaction by adding/removing a class
     if (canvas) {
         if (!enabled || gameState.isGameOver) {
             canvas.classList.add('disabled'); // Add class to style cursor etc.
         } else {
             canvas.classList.remove('disabled');
         }
     }
}

function showSetupScreen() {
    console.log("showSetupScreen - START"); // DEBUG
    if (setupContainer) setupContainer.style.display = 'flex';
    if (gameScreen) gameScreen.style.display = 'none';
    if (scoreContainer) scoreContainer.style.display = 'none';
    if (colorSwatchesContainer) colorSwatchesContainer.style.display = 'none';
    if (gameControls) gameControls.style.display = 'none'; // Includes power-ups, messages etc.
    if (chatContainer) chatContainer.style.display = 'none';
    if (toggleChatButton) toggleChatButton.style.display = 'none';
    if (challengeInfo) challengeInfo.style.display = 'none'; // Ensure challenge info is hidden too
    // Reset status message on setup screen
     if (setupMessageElement) setupMessageElement.textContent = '';
     console.log("showSetupScreen - END"); // DEBUG
}

function showGameScreen() {
    console.log("showGameScreen - START"); // DEBUG
    if (setupContainer) setupContainer.style.display = 'none';
    if (gameScreen) gameScreen.style.display = 'flex'; // Use flex for canvas centering
    if (scoreContainer) scoreContainer.style.display = 'flex'; // Use flex for layout
    if (colorSwatchesContainer) colorSwatchesContainer.style.display = 'block';
    if (gameControls) gameControls.style.display = 'block'; // Show game controls container

    const challengeInfo = document.getElementById('challenge-info'); // Get element locally

     // Show chat and challenge info only in online mode
    if (gameMode !== 'local') {
         if (chatContainer) chatContainer.style.display = 'flex'; // Or 'block' based on your CSS
         if (toggleChatButton) toggleChatButton.style.display = 'block';
         if (challengeInfo) challengeInfo.style.display = 'block'; // Show Game ID area
         if (gameIdDisplay) gameIdDisplay.textContent = gameId || 'N/A';
    } else {
        if (chatContainer) chatContainer.style.display = 'none';
        if (toggleChatButton) toggleChatButton.style.display = 'none';
         if (challengeInfo) challengeInfo.style.display = 'none';
    }
     console.log("showGameScreen - END"); // DEBUG
}


// --- Event Handlers ---

function handleCanvasClick(event) {
     // Add checks for canvas disabled class
    if (!gameState || gameState.isGameOver || !isMyTurn || canvas.classList.contains('disabled')) {
        console.log("handleCanvasClick: Click ignored (game over, not my turn, or disabled)."); // DEBUG
        return;
    }

    const { r, c } = getHexCoords(event);
    if (r === -1 || c === -1) {
        console.log("handleCanvasClick: Click outside valid hex area."); // DEBUG
        return; // Click outside valid hex area
    }

    const tile = gameState.getTile(r,c); // Get tile state *before* action

    // If a power-up is selected, try to use it
    if (selectedPowerUp) {
        console.log(`handleCanvasClick: Attempting to use ${selectedPowerUp} on tile ${r},${c}`); // DEBUG
         const playerIndexToUse = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;

        // Send power-up move to server or handle locally
        if (gameMode !== 'local') {
             window.multiplayer.sendMove({ type: 'powerup', powerUpType: selectedPowerUp, r, c, playerIndex: playerIndexToUse });
             // No optimistic update here, wait for server 'game-state'
        } else {
             const result = gameState.usePowerUp(playerIndexToUse, selectedPowerUp, r, c);
             if (result.used) {
                 updateMessage(result.message);
                 // Power-up use doesn't switch turn in this logic
             } else {
                 updateMessage(result.error || "Failed to use power-up.", true);
             }
             renderGameBoard(); // Re-render after local action
        }

        // Deselect power-up after attempting use
        selectedPowerUp = null;
        updatePowerUpDisplay(); // Update UI to remove selection highlight

    }
    // If a color is selected, try to place a tile
    else if (selectedColor) {
         console.log(`handleCanvasClick: Attempting to place tile at ${r},${c}`); // DEBUG
         const playerIndexToPlace = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;
         // Use the player's assigned color, not the selected swatch color directly
         const colorToPlace = gameState.playerColors[playerIndexToPlace];

         // Send color move to server or handle locally
         if (gameMode !== 'local') {
             window.multiplayer.sendMove({ type: 'color', r, c, playerIndex: playerIndexToPlace, color: colorToPlace });
              // No optimistic update here, wait for server 'game-state'
         } else {
             const result = gameState.placeTile(r, c, playerIndexToPlace, colorToPlace);
             if (result.placed) {
                 if (result.awardedPowerUp) {
                    updateMessage(`Placed tile and found a ${result.awardedPowerUp}!`);
                 } else {
                    // updateMessage(`Placed tile at ${r},${c}.`); // Keep message minimal
                 }
                 if (!gameState.isGameOver) {
                    gameState.switchTurn(); // Only switch turn locally if placement successful
                 }
             } else if (result.hitMine) {
                 updateMessage(`You hit a mine at ${r},${c}! Turn lost.`, true);
                  if (!gameState.isGameOver) {
                    gameState.switchTurn(); // Turn lost due to mine
                  }
             } else {
                 // Invalid placement message
                 updateMessage(result.error || "Invalid placement.", true);
             }
              renderGameBoard(); // Re-render after local action
         }
    }
    else {
        console.log("handleCanvasClick: No color or power-up selected."); // DEBUG
        updateMessage("Select a color or power-up first.", true);
    }
}

function handleCanvasMouseMove(event) {
    // Implement hover effects if desired (consider performance)
}


function handleColorSelection(color) {
     if (!isMyTurn || gameState.isGameOver || canvas.classList.contains('disabled')) {
          console.log("handleColorSelection: Ignored (not my turn, game over, or disabled)."); // DEBUG
          return;
     }
    console.log("Color selected:", color); // DEBUG
    // We don't actually need to store selectedColor if we always use the player's turn color
    // selectedColor = color; // Keep for UI feedback?
    selectedPowerUp = null; // Deselect any active power-up

     // Update UI to show selected color
     const swatches = document.querySelectorAll('.color-swatch');
     swatches.forEach(swatch => {
         // Highlight the swatch matching the current player's color
         const playerIndex = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;
         if (gameState.playerColors[playerIndex] === swatch.dataset.color) { // Check against player's actual color
             swatch.classList.add('selected');
         } else {
             swatch.classList.remove('selected');
         }
     });
     updatePowerUpDisplay(); // Deselect power-up UI
     updateMessage("Click on the board to place a tile.");
}

function handlePowerUpSelection(powerUpType) {
      if (!isMyTurn || gameState.isGameOver || canvas.classList.contains('disabled')) {
           console.log("handlePowerUpSelection: Ignored (not my turn, game over, or disabled)."); // DEBUG
           return;
      }

     // Check if player actually has this power-up
     const playerIndex = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;
     if (!gameState.powerUpInventory[playerIndex] || gameState.powerUpInventory[playerIndex].indexOf(powerUpType) === -1) {
         updateMessage("You don't have this power-up.", true);
         return;
     }


    console.log("Power-up selected:", powerUpType); // DEBUG
    // Toggle selection: If clicking the same power-up again, deselect it.
    if (selectedPowerUp === powerUpType) {
         selectedPowerUp = null;
         updateMessage("Power-up deselected.");
    } else {
         selectedPowerUp = powerUpType;
         updateMessage(`Power-up ${powerUpType} selected. Click on a target tile.`);
    }
    // selectedColor = null; // Deselect color logic is implicitly handled

     // Update UI
     updatePowerUpDisplay(); // Handles highlighting selected power-up
      const swatches = document.querySelectorAll('.color-swatch');
      swatches.forEach(swatch => swatch.classList.remove('selected')); // Deselect colors

}


// --- Game Initialization and State Sync ---

function initializeGame(localPlayerName = "Player 1", opponentName = "Player 2", p1Color = '#FF0000', p2Color = '#0000FF') {
    console.log(`DEBUG: initializeGame - START. Mode: ${gameMode}`);
    gameState = new GameState(); // Create a fresh state
    gameState.playerNames = [localPlayerName, opponentName];
    gameState.playerColors = [p1Color, p2Color];
    selectedColor = null;
    selectedPowerUp = null;

    if (gameMode === 'local') {
        playerName = localPlayerName; // Set global name for local P1
        playerNumber = 0; // Treat local player as player 0
        isMyTurn = true; // Local game starts with player 1
        setupInitialTilesLocal(); // Set initial starting squares randomly for local game
    } else {
        // For online games, names/colors are set by server/syncGameState or initializeOnlineGame
        // playerNumber is set by server
        // isMyTurn is determined by server state
        // Do not set starting squares here, wait for server state
         isMyTurn = false; // Assume not my turn initially online until confirmed by server
         console.log("DEBUG: initializeGame - Online mode, waiting for server state.");
    }

    showGameScreen(); // Ensure game screen is visible
    renderGameBoard(); // Render initial board state
    toggleControls(isMyTurn); // Enable/disable controls based on initial turn

     // Add initial resize call after first render
     resizeGame();
     console.log(`DEBUG: initializeGame - END.`);
}

// Called specifically for local games to place starting tiles
function setupInitialTilesLocal() {
    if (!gameState || gameMode !== 'local') return;

    const placeRandomStart = (playerIndex) => {
        let placed = false;
        let attempts = 0; // Prevent infinite loop
        while (!placed && attempts < 100) {
            const r = Math.floor(Math.random() * gameState.rows);
            const c = Math.floor(Math.random() * gameState.cols);
            const tile = gameState.getTile(r, c);

            // Ensure tile exists and is unowned
            if (tile && tile.owner === -1) {
                 // Basic check: Avoid placing directly on top of other start tile (if P1 already placed)
                 let farEnough = true;
                 if (playerIndex === 1 && gameState.board.some(row => row.some(t => t.isStartingTile && t.owner === 0))) {
                     // Add a more robust distance check if needed
                     const startTileP0 = gameState.board.flat().find(t => t.isStartingTile && t.owner === 0);
                     // Basic Manhattan distance check on offset coords (not perfect for hex)
                     if (startTileP0) {
                        // Find coords of P0 start tile
                        let p0_r, p0_c;
                        outer: for(p0_r = 0; p0_r < gameState.rows; p0_r++){
                           for(p0_c = 0; p0_c < gameState.cols; p0_c++){
                              if(gameState.board[p0_r][p0_c] === startTileP0) break outer;
                           }
                        }
                        const dist = Math.abs(r - p0_r) + Math.abs(c - p0_c);
                        if (dist < 4) farEnough = false; // Ensure minimum distance
                     }
                 }

                if (farEnough) {
                    tile.owner = playerIndex;
                    tile.color = gameState.playerColors[playerIndex];
                    tile.isStartingTile = true;
                    placed = true;
                    console.log(`DEBUG: Player ${playerIndex + 1} starting tile placed at ${r},${c}`);
                }
            }
            attempts++;
        }
         if (!placed) console.error(`Could not place starting tile for player ${playerIndex + 1} after ${attempts} attempts.`);
    };

    placeRandomStart(0);
    placeRandomStart(1);
    gameState.updateScores(); // Update scores after placing starting tiles
    gameState.turnNumber = 0; // Ensure turn number is 0 initially
    gameState.currentPlayerIndex = 0; // Player 1 starts
    isMyTurn = true;
}


// Called by multiplayer.js when receiving game state from server
window.syncGameState = function(serverState) {
    console.log("DEBUG: syncGameState - START");
     if (!gameState) {
         console.error("DEBUG: syncGameState called but no local gameState exists! Attempting recovery.");
         // Attempt to initialize a basic state if needed, dimensions might be wrong
         gameState = new GameState(serverState.rows, serverState.cols);
     }

     // Update local state with server data using deserialize
     // We trust the server sends a complete, valid serialized state
     gameState.deserialize(JSON.stringify(serverState)); // Use deserialize to handle structure and types

     // Determine if it's my turn based on server state and local playerNumber
     isMyTurn = !gameState.isGameOver && (gameState.currentPlayerIndex === playerNumber);
     console.log(`DEBUG: Synced. Player Number: ${playerNumber}, Server Current Player: ${gameState.currentPlayerIndex}, Is My Turn: ${isMyTurn}`);

     // Ensure game screen is visible and render
     showGameScreen();
     renderGameBoard();
     toggleControls(isMyTurn); // Enable/disable controls based on turn
     // updateMessage("Game state updated."); // Use turn indicator update instead
     updateTurnIndicator(); // Ensure turn indicator is correct
     console.log("DEBUG: syncGameState - END");
}

// Called by multiplayer.js when the server confirms game setup (AFTER both players joined and host sent initial state)
window.initializeOnlineGame = function(initGameId, assignedPlayerNumber, playerNamesList, playerColorsList, initialGameStateData) {
     console.log("DEBUG: initializeOnlineGame - START", { initGameId, assignedPlayerNumber, playerNamesList, playerColorsList });
     gameId = initGameId;
     playerNumber = assignedPlayerNumber; // Server tells us if we are 0 or 1
     playerName = playerNamesList[playerNumber]; // Our name from the server list
     gameMode = playerNumber === 0 ? 'online-host' : 'online-client';

     console.log(`DEBUG: Online game start. Game ID: ${gameId}, Player Number: ${playerNumber}, Name: ${playerName}`);

     // Create the initial game state using the dimensions from the server state
     gameState = new GameState(initialGameStateData.rows, initialGameStateData.cols);
     // Immediately deserialize the initial state provided by the server
     gameState.deserialize(JSON.stringify(initialGameStateData));

     // Override names/colors from server lists if they differ (shouldn't normally)
     gameState.playerNames = playerNamesList;
     gameState.playerColors = playerColorsList;

     isMyTurn = !gameState.isGameOver && (gameState.currentPlayerIndex === playerNumber); // Initial turn check based on server state

     showGameScreen(); // Ensure game UI is visible
     renderGameBoard(); // Render the initial board state from server
     toggleControls(isMyTurn);
     updateMessage(`Game started! You are ${playerName}.`);
     updateTurnIndicator(); // Show whose turn it is

     console.log("DEBUG: initializeOnlineGame - END");
}

window.handleGameOver = function(gameOverMessage) {
    console.log("DEBUG: handleGameOver - START", gameOverMessage);
    if (gameState) {
        gameState.isGameOver = true;
        // Scores should be final from last sync or included in message data?
        renderGameBoard(); // Re-render to show final state if needed
        updateMessage(gameOverMessage || gameState.determineWinner()); // Use server message or local calculation
        toggleControls(false); // Disable all controls
    }
     console.log("DEBUG: handleGameOver - END");
}

// Kept separate from generic disconnect handler
window.handleOpponentDisconnect = function(message) {
     console.log("DEBUG: handleOpponentDisconnect - START", message);
      if (gameState && !gameState.isGameOver) {
         updateMessage(message, true);
         gameState.isGameOver = true; // End the game
         toggleControls(false);
     }
      console.log("DEBUG: handleOpponentDisconnect - END");
};

// --- Multiplayer Communication Helpers (Called by multiplayer.js) ---

// Called when server confirms game creation (P1) or joining (P2)
window.setGameInfo = function(receivedGameId, assignedPlayerNumber, opponentPlayerName = null) {
    console.log(`DEBUG: setGameInfo - START - ID: ${receivedGameId}, PlayerNum: ${assignedPlayerNumber}, Opponent: ${opponentPlayerName}`);
    gameId = receivedGameId;
    playerNumber = assignedPlayerNumber;
    gameMode = (playerNumber === 0) ? 'online-host' : 'online-client';

    // Update UI immediately
    if (gameIdDisplay) gameIdDisplay.textContent = gameId;
    const challengeInfo = document.getElementById('challenge-info'); // Get element locally
    if (challengeInfo) challengeInfo.style.display = 'block'; // Show game ID area

    if (playerNumber === 0) { // Player 1 (Host)
        updateMessage(`Game created! Code: ${gameId}. Setting up board...`);
        // Setup local state *first*
        initializeGame(playerName, "Waiting...", '#FF0000', '#0000FF'); // Initialize with placeholder opponent
        setupInitialTilesLocal(); // Place starting tiles *locally*
        renderGameBoard(); // Render the board with starting tiles
        console.log('DEBUG: Player 1 local setup complete. Sending initial state to server...');
        // Now send the initial state to the server via multiplayer module
        window.multiplayer.sendInitialGameState(gameId, gameState.serialize()); // Send serialized state
    } else { // Player 2 (Client)
        updateMessage(`Joined game ${gameId}. Waiting for host to start...`);
        // Player 2 just updates names if opponent name is known, then waits for 'game-setup'
        if (!gameState) {
            // If P2 joins, gameState might not exist yet. Create a basic shell.
            // Dimensions might be default until first sync.
             gameState = new GameState();
             console.log("DEBUG: P2 joined, created placeholder gameState.");
        }
        if (opponentPlayerName) {
            gameState.playerNames[0] = opponentPlayerName; // Player 0 is opponent
             gameState.playerNames[1] = playerName; // Player 1 is us (since playerNumber=1)
             updateScoreDisplay();
        } else {
            // Set placeholder names if opponent unknown
            gameState.playerNames[0] = "Player 1";
            gameState.playerNames[1] = playerName;
             updateScoreDisplay();
        }
        // Ensure game screen is shown while waiting
        showGameScreen();
        // Maybe render a placeholder board or message?
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    }
    console.log(`DEBUG: setGameInfo - END`);
};

// Called when opponent info is updated (e.g., P2 joins, P1 receives name)
window.setOpponentInfo = function(opponentNum, opponentPlayerName) {
     console.log(`DEBUG: setOpponentInfo - START - Num: ${opponentNum}, Name: ${opponentPlayerName}`);
    if (gameState && gameState.playerNames[opponentNum] !== undefined) {
        gameState.playerNames[opponentNum] = opponentPlayerName;
        updateScoreDisplay(); // Update names on screen
        // If P1, maybe update message
        if (playerNumber === 0) {
            updateMessage(`${opponentPlayerName} joined! Starting game...`);
        }
    }
     console.log(`DEBUG: setOpponentInfo - END`);
};

// --- Multiplayer Error Handlers (Called by multiplayer.js) ---

window.handleConnectionError = function(errorMessage) {
    console.error("DEBUG: handleConnectionError:", errorMessage);
    // Display error on the setup screen message area
     if (setupMessageElement) setupMessageElement.textContent = `Connection Failed: ${errorMessage}`;
     showSetupScreen(); // Force back to setup screen on connection failure
     gameMode = 'local'; // Reset game mode
};

window.handleUnexpectedDisconnect = function(message) {
     console.error("DEBUG: handleUnexpectedDisconnect:", message);
     if (gameState && !gameState.isGameOver) {
         updateMessage(`Disconnected: ${message}`, true);
         gameState.isGameOver = true; // End the game
         toggleControls(false);
     } else if (!gameState) {
          // If disconnect happens before game starts
          if (setupMessageElement) setupMessageElement.textContent = `Disconnected: ${message}`;
          showSetupScreen();
     }
};

window.handleGenericServerError = function(message, errorType) {
     console.error(`DEBUG: handleGenericServerError (${errorType}):`, message);
     // Show error, but don't necessarily change UI state unless critical
     updateMessage(`Server Error: ${message}`, true);
};

window.handleGameSetupError = function(message) {
     console.error("DEBUG: handleGameSetupError:", message);
      // Display error on setup screen
       if (setupMessageElement) setupMessageElement.textContent = `Game Setup Failed: ${message}`;
       showSetupScreen(); // Force back to setup screen
       toggleControls(false);
       gameMode = 'local'; // Reset game mode
};


// --- Utility Functions ---

function getNeighbors(r, c) {
    const neighbors = [];
    // Offset coordinates for pointy-top hex grid
    const neighborOffsets = [
        [+1, 0], [+1, -1], [ 0, -1], // Even cols: S, SW, NW
        [-1, 0], [-1, +1], [ 0, +1], // Even cols: N, NE, SE

        [+1, 0], [+1, +1], [ 0, +1], // Odd cols: S, SE, NE
        [-1, 0], [-1, -1], [ 0, -1]  // Odd cols: N, NW, SW
    ];
    const parity = c & 1; // 0 for even, 1 for odd
    const offsets = parity === 0 ? neighborOffsets.slice(0, 6) : neighborOffsets.slice(6, 12);

     // Simplified unified offsets for pointy top, works for both parities:
     const unifiedOffsets = [
       [+1, 0], // S
       [0, -1], // NW
       [-1,-1 + parity], // N/NW diag (corrects based on parity)
       [-1, 0], // N
       [-1,+1 - parity], // N/NE diag (corrects based on parity)
       [0, +1], // NE
       // Hmm, the standard 6 neighbors are simpler:
       // N, S, NE, NW, SE, SW
       // Adjust NE/NW/SE/SW based on parity
     ];

     const standardOffsets = [
       [-1, 0], // N
       [+1, 0], // S
       [0, +1], // E-side (+1 col)
       [0, -1], // W-side (-1 col)
       // Diagonals depend on parity
       // If even col (parity 0): NW(-1,-1), NE(-1, +1)
       // If odd col (parity 1): SW(+1, -1), SE(+1, +1)
       [parity === 0 ? -1 : +1, -1], // NW / SW
       [parity === 0 ? -1 : +1, +1]  // NE / SE
     ];


    for (const [dr, dc] of standardOffsets) { // Use standardOffsets
        const nr = r + dr;
        const nc = c + dc;
        // Check bounds using gameState dimensions if available
        if (gameState && nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
            neighbors.push({ nr, nc });
        } else if (!gameState && nr >= 0 && nc >= 0) {
            // If gameState not ready, perform basic check (used rarely)
            neighbors.push({ nr, nc });
        }
    }
    return neighbors;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function darkenColor(hexColor, percent) {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return hexColor; // Return original if invalid hex

    const factor = 1 - percent / 100;

    const r = Math.max(0, Math.min(255, Math.round(rgb.r * factor)));
    const g = Math.max(0, Math.min(255, Math.round(rgb.g * factor)));
    const b = Math.max(0, Math.min(255, Math.round(rgb.b * factor)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


function resizeGame() {
     // Adjust canvas CSS size to fit container, redraw internal buffer
    const gameArea = document.getElementById('game-area');
    // Only attempt to render if canvas, gameArea, AND gameState exist
    if (canvas && gameArea && gameState) {
        // Let CSS handle the display size
        // Re-rendering handles internal scaling if needed
        renderGameBoard();
        console.log("DEBUG: resizeGame triggered, re-rendering.");
    } else {
        console.log("DEBUG: resizeGame triggered, but gameState not ready for rendering.");
    }
}


// --- Chat Functions ---
// Simplified displayChatMessage - relies on addChatMessage for logic
function displayChatMessage(senderName, messageText, options = {}) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');

    const isMine = options.isMine;
    const isSystem = options.isSystem;

    messageElement.classList.add(isSystem ? 'system-message' : (isMine ? 'my-message' : 'other-message'));
    if (options.isTaunt) messageElement.classList.add('taunt-message');


    if (!isSystem) {
        const nameSpan = document.createElement('div'); nameSpan.className = 'sender-name';
        nameSpan.textContent = senderName + (isMine ? " (You)" : ""); // Add "(You)" if mine
        messageElement.appendChild(nameSpan);
    }

    const msgTextElem = document.createElement('div'); msgTextElem.className = 'message-text';
    msgTextElem.textContent = messageText; // Use textContent to prevent XSS
    messageElement.appendChild(msgTextElem);

    const timestampSpan = document.createElement('div'); timestampSpan.className = 'message-timestamp';
    const time = options.timestamp ? new Date(options.timestamp) : new Date();
    // Ensure getMinutes returns two digits
    const minutes = time.getMinutes().toString().padStart(2, '0');
    timestampSpan.textContent = `${time.getHours()}:${minutes}`;
    messageElement.appendChild(timestampSpan);


    // Append and scroll logic
     const shouldScroll = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 30; // Threshold
    chatMessages.appendChild(messageElement);
     if (shouldScroll || isMine) { // Always scroll for own messages or if already near bottom
         chatMessages.scrollTop = chatMessages.scrollHeight;
     }
}

// Global hook for multiplayer module to call
window.addChatMessage = function(data) {
     // data expected: { playerName?: string, playerNumber: int, message: string, isTaunt: bool, isFromServer: bool, timestamp: date/string }
     console.log("DEBUG: window.addChatMessage received:", data); // DEBUG
     const sender = data.isFromServer ? 'System' : (data.playerName || `Player ${data.playerNumber + 1}`); // Use P1/P2 for display
     // Determine if it's the local player's message
     const isMine = typeof playerNumber !== 'undefined' && data.playerNumber === playerNumber;
     displayChatMessage(sender, data.message, { isMine: isMine, isSystem: data.isFromServer, isTaunt: data.isTaunt, timestamp: data.timestamp });
};


function setupChat() {
     // Use globally declared variables, assuming they are assigned in DOMContentLoaded
     const chatSendHandler = () => {
          const message = chatInput.value.trim();
          if (message && gameMode !== 'local') {
              // Call the exposed multiplayer function
              window.multiplayer.sendChatMessage(message);
              // Don't display locally, wait for server echo via addChatMessage
              chatInput.value = '';
          }
      };

      if (sendChatButton && chatInput) {
         sendChatButton.addEventListener('click', chatSendHandler);
         chatInput.addEventListener('keypress', (e) => {
             if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 chatSendHandler();
             }
         });
     } else {
         console.warn("Chat input or send button not found during setup."); // DEBUG
     }

     if (toggleChatButton && chatContainer) {
         toggleChatButton.addEventListener('click', () => {
             // Using style.display for toggling
              const isVisible = chatContainer.style.display !== 'none';
              chatContainer.style.display = isVisible ? 'none' : 'flex';
              // toggleChatButton.textContent = isVisible ? 'Show Chat' : 'Hide Chat'; // Icon used instead
         });
          // Set initial state based on gameMode
          if (gameMode === 'local') {
              chatContainer.style.display = 'none';
              toggleChatButton.style.display = 'none';
          } else {
             // Online: default depends on CSS? Let's ensure it's hidden initially by style attribute in HTML
             // toggleChatButton should be visible
             toggleChatButton.style.display = 'block';
          }
     } else {
          console.warn("Chat container or toggle button not found during setup."); // DEBUG
     }
}


// --- Global Action Functions ---
window.restartGame = function() {
    if (gameMode !== 'local') {
        console.log("DEBUG: Requesting online game restart...");
        window.multiplayer.requestRestartGame(); // Exists in multiplayer.js
    } else {
        console.log("DEBUG: Restarting local game...");
        // Re-initialize with current names/colors if available
        const p1Name = gameState?.playerNames[0] || "Player 1";
        const p2Name = gameState?.playerNames[1] || "Player 2";
        const p1Color = gameState?.playerColors[0] || '#FF0000';
        const p2Color = gameState?.playerColors[1] || '#0000FF';
        initializeGame(p1Name, p2Name, p1Color, p2Color);
    }
};

window.leaveGame = function() {
     console.log("DEBUG: leaveGame called.");
     if (gameMode !== 'local') {
        // Attempt to notify server if possible, but always reload.
        if (window.multiplayer && typeof window.multiplayer.notifyLeaveGame === 'function') {
            console.log("DEBUG: Notifying server of leave.");
            window.multiplayer.notifyLeaveGame();
        }
     }
     // For both local and online, leaving means reloading the page to start fresh.
     console.log("DEBUG: Reloading page.");
     window.location.reload();
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded - START");

    // --- Get DOM Elements ---
    // Assign values to globally declared variables
    canvas = document.getElementById('gameCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        if (!ctx) console.error("Failed to get 2D context!");
    } else {
        console.error("Canvas element not found!");
        // If canvas is critical, might want to return or display an error message
    }

    setupContainer = document.getElementById('setup-container');
    playerNameInput = document.getElementById('player-name-input'); // Correct ID
    setupMessageElement = document.getElementById('setup-message');
    localGameButton = document.getElementById('local-game-button'); // Correct ID
    createChallengeButton = document.getElementById('create-challenge-button'); // Correct ID
    joinChallengeButton = document.getElementById('join-challenge-button'); // Correct ID
    gameIdInput = document.getElementById('game-id-input'); // Correct ID
    leaveGameButton = document.getElementById('leaveGameButton');
    restartGameButton = document.getElementById('restartGameButton');
    messageElement = document.getElementById('message');
    gameScreen = document.getElementById('game-area');
    scoreContainer = document.getElementById('score-container'); // Get score container
    gameControls = document.getElementById('game-controls'); // Get game controls container
    challengeInfo = document.getElementById('challenge-info'); // Get challenge info container
    gameIdDisplay = document.getElementById('game-id-display');
    player1ScoreElement = document.getElementById('player1-score');
    player2ScoreElement = document.getElementById('player2-score');
    colorSwatchesContainer = document.getElementById('color-palette');
    powerUpSlotsContainer = document.getElementById('powerup-slots'); // If exists
    landmineInfoElement = document.getElementById('landmine-info');
    chatInput = document.getElementById('chat-input');
    chatMessages = document.getElementById('chat-messages');
    sendChatButton = document.getElementById('send-message'); // Use correct ID
    toggleChatButton = document.getElementById('toggle-chat');
    chatContainer = document.getElementById('chat-container');

    // Check if all essential elements were found
    if (!setupContainer || !gameScreen || !canvas || !ctx) {
         console.error("CRITICAL ERROR: Missing essential UI elements (setup, gameScreen, canvas, ctx). Stopping initialization.");
         document.body.innerHTML = "<h1>Error: Failed to load game UI. Please refresh.</h1>";
         return; // Stop further execution
    }

    // --- Initial UI State ---
    showSetupScreen(); // Start by showing the setup screen

    // --- Setup Screen Button Listeners ---
    if (localGameButton) {
        localGameButton.addEventListener('click', () => {
            console.log("DEBUG: localGameButton clicked.");
            const name = playerNameInput.value.trim() || 'Player 1';
             playerName = name; // Set global name
             gameMode = 'local';
             if (setupMessageElement) setupMessageElement.textContent = "Starting local game...";
             initializeGame(playerName); // Start local game
        });
    } else console.warn("DEBUG: localGameButton not found.");

    if (createChallengeButton) {
        createChallengeButton.addEventListener('click', () => {
            console.log("DEBUG: createChallengeButton clicked.");
            const name = playerNameInput.value.trim();
            if (!name) {
                if (setupMessageElement) setupMessageElement.textContent = "Please enter your name.";
                return;
            }
             playerName = name; // Set global playerName
             gameMode = 'online-host';
            if (setupMessageElement) setupMessageElement.textContent = "Connecting to server...";
            // Use multiplayer module's connect function
             if (window.multiplayer) {
                window.multiplayer.connectToServer(playerName, 'create', { playerName: playerName });
             } else {
                console.error("Multiplayer module not found!");
                if (setupMessageElement) setupMessageElement.textContent = "Error: Multiplayer features unavailable.";
             }
        });
    } else console.warn("DEBUG: createChallengeButton not found.");

     if (joinChallengeButton && gameIdInput) {
        joinChallengeButton.addEventListener('click', () => {
            console.log("DEBUG: joinChallengeButton clicked.");
             const name = playerNameInput.value.trim();
             const idToJoin = gameIdInput.value.trim().toUpperCase();
            if (!name) {
                if (setupMessageElement) setupMessageElement.textContent = "Please enter your name.";
                return;
            }
            if (!idToJoin) {
                 if (setupMessageElement) setupMessageElement.textContent = "Please enter a Game ID to join.";
                 return;
             }
             playerName = name; // Set global playerName
             gameMode = 'online-client';
             if (setupMessageElement) setupMessageElement.textContent = "Connecting to server...";
            // Use multiplayer module's connect function
             if (window.multiplayer) {
                window.multiplayer.connectToServer(playerName, 'join', { playerName: playerName, gameId: idToJoin });
             } else {
                console.error("Multiplayer module not found!");
                if (setupMessageElement) setupMessageElement.textContent = "Error: Multiplayer features unavailable.";
             }
        });
    } else console.warn("DEBUG: joinChallengeButton or gameIdInput not found.");

     // --- Other Button Listeners ---
     if (leaveGameButton) {
         leaveGameButton.addEventListener('click', window.leaveGame);
     } else console.warn("DEBUG: leaveGameButton not found.");
      if (restartGameButton) {
         restartGameButton.addEventListener('click', window.restartGame);
     } else console.warn("DEBUG: restartGameButton not found.");

    // --- Canvas Event Listeners ---
    canvas.addEventListener('click', handleCanvasClick);
    // canvas.addEventListener('mousemove', handleCanvasMouseMove); // Keep disabled unless needed

     // --- Color Palette Setup ---
    // Attaching listeners to existing buttons
    const palette = document.getElementById('color-palette');
    if (palette) {
        const colorButtons = palette.querySelectorAll('.color-button');
        colorButtons.forEach(button => {
            const color = button.dataset.color;
            if (color) {
                // Assign the click handler directly to existing buttons
                button.onclick = () => handleColorSelection(color);
            }
        });
         // Initialize palette state (disabled)
         toggleControls(false); // Start with controls disabled
    } else console.warn("DEBUG: color-palette element not found.");


     // --- Chat Setup ---
     setupChat();

    // --- Window Resize Listener ---
    window.addEventListener('resize', resizeGame);

    console.log("DEBUG: DOMContentLoaded - END");

}); // End of DOMContentLoaded listener