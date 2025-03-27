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

// Sound effects
const sounds = {
    placeTile: new Audio('sounds/place_tile.mp3'),
    const MAX_UNDO_STEPS = 5; // Allow up to 5 undo steps
    
    // Function to play sound effects
    function playSound(soundName) {
        // Check if sound is enabled (optional enhancement)
        // console.log(`Attempting to play sound: ${soundName}`); // Debug log
        try {
            const audio = new Audio(`assets/sounds/${soundName}.mp3`);
            audio.play().catch(error => {
                // Autoplay was prevented, log it but don't crash
                // console.error(`Sound play failed for ${soundName}:`, error);
            });
        } catch (error) {
            console.error(`Error loading sound ${soundName}:`, error);
        }
    }
    
    // DOM element references (initialized in DOMContentLoaded)
    let canvas, ctx, messageElement, setupContainer, gameScreen, playerNameInput, localGameButton,
        createChallengeButton, joinChallengeButton, setupMessageElement, gameIdDisplay,
        player1ScoreElement, player2ScoreElement, colorSwatchesContainer, powerUpSlotsContainer,
        landmineInfoElement, chatInput, chatMessages, sendChatButton, toggleChatButton, chatContainer,
        leaveGameButton;
    
    // --- State Management ---
    class GameState {
        constructor() {
            this.reset();
        }
        this.revealedMines = new Set(); // Mines triggered
        this.protectedTiles = new Map(); // Stores "row,col" => playerIndex for shielded tiles
        this.turnNumber = 0;
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
                    hasLandmine: false,
                    powerUpType: null
                };
            }
        }
        return board;
    }

    reset() {
        this.board = this.createInitialBoard(this.rows, this.cols);
        this.playerScores = [0, 0];
        this.currentPlayerIndex = 0;
        this.isGameOver = false;
        this.powerUpInventory = [[], []];
        this.landmines = new Set();
        this.revealedMines = new Set();
        this.protectedTiles = new Map();
        this.turnNumber = 0;
        // Keep player names and colors unless specifically reset elsewhere
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
        });
    }

    deserialize(jsonData) {
        const data = JSON.parse(jsonData);
        this.rows = data.rows;
        this.cols = data.cols;
        this.board = data.board;
        this.playerScores = data.playerScores;
        this.playerNames = data.playerNames;
        this.playerColors = data.playerColors;
        this.currentPlayerIndex = data.currentPlayerIndex;
        this.isGameOver = data.isGameOver;
        this.powerUpInventory = data.powerUpInventory;
        this.landmines = new Set(data.landmines);
        this.revealedMines = new Set(data.revealedMines);
        this.protectedTiles = new Map(data.protectedTiles);
        this.turnNumber = data.turnNumber;
    }

    getTile(r, c) {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
            return this.board[r][c];
        }
        return null;
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
        if (!tile || tile.owner !== -1 || this.isGameOver) return false; // Already owned or game over

        const coordKey = `${r},${c}`;
        // Check for landmine FIRST
        if (this.landmines.has(coordKey) && !this.revealedMines.has(coordKey)) {
            console.log(`Player ${playerIndex} hit a mine at ${r},${c}!`);
            this.revealedMines.add(coordKey);
            playSound('landmine');
            // Optionally, add penalty logic here (e.g., lose turn, score penalty)
            // For now, just reveal it and deny the placement.
            // Update the tile visually if needed (handled in render)
            return { hitMine: true, placed: false }; // Indicate mine hit, tile not placed
        }

        // Check if placement is valid (adjacent to existing tile of same player)
        const neighbors = getNeighbors(r, c);
        let isAdjacent = false;
        if (this.turnNumber < 2) { // First two turns can place anywhere
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
            console.log("Invalid placement: Must be adjacent to your own tile.");
            playSound('error');
            return { hitMine: false, placed: false };
        }

        // Place the tile
        tile.owner = playerIndex;
        tile.color = color;
        playSound('placeTile');
        this.updateScores();

        // Check for power-up or landmine generation
        let awardedPowerUp = null;
        let generatedLandmine = false;
        if (Math.random() < POWER_UP_CHANCE) {
            tile.hasPowerUp = true;
            tile.powerUpType = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
            awardedPowerUp = tile.powerUpType;
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
                    this.getTile(nr, nc).hasLandmine = true; // Mark for rendering hints?
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
                     // Add visual effect for shield breaking?
                 } else {
                    neighborTile.owner = playerIndex;
                    neighborTile.color = color; // Change to capturer's color
                    capturedCount++;
                 }
            }
        }

        if (capturedCount > 0) {
            console.log(`Player ${playerIndex} captured ${capturedCount} tiles!`);
            this.updateScores();
        }

        this.checkForGameOver();

        return { hitMine: false, placed: true, awardedPowerUp, generatedLandmine };
    }

     givePowerUp(playerIndex, powerUpType) {
        if (!this.powerUpInventory[playerIndex]) {
            this.powerUpInventory[playerIndex] = [];
        }
        this.powerUpInventory[playerIndex].push(powerUpType);
        updatePowerUpDisplay(); // Update UI
    }

    usePowerUp(playerIndex, powerUpType, targetR, targetC) {
        if (this.isGameOver || this.currentPlayerIndex !== playerIndex) return { used: false, error: "Not your turn or game over." };

        const inventory = this.powerUpInventory[playerIndex];
        const powerUpIndex = inventory.indexOf(powerUpType);

        if (powerUpIndex === -1) return { used: false, error: "Power-up not found." };

        let success = false;
        let message = "";
        const targetKey = `${targetR},${targetC}`;
        const targetTile = this.getTile(targetR, targetC);
        const opponentIndex = 1 - playerIndex;

        switch (powerUpType) {
            case 'shield':
                if (targetTile && targetTile.owner === playerIndex && !this.protectedTiles.has(targetKey)) {
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
                 if (targetTile && targetTile.owner === opponentIndex && !this.protectedTiles.has(targetKey)) {
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
                if (targetTile) { // Can bomb any tile (owned, unowned, opponent's)
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
                        playSound('landmine'); // Bomb sound
                     }
                } else {
                     message = "Invalid target for bomb."; // Should not happen if r,c are valid
                     playSound('error');
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
            // It's still the player's turn after using a power-up
            return { used: true, message: message };
        } else {
            return { used: false, error: message };
        }
    }

    switchTurn() {
        if (this.isGameOver) return;
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        this.turnNumber++;
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
                const tile = this.board[r][c];
                if (tile.owner !== -1) {
                    this.playerScores[tile.owner]++;
                }
            }
        }
        updateScoreDisplay();
    }

    checkForGameOver() {
        let unownedCount = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c].owner === -1) {
                    // Only count unowned tiles that are placeable (adjacent to someone)
                    // unless it's the very start of the game
                    if (this.turnNumber < 2) {
                        unownedCount++;
                        continue;
                    }
                     let isPlaceable = false;
                     const neighbors = getNeighbors(r, c);
                     for(const {nr, nc} of neighbors) {
                        const neighborTile = this.getTile(nr, nc);
                        if (neighborTile && neighborTile.owner !== -1) {
                            isPlaceable = true;
                            break;
                        }
                     }
                     if (isPlaceable) {
                        unownedCount++;
                     }
                }
            }
        }

        if (unownedCount === 0) {
            this.isGameOver = true;
            console.log("Game Over!");
            playSound('gameOver');
            determineWinner();
            updateTurnIndicator(); // Show game over message
            toggleControls(false); // Disable controls on game over
            // In online mode, the server will also detect and broadcast game over
            if (gameMode !== 'local' && playerNumber === 0) { // Host notifies server
                 window.sendGameOver(); // Function to be defined in multiplayer.js
            }
        }
         return this.isGameOver;
    }

    determineWinner() {
        if (!this.isGameOver) return "Game not over";
        const score1 = this.playerScores[0];
        const score2 = this.playerScores[1];
        const name1 = this.playerNames[0] || "Player 1";
        const name2 = this.playerNames[1] || "Player 2";

        if (score1 > score2) return `${name1} Wins!`;
        if (score2 > score1) return `${name2} Wins!`;
        return "It's a Tie!";
    }
}


// --- Drawing Functions ---

function drawHexagon(r, c, color, tile) {
    const x = c * HEX_SIZE * 1.5;
    const y = r * HEX_SIZE * Math.sqrt(3) + (c % 2 === 1 ? HEX_SIZE * Math.sqrt(3) / 2 : 0);
    const angle = Math.PI / 3; // 60 degrees

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(
            x + HEX_SIZE * Math.cos(angle * i + Math.PI / 6), // Add PI/6 offset for pointy top
            y + HEX_SIZE * Math.sin(angle * i + Math.PI / 6)
        );
    }
    ctx.closePath();

    // Fill
    ctx.fillStyle = color;
    ctx.fill();

    // Border styling based on ownership and state
    let borderColor = '#555'; // Default dark border
    let borderWidth = 1;

    if (tile && tile.owner !== -1) {
        // Owned tile: Use slightly darker version of player color for border
        borderColor = darkenColor(tile.color, 30); // Darken by 30%
        borderWidth = 2; // Thicker border for owned tiles
    } else {
        // Unowned tile: Default border
    }

     // Highlight for shield
    if (tile && gameState.protectedTiles.has(`${r},${c}`)) {
        borderColor = '#FFFF00'; // Yellow border for shield
        borderWidth = 3;
    }

    // Highlight for revealed mine
    if (tile && gameState.revealedMines.has(`${r},${c}`)) {
        borderColor = '#FF0000'; // Red border for revealed mine
        borderWidth = 3;
        // Optional: Draw an 'X' or symbol
        ctx.font = `${HEX_SIZE * 0.6}px Arial`;
        ctx.fillStyle = '#FF0000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X', x, y);
    }


    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();

     // Optional: Draw power-up indicator if present but not collected
     // Note: This requires the tile object to be passed or accessed
    /*
    if (tile && tile.hasPowerUp && tile.owner === -1) { // Example: only show on unowned
        ctx.fillStyle = 'gold';
        ctx.font = `${HEX_SIZE * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y); // Placeholder '?'
    }
    */
}

function renderGameBoard() {
    if (!ctx || !gameState) return;
     // Calculate required canvas size
    const requiredWidth = gameState.cols * HEX_SIZE * 1.5 + HEX_SIZE * 0.5;
    const requiredHeight = gameState.rows * HEX_SIZE * Math.sqrt(3) + HEX_SIZE * Math.sqrt(3) / 2;

    // Resize canvas if necessary
    if (canvas.width < requiredWidth || canvas.height < requiredHeight) {
        canvas.width = requiredWidth;
        canvas.height = requiredHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Center the grid (optional, adjust as needed)
    const offsetX = (canvas.width - requiredWidth) / 2 + HEX_SIZE; // Initial offset for centering + first hex radius
    const offsetY = (canvas.height - requiredHeight) / 2 + HEX_SIZE * Math.sqrt(3) / 2; // Initial offset + first hex height/2


    ctx.save();
    ctx.translate(offsetX, offsetY); // Apply translation for centering

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const tile = gameState.board[r][c];
            // Pass the tile object to drawHexagon
            drawHexagon(r, c, tile.color, tile);
        }
    }

     ctx.restore(); // Restore context after translation

    // Update other UI elements
    updateScoreDisplay();
    updateTurnIndicator();
    updatePowerUpDisplay();
    updateLandmineInfo();

}


function getHexCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

     // Adjust mouse coordinates based on current canvas translation (if any)
     const matrix = ctx.getTransform();
     const invMatrix = matrix.invertSelf();
     const transformedX = mouseX * invMatrix.a + mouseY * invMatrix.c + invMatrix.e;
     const transformedY = mouseX * invMatrix.b + mouseY * invMatrix.d + invMatrix.f;


    // Approximate conversion - might need refinement for accuracy
    const approxCol = (transformedX / (HEX_SIZE * 1.5));
    const approxRow = (transformedY / (HEX_SIZE * Math.sqrt(3))) - (approxCol % 2 === 1 ? 0.5 : 0);

    // Find the closest hex center
    let minDist = Infinity;
    let closestR = -1, closestC = -1;

    // Iterate over a small grid around the approximation
    for (let rOffset = -1; rOffset <= 1; rOffset++) {
        for (let cOffset = -1; cOffset <= 1; cOffset++) {
            const r = Math.round(approxRow) + rOffset;
            const c = Math.round(approxCol) + cOffset;

            if (r < 0 || r >= gameState.rows || c < 0 || c >= gameState.cols) continue;

            const hexX = c * HEX_SIZE * 1.5;
            const hexY = r * HEX_SIZE * Math.sqrt(3) + (c % 2 === 1 ? HEX_SIZE * Math.sqrt(3) / 2 : 0);

            const dist = Math.sqrt((transformedX - hexX) ** 2 + (transformedY - hexY) ** 2);

             // Check if the click is actually within the hexagon boundaries (more accurate)
            if (dist < HEX_SIZE) { // Simple radius check
                 if (dist < minDist) {
                    minDist = dist;
                    closestR = r;
                    closestC = c;
                 }
            }
        }
    }


    return { r: closestR, c: closestC };
}


// --- UI Update Functions ---

function updateScoreDisplay() {
    const score1Elem = document.getElementById('player1-score');
    const score2Elem = document.getElementById('player2-score');
    const player1NameElem = document.getElementById('player1-name');
    const player2NameElem = document.getElementById('player2-name');
    const player1ColorSwatch = document.getElementById('player1-color-swatch');
    const player2ColorSwatch = document.getElementById('player2-color-swatch');
    const player1Container = document.getElementById('player1-score-container');
    const player2Container = document.getElementById('player2-score-container');

    if (score1Elem && gameState) score1Elem.textContent = gameState.playerScores[0];
    if (score2Elem && gameState) score2Elem.textContent = gameState.playerScores[1];

    const name1 = gameState?.playerNames[0] || "Player 1";
    const name2 = gameState?.playerNames[1] || "Player 2";
    if (player1NameElem) player1NameElem.textContent = name1;
    if (player2NameElem) player2NameElem.textContent = name2;

    const color1 = gameState?.playerColors[0] || '#FF0000';
    const color2 = gameState?.playerColors[1] || '#0000FF';
    if (player1ColorSwatch) player1ColorSwatch.style.backgroundColor = color1;
    if (player2ColorSwatch) player2ColorSwatch.style.backgroundColor = color2;

    // Highlight current player
    if (player1Container && player2Container && gameState && !gameState.isGameOver) {
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
        messageElem.textContent = gameState.determineWinner();
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

    if (!gameState || !playerInventories[0] || !playerInventories[1]) return;


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

            // Make clickable only if it's the current player's inventory and they have the power-up
            const isClickable = (gameMode === 'local' || i === playerNumber) && count > 0 && isMyTurn;

            if (isClickable) {
                 powerUpSlot.classList.add('active');
                 powerUpSlot.onclick = () => handlePowerUpSelection(powerUpType);
            } else {
                 powerUpSlot.classList.add('disabled');
            }

            // Add visual representation (e.g., icon or text)
            const icon = document.createElement('span');
            icon.classList.add('powerup-icon');
            // Simple text representation for now
            icon.textContent = powerUpType.substring(0, 1).toUpperCase();
            if (powerUpType === 'shield') icon.textContent = 'S';
            if (powerUpType === 'steal') icon.textContent = 'T';
            if (powerUpType === 'bomb') icon.textContent = 'B';
            powerUpSlot.appendChild(icon);


             // Add count bubble
            if (count > 0) {
                const countBubble = document.createElement('span');
                countBubble.classList.add('powerup-count');
                countBubble.textContent = count;
                powerUpSlot.appendChild(countBubble);
            }

             // Highlight if selected
            if (selectedPowerUp === powerUpType && i === playerNumber) {
                powerUpSlot.classList.add('selected');
            }


            inventoryElem.appendChild(powerUpSlot);
        });
    }
}


function updateLandmineInfo() {
    const landmineInfo = document.getElementById('landmine-info');
    if (landmineInfo && gameState) {
        const activeMines = gameState.landmines.size - gameState.revealedMines.size;
         // Only show if playing online and it's opponent's turn OR if local mode
         if (gameMode === 'local' || (gameMode !== 'local' && !isMyTurn)) {
             landmineInfo.textContent = `Active Mines: ${activeMines}`;
             landmineInfo.style.display = activeMines > 0 ? 'block' : 'none';
         } else {
             landmineInfo.style.display = 'none'; // Hide from current player in online mode
         }
    }
}


function updateMessage(msg, isError = false) {
    const messageElem = document.getElementById('message');
    if (messageElem) {
        messageElem.textContent = msg;
        if (isError) {
             messageElem.className = 'message error';
             playSound('error');
        } else {
             // Reset to default turn indicator styling if needed
             updateTurnIndicator();
        }
    }
}

function toggleControls(enabled) {
     // Disable/enable color palette
    const colorSwatches = document.querySelectorAll('.color-swatch');
    colorSwatches.forEach(swatch => {
        if (enabled) {
            swatch.classList.remove('disabled');
            swatch.onclick = () => handleColorSelection(swatch.dataset.color);
        } else {
            swatch.classList.add('disabled');
            swatch.onclick = null;
        }
    });

     // Disable/enable power-up slots (handled within updatePowerUpDisplay)
     updatePowerUpDisplay();

     // Disable/enable canvas interaction (optional, prevents hover effects etc.)
     // canvas.style.pointerEvents = enabled ? 'auto' : 'none';
}

function showSetupScreen() {
    document.getElementById('setup-container').style.display = 'flex';
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('score-container').style.display = 'none';
    document.getElementById('color-palette').style.display = 'none';
    document.getElementById('game-controls').style.display = 'none'; // Includes power-ups, messages etc.
     document.getElementById('chat-container').style.display = 'none';
     document.getElementById('toggle-chat').style.display = 'none';
     document.getElementById('challenge-info').style.display = 'none';
}

function showGameScreen() {
    document.getElementById('setup-container').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex'; // Use flex for canvas centering
    document.getElementById('score-container').style.display = 'flex'; // Use flex for layout
    document.getElementById('color-palette').style.display = 'block';
    document.getElementById('game-controls').style.display = 'block';
     // Show chat only in online mode
    if (gameMode !== 'local') {
         document.getElementById('chat-container').style.display = 'flex'; // Or 'block' based on your CSS
         document.getElementById('toggle-chat').style.display = 'block';
         document.getElementById('challenge-info').style.display = 'block'; // Show Game ID
         document.getElementById('game-id-display').textContent = gameId || 'N/A';
    } else {
        document.getElementById('chat-container').style.display = 'none';
        document.getElementById('toggle-chat').style.display = 'none';
         document.getElementById('challenge-info').style.display = 'none';
    }
}


// --- Event Handlers ---

function handleCanvasClick(event) {
    if (!gameState || gameState.isGameOver || !isMyTurn) return;

    const { r, c } = getHexCoords(event);
    if (r === -1 || c === -1) return; // Click outside valid hex area

    const tile = gameState.getTile(r,c);

    // If a power-up is selected, try to use it
    if (selectedPowerUp) {
        console.log(`Attempting to use ${selectedPowerUp} on tile ${r},${c}`);
         const playerIndexToUse = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;

        // Send power-up move to server or handle locally
        if (gameMode !== 'local') {
             window.sendMove({ type: 'powerup', powerUpType: selectedPowerUp, r, c, playerIndex: playerIndexToUse });
             // Optimistic UI update (optional, server state is source of truth)
             // gameState.usePowerUp(playerIndexToUse, selectedPowerUp, r, c); // Simulate locally
             // renderGameBoard(); // Re-render after simulation
        } else {
             const result = gameState.usePowerUp(playerIndexToUse, selectedPowerUp, r, c);
             if (result.used) {
                 updateMessage(result.message);
                 // Power-up use doesn't switch turn in this logic
                 // renderGameBoard(); // Already rendered in usePowerUp? Check logic
             } else {
                 updateMessage(result.error, true);
             }
        }

        // Deselect power-up after attempting use
        selectedPowerUp = null;
        updatePowerUpDisplay(); // Update UI to remove selection highlight
        renderGameBoard(); // Re-render to show results/clear highlights

    }
    // If a color is selected, try to place a tile
    else if (selectedColor) {
         console.log(`Attempting to place tile at ${r},${c} with color ${selectedColor}`);
         const playerIndexToPlace = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;
         const colorToPlace = gameState.playerColors[playerIndexToPlace]; // Use the player's assigned color

         // Send color move to server or handle locally
         if (gameMode !== 'local') {
             window.sendMove({ type: 'color', r, c, playerIndex: playerIndexToPlace, color: colorToPlace });
             // Optimistic UI update (optional, server is source of truth)
             // gameState.placeTile(r, c, playerIndexToPlace, colorToPlace); // Simulate locally
             // gameState.switchTurn(); // Simulate turn switch
             // renderGameBoard(); // Re-render
         } else {
             const result = gameState.placeTile(r, c, playerIndexToPlace, colorToPlace);
             if (result.placed) {
                 if (result.awardedPowerUp) {
                    updateMessage(`Placed tile and found a ${result.awardedPowerUp}!`);
                 } else {
                    updateMessage(`Placed tile at ${r},${c}.`);
                 }
                 if (!gameState.isGameOver) {
                    gameState.switchTurn();
                 }
             } else if (result.hitMine) {
                 updateMessage(`You hit a mine at ${r},${c}! Turn lost.`, true);
                  if (!gameState.isGameOver) {
                    gameState.switchTurn(); // Turn lost due to mine
                  }
             } else {
                 // Invalid placement message handled within placeTile or here
                 updateMessage("Invalid placement.", true);
             }
         }
         renderGameBoard(); // Re-render after local action or server update expectation
    }
    else {
        console.log("No color or power-up selected.");
        // Provide feedback?
        updateMessage("Select a color or power-up first.", true);
    }
}

function handleCanvasMouseMove(event) {
    // Optional: Implement hover effects
    // Example: Highlight hex under cursor
    // const { r, c } = getHexCoords(event);
    // renderGameBoard(); // Re-render base board
    // if (r !== -1 && c !== -1) {
    //    drawHexagon(r, c, 'rgba(255, 255, 255, 0.3)'); // Draw highlight overlay
    // }
}


function handleColorSelection(color) {
    if (!isMyTurn || gameState.isGameOver) return;
    console.log("Color selected:", color);
    selectedColor = color;
    selectedPowerUp = null; // Deselect any active power-up

     // Update UI to show selected color
     const swatches = document.querySelectorAll('.color-swatch');
     swatches.forEach(swatch => {
         if (swatch.dataset.color === color) {
             swatch.classList.add('selected');
         } else {
             swatch.classList.remove('selected');
         }
     });
     updatePowerUpDisplay(); // Deselect power-up UI
     updateMessage("Color selected. Click on the board to place a tile.");
}

function handlePowerUpSelection(powerUpType) {
     if (!isMyTurn || gameState.isGameOver) return;

     // Check if player actually has this power-up
     const playerIndex = (gameMode === 'local') ? gameState.currentPlayerIndex : playerNumber;
     if (!gameState.powerUpInventory[playerIndex] || gameState.powerUpInventory[playerIndex].indexOf(powerUpType) === -1) {
         updateMessage("You don't have this power-up.", true);
         return;
     }


    console.log("Power-up selected:", powerUpType);
    selectedPowerUp = powerUpType;
    selectedColor = null; // Deselect color

     // Update UI
     updatePowerUpDisplay(); // Handles highlighting selected power-up
      const swatches = document.querySelectorAll('.color-swatch');
      swatches.forEach(swatch => swatch.classList.remove('selected')); // Deselect colors
      updateMessage(`Power-up ${powerUpType} selected. Click on a target tile.`);
}


// --- Game Initialization and State Sync ---

function initializeGame(localPlayerName = "Player 1", opponentName = "Player 2", p1Color = '#FF0000', p2Color = '#0000FF') {
    console.log(`Initializing ${gameMode} game.`);
    gameState = new GameState(); // Create a fresh state
    gameState.playerNames = [localPlayerName, opponentName];
    gameState.playerColors = [p1Color, p2Color];
    selectedColor = null;
    selectedPowerUp = null;

    if (gameMode === 'local') {
        playerName = localPlayerName; // For local games, player 1 perspective
        playerNumber = 0; // Treat local player as player 0
        isMyTurn = true; // Local game starts with player 1
        // Set initial starting squares randomly for local game
        setupInitialTilesLocal();
    } else {
        // For online games, names and colors are set by server/syncGameState
        // playerNumber and isMyTurn are also set by server data
        // Do not set starting squares here, wait for server state
    }

    renderGameBoard();
    showGameScreen(); // Ensure game screen is visible
    toggleControls(isMyTurn); // Enable/disable controls based on turn

     // Add initial resize call after first render
     resizeGame();
}

// Called specifically for local games to place starting tiles
function setupInitialTilesLocal() {
    if (!gameState || gameMode !== 'local') return;

    const placeRandomStart = (playerIndex) => {
        let placed = false;
        while (!placed) {
            const r = Math.floor(Math.random() * gameState.rows);
            const c = Math.floor(Math.random() * gameState.cols);
            const tile = gameState.getTile(r, c);
            // Ensure it's not too close to the other player's start? (Simple check: different quadrant)
            let farEnough = true;
            if (playerIndex === 1 && gameState.board.some(row => row.some(t => t.isStartingTile))) {
                 // Basic check: Avoid same column/row for simplicity, needs improvement for hex grid distance
                 farEnough = !gameState.board[r].some(t => t.isStartingTile) && !gameState.board.some(row => row[c]?.isStartingTile);
            }

            if (tile && tile.owner === -1 && farEnough) {
                tile.owner = playerIndex;
                tile.color = gameState.playerColors[playerIndex];
                tile.isStartingTile = true;
                placed = true;
                console.log(`Player ${playerIndex + 1} starting tile placed at ${r},${c}`);
            }
        }
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
    console.log("Syncing game state from server...");
     if (!gameState) {
         console.log("No local gameState found, creating new one for sync.");
         // This case should ideally be handled by initializeOnlineGame first
         // If we reach here, it might mean joining mid-game or reconnecting
         gameState = new GameState(serverState.rows, serverState.cols);
     }

     // Update local state with server data
     gameState.rows = serverState.rows;
     gameState.cols = serverState.cols;
     gameState.board = serverState.board;
     gameState.playerScores = serverState.playerScores;
     gameState.playerNames = serverState.playerNames; // Crucial for display
     gameState.playerColors = serverState.playerColors; // Crucial for display
     gameState.currentPlayerIndex = serverState.currentPlayerIndex;
     gameState.isGameOver = serverState.isGameOver;
     gameState.powerUpInventory = serverState.powerUpInventory;
     gameState.landmines = new Set(serverState.landmines);
     gameState.revealedMines = new Set(serverState.revealedMines);
     gameState.protectedTiles = new Map(serverState.protectedTiles);
     gameState.turnNumber = serverState.turnNumber;

     // Determine if it's my turn based on server state and local playerNumber
     isMyTurn = !gameState.isGameOver && (gameState.currentPlayerIndex === playerNumber);
     console.log(`Synced. Player Number: ${playerNumber}, Current Player Index: ${gameState.currentPlayerIndex}, Is My Turn: ${isMyTurn}`);

     // Ensure game screen is visible and render
     showGameScreen();
     renderGameBoard();
     toggleControls(isMyTurn); // Enable/disable controls based on turn
     updateMessage("Game state updated."); // Or use turn indicator
}

// Called by multiplayer.js when the server confirms game setup
window.initializeOnlineGame = function(setupData) {
     console.log("Initializing online game with data:", setupData);
     gameId = setupData.gameId;
     playerNumber = setupData.playerNumber; // Server tells us if we are 0 or 1
     playerName = setupData.playerName; // Our name
     const opponentName = setupData.opponentName || (playerNumber === 0 ? "Player 2" : "Player 1"); // Opponent's name

     gameMode = playerNumber === 0 ? 'online-host' : 'online-client';

     console.log(`Received Game ID: ${gameId}, Player Number: ${playerNumber}`);

     // Create the initial game state shell - board data will come via syncGameState
     gameState = new GameState(setupData.rows, setupData.cols); // Use dimensions from server
     gameState.playerNames = (playerNumber === 0) ? [playerName, opponentName] : [opponentName, playerName];
     gameState.playerColors = setupData.playerColors || ['#FF0000', '#0000FF']; // Use colors from server

     // The rest of the state (board, scores, turn) will be set by the first syncGameState call
     isMyTurn = setupData.currentPlayerIndex === playerNumber && !setupData.isGameOver; // Initial turn check

     showGameScreen(); // Ensure game UI is visible
     renderGameBoard(); // Render the initial empty board (or whatever state was sent)
     toggleControls(isMyTurn);
     updateMessage(`Game started! You are ${gameState.playerNames[playerNumber]}. Waiting for first state sync...`);

     // If player 1 (host), they might need to send the initial board state
     // This logic might be better handled server-side (server sends initial state to both)
     // Let's assume server sends the initial state via syncGameState after setup.
}

window.handleGameOver = function(data) {
    console.log("Received game over from server:", data);
    if (gameState) {
        gameState.isGameOver = true;
        // Update scores one last time from server data if available
        if (data.scores) gameState.playerScores = data.scores;
        renderGameBoard(); // Re-render to show final state
        updateMessage(data.winnerMessage || gameState.determineWinner()); // Use server message or local calculation
        toggleControls(false); // Disable all controls
    }
}

window.handlePlayerDisconnected = function(disconnectData) {
     console.log("Opponent disconnected:", disconnectData);
     updateMessage(`${disconnectData.playerName} disconnected. Game cannot continue.`, true);
     if (gameState) {
         gameState.isGameOver = true; // Mark game as over
     }
     toggleControls(false); // Disable controls
     // Optionally implement a "rematch" or "return to lobby" button
};


// --- Utility Functions ---

function getNeighbors(r, c) {
    const neighbors = [];
    const isOddCol = c % 2 === 1;

    // Potential neighbor relative coordinates
    const neighborCoords = [
        { dr: -1, dc: 0 }, // Top
        { dr: 1, dc: 0 },  // Bottom
        { dr: 0, dc: -1 }, // Left
        { dr: 0, dc: 1 },  // Right
        // Diagonal neighbors depend on column parity
        isOddCol ? { dr: 1, dc: -1 } : { dr: -1, dc: -1 }, // Bottom-Left / Top-Left
        isOddCol ? { dr: 1, dc: 1 } : { dr: -1, dc: 1 }  // Bottom-Right / Top-Right
    ];

    for (const { dr, dc } of neighborCoords) {
        const nr = r + dr;
        const nc = c + dc;
        // Check bounds (using gameState dimensions)
        if (gameState && nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
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
     // Simple resize - match canvas to window dimensions or a container
     // This is basic, might need refinement for aspect ratio etc.
    const gameArea = document.getElementById('game-area');
    if (canvas && gameArea) {
         // Let CSS handle the sizing via width/height 100% on canvas/container
         // We might still need to adjust internal resolution or redraw if needed
         // canvas.width = gameArea.clientWidth;
         // canvas.height = gameArea.clientHeight;

        // Re-render after resize
        renderGameBoard();
        console.log("Game potentially resized, re-rendering.");
    }
}


// --- Chat Functions ---
function displayChatMessage(sender, message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
     // Simple distinction - could be enhanced with CSS classes
    messageElement.innerHTML = `<span class="chat-sender">${sender === playerName ? 'Me' : sender}:</span> ${message}`;
    chatMessages.appendChild(messageElement);
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupChat() {
     const chatInput = document.getElementById('chat-input');
     const sendChatButton = document.getElementById('send-chat');
     const toggleChatButton = document.getElementById('toggle-chat');
     const chatContainer = document.getElementById('chat-container');

     if (sendChatButton && chatInput) {
         sendChatButton.addEventListener('click', () => {
             const message = chatInput.value.trim();
             if (message && gameMode !== 'local') {
                 window.sendChatMessage(message); // Defined in multiplayer.js
                 displayChatMessage(playerName, message); // Display own message immediately
                 chatInput.value = '';
             }
         });

         chatInput.addEventListener('keypress', (e) => {
             if (e.key === 'Enter') {
                 sendChatButton.click();
             }
         });
     }

     if (toggleChatButton && chatContainer) {
         toggleChatButton.addEventListener('click', () => {
             const isVisible = chatContainer.style.display === 'none' || chatContainer.style.display === '';
              chatContainer.style.display = isVisible ? 'flex' : 'none'; // Or 'block'
              toggleChatButton.textContent = isVisible ? 'Hide Chat' : 'Show Chat';
         });
          // Initially hide chat? Or based on gameMode?
          if (gameMode === 'local') {
             chatContainer.style.display = 'none';
             toggleChatButton.style.display = 'none';
          } else {
             chatContainer.style.display = 'flex'; // Show by default for online
             toggleChatButton.style.display = 'block';
          }
     }
}

// --- Global Action Functions ---
window.restartGame = function() {
    if (gameMode !== 'local') {
        // Ask server to restart
        console.log("Requesting game restart from server...");
        window.requestRestartGame(); // Defined in multiplayer.js
    } else {
        // Restart local game
        console.log("Restarting local game...");
        initializeGame(gameState.playerNames[0], gameState.playerNames[1], gameState.playerColors[0], gameState.playerColors[1]);
    }
};

window.leaveGame = function() {
     if (gameMode !== 'local') {
         window.notifyLeaveGame(); // Let server know we're leaving
     }
 
// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- Get DOM Elements ---
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

     // --- Get UI Element References ---
    const setupContainer = document.getElementById('setup-container');
    const playerNameInput = document.getElementById('player-name-input');
    const setupMessage = document.getElementById('setup-message');
    const localGameButton = document.getElementById('local-game-button');
    const createChallengeButton = document.getElementById('create-challenge-button');
    const joinChallengeButton = document.getElementById('join-challenge-button');
    const gameIdInput = document.getElementById('game-id-input'); // For joining
    const leaveGameButton = document.getElementById('leave-game-button');
    const restartGameButton = document.getElementById('restart-game-button'); // Make sure this button exists

    // --- Initial UI State ---
    showSetupScreen(); // Start by showing the setup screen

    // --- Setup Screen Button Listeners ---
    if (localGameButton) {
        localGameButton.addEventListener('click', () => {
            const name = playerNameInput.value.trim() || 'Player 1';
            if (!name) {
                setupMessage.textContent = "Please enter your name.";
                return;
            }
             playerName = name;
             gameMode = 'local';
            initializeGame(playerName); // Start local game
        });
    }

    if (createChallengeButton) {
        createChallengeButton.addEventListener('click', () => {
            const name = playerNameInput.value.trim();
            if (!name) {
                setupMessage.textContent = "Please enter your name.";
                return;
            }
             playerName = name; // Set global playerName
             gameMode = 'online-host';
            setupMessage.textContent = "Connecting to server...";
            // Connect and then create challenge (multiplayer.js handles the sequence)
            window.connectToServer(playerName, 'create', { playerName: playerName });
        });
    }

     if (joinChallengeButton) {
        joinChallengeButton.addEventListener('click', () => {
             const name = playerNameInput.value.trim();
             const idToJoin = gameIdInput.value.trim().toUpperCase(); // Join uses separate input
            if (!name) {
                setupMessage.textContent = "Please enter your name.";
                return;
            }
            if (!idToJoin) {
                 setupMessage.textContent = "Please enter a Game ID to join.";
                 return;
             }
             playerName = name; // Set global playerName
             gameMode = 'online-client';
             setupMessage.textContent = "Connecting to server...";
            // Connect and then join challenge (multiplayer.js handles the sequence)
            window.connectToServer(playerName, 'join', { playerName: playerName, gameId: idToJoin });
        });
    }

     // --- Other Button Listeners ---
     if (leaveGameButton) {
         leaveGameButton.addEventListener('click', window.leaveGame);
     }
      if (restartGameButton) {
         restartGameButton.addEventListener('click', window.restartGame);
     }

    // --- Canvas Event Listeners ---
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);

     // --- Color Palette Setup ---
     const palette = document.getElementById('color-palette');
     if (palette && gameState && gameState.playerColors) { // Ensure gameState exists before accessing colors
         // Clear existing swatches if any
         palette.innerHTML = '';
         // Create swatches based on assigned colors - this needs adjustment
         // For now, let's assume fixed palette, selection maps to player's color later
          const availableColors = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#008080', '#E6BEFF'];
          availableColors.forEach(color => {
               const swatch = document.createElement('div');
               swatch.classList.add('color-swatch');
               swatch.style.backgroundColor = color;
               swatch.dataset.color = color; // Store color value
               swatch.onclick = () => handleColorSelection(color);
               palette.appendChild(swatch);
          });
     } else if (palette) {
         // Fallback or default palette if gameState not ready (shouldn't happen if UI hidden)
          const availableColors = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#008080', '#E6BEFF'];
           availableColors.forEach(color => {
               const swatch = document.createElement('div');
               swatch.classList.add('color-swatch');
               swatch.style.backgroundColor = color;
               swatch.dataset.color = color; // Store color value
               // Don't assign onclick here, do it when game starts/turn enables
               palette.appendChild(swatch);
           });
     }

     // --- Chat Setup ---
     setupChat();

    // --- Window Resize Listener ---
    window.addEventListener('resize', resizeGame);

    console.log("Initial setup complete. Waiting for user action.");

}); // End of DOMContentLoaded listener - THIS WAS LIKELY THE MISSING BRACE