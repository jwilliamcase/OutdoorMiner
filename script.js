(function() {
    // --- Variable Declarations ---
    let canvas = document.getElementById('game-board');
    let ctx = canvas.getContext('2d');
    let playerNameInput = document.getElementById('playerName');
    let gameIdDisplay = document.getElementById('gameIdDisplay');
    let playerScoreDisplay = document.getElementById('player1Score');
    let opponentScoreDisplay = document.getElementById('player2Score');
    let messageDisplay = document.getElementById('messageDisplay');
    let chatMessages = document.getElementById('chat-messages');
    let chatInput = document.getElementById('chat-input');
    let sendButton = document.getElementById('send-button');
    let tauntButtons = document.querySelectorAll('.taunt-button');
    
    let board; // Game board array
    // board = initializeBoard(); // Initialize board here, globally - Moved to DOMContentLoaded
    let hexSize = 30;
    let isOnlineMultiplayer = false;
    let gameId = null;
    let playerNumber = 1;
    let playerName = '';
    let opponentName = '';
    let sabotageActive = false;
    let wildcardActive = false;
    let teleportActive = false;
    let activePowerUp = null;
    let lastMove = null;
    let moveHistory = [];
    let sabotageAvailable = true;
    let wildcardAvailable = true;
    let teleportAvailable = true;


    // --- Event Listeners ---
    document.addEventListener('DOMContentLoaded', () => {
        canvas = document.getElementById('game-board');
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize canvas and context
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');

        board = initializeBoard(); // Initialize board here, after DOM is ready
    
        renderGameBoard();
        updateScoreDisplay();
        resizeGame(); // Initial resize
    
        // ... rest of DOMContentLoaded code ...
    });
        updateTurnIndicator();
        initializePowerUpCountsDisplay();

        // Expose functions to window for multiplayer interaction
        window.initializeOnlineGame = initializeOnlineGame;
        window.getGameState = getGameState;
        window.syncGameState = syncGameState;
        window.renderGameBoard = renderGameBoard;
        window.resizeGame = resizeGame;
        window.updateScoreDisplay = updateScoreDisplay;
        window.restartGame = restartGame;
    });

    window.addEventListener('resize', resizeGame);
    canvas.addEventListener('click', handleCanvasClick);
function initializeBoard() {
        board = [];
        for (let row = 0; row < rows; row++) {
            board[row] = [];
            for (let col = 0; col < cols; col++) {
                board[row][col] = {
                    color: null, // Default color to null (unowned)
                    player: 0,    // 0 for unowned
                    isMine: false,
                    isPowerUp: null
                };
            }
        }
        // Initialize starting positions for players in corners
        board[rows - 1][0].player = 1; // Player 1 starts at bottom-left
        board[rows - 1][0].color = playerColors[1]; // Assign Player 1's color
        board[0][cols - 1].player = 2; // Player 2 starts at top-right
        board[0][cols - 1].color = playerColors[2]; // Assign Player 2's color
    }
    function initializeLandmines() {
        landmineLocations = []; // Clear existing landmines
        let count = 0;
        while (count < CONFIG.LANDMINE_COUNT) {
            let row = Math.floor(Math.random() * boardSize);
            let col = Math.floor(Math.random() * boardSize);
            if (!board[row][col].landmine && board[row][col].player === 0) {
                board[row][col].landmine = true;
                landmineLocations.push({ row: row, col: col });
                count++;
            }
        }
        console.log('Landmines initialized:', landmineLocations);
    }

    function startGame() {
        if (isColorSelectionDone()) {
            gameStarted = true;
            initializeLandmines(); // Initialize landmines at game start
            renderGameBoard(); // Re-render to show landmines (if visible)
            updateTurnIndicator();
            document.getElementById('start-game').style.display = 'none'; // Hide start button after game begins
            document.getElementById('player-name-container').style.display = 'none'; // Hide player name input after game starts
            document.getElementById('landmine-info').style.display = 'block'; // Show landmine info
        } else {
            alert('Please select colors for both players before starting the game.');
        }
    }

    function restartGame() {
        gameStarted = false;
        board = initializeBoard();
        playerScores = { 1: 0, 2: 0 };
        playerColors = { 1: null, 2: null };
        currentPlayer = 1;
        selectedColor = null;
        powerUpCounts = { 1: { wildcard: 0, sabotage: 0, teleport: 0 }, 2: { wildcard: 0, sabotage: 0, teleport: 0 } };
        sabotageAvailable = true;
        wildcardAvailable = true;
        teleportAvailable = true;
        sabotageActive = false;
        wildcardActive = false;
        teleportActive = false;
        activePowerUp = null;
        moveHistory = [];
        landmineLocations = [];

        // Reset power-up counts display
        initializePowerUpCountsDisplay();

        // Re-enable color selection
        enableColorSelection();
        updateColorPaletteDisplay(); // Ensure palette reflects available colors

        // Reset UI elements
        document.getElementById('start-game').style.display = 'block'; // Show start game button again
        document.getElementById('player-name-container').style.display = 'block'; // Show player name input again
        document.getElementById('landmine-info').style.display = 'none'; // Hide landmine info
        hidePlayAgainButton(); // Hide play again button if visible

        // Re-render the game board in neutral state
        renderGameBoard();
        updateScoreDisplay();
        updateTurnIndicator();

        if (isOnlineMultiplayer && gameId) {
            // Notify server to restart game for both players
            sendRestartGameSignal();
        }
    }

    function sendRestartGameSignal() {
        if (isOnlineMultiplayer && gameId) {
            window.sendMove({ type: 'restart-game' }); // Send restart game signal to server
        }
    }

    function hidePlayAgainButton() {
        const playAgainButton = document.getElementById('play-again-button');
        if (playAgainButton) {
            playAgainButton.remove();
        }
    }

    function initializeOnlineGame(playerNum, gameID, pName, oppName) {
        isOnlineMultiplayer = true;
        gameId = gameID;
        playerNumber = playerNum;
        playerName = pName;
        opponentName = oppName;
        currentPlayerName = playerName;
        opponentPlayerName = opponentName || 'Opponent';


        // Set player turn based on player number (player 1 starts)
        currentPlayer = 1; // Always reset to player 1 initially, server manages turns
        if (playerNumber === 2) {
            currentPlayer = 1; // Player 2 also starts with turn indicator showing player 1
        }

        // Disable start game button in online mode
        document.getElementById('start-game').style.display = 'none';
        document.getElementById('player-name-container').style.display = 'none'; // Hide player name input in online mode
        document.getElementById('landmine-info').style.display = 'block'; // Show landmine info in online mode

        // Adjust UI for online mode - hide color palette initially
        const colorPalette = document.getElementById('color-palette');
        if (colorPalette) {
            colorPalette.style.display = 'flex'; // Keep visible, but manage color selection
        }
        disableColorSelection(); // Initially, no colors selectable until game-started event

        // Set initial player names in UI
        currentPlayerName = playerName || 'Player 1';
        opponentPlayerName = opponentName || 'Player 2';
        updateScoreDisplay();
        updateTurnIndicator();
    }

    function syncGameState(gameState) {
        if (!gameState) return;

        board = gameState.board;
        currentPlayer = gameState.currentPlayer;
        playerColors = { 1: gameState.player1Color, 2: gameState.player2Color };
        playerScores = calculateScores(); // Recalculate scores based on synced board
        powerUpCounts = {
            1: gameState.player1PowerUps || { wildcard: 0, sabotage: 0, teleport: 0 },
            2: gameState.player2PowerUps || { wildcard: 0, sabotage: 0, teleport: 0 }
        };
        landmineLocations = gameState.landmines || [];
        currentPlayerName = gameState.player1Name || 'Player 1';
        opponentPlayerName = gameState.player2Name || 'Player 2';

        // Ensure player names are correctly set for UI
        if (playerNumber === 1) {
            currentPlayerName = gameState.player1Name || 'You';
            opponentPlayerName = gameState.player2Name || 'Opponent';
        } else if (playerNumber === 2) {
            currentPlayerName = gameState.player2Name || 'You';
            opponentPlayerName = gameState.player1Name || 'Opponent';
        }

        updateScoreDisplay();
        updateTurnIndicator();
        updatePowerUpCountsDisplay();
        renderGameBoard(); // Re-render board with synced state
        updateColorPaletteDisplay(); // Update color palette based on game state

        // After sync, if game has started and colors are selected, disable color selection
        if (isColorSelectionDone() && gameStarted) {
            disableColorSelection();
        }

        console.log('Game state synced:', gameState);
    }

    function getGameState() {
        return {
            board: board,
            currentPlayer: currentPlayer,
            player1Color: playerColors[1],
            player2Color: playerColors[2],
            player1Tiles: getPlayerTileLocations(1),
            player2Tiles: getPlayerTileLocations(2),
            player1PowerUps: powerUpCounts[1],
            player2PowerUps: powerUpCounts[2],
            landmines: landmineLocations,
            player1Name: playerName,
            player2Name: opponentName
        };
    }

    function getPlayerTileLocations(playerNumber) {
        let tileLocations = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col].player === playerNumber) {
                    tileLocations.push({ row: row, col: col });
                }
            }
        }
        return tileLocations;
    }


    // --- Rendering Functions ---
    function renderGameBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let centerX = canvas.width / 2;
        let centerY = canvas.height / 2;
        let startX = centerX - (boardSize / 2) * hexSize * 1.5;
        let startY = centerY - (boardSize / 2) * hexHeight();

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                let hexCenterX = startX + col * hexSize * 1.5;
                let hexCenterY = startY + row * hexHeight() + (col % 2) * hexHeight() / 2;

                console.log(`Rendering Hexagon at Row: ${row}, Col: ${col}`);
                console.log(`  Center X: ${hexCenterX}, Center Y: ${hexCenterY}`);
                console.log(`  Hex Size: ${hexSize}, Hex Height: ${hexHeight()}`);
                console.log(`  Start X: ${startX}, Start Y: ${startY}`);
                console.log(`  Color: ${board[row][col].color}, Player: ${board[row][col].player}`);

                drawHexagon(ctx, hexCenterX, hexCenterY, hexSize, board[row][col].color, board[row][col].player);

                if (board[row][col].landmine && gameStarted) {
                    drawLandmine(ctx, hexCenterX, hexCenterY, hexSize / 3);
                }
            }
        }
    }

    function resizeGame() {
        hexSize = Math.max(Math.min(canvas.width / (boardSize * 3), canvas.height / (boardSize * 2.5)), 10);
        renderGameBoard();
    }

    function hexHeight() {
        return Math.sqrt(3) / 2 * hexSize;
    }

    function drawHexagon(ctx, centerX, centerY, size, fillColor, player) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = 2 * Math.PI / 6 * i;
            const x = centerX + size * Math.cos(angle);
            const y = centerY + size * Math.sin(angle);
            ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        } else {
            ctx.fillStyle = '#f0f0f0'; // Neutral hex color
            ctx.fill();
        }

        ctx.fillStyle = board[row][col].color || 'rgba(200, 200, 200, 0.8)'; // Use tile color from board, default to placeholder if null
        ctx.strokeStyle = 'black';
        ctx.stroke();
    }

    function drawLandmine(ctx, centerX, centerY, radius) {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = `${radius}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', centerX, centerY); // Emoji for landmine
    }


    // --- Event Handling Functions ---
    function handleCanvasClick(event) {
        if (!gameStarted && !isOnlineMultiplayer) {
            alert('Please start the game to capture tiles.');
            return;
        }
        if (isGameFinished()) {
            showPlayAgainButton();
            return;
        }
        if (currentPlayer !== playerNumber && isOnlineMultiplayer && gameStarted) {
            console.log("Not your turn in online game.");
            return; // Prevent action if it's not the player's turn in online mode
        }


        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const hex = pixelToHex(mouseX, mouseY);
        if (hex && isValidHex(hex.row, hex.col)) {
            handleHexClick(hex.row, hex.col);
        }
    }

    function pixelToHex(x, y) {
        let centerX = canvas.width / 2;
        let centerY = canvas.height / 2;
        let startX = centerX - (boardSize / 2) * hexSize * 1.5;
        let startY = centerY - (boardSize / 2) * hexHeight();

        let col = Math.floor((x - startX) / (hexSize * 1.5));
        let row = Math.floor(((y - startY) - (col % 2) * hexHeight() / 2) / hexHeight());

        if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) {
            return null;
        }

        // Check if the click is within the hexagon bounds (more precise check if needed)
        let hexCenterX = startX + col * hexSize * 1.5;
        let hexCenterY = startY + row * hexHeight() + (col % 2) * hexHeight() / 2;
        if (distance(x, y, hexCenterX, hexCenterY) > 2 * hexSize) { // Simple distance check, can be refined
            return null;
        }


        return { row: row, col: col };
    }

    function distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function handleHexClick(row, col) {
        if (!gameStarted && !isOnlineMultiplayer) {
            alert('Please start the game to capture tiles.');
            return;
        }
        if (isGameFinished()) {
            showPlayAgainButton();
            return;
        }
        if (currentPlayer !== playerNumber && isOnlineMultiplayer && gameStarted) {
            console.log("Not your turn in online game.");
            return; // Prevent action if it's not player's turn in online mode
        }


        const hex = board[row][col];

        if (sabotageActive) {
            handleSabotageClick(hex);
        } else if (wildcardActive) {
            handleWildcardClick(hex);
        } else if (teleportActive) {
            handleTeleportClick(hex);
        }
        else if (hex.player === 0) {
            if (!selectedColor) {
                alert('Please select a color first.');
                return;
            }
            if (isValidMove(row, col, currentPlayer)) {
                captureHex(row, col);
                if (hex.landmine) {
                    handleLandmineExplosion(row, col);
                } else {
                    finalizeMove();
                }
            }
        } else if (sabotageAvailable && hex.player !== 0 && hex.player !== currentPlayer && sabotageActive) {
            // Sabotage logic already handled in handleSabotageClick
        } else {
            console.log('Invalid move');
        }
    }

    function isValidHex(row, col) {
        return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
    }

    function isValidMove(row, col, player) {
        if (board[row][col].player !== 0) {
            return false; // Hex is already claimed
        }
        if (isAdjacentToPlayer(row, col, player)) {
            return true; // Is adjacent to player's existing tile
        }
        if (!getPlayerTileLocations(player).length) {
            return true; // First move can be anywhere
        }
        return false; // Not a valid move
    }

    function isAdjacentToPlayer(row, col, player) {
        const neighbors = getNeighbors(row, col);
        for (const neighbor of neighbors) {
            if (isValidHex(neighbor.row, neighbor.col) && board[neighbor.row][neighbor.col].player === player) {
                return true;
            }
        }
        return false;
    }

    function getNeighbors(row, col) {
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, 1]]; // Offset directions for hex grid
        let neighbors = [];
        for (const [dRow, dCol] of directions) {
            let newRow = row + dRow;
            let newCol = col + dCol;
            if (newCol % 2 !== 0 && dRow === 1 && dCol === -1) newCol += 1; // Adjust for odd columns
            if (newCol % 2 !== 0 && dRow === -1 && dCol === 1) newCol -= 1; // Adjust for odd columns

            neighbors.push({ row: newRow, col: newCol });
        }
        return neighbors;
    }


    function captureHex(row, col) {
        board[row][col].player = currentPlayer;
        board[row][col].color = playerColors[currentPlayer];
        lastMove = { row: row, col: col, player: currentPlayer }; // Store last move

        // Check for combos and capture adjacent tiles
        let comboCount = checkCombo(row, col, playerColors[currentPlayer]);
        if (comboCount >= CONFIG.COMBO_THRESHOLD) {
            captureNeighbors(row, col, currentPlayer);
            if (isOnlineMultiplayer) {
                // Send move data including combo capture
                sendMove({ type: 'capture', row: row, col: col, combo: true });
            }
        } else if (isOnlineMultiplayer) {
            // Send move data without combo
            sendMove({ type: 'capture', row: row, col: col, combo: false });
        }
        renderGameBoard(); // Update the board display after capture
    }

    function checkCombo(row, col, color) {
        let comboCount = 1; // Start with the current hex
        const neighbors = getNeighbors(row, col);
        for (const neighbor of neighbors) {
            if (isValidHex(neighbor.row, neighbor.col) && board[neighbor.row][neighbor.col].color === color) {
                comboCount++;
            }
        }
        return comboCount;
    }

    function captureNeighbors(row, col, player) {
        const neighbors = getNeighbors(row, col);
        for (const neighbor of neighbors) {
            if (isValidHex(neighbor.row, neighbor.col) && board[neighbor.row][neighbor.col].player === 0) {
                board[neighbor.row][neighbor.col].player = player;
                board[neighbor.row][neighbor.col].color = playerColors[player];
            }
        }
    }

    function handleLandmineExplosion(row, col) {
        board[row][col].landmine = false; // Disarm the landmine
        landmineLocations = landmineLocations.filter(loc => !(loc.row === row && loc.col === col)); // Remove from locations array

        // Visually indicate explosion (optional, e.g., animation or different hex drawing)
        playSound('explosion-sound');

        // Apply explosion effect to adjacent tiles (e.g., neutralize or damage)
        neutralizeNeighbors(row, col);

        if (isOnlineMultiplayer) {
            sendMove({
                type: 'landmine',
                row: row,
                col: col,
                player1Tiles: getPlayerTileLocations(1),
                player2Tiles: getPlayerTileLocations(2),
                updatedBoard: board // Send updated board state
            });
        }
    }

    function neutralizeNeighbors(row, col) {
        const neighbors = getNeighbors(row, col);
        for (const neighbor of neighbors) {
            if (isValidHex(neighbor.row, neighbor.col) && board[neighbor.row][neighbor.col].player !== 0) {
                board[neighbor.row][neighbor.col].player = 0;
                board[neighbor.row][neighbor.col].color = null; // Or reset to neutral color
            }
        }
    }


    function finalizeMove() {
        playerScores = calculateScores();
        updateScoreDisplay();
        updateTurnIndicator();
        moveHistory.push(lastMove); // Add move to history

        if (!isGameFinished()) {
            switchPlayerTurn();
        } else {
            handleGameEnd();
        }
    }

    function calculateScores() {
        let score1 = 0;
        let score2 = 0;
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col].player === 1) {
                    score1++;
                } else if (board[row][col].player === 2) {
                    score2++;
                }
            }
        }
        return { 1: score1, 2: score2 };
    }

    function updateScoreDisplay() {
        document.getElementById('your-score').textContent = playerScores[1];
        document.getElementById('opponent-score-value').textContent = playerScores[2];

        // Update player names in score display if available
        const player1ScoreElement = document.getElementById('player-score');
        const player2ScoreElement = document.getElementById('opponent-score');

        if (playerNumber === 1) {
            player1ScoreElement.innerHTML = `<span class="player-name ${currentPlayer === 1 ? 'active-player' : ''}">${playerName || 'You'}</span>: <span id="your-score">${playerScores[1]}</span>`;
            player2ScoreElement.innerHTML = `<span class="player-name ${currentPlayer === 2 ? 'active-player' : ''}">${opponentName || 'Opponent'}</span>: <span id="opponent-score-value">${playerScores[2]}</span>`;
        } else if (playerNumber === 2) {
            player1ScoreElement.innerHTML = `<span class="player-name ${currentPlayer === 1 ? 'active-player' : ''}">${opponentName || 'Opponent'}</span>: <span id="your-score">${playerScores[1]}</span>`;
            player2ScoreElement.innerHTML = `<span class="player-name ${currentPlayer === 2 ? 'active-player' : ''}">${playerName || 'You'}</span>: <span id="opponent-score-value">${playerScores[2]}</span>`;
        }
    }


    function updateTurnIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        const currentPlayerNameDisplay = document.getElementById('current-player');
        let playerNameForDisplay = currentPlayer === playerNumber ? 'Your' : 'Opponent\'s';
        if (isOnlineMultiplayer) {
            playerNameForDisplay = currentPlayer === playerNumber ? (playerName || 'You') : (opponentName || 'Opponent');
        }

        currentPlayerNameDisplay.textContent = playerNameForDisplay;

        if (currentPlayer === 1) {
            turnIndicator.classList.add('player1-turn');
            turnIndicator.classList.remove('player2-turn');
        } else {
            turnIndicator.classList.remove('player1-turn');
            turnIndicator.classList.add('player2-turn');
        }

        // Update active player class in score container
        const playerScoreContainer = document.getElementById('score-container');
        if (currentPlayer === 1) {
            playerScoreContainer.classList.add('player1-turn');
            playerScoreContainer.classList.remove('player2-turn');
        } else {
            playerScoreContainer.classList.remove('player1-turn');
            playerScoreContainer.classList.add('player2-turn');
        }
    }


    function switchPlayerTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        updateTurnIndicator();
        if (isOnlineMultiplayer) {
            // Notify opponent of turn switch - server handles game state update
        }
    }

    function handleGameEnd() {
        gameStarted = false;
        let winner = calculateWinner();
        let message = '';
        if (winner === 1) {
            message = `${playerName || 'Player 1'} wins!`;
        } else if (winner === 2) {
            message = `${opponentName || 'Player 2'} wins!`;
        } else {
            message = 'It\'s a draw!';
        }
        alert(message); // Or display in a nicer UI element

        showPlayAgainButton();
    }

    function isGameFinished() {
        const totalTiles = boardSize * boardSize;
        const occupiedTiles = playerScores[1] + playerScores[2];
        return occupiedTiles >= totalTiles * 0.8 || occupiedTiles === totalTiles; // Game ends when 80% tiles are occupied or all tiles are taken
    }

    function calculateWinner() {
        if (playerScores[1] > playerScores[2]) {
            return 1;
        } else if (playerScores[2] > playerScores[1]) {
            return 2;
        } else {
            return 0; // Draw
        }
    }

    function showPlayAgainButton() {
        const existingButton = document.getElementById('play-again-button');
        if (!existingButton) {
            const playAgainButton = document.createElement('button');
            playAgainButton.id = 'play-again-button';
            playAgainButton.className = 'action-button';
            playAgainButton.textContent = 'Play Again';
            playAgainButton.addEventListener('click', restartGame);

            document.getElementById('game-controls').appendChild(playAgainButton);
        }
    }


    // --- Color Palette Functions ---
    function attachColorPaletteListeners() {
        const colorButtons = document.querySelectorAll('.color-button');
        colorButtons.forEach(button => {
            button.addEventListener('click', handleColorSelection);
        });
    }

    function handleColorSelection(event) {
        if (gameStarted) {
            alert('Colors cannot be changed once the game has started.');
            return;
        }
        const color = event.target.dataset.color;
        if (!color) return;

        if (!playerColors[1]) {
            playerColors[1] = color;
            setSelectedColor(color);
            disableColorButton(color); // Disable for player 1
            updateColorPaletteDisplay();
            updateTurnIndicator();
        } else if (!playerColors[2] && playerColors[1] !== color) {
            playerColors[2] = color;
            disableColorButton(color); // Disable for player 2
            updateColorPaletteDisplay();
            updateTurnIndicator();
            enableStartButtonIfReady();
            if (isOnlineMultiplayer && gameId) {
                sendColorSelection(playerColors); // Send color selection to server
            }
        } else {
            alert('Color already selected or invalid choice.');
        }
    }

    function sendColorSelection(colors) {
        if (isOnlineMultiplayer && gameId) {
            sendMove({
                type: 'color-selection',
                color: colors[playerNumber], // Send only the selecting player's color
                player1Color: colors[1],
                player2Color: colors[2],
                player1Tiles: getPlayerTileLocations(1), // Include tile locations
                player2Tiles: getPlayerTileLocations(2)
            });
        }
    }


    function setSelectedColor(color) {
        selectedColor = color;
    }

    function disableColorButton(color) {
        const buttons = document.querySelectorAll(`.color-button[data-color="${color}"]`);
        buttons.forEach(button => {
            button.classList.add('disabled');
            button.disabled = true;
        });
    }

    function enableColorButton(color) {
        const buttons = document.querySelectorAll(`.color-button[data-color="${color}"]`);
        buttons.forEach(button => {
            button.classList.remove('disabled');
            button.disabled = false;
        });
    }

    function updateColorPaletteDisplay() {
        const colorSwatches = document.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.classList.remove('current-player', 'opponent-player', 'disabled');
            const button = swatch.querySelector('.color-button');
            if (button.classList.contains('disabled')) {
                swatch.classList.add('disabled');
            }
        });

        if (playerColors[1]) {
            const swatch1 = document.querySelector(`.color-swatch .color-button[data-color="${playerColors[1]}"]`).closest('.color-swatch');
            swatch1.classList.add('current-player');
        }
        if (playerColors[2]) {
            const swatch2 = document.querySelector(`.color-swatch .color-button[data-color="${playerColors[2]}"]`).closest('.color-swatch');
            swatch2.classList.add('opponent-player');
        }
    }

    function enableStartButtonIfReady() {
        if (playerColors[1] && playerColors[2]) {
            document.getElementById('start-game').disabled = false;
        }
    }

    function disableColorSelection() {
        const colorPalette = document.getElementById('color-palette');
        if (colorPalette) {
            colorPalette.classList.add('disabled'); // Visually indicate disabled state
            colorPalette.querySelectorAll('.color-button').forEach(button => {
                button.disabled = true;
            });
        }
    }

    function enableColorSelection() {
        const colorPalette = document.getElementById('color-palette');
        if (colorPalette) {
            colorPalette.classList.remove('disabled');
            colorPalette.querySelectorAll('.color-button:not(.disabled)').forEach(button => {
                button.disabled = false;
            });
        }
    }

    function isColorSelectionDone() {
        return playerColors[1] && playerColors[2];
    }


    // --- Power-Up Functions ---
    function attachPowerUpListeners() {
        document.querySelectorAll('.power-up-slot').forEach(slot => {
            slot.addEventListener('click', handlePowerUpSelection);
        });
    }

    function handlePowerUpSelection(event) {
        if (!gameStarted && !isOnlineMultiplayer) {
            alert('Please start the game to use power-ups.');
            return;
        }
        if (isGameFinished()) {
            showPlayAgainButton();
            return;
        }
        if (currentPlayer !== playerNumber && isOnlineMultiplayer && gameStarted) {
            console.log("Not your turn in online game.");
            return; // Prevent power-up activation if not player's turn in online mode
        }

        const powerUpType = event.currentTarget.dataset.type;
        if (powerUpCounts[currentPlayer][powerUpType] > 0) {
            activatePowerUp(powerUpType);
            highlightActivePowerUp(powerUpType);
        } else {
            alert(`No ${powerUpType} power-ups available.`);
        }
    }

    function activatePowerUp(type) {
        activePowerUp = type;
        switch (type) {
            case 'sabotage':
                sabotageActive = true;
                wildcardActive = false;
                teleportActive = false;
                break;
            case 'wildcard':
                wildcardActive = true;
                sabotageActive = false;
                teleportActive = false;
                break;
            case 'teleport':
                teleportActive = true;
                wildcardActive = false;
                sabotageActive = false;
                break;
            default:
                activePowerUp = null;
                sabotageActive = false;
                wildcardActive = false;
                teleportActive = false;
                break;
        }
    }

    function highlightActivePowerUp(type) {
        // Reset highlight on all slots
        document.querySelectorAll('.power-up-slot').forEach(slot => slot.classList.remove('active'));

        // Highlight the selected slot
        const slot = document.querySelector(`.power-up-slot[data-type="${type}"]`);
        if (slot) {
            slot.classList.add('active');
        }
    }

    function resetPowerUpHighlight() {
        document.querySelectorAll('.power-up-slot').forEach(slot => slot.classList.remove('active'));
    }


    // --- Sabotage Power-Up ---
    function handleSabotageClick(hex) {
        if (!sabotageActive || !sabotageAvailable) return;

        if (hex.player !== 0 && hex.player !== currentPlayer) {
            sabotageHex(hex);
            deactivatePowerUps();
            sabotageAvailable = false; // Use only once per game for now
            decrementPowerUpCount('sabotage');
            finalizeMove(); // End turn after sabotage
        } else {
            alert('Sabotage can only be used on opponent occupied tiles.');
        }
    }

    function sabotageHex(hex) {
        hex.player = 0;
        hex.color = null;
        playSound('power-up-sound'); // Indicate power-up use

        if (isOnlineMultiplayer) {
            sendMove({
                type: 'power-up',
                powerUp: 'sabotage',
                targetHex: { row: hex.row, col: hex.col },
                player1PowerUps: powerUpCounts[1],
                player2PowerUps: powerUpCounts[2],
                player1Tiles: getPlayerTileLocations(1),
                player2Tiles: getPlayerTileLocations(2)
            });
        }
        renderGameBoard(); // Update display after sabotage
    }


    // --- Wildcard Power-Up ---
    function handleWildcardClick(hex) {
        if (!wildcardActive || !wildcardAvailable) return;

        if (hex.player === 0 && isAdjacentToPlayer(hex.row, hex.col, currentPlayer)) {
            captureHexWithWildcard(hex);
            deactivatePowerUps();
            wildcardAvailable = false; // Limit wildcard to once per game for now
            decrementPowerUpCount('wildcard');
            finalizeMove(); // End turn after wildcard use
        } else {
            alert('Wildcard can only be used on unclaimed tiles adjacent to your territory.');
        }
    }

    function captureHexWithWildcard(hex) {
        hex.player = currentPlayer;
        hex.color = playerColors[currentPlayer];
        playSound('power-up-sound'); // Play power-up sound

        if (isOnlineMultiplayer) {
            sendMove({
                type: 'power-up',
                powerUp: 'wildcard',
                targetHex: { row: hex.row, col: hex.col },
                player1PowerUps: powerUpCounts[1],
                player2PowerUps: powerUpCounts[2],
                player1Tiles: getPlayerTileLocations(1),
                player2Tiles: getPlayerTileLocations(2)
            });
        }
        renderGameBoard(); // Update board after wildcard capture
    }


    // --- Teleport Power-Up ---
    function handleTeleportClick(hex) {
        if (!teleportActive || !teleportAvailable) return;

        if (hex.player === 0) {
            captureHexWithTeleport(hex);
            deactivatePowerUps();
            teleportAvailable = false; // Limit teleport to once per game
            decrementPowerUpCount('teleport');
            finalizeMove(); // End turn after teleport use
        } else {
            alert('Teleport can only be used on unclaimed tiles.');
        }
    }

    function captureHexWithTeleport(hex) {
        hex.player = currentPlayer;
        hex.color = playerColors[currentPlayer];
        playSound('power-up-sound'); // Power-up sound effect

        if (isOnlineMultiplayer) {
            sendMove({
                type: 'power-up',
                powerUp: 'teleport',
                targetHex: { row: hex.row, col: hex.col },
                player1PowerUps: powerUpCounts[1],
                player2PowerUps: powerUpCounts[2],
                player1Tiles: getPlayerTileLocations(1),
                player2Tiles: getPlayerTileLocations(2)
            });
        }
        renderGameBoard(); // Update display after teleport capture
    }


    function deactivatePowerUps() {
        sabotageActive = false;
        wildcardActive = false;
        teleportActive = false;
        activePowerUp = null;
        resetPowerUpHighlight();
    }

    function incrementPowerUpCount(powerUpType) {
        powerUpCounts[currentPlayer][powerUpType]++;
        updatePowerUpCountsDisplay();
    }

    function decrementPowerUpCount(powerUpType) {
        if (powerUpCounts[currentPlayer][powerUpType] > 0) {
            powerUpCounts[currentPlayer][powerUpType]--;
            updatePowerUpCountsDisplay();
        }
    }

    function initializePowerUpCountsDisplay() {
        for (let player = 1; player <= 2; player++) {
            for (const type of ['wildcard', 'sabotage', 'teleport']) {
                const countElementId = `${type}-count`;
                const countElement = document.getElementById(countElementId);
                if (countElement) {
                    countElement.textContent = powerUpCounts[player][type];
                }
            }
        }
    }

    function updatePowerUpCountsDisplay() {
        for (const type of ['wildcard', 'sabotage', 'teleport']) {
            const countElementId = `${type}-count`;
            const countElement = document.getElementById(countElementId);
            if (countElement) {
                let displayCount = playerNumber === 1 ? powerUpCounts[1][type] : powerUpCounts[2][type]; // Display based on local player number
                countElement.textContent = displayCount;
            }
        }
    }


    // --- Multiplayer Send Move Function ---
    function sendMove(moveData) {
        if (isOnlineMultiplayer && gameId) {
            if (window.sendMove) {
                window.sendMove(moveData); // Use globally exposed sendMove function from multiplayer.js
            } else {
                console.error('sendMove function not available in window scope.');
            }
        } else {
            // --- AI Move Logic (Placeholder) ---
            if (moveData.type !== 'color-selection' && moveData.type !== 'restart-game') { // Prevent AI move on color selection
                setTimeout(makeAiMove, 500); // Example: AI move after 500ms delay for local game
            }
        }
    }


    // --- AI Logic (Basic Placeholder) ---
    function makeAiMove() {
        if (currentPlayer === 2 && gameStarted && !isOnlineMultiplayer && !isGameFinished()) { // AI only moves if game is started, not online, and not finished
            let possibleMoves = [];
            for (let row = 0; row < boardSize; row++) {
                for (let col = 0; col < boardSize; col++) {
                    if (isValidMove(row, col, 2)) { // Check for player 2 (AI)
                        possibleMoves.push({ row: row, col: col });
                    }
                }
            }

            if (possibleMoves.length > 0) {
                let move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                if (board[move.row][move.col].landmine) {
                    handleLandmineExplosion(move.row, move.col);
                }
                captureHex(move.row, move.col);
                finalizeMove();
            } else {
                switchPlayerTurn(); // If no moves available, just switch turn
            }
        }
    }


    // --- Taunt and Sound Effects ---
    function playSound(elementId) {
        const soundElement = document.getElementById(elementId);
        if (soundElement) {
            soundElement.currentTime = 0; // Rewind to the start if it's currently playing
            soundElement.play().catch(error => console.error("Sound play failed:", error));
        }
    }


    // --- Initial Rendering and Setup ---
    resizeGame(); // Initial resize based on canvas dimensions
    renderGameBoard(); // Render initial board state
    updateScoreDisplay();
    updateTurnIndicator();
    initializePowerUpCountsDisplay();

    // Expose functions globally if not in a module environment
    if (typeof module === 'undefined') {
        window.initializeOnlineGame = initializeOnlineGame;
        window.getGameState = getGameState;
        window.syncGameState = syncGameState;
        window.renderGameBoard = renderGameBoard;
        window.resizeGame = resizeGame;
        window.updateScoreDisplay = updateScoreDisplay;
        window.restartGame = restartGame;
    }
})();