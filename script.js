(function() {
    // --- Start of script.js content ---
    let canvas = document.getElementById('game-board');
    let ctx = canvas.getContext('2d');
    let playerNameInput = document.getElementById('player-name');
    let startGameButton = document.getElementById('start-game');
    let colorPalette = document.getElementById('color-palette');
    let colorButtons = colorPalette.querySelectorAll('.color-button');
    let landmineInfo = document.getElementById('landmine-info');
    let messageElement = document.getElementById('message');
    let scoreContainer = document.getElementById('score-container');
    let turnIndicator = document.getElementById('turn-indicator');
    let opponentScoreDisplay = document.getElementById('opponent-score');
    let yourScoreDisplay = document.getElementById('your-score');

    let boardSize = CONFIG.BOARD_SIZE;
    let hexSize = CONFIG.HEX_SIZE;
    let board = initializeBoard();
    let currentPlayer = 1;
    let selectedColor = null;
    let playerColors = { 1: null, 2: null };
    let playerScore = { 1: 0, 2: 0 };
    let powerUpCounts = { 1: { wildcard: 1, sabotage: 1, teleport: 1 }, 2: { wildcard: 1, sabotage: 1, teleport: 1 } };
    let activePowerUp = null;
    let landmines = generateLandmines();
    let gameStarted = false;
    let isOnlineMultiplayer = false; // Flag for online multiplayer mode
    let gameId = null;
    let playerNumber = 0;
    let playerName = '';
    let opponentName = '';
    let currentPlayerTurn = 1; // Track whose turn it is locally, synced with server
    let lastMoveType = null; // Track last move type for UI updates

    // ... [Rest of the script.js content - all functions and logic] ...
    function initializeBoard() {
        let board = [];
        for (let row = 0; row < boardSize; row++) {
            board[row] = [];
            for (let col = 0; col < boardSize; col++) {
                board[row][col] = {
                    player: 0, // 0: neutral, 1: player 1, 2: player 2
                    color: null,
                    isLandmine: false,
                    row: row,
                    col: col,
                    powerUp: null // Could be 'wildcard', 'sabotage', 'teleport'
                };
            }
        }
        placeLandmines(board, landmines);
        return board;
    }

    function placeLandmines(board, landmines) {
        landmines.forEach(mine => {
            if (board[mine.row] && board[mine.row][mine.col]) {
                board[mine.row][mine.col].isLandmine = true;
            }
        });
    }

    function generateLandmines() {
        let mines = [];
        let count = CONFIG.LANDMINE_COUNT;
        while (mines.length < count) {
            let row = Math.floor(Math.random() * boardSize);
            let col = Math.floor(Math.random() * boardSize);
            let mine = { row: row, col: col };
            if (!mines.some(m => m.row === mine.row && m.col === mine.col)) {
                mines.push(mine);
            }
        }
        return mines;
    }

    function drawHexagon(ctx, center, size, color, isFilled = true, strokeColor = 'black') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = 2 * Math.PI / 6 * i - Math.PI / 2;
            const x = center.x + size * Math.cos(angle);
            const y = center.y + size * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        if (isFilled && color) {
            ctx.fillStyle = color;
            ctx.fill();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    function hexToPixel(hexCoords) {
        const col = hexCoords.col;
        const row = hexCoords.row;
        const x = hexSize * Math.sqrt(3) * col + hexSize * Math.sqrt(3) / 2 * (row % 2);
        const y = hexSize * 1.5 * row;
        return { x: x + hexSize, y: y + hexSize }; //+ hexSize for offset
    }

    function pixelToHex(pixel) {
        let col = Math.floor(pixel.x / (hexSize * Math.sqrt(3)));
        let row = Math.floor(pixel.y / (hexSize * 1.5));
        return { col: col, row: row };
    }

    function getHexCenter(hexCoords) {
        return hexToPixel(hexCoords);
    }

    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const hex = board[row][col];
                const center = getHexCenter({ row: row, col: col });
                let fillColor = hex.color || '#ddd'; // Default neutral color
                if (hex.isLandmine) {
                    fillColor = 'rgba(0,0,0,0.8)'; // Darker for landmines
                }
                drawHexagon(ctx, center, hexSize, fillColor);

                if (hex.isLandmine && hex.player === 0) {
                    ctx.fillStyle = '#F8E9A1'; // Landmine icon color
                    ctx.font = `${hexSize * 0.8}px FontAwesome`; // Adjust font size
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('\uf1e2', center.x, center.y + 2); // Landmine icon - FontAwesome bomb icon
                }
            }
        }
        highlightCurrentPlayerTiles(); // Call highlight function after drawing board
    }

    function highlightCurrentPlayerTiles() {
        const player = currentPlayerTurn; // Use currentPlayerTurn to highlight correct player
        const color = playerColors[player];

        if (!color) return; // Exit if color is not yet selected

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col].player === player) {
                    const center = getHexCenter({ row: row, col: col });
                    drawHexagon(ctx, center, hexSize + 5, null, false, color); // Stroke around the hex
                }
            }
        }
    }

    function handleHexClick(hexCoords) {
        if (!gameStarted) {
            messageElement.textContent = "Please start the game first.";
            return;
        }
        if (currentPlayerTurn !== playerNumber && isOnlineMultiplayer) {
            messageElement.textContent = "It's not your turn yet.";
            return;
        }
        if (!selectedColor && playerColors[playerNumber] === null) {
            messageElement.textContent = "Select a color from the palette first.";
            return;
        }

        const hex = board[hexCoords.row][hexCoords.col];
        if (!hex) return; // Invalid hex

        if (activePowerUp === 'sabotage' && currentPlayerTurn === playerNumber) {
            if (hex.player !== 0 && hex.player !== playerNumber) {
                sabotageTile(hexCoords);
                resetActivePowerUp();
            } else {
                messageElement.textContent = "Sabotage must be used on opponent's or neutral territory.";
            }
            return; // Exit after sabotage attempt
        }
        if (activePowerUp === 'wildcard' && currentPlayerTurn === playerNumber) {
            if (hex.player === 0 && isAdjacentToPlayer(hexCoords, playerNumber)) {
                wildcardClaim(hexCoords);
                resetActivePowerUp();
            } else {
                messageElement.textContent = "Wildcard can only claim unclaimed tiles adjacent to your territory.";
            }
            return; // Exit after wildcard attempt
        }
        if (activePowerUp === 'teleport' && currentPlayerTurn === playerNumber) {
            if (hex.player === 0) {
                teleportClaim(hexCoords);
                resetActivePowerUp();
            } else {
                messageElement.textContent = "Teleport can only claim unclaimed tiles.";
            }
            return; // Exit after teleport attempt
        }

        if (hex.player === 0) {
            claimHex(hexCoords);
        } else {
            messageElement.textContent = "Tile already claimed.";
        }
    }

    function claimHex(hexCoords) {
        const row = hexCoords.row;
        const col = hexCoords.col;
        if (!board[row] || !board[row][col] || board[row][col].player !== 0) return;

        let colorToUse = selectedColor || playerColors[playerNumber];
        if (!colorToUse) {
            console.error("No color selected for claim.");
            return;
        }

        board[row][col].player = currentPlayerTurn;
        board[row][col].color = colorToUse;

        let moveDetails = {
            type: 'claim',
            hex: hexCoords,
            player: currentPlayerTurn,
            color: colorToUse,
            landminesTriggered: [] // Initialize landminesTriggered array
        };

        if (board[row][col].isLandmine) {
            handleLandmineTrigger(hexCoords, moveDetails);
        } else {
            updateScore();
            checkAndProcessCombos(hexCoords, moveDetails);
        }

        if (isOnlineMultiplayer) {
            sendMoveToServer(moveDetails); // Send move data to server
        } else {
            switchTurn(); // Only switch turn if not waiting for server response
        }
        drawBoard(); // Redraw the board to reflect changes
    }

    function handleLandmineTrigger(hexCoords, moveDetails) {
        const row = hexCoords.row;
        const col = hexCoords.col;

        if (board[row] && board[row][col] && board[row][col].isLandmine) {
            board[row][col].isLandmine = false; // Disarm the landmine

            landmines = landmines.filter(mine => !(mine.row === row && mine.col === col)); // Remove from landmines array

            moveDetails.landminesTriggered.push({ row: row, col: col }); // Record triggered landmine

            // "Explode" adjacent tiles
            explodeAdjacentTiles(hexCoords, moveDetails);

            playSound('explosion-sound'); // Play explosion sound

            if (isOnlineMultiplayer) {
                sendMoveToServer(moveDetails); // Send updated move details including explosion
            } else {
                updateScore(); // Update scores after explosions
                switchTurn(); // Switch turn after explosion
            }
            drawBoard(); // Redraw to show explosion effects
        }
    }

    function explodeAdjacentTiles(hexCoords, moveDetails) {
        const adjacentHexes = getAdjacentHexes(hexCoords);
        let updatedBoard = false; // Flag to track if board was updated

        adjacentHexes.forEach(coords => {
            if (isValidHex(coords)) {
                const hex = board[coords.row][coords.col];
                if (hex.player !== 0) {
                    hex.player = 0; // Revert to neutral
                    hex.color = null; // Clear color
                    updatedBoard = true; // Board was updated
                }
            }
        });
        if (updatedBoard) {
            moveDetails.updatedBoard = getBoardStateForMove(); // Include updated board in move details
            updateScore(); // Update score if tiles were exploded
        }
    }

    function sabotageTile(hexCoords) {
        if (powerUpCounts[currentPlayerTurn].sabotage > 0) {
            board[hexCoords.row][hexCoords.col].player = 0;
            board[hexCoords.row][hexCoords.col].color = null;
            powerUpCounts[currentPlayerTurn].sabotage--;
            updatePowerUpDisplay();

            let moveDetails = {
                type: 'sabotage',
                hex: hexCoords,
                player: currentPlayerTurn,
                powerUps: powerUpCounts[currentPlayerTurn]
            };

            if (isOnlineMultiplayer) {
                sendMoveToServer(moveDetails);
            } else {
                updateScore();
                switchTurn();
            }
            drawBoard();
            playSound('power-up-sound'); // Play power-up sound effect
        } else {
            messageElement.textContent = "No sabotage power-ups left!";
        }
    }

    function wildcardClaim(hexCoords) {
        if (powerUpCounts[currentPlayerTurn].wildcard > 0) {
            claimHex(hexCoords); // Use existing claimHex logic
            powerUpCounts[currentPlayerTurn].wildcard--;
            updatePowerUpDisplay();

            let moveDetails = {
                type: 'wildcard',
                hex: hexCoords,
                player: currentPlayerTurn,
                powerUps: powerUpCounts[currentPlayerTurn],
                player1Tiles: getPlayerTiles(1), // Include player tiles in move data
                player2Tiles: getPlayerTiles(2)
            };

            if (isOnlineMultiplayer) {
                sendMoveToServer(moveDetails);
            } else {
                updateScore();
                switchTurn();
            }
            drawBoard();
            playSound('power-up-sound'); // Play power-up sound effect
        } else {
            messageElement.textContent = "No wildcard power-ups left!";
        }
    }

    function teleportClaim(hexCoords) {
        if (powerUpCounts[currentPlayerTurn].teleport > 0) {
            claimHex(hexCoords); // Use existing claimHex logic
            powerUpCounts[currentPlayerTurn].teleport--;
            updatePowerUpDisplay();

            let moveDetails = {
                type: 'teleport',
                hex: hexCoords,
                player: currentPlayerTurn,
                powerUps: powerUpCounts[currentPlayerTurn],
                player1Tiles: getPlayerTiles(1), // Include player tiles in move data
                player2Tiles: getPlayerTiles(2)
            };

            if (isOnlineMultiplayer) {
                sendMoveToServer(moveDetails);
            } else {
                updateScore();
                switchTurn();
            }
            drawBoard();
            playSound('power-up-sound'); // Play power-up sound effect
        } else {
            messageElement.textContent = "No teleport power-ups left!";
        }
    }

    function resetActivePowerUp() {
        activePowerUp = null;
        document.querySelectorAll('.power-up-slot').forEach(slot => slot.classList.remove('active'));
    }

    function checkAndProcessCombos(hexCoords, moveDetails) {
        let comboCount = 1;
        let comboHexes = [hexCoords];
        let visited = new Set([`${hexCoords.row},${hexCoords.col}`]); // Track visited hexes

        // 4-directional check for combos (excluding diagonals)
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // Right, Left, Down, Up

        function findCombo(currentHex, initialColor) {
            directions.forEach(dir => {
                let nextRow = currentHex.row + dir[0];
                let nextCol = currentHex.col + dir[1];
                let nextHexCoords = { row: nextRow, col: nextCol };

                if (isValidHex(nextHexCoords) && !visited.has(`${nextRow},${nextCol}`)) {
                    let neighborHex = board[nextRow][nextCol];
                    if (neighborHex.color === initialColor) {
                        comboCount++;
                        comboHexes.push(nextHexCoords);
                        visited.add(`${nextRow},${nextCol}`);
                        findCombo(nextHexCoords, initialColor); // Recursive call
                    }
                }
            });
        }

        findCombo(hexCoords, board[hexCoords.row][hexCoords.col].color);

        if (comboCount >= CONFIG.COMBO_THRESHOLD) {
            processComboEffect(comboHexes, moveDetails);
        }
    }

    function processComboEffect(comboHexes, moveDetails) {
        comboHexes.forEach(coords => {
            board[coords.row][coords.col].player = 0; // Revert to neutral
            board[coords.row][coords.col].color = null; // Clear color
        });

        updateScore(); // Update score after combo

        moveDetails.combo = { // Record combo details in move
            hexes: comboHexes,
            threshold: CONFIG.COMBO_THRESHOLD,
            count: comboHexes.length
        };

        messageElement.textContent = `Combo! ${comboHexes.length} tiles cleared!`;
        playSound('power-up-sound'); // Use power-up sound for combos

        if (isOnlineMultiplayer) {
            sendMoveToServer(moveDetails); // Send move data with combo info
        }
    }

    function updateScore() {
        playerScore[1] = 0;
        playerScore[2] = 0;
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col].player === 1) {
                    playerScore[1]++;
                } else if (board[row][col].player === 2) {
                    playerScore[2]++;
                }
            }
        }
        updateScoreDisplay();

        // Check for game end condition
        if (checkGameEnd()) {
            endGame();
        }
    }

    function updateScoreDisplay() {
        yourScoreDisplay.textContent = playerScore[playerNumber]; // Use playerNumber for 'your' score
        opponentScoreDisplay.textContent = playerScore[getOpponentPlayerNumber()]; // Use opponent's player number
        turnIndicator.textContent = `Current Turn: Player ${currentPlayerTurn}`;

        // Update active player highlight in score display
        if (currentPlayerTurn === 1) {
            scoreContainer.classList.remove('player2-turn');
            scoreContainer.classList.add('player1-turn');
            turnIndicator.classList.remove('player2-turn');
            turnIndicator.classList.add('player1-turn');
        } else {
            scoreContainer.classList.remove('player1-turn');
            scoreContainer.classList.add('player2-turn');
            turnIndicator.classList.remove('player1-turn');
            turnIndicator.classList.add('player2-turn');
        }
        highlightCurrentPlayerTiles(); // Re-highlight tiles after score update
    }

    function checkGameEnd() {
        const totalTiles = boardSize * boardSize;
        const occupiedTiles = playerScore[1] + playerScore[2];
        return occupiedTiles >= totalTiles * 0.8; // Game ends when 80% of tiles are occupied
    }

    function endGame() {
        gameStarted = false;
        let winner = playerScore[1] > playerScore[2] ? 1 : 2;
        if (playerScore[1] === playerScore[2]) {
            winner = 0; // It's a tie
        }
        let message = winner === 0 ? "It's a tie!" : `Player ${winner} wins!`;
        messageElement.textContent = `Game Over! ${message}`;

        if (isOnlineMultiplayer) {
            // For online games, maybe trigger a 'game-over' event to the server
            // and handle UI updates in multiplayer.js upon receiving 'game-over'
        } else {
            showPlayAgainButton(); // For local games, show play again button immediately
        }
    }

    function showPlayAgainButton() {
        const existingButton = document.getElementById('play-again-button');
        if (!existingButton) {
            const playAgainButton = document.createElement('button');
            playAgainButton.id = 'play-again-button';
            playAgainButton.textContent = 'Play Again';
            playAgainButton.className = 'action-button';
            playAgainButton.addEventListener('click', restartGame);
            document.getElementById('game-controls').appendChild(playAgainButton);
        }
    }

    function switchTurn() {
        currentPlayerTurn = currentPlayerTurn === 1 ? 2 : 1;
        updateScoreDisplay(); // Update display to reflect turn change
    }

    function handleColor выбор(color) {
        if (!gameStarted && playerColors[playerNumber] === null) {
            selectedColor = color;
            playerColors[playerNumber] = color;

            // Update UI to show color selection
            colorButtons.forEach(button => {
                if (button.dataset.color === color) {
                    button.classList.add('selected');
                } else {
                    button.classList.remove('selected');
                }
            });

            if (isOnlineMultiplayer && playerColors[getOpponentPlayerNumber()] !== null) {
                startGameOnline(); // Start game automatically if both players have chosen colors
            }
        } else if (gameStarted) {
            messageElement.textContent = "Color cannot be changed once the game has started.";
        } else if (playerColors[playerNumber] !== null) {
            messageElement.textContent = "You have already selected a color.";
        }
    }

    function startOfflineGame() {
        isOnlineMultiplayer = false;
        gameStarted = true;
        currentPlayerTurn = 1; // Player 1 starts
        playerColors = { 1: null, 2: null }; // Reset colors for new game
        playerScore = { 1: 0, 2: 0 };
        board = initializeBoard();
        landmines = generateLandmines();
        placeLandmines(board, landmines);
        updateScoreDisplay();
        drawBoard();
        landmineInfo.style.display = 'block'; // Show landmine info at game start
        messageElement.textContent = "Game started! Player 1's turn to choose color.";
        hidePlayerNameInput(); // Hide name input when game starts
        removePlayAgainButton(); // Ensure play again button is removed on new game start
        resetPowerUps(); // Reset power-up counts at game start
        updatePowerUpDisplay(); // Update power-up display to reflect reset counts
        resetColorSelectionUI(); // Reset color selection UI
    }

    function startGameOnline() {
        if (!isOnlineMultiplayer) {
            console.error("startGameOnline called in offline mode.");
            return;
        }
        if (playerColors[1] === null || playerColors[2] === null) {
            console.log("Colors not yet selected by both players. Waiting...");
            return; // Wait for both players to select colors
        }

        gameStarted = true;
        currentPlayerTurn = 1; // Player 1 starts in online mode as well (can be adjusted)

        // Initialize and sync game state for online play
        board = initializeBoard();
        landmines = generateLandmines();
        placeLandmines(board, landmines);
        playerScore = { 1: 0, 2: 0 };
        resetPowerUps(); // Reset power-up counts at game start
        updatePowerUpDisplay(); // Update power-up display to reflect reset counts
        updateScoreDisplay(); // Initial score display update
        drawBoard(); // Initial board draw
        landmineInfo.style.display = 'block'; // Show landmine info
        messageElement.textContent = "Online game started! Player 1's turn."; // Initial message
        hidePlayerNameInput(); // Hide name input in online game
        removePlayAgainButton(); // Remove play again button
        resetColorSelectionUI(); // Reset color selection UI

        if (playerNumber === 1) {
            // Only player 1 initializes and sends game state
            initializeAndSendGameState();
        }
    }

    function initializeAndSendGameState() {
        if (!isOnlineMultiplayer || playerNumber !== 1) {
            console.error("initializeAndSendGameState should only be called by Player 1 in online mode.");
            return;
        }

        let gameState = getGameState();

        // Send 'initialize-game' event to server with game state
        if (isOnlineMultiplayer) {
            window.sendMove({ type: 'initialize-game', gameState: gameState }); // Using sendMove as a general communication function
        }
    }

    function getGameState() {
        return {
            board: board,
            currentPlayer: currentPlayerTurn,
            player1Color: playerColors[1],
            player2Color: playerColors[2],
            player1Tiles: getPlayerTiles(1),
            player2Tiles: getPlayerTiles(2),
            player1PowerUps: powerUpCounts[1],
            player2PowerUps: powerUpCounts[2],
            landmines: landmines
        };
    }

    function syncGameState(gameState) {
        if (!gameState) {
            console.error("Received null gameState for sync.");
            return;
        }

        board = gameState.board;
        currentPlayerTurn = gameState.currentPlayer;
        playerColors[1] = gameState.player1Color;
        playerColors[2] = gameState.player2Color;
        playerScore[1] = 0; // Recalculate scores from board state
        playerScore[2] = 0;
        powerUpCounts[1] = gameState.player1PowerUps || { wildcard: 1, sabotage: 1, teleport: 1 }; // Ensure power-ups are handled
        powerUpCounts[2] = gameState.player2PowerUps || { wildcard: 1, sabotage: 1, teleport: 1 };
        landmines = gameState.landmines || []; // Sync landmines

        // Recalculate scores based on the synced board
        updateScore();
        updateScoreDisplay(); // Update score display after syncing state
        updatePowerUpDisplay(); // Update power-up counts in UI
        drawBoard(); // Redraw board with synced state

        if (gameStarted === false) {
            gameStarted = true; // Ensure gameStarted flag is set after sync
        }

        // Set player turn based on synced state
        currentPlayerTurn = gameState.currentPlayer;

        // Update color palette selection UI to reflect synced colors
        updateColorPaletteUI();

        // Update score display and turn indicator
        updateScoreDisplay();

        // Ensure board is redrawn
        drawBoard();
    }

    function getBoardStateForMove() {
        // Return a simplified board state for network transfer, if needed
        return board.map(row => row.map(hex => ({
            player: hex.player,
            color: hex.color,
            isLandmine: hex.isLandmine
        })));
    }

    function sendMoveToServer(moveData) {
        if (!isOnlineMultiplayer) {
            console.error("sendMoveToServer called in offline mode.");
            return;
        }
        if (!gameId) {
            console.error("Game ID is not set for online move.");
            return;
        }

        // Add current game state to move data before sending
        moveData.gameState = getGameState();
        window.sendMove(moveData); // Use global sendMove function from multiplayer.js
    }

    function restartGame() {
        isOnlineMultiplayer = false; // Reset to offline mode for restart button in local game
        gameStarted = false;
        currentPlayerTurn = 1;
        playerColors = { 1: null, 2: null };
        playerScore = { 1: 0, 2: 0 };
        board = initializeBoard();
        landmines = generateLandmines();
        placeLandmines(board, landmines);
        updateScoreDisplay();
        drawBoard();
        landmineInfo.style.display = 'none'; // Hide landmine info on restart
        messageElement.textContent = "Game restarted. Player 1's turn to choose color.";
        showPlayerNameInput(); // Show name input on restart
        removePlayAgainButton(); // Remove play again button on restart
        resetPowerUps(); // Reset power-up counts on game restart
        updatePowerUpDisplay(); // Update power-up display to reflect reset counts
        resetColorSelectionUI(); // Reset color selection UI
    }

    function initializeOnlineGame(playerNum, gameID, pName, oppName) {
        isOnlineMultiplayer = true;
        gameStarted = false; // Game starts when 'game-started' event is received
        gameId = gameID;
        playerNumber = playerNum;
        playerName = pName;
        opponentName = oppName || 'Opponent'; // Default opponent name
        currentPlayerTurn = 1; // Initial turn (will be synced from server)
        playerColors = { 1: null, 2: null }; // Colors to be selected
        playerScore = { 1: 0, 2: 0 };
        board = initializeBoard(); // Initialize empty board
        landmines = generateLandmines(); // Generate landmines
        placeLandmines(board, landmines); // Place landmines on board
        updateScoreDisplay();
        drawBoard();
        landmineInfo.style.display = 'none'; // Initially hide landmine info in online game
        messageElement.textContent = `Waiting for Player ${playerNumber === 1 ? 2 : 1} to join and start the game...`;
        hidePlayAgainButton(); // Hide play again button at start of online game
        resetPowerUps(); // Reset power-up counts at game start
        updatePowerUpDisplay(); // Update power-up display to reflect reset counts
        resetColorSelectionUI(); // Reset color selection UI
    }

    function hidePlayAgainButton() {
        const button = document.getElementById('play-again-button');
        if (button) {
            button.style.display = 'none';
        }
    }

    function showPlayerNameInput() {
        const playerNameContainer = document.getElementById('player-name-container');
        if (playerNameContainer) {
            playerNameContainer.style.display = 'block';
        }
    }

    function hidePlayerNameInput() {
        const playerNameContainer = document.getElementById('player-name-container');
        if (playerNameContainer) {
            playerNameContainer.style.display = 'none';
        }
    }

    function removePlayAgainButton() {
        const button = document.getElementById('play-again-button');
        if (button) {
            button.remove();
        }
    }

    function isValidHex(hexCoords) {
        return hexCoords.row >= 0 && hexCoords.row < boardSize && hexCoords.col >= 0 && hexCoords.col < boardSize;
    }

    function getAdjacentHexes(hexCoords) {
        const { row, col } = hexCoords;
        const adjacentCoords = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, 1]]; // Include diagonals for adjacency

        for (const dir of directions) {
            let newRow = row + dir[0];
            let newCol = col + dir[1];
            if (isValidHex({ row: newRow, col: newCol })) {
                adjacentCoords.push({ row: newRow, col: newCol });
            }
        }
        return adjacentCoords;
    }

    function isAdjacentToPlayer(hexCoords, player) {
        const adjacentHexes = getAdjacentHexes(hexCoords);
        return adjacentHexes.some(coords => board[coords.row][coords.col].player === player);
    }

    function getOpponentPlayerNumber() {
        return playerNumber === 1 ? 2 : 1;
    }

    function getPlayerTiles(playerNumber) {
        let tiles = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col].player === playerNumber) {
                    tiles.push({ row: row, col: col });
                }
            }
        }
        return tiles;
    }

    function handlePowerUpSelection(powerUpType, slotElement) {
        if (currentPlayerTurn !== playerNumber && isOnlineMultiplayer) {
            messageElement.textContent = "Cannot use power-ups on opponent's turn.";
            return;
        }
        if (activePowerUp === powerUpType) {
            resetActivePowerUp(); // Deselect if already active
        } else {
            resetActivePowerUp(); // Deselect any other active power-up first
            activePowerUp = powerUpType;
            slotElement.classList.add('active');
            messageElement.textContent = `Selected power-up: ${powerUpType}. Click on the board to use it.`;
        }
    }

    function updatePowerUpDisplay() {
        for (let player = 1; player <= 2; player++) {
            for (const powerUpType of ['wildcard', 'sabotage', 'teleport']) {
                const countElementId = `${powerUpType}-count`;
                const countElement = document.getElementById(countElementId);
                if (countElement) {
                    // Determine which player's power-ups to display based on local player number
                    const displayCount = (playerNumber === 1) ? powerUpCounts[1][powerUpType] : powerUpCounts[2][powerUpType];
                    countElement.textContent = powerUpCounts[playerNumber][powerUpType];
                }
            }
        }
    }

    function resetPowerUps() {
        powerUpCounts = { 1: { wildcard: 1, sabotage: 1, teleport: 1 }, 2: { wildcard: 1, sabotage: 1, teleport: 1 } };
    }

    function updateColorPaletteUI() {
        colorButtons.forEach(button => {
            const color = button.dataset.color;
            if (color === playerColors[1]) {
                colorPalette.querySelector(`.color-swatch:nth-child(1)`).classList.add('current-player');
                colorPalette.querySelector(`.color-swatch:nth-child(1)`).classList.remove('opponent-player');
            } else if (color === playerColors[2]) {
                colorPalette.querySelector(`.color-swatch:nth-child(1)`).classList.add('opponent-player');
                colorPalette.querySelector(`.color-swatch:nth-child(1)`).classList.remove('current-player');
            } else {
                colorPalette.querySelector(`.color-swatch:nth-child(1)`).classList.remove('current-player');
                colorPalette.querySelector(`.color-swatch:nth-child(1)`).classList.remove('opponent-player');
            }
        });
    }

    function resetColorSelectionUI() {
        colorButtons.forEach(button => {
            button.classList.remove('selected');
        });
    }

    // --- Event Listeners ---
    canvas.addEventListener('click', function(event) {
        if (!gameStarted) return;
        const rect = canvas.getBoundingClientRect();
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;
        const hexCoords = pixelToHex({ x: pixelX, y: pixelY });
        if (isValidHex(hexCoords)) {
            handleHexClick(hexCoords);
        }
    });

    startGameButton.addEventListener('click', startOfflineGame);

    colorButtons.forEach(button => {
        button.addEventListener('click', function() {
            handleColor выбор(this.dataset.color);
        });
    });

    document.querySelectorAll('.power-up-slot').forEach(slot => {
        slot.addEventListener('click', function() {
            const powerUpType = this.dataset.type;
            if (!this.classList.contains('disabled')) { // Check if not disabled
                handlePowerUpSelection(powerUpType, this);
            } else {
                messageElement.textContent = `No ${this.querySelector('.power-up-name').textContent} power-ups left!`;
            }
        });
    });

    // Export functions to window for multiplayer.js to call
    window.initializeOnlineGame = initializeOnlineGame;
    window.getGameState = getGameState;
    window.syncGameState = syncGameState;
    window.renderGameBoard = drawBoard; // Export for potential external use
    window.resizeGame = drawBoard; // Export resizeGame as drawBoard for simplicity in this context
    window.updateScoreDisplay = updateScoreDisplay;
    window.restartGame = restartGame;

    // Initialize power-up counts display on page load
    updatePowerUpDisplay();
    // --- End of script.js content ---
})();