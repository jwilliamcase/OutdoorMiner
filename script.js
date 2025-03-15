(function() {
    // Initialize game variables
    const BOARD_SIZE = CONFIG.BOARD_SIZE;
    const HEX_SIZE = CONFIG.HEX_SIZE;
    let canvas = document.getElementById('game-board');
    let ctx = canvas.getContext('2d');
    let board = initializeBoard();
    let currentPlayer = 1; // 1 for player 1, 2 for player 2
    let selectedColor = null;
    let player1Score = 0;
    let player2Score = 0;
    let gameStarted = false;
    let player1Color = null;
    let player2Color = null;
    let powerUpActive = null;
    let powerUpTarget = null;
    let sabotageCount = 2;
    let wildcardCount = 2;
    let teleportCount = 2;
    let landmines = [];
    let playerName = 'You';
    let opponentName = 'Opponent';
    let isOnlineGame = false;
    let gameId = null;
    let playerNumber = 1;
    let currentPlayerName = playerName;
    let opponentPlayerName = opponentName;
    let moveHistory = [];
    let lastMoveType = null;


    // UI elements
    const startGameButton = document.getElementById('start-game');
    const colorPalette = document.getElementById('color-palette');
    const colorButtons = document.querySelectorAll('.color-button');
    const turnIndicator = document.getElementById('turn-indicator');
    const playerScoreElement = document.getElementById('your-score');
    const opponentScoreElement = document.getElementById('opponent-score-value');
    const messageElement = document.getElementById('message');
    const landmineInfoElement = document.getElementById('landmine-info');
    const sabotagePowerUp = document.querySelector('.power-up-slot[data-type="sabotage"]');
    const wildcardPowerUp = document.querySelector('.power-up-slot[data-type="wildcard"]');
    const teleportPowerUp = document.querySelector('.power-up-slot[data-type="teleport"]');
    const sabotageCountElement = document.getElementById('sabotage-count');
    const wildcardCountElement = document.getElementById('wildcard-count');
    const teleportCountElement = document.getElementById('teleport-count');
    const playerNameContainer = document.getElementById('player-name-container');
    const playerNameInput = document.getElementById('player-name');


    // Event listeners
    canvas.addEventListener('click', handleCanvasClick);
    startGameButton.addEventListener('click', startGame);
    colorPalette.addEventListener('click', handleColorClick);
    sabotagePowerUp.addEventListener('click', () => activatePowerUp('sabotage'));
    wildcardPowerUp.addEventListener('click', () => activatePowerUp('wildcard'));
    teleportPowerUp.addEventListener('click', () => activatePowerUp('teleport'));

    // Initialize power-up counts in UI
    sabotageCountElement.textContent = sabotageCount;
    wildcardCountElement.textContent = wildcardCount;
    teleportCountElement.textContent = teleportCount;

    // Initialize the game board
    function initializeBoard() {
        let board = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            board[row] = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                board[row][col] = {
                    player: 0, // 0: unclaimed, 1: player 1, 2: player 2
                    color: null,
                    landmine: false,
                    row: row,
                    col: col,
                    neighbors: getNeighbors(row, col)
                };
            }
        }
        return board;
    }

    function getNeighbors(row, col) {
        const neighbors = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, 1]]; // Correct hex directions

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidCell(newRow, newCol)) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }
        return neighbors;
    }

    function isValidCell(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    function startGame() {
        if (gameStarted) {
            restartGame(); // Implement restart functionality
            return;
        }

        setupOnlineGameElements(); // Ensure online game elements are correctly set up on game start

        gameStarted = true;
        landmines = placeLandmines();
        board = initializeBoard(); // Re-initialize the board at the start of the game
        player1Score = 0;
        player2Score = 0;
        currentPlayer = 1;
        selectedColor = null;
        powerUpActive = null;
        powerUpTarget = null;
        sabotageCount = 2;
        wildcardCount = 2;
        teleportCount = 2;

        // Re-initialize power-up counts in UI
        sabotageCountElement.textContent = sabotageCount;
        wildcardCountElement.textContent = wildcardCount;
        teleportCountElement.textContent = teleportCount;

        updateScoreDisplay();
        updateTurnIndicator();
        renderGameBoard();
        updateColorPaletteDisplay();
        resetPowerUpStates();
        clearMessages();
        hideLandmineInfo();
        moveHistory = []; // Clear move history on game start
        lastMoveType = null;

        if (isOnlineGame) {
            if (playerNumber === 1) {
                // Initialize and send game state for player 1 in online mode
                initOnlineGameForPlayer1();
            } else {
                // For player 2, game state will be received from server
                messageElement.textContent = "Waiting for Player 1 to start the game...";
            }
        } else {
            messageElement.textContent = "Game started! Player 1's turn.";
        }

        // Change Start Game button to Restart Game
        startGameButton.textContent = 'Restart Game';
    }


    function initOnlineGameForPlayer1() {
        if (!isOnlineGame || playerNumber !== 1) return;

        // Initialize game state for player 1
        const gameState = {
            board: board,
            currentPlayer: currentPlayer,
            player1Color: player1Color,
            player2Color: player2Color,
            player1Tiles: getPlayerTiles(1),
            player2Tiles: getPlayerTiles(2),
            player1PowerUps: getPowerUpCounts(1),
            player2PowerUps: getPowerUpCounts(2),
            landmines: landmines
        };

        // Send initial game state to the server
        if (typeof window.sendMove === 'function') {
            window.sendMove({
                type: 'initial-state', // Or 'game-start'
                gameState: gameState
            });
        } else {
            console.error('sendMove function is not available in window scope for online game.');
        }
    }

    function getPowerUpCounts(player) {
        return player === 1 ? { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount } : { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
    }


    function placeLandmines() {
        let mines = [];
        for (let i = 0; i < CONFIG.LANDMINE_COUNT; i++) {
            let row, col;
            do {
                row = Math.floor(Math.random() * BOARD_SIZE);
                col = Math.floor(Math.random() * BOARD_SIZE);
            } while (board[row][col].landmine || board[row][col].player !== 0); // Avoid placing mines on existing mines or claimed tiles

            board[row][col].landmine = true; // Set landmine on the board for internal tracking, but don't visually reveal yet
            mines.push({ row: row, col: col }); // Store mine location for game state

        }
        return mines;
    }


    function restartGame() {
        gameStarted = false;
        startGameButton.textContent = 'Start Game'; // Change button back to 'Start Game'

        if (isOnlineGame) {
            if (typeof window.sendMove === 'function') {
                window.sendMove({ type: 'restart-game' });
            } else {
                console.error('sendMove function is not available for restart in online game.');
            }
        } else {
            startGame(); // For local game, just restart the game
        }
    }

    // Function to handle game restart initiated by opponent in online game
    function handleGameRestarted() {
        if (isOnlineGame) {
            gameStarted = false;
            startGameButton.textContent = 'Start Game';
            startGame(); // Restart the game
            messageElement.textContent = "Opponent restarted the game. New game started!";
        }
    }


    function renderGameBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const gridSize = BOARD_SIZE;
        const verticalSpacing = HEX_SIZE * 2;
        const horizontalSpacing = Math.sqrt(3) * HEX_SIZE;

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                let x = centerX + (col - gridSize / 2) * horizontalSpacing;
                let y = centerY + (row - gridSize / 2) * verticalSpacing * 0.75;

                if (col % 2 !== 0) { // Offset every other column for hex grid layout
                    y += verticalSpacing * 0.375;
                }

                drawHexagon(ctx, x, y, HEX_SIZE, board[row][col].color, board[row][col].player, board[row][col].landmine && !isOnlineGame); //Conditionally render landmines for local game only
            }
        }
    }


    function drawHexagon(ctx, centerX, centerY, size, fillColor, playerNumber, showLandmine) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = centerX + size * Math.cos(angle);
            const y = centerY + size * Math.sin(angle);
            ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        } else {
            ctx.fillStyle = '#ddd'; // Default hexagon color
            ctx.fill();
        }

        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (showLandmine) {
            drawLandmine(ctx, centerX, centerY, size / 2);
        } else if (playerNumber) {
            drawPlayerIndicator(ctx, centerX, centerY, playerNumber, size / 2);
        }
    }

    function drawLandmine(ctx, centerX, centerY, size) {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = `${size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', centerX, centerY);
    }


    function drawPlayerIndicator(ctx, centerX, centerY, playerNumber, size) {
        const colors = ['', player1Color, player2Color]; // Index 0 is intentionally blank
        ctx.fillStyle = colors[playerNumber] || 'transparent'; // Use player's color or transparent if no color
        ctx.beginPath();
        ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }


    function handleCanvasClick(event) {
        if (!gameStarted) {
            messageElement.textContent = "Please start the game first.";
            return;
        }
        if (selectedColor === null && !powerUpActive) {
            messageElement.textContent = "Select a color from the palette first.";
            return;
        }
        if (currentPlayer !== playerNumber && isOnlineGame) {
            messageElement.textContent = "It's not your turn yet.";
            return;
        }


        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const gridSize = BOARD_SIZE;
        const verticalSpacing = HEX_SIZE * 2 * 0.75;
        const horizontalSpacing = Math.sqrt(3) * HEX_SIZE;

        let clickedRow, clickedCol = null;
        let minDist = Infinity;

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                let hexCenterX = centerX + (col - gridSize / 2) * horizontalSpacing;
                let hexCenterY = centerY + (row - gridSize / 2) * verticalSpacing;
                if (col % 2 !== 0) {
                    hexCenterY += verticalSpacing / 2;
                }

                const dist = Math.sqrt((clickX - hexCenterX) ** 2 + (clickY - hexCenterY) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    clickedRow = row;
                    clickedCol = col;
                }
            }
        }

        if (minDist <= HEX_SIZE) {
            handleHexagonClick(clickedRow, clickedCol);
        }
    }


    function handleHexagonClick(row, col) {
        if (!isValidCell(row, col)) return;

        const cell = board[row][col];

        if (powerUpActive) {
            handlePowerUpClick(cell);
        } else {
            if (cell.player === 0) {
                if (isAdjacentToPlayer(row, col, currentPlayer)) {
                    processPlayerMove(row, col);
                } else {
                    messageElement.textContent = "You must choose a tile adjacent to your existing tiles.";
                }
            } else {
                messageElement.textContent = "This tile is already claimed.";
            }
        }
    }

    function isAdjacentToPlayer(row, col, player) {
        for (const neighbor of board[row][col].neighbors) {
            if (board[neighbor.row][neighbor.col].player === player) {
                return true;
            }
        }
        return false;
    }


    function processPlayerMove(row, col) {
        if (board[row][col].player === 0) {
            let moveType = 'color-selection'; // Default move type

            if (board[row][col].landmine) {
                moveType = 'landmine';
                handleLandmineExplosion(row, col);
            } else {
                board[row][col].player = currentPlayer;
                board[row][col].color = selectedColor;
                updateScore();
            }

            renderGameBoard();
            moveHistory.push({
                row: row,
                col: col,
                player: currentPlayer,
                color: selectedColor,
                moveType: moveType,
                timestamp: Date.now()
            });
            lastMoveType = moveType;


            if (isOnlineGame) {
                sendMoveToOpponent(row, col, moveType);
            } else {
                switchTurn(); // Only switch turns in local games after a move
            }
            resetPowerUpStates(); // Power-ups are one-time use per turn
        }
    }

    function sendMoveToOpponent(row, col, moveType) {
        if (!isOnlineGame) return;

        let moveData = {
            type: moveType,
            row: row,
            col: col,
            player: currentPlayer,
            color: selectedColor,
            player1Tiles: getPlayerTiles(1),
            player2Tiles: getPlayerTiles(2),
            player1PowerUps: { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount },
            player2PowerUps: { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount },
            updatedBoard: board,
            currentPlayer: currentPlayer
        };


        if (moveType === 'color-selection') {
            moveData.player1Tiles = getPlayerTiles(1);
            moveData.player2Tiles = getPlayerTiles(2);
            moveData.player1Color = player1Color;
            moveData.player2Color = player2Color;
        } else if (moveType === 'landmine') {
            moveData.landmines = landmines.filter(mine => !(mine.row === row && mine.col === col)); // Remove exploded mine
            moveData.updatedBoard = board; // Send updated board after explosion
            moveData.player1Tiles = getPlayerTiles(1);
            moveData.player2Tiles = getPlayerTiles(2);
        }


        if (typeof window.sendMove === 'function') {
            window.sendMove(moveData);
        } else {
            console.error('sendMove function is not available.');
        }
    }


    function handleLandmineExplosion(row, col) {
        board[row][col].landmine = false; // Disarm the landmine

        // Determine tiles to convert based on explosion radius (e.g., neighbors)
        const explosionZone = [{ row: row, col: col }, ...board[row][col].neighbors];

        explosionZone.forEach(pos => {
            if (isValidCell(pos.row, pos.col) && board[pos.row][pos.col].player === currentPlayer) {
                board[pos.row][pos.col].player = 0; // Revert to unclaimed
                board[pos.row][pos.col].color = null;
            }
        });
        updateScore();
        playSound('explosion-sound');
        messageElement.textContent = "💥 Landmine exploded!";
        showLandmineInfoTemporarily();
    }

    function showLandmineInfoTemporarily() {
        landmineInfoElement.classList.remove('hidden');
        setTimeout(() => {
            landmineInfoElement.classList.add('hidden');
        }, 3000); // Hide after 3 seconds
    }

    function hideLandmineInfo() {
        landmineInfoElement.classList.add('hidden');
    }


    function handleOpponentMove(moveData) {
        console.log("Handling opponent's move:", moveData); // Debugging log

        if (!moveData || !moveData.type) {
            console.error("Invalid move data received:", moveData);
            return;
        }

        const { type, row, col, player, color, gameState } = moveData;

        if (type === 'color-selection') {
            // Update game state from server's game-update event
            syncGameState(gameState);
            messageElement.textContent = `${opponentName} claimed a tile. Your turn!`;
        } else if (type === 'landmine') {
            // Handle landmine explosion on opponent's move
            syncGameState(gameState); // Sync entire game state
            messageElement.textContent = `💥 Landmine exploded! ${playerName}'s turn.`;
            playSound('explosion-sound');
            showLandmineInfoTemporarily();
        } else if (type === 'power-up') {
            syncGameState(gameState);
            messageElement.textContent = `${opponentName} used ${moveData.powerUpType}! Your turn.`;
            playSound('power-up-sound');
        } else if (type === 'restart-game') {
            handleGameRestarted();
            return; // Exit early to avoid turn switch below after restart
        }


        renderGameBoard();
        updateScoreDisplay();
        updateTurnIndicator();
        resetPowerUpStates(); // Reset power-up states after opponent's move
        moveHistory.push({
            row: row,
            col: col,
            player: currentPlayer, // Note: currentPlayer was already switched by opponent's move
            color: color,
            moveType: type,
            timestamp: Date.now()
        });
        lastMoveType = type;

        // No need to switch turn here, as turn is managed by server and syncGameState
    }


    function handleColorClick(event) {
        if (!gameStarted) {
            messageElement.textContent = "Please start the game first.";
            return;
        }
        const button = event.target.closest('.color-button');
        if (button) {
            const color = button.dataset.color;
            selectedColor = color;
            updateColorPaletteDisplay();
            button.classList.add('selected');
            messageElement.textContent = `Color selected: ${color}. Now click on a hexagon to claim it.`;
        }
    }

    function updateColorPaletteDisplay() {
        colorButtons.forEach(button => button.classList.remove('selected'));
        if (selectedColor) {
            colorButtons.forEach(button => {
                if (button.dataset.color === selectedColor) {
                    button.classList.add('selected');
                }
            });
        }
    }


    function switchTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        selectedColor = null; // Reset selected color after turn switch
        updateTurnIndicator();
        updateColorPaletteDisplay(); // Clear color selection UI
        clearMessages(); // Clear any residual messages
        resetPowerUpStates(); // Ensure power-up states are reset each turn

        currentPlayerName = currentPlayer === playerNumber ? playerName : opponentName;
        opponentPlayerName = currentPlayer === playerNumber ? opponentName : playerName;

        if (!isOnlineGame) {
            messageElement.textContent = `Player ${currentPlayer}'s turn (${currentPlayerName}). Select a color.`;
        } else {
            if (currentPlayer === playerNumber) {
                messageElement.textContent = `Your turn, ${playerName}! Select a color and claim a tile.`;
            } else {
                messageElement.textContent = `Waiting for ${opponentName} to make a move...`;
            }
        }
    }

    function updateTurnIndicator() {
        turnIndicator.textContent = `Current Turn: Player ${currentPlayer} (${currentPlayerName})`;
        if (currentPlayer === 1) {
            turnIndicator.classList.add('player1-turn');
            turnIndicator.classList.remove('player2-turn');
        } else {
            turnIndicator.classList.remove('player1-turn');
            turnIndicator.classList.add('player2-turn');
        }
        // Update active player names in score container
        updatePlayerNamesInScoreboard();
    }

    function updatePlayerNamesInScoreboard() {
        const player1ScoreElement = document.getElementById('player-score');
        const player2ScoreElement = document.getElementById('opponent-score');

        let p1Name = playerName;
        let p2Name = opponentName;
        if (playerNumber === 2) {
            p1Name = opponentName;
            p2Name = playerName;
        }

        player1ScoreElement.innerHTML = `<span class="player-name ${currentPlayer === 1 ? 'active-player' : ''}">${p1Name}</span>: <span id="your-score">${player1Score}</span>`;
        player2ScoreElement.innerHTML = `<span class="player-name ${currentPlayer === 2 ? 'active-player' : ''}">${p2Name}</span>: <span id="opponent-score-value">${player2Score}</span>`;
    }


    function updateScore() {
        player1Score = getPlayerTiles(1).length;
        player2Score = getPlayerTiles(2).length;
        updateScoreDisplay();

        if (checkGameEndCondition()) {
            endGame();
        }
    }

    function updateScoreDisplay() {
        playerScoreElement.textContent = player1Score;
        opponentScoreElement.textContent = player2Score;
        updatePlayerNamesInScoreboard(); // Ensure names are also updated when scores change
    }


    function getPlayerTiles(player) {
        let tiles = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col].player === player) {
                    tiles.push(board[row][col]);
                }
            }
        }
        return tiles;
    }

    function checkGameEndCondition() {
        const totalTiles = BOARD_SIZE * BOARD_SIZE;
        const occupiedTiles = player1Score + player2Score;
        return occupiedTiles >= totalTiles * 0.8; // Game ends when 80% of tiles are claimed
    }


    function endGame() {
        gameStarted = false;
        let winner = player1Score > player2Score ? 'Player 1' : (player2Score > player1Score ? 'Player 2' : 'No one');
        let winnerName = player1Score > player2Score ? playerName : (player2Score > player1Score ? opponentName : 'No one');
        if (playerNumber === 2 && winner === 'Player 1') winnerName = opponentName;
        if (playerNumber === 2 && winner === 'Player 2') winnerName = playerName;
        if (!isOnlineGame) {
            messageElement.textContent = `Game Over! ${winner} (${winnerName}) wins!`;
        } else {
            messageElement.textContent = `Game Over! ${winner} (${winnerName}) wins! Play again?`;
        }
        startGameButton.textContent = 'Play Again'; // Change button to 'Play Again' for new game

        if (isOnlineGame) {
            showPlayAgainButton(); // Show button only in online games
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


    function clearMessages() {
        messageElement.textContent = '';
    }

    function playSound(elementId) {
        const sound = document.getElementById(elementId);
        if (sound) {
            sound.currentTime = 0; // Rewind to the start if it's currently playing
            sound.play().catch(error => console.error("Playback failed:", error));
        }
    }


    // Power-Up Functions
    function activatePowerUp(powerUpType) {
        if (!gameStarted) {
            messageElement.textContent = "Start the game to use power-ups.";
            return;
        }
        if (currentPlayer !== playerNumber && isOnlineGame) {
            messageElement.textContent = "Wait for your turn to use power-ups.";
            return;
        }
        if (selectedColor === null) {
            messageElement.textContent = "Select a color before using a power-up.";
            return;
        }

        powerUpActive = powerUpType;
        resetPowerUpStates(); // Visually reset other power-up buttons
        const powerUpElement = document.querySelector(`.power-up-slot[data-type="${powerUpType}"]`);
        if (powerUpElement) {
            powerUpElement.classList.add('active');
        }

        switch (powerUpType) {
            case 'sabotage':
                messageElement.textContent = "Sabotage power-up active. Click on opponent's tile to convert it.";
                break;
            case 'wildcard':
                messageElement.textContent = "Wildcard power-up active. Click on an unclaimed tile adjacent to yours.";
                break;
            case 'teleport':
                messageElement.textContent = "Teleport power-up active. Click on any unclaimed tile to claim it.";
                break;
        }
    }

    function resetPowerUpStates() {
        powerUpActive = null;
        sabotagePowerUp.classList.remove('active');
        wildcardPowerUp.classList.remove('active');
        teleportPowerUp.classList.remove('active');
    }


    function handlePowerUpClick(cell) {
        if (!powerUpActive) return;

        switch (powerUpActive) {
            case 'sabotage':
                if (cell.player === (currentPlayer === 1 ? 2 : 1)) { // Target is opponent's tile
                    useSabotagePowerUp(cell);
                } else {
                    messageElement.textContent = "Sabotage power-up can only be used on opponent's tiles.";
                }
                break;
            case 'wildcard':
                if (cell.player === 0 && isAdjacentToPlayer(cell.row, cell.col, currentPlayer)) {
                    useWildcardPowerUp(cell);
                } else {
                    messageElement.textContent = "Wildcard can only be used on unclaimed tiles adjacent to your own.";
                }
                break;
            case 'teleport':
                if (cell.player === 0) {
                    useTeleportPowerUp(cell);
                } else {
                    messageElement.textContent = "Teleport can only be used on unclaimed tiles.";
                }
                break;
        }
    }


    function useSabotagePowerUp(targetCell) {
        if (sabotageCount <= 0) {
            messageElement.textContent = "No sabotage power-ups left.";
            resetPowerUpStates();
            return;
        }

        // Send power-up move to server
        if (isOnlineGame) {
            sendPowerUpMove('sabotage', targetCell);
        } else {
            applySabotageEffect(targetCell);
        }
    }

    function applySabotageEffect(targetCell) {
        targetCell.player = 0; // Revert to unclaimed
        targetCell.color = null;
        sabotageCount--;
        sabotageCountElement.textContent = sabotageCount;
        updateScore();
        renderGameBoard();
        playSound('power-up-sound');
        messageElement.textContent = "Sabotage power-up used!";
        resetPowerUpStates();

        if (!isOnlineGame) {
            switchTurn(); // Switch turn only in local games
        }
    }


    function useWildcardPowerUp(targetCell) {
        if (wildcardCount <= 0) {
            messageElement.textContent = "No wildcard power-ups left.";
            resetPowerUpStates();
            return;
        }

        // Send power-up move to server
        if (isOnlineGame) {
            sendPowerUpMove('wildcard', targetCell);
        } else {
            applyWildcardEffect(targetCell);
        }
    }


    function applyWildcardEffect(targetCell) {
        targetCell.player = currentPlayer;
        targetCell.color = selectedColor;
        wildcardCount--;
        wildcardCountElement.textContent = wildcardCount;
        updateScore();
        renderGameBoard();
        playSound('power-up-sound');
        messageElement.textContent = "Wildcard power-up used!";
        resetPowerUpStates();

        if (!isOnlineGame) {
            switchTurn(); // Switch turn only in local games
        }
    }


    function useTeleportPowerUp(targetCell) {
        if (teleportCount <= 0) {
            messageElement.textContent = "No teleport power-ups left.";
            resetPowerUpStates();
            return;
        }

        // Send power-up move to server
        if (isOnlineGame) {
            sendPowerUpMove('teleport', targetCell);
        } else {
            applyTeleportEffect(targetCell);
        }
    }


    function applyTeleportEffect(targetCell) {
        targetCell.player = currentPlayer;
        targetCell.color = selectedColor;
        teleportCount--;
        teleportCountElement.textContent = teleportCount;
        updateScore();
        renderGameBoard();
        playSound('power-up-sound');
        messageElement.textContent = "Teleport power-up used!";
        resetPowerUpStates();

        if (!isOnlineGame) {
            switchTurn(); // Switch turn only in local games
        }
    }


    function sendPowerUpMove(powerUpType, targetCell) {
        if (!isOnlineGame) return;

        let moveData = {
            type: 'power-up',
            powerUpType: powerUpType,
            targetRow: targetCell.row,
            targetCol: targetCell.col,
            player: currentPlayer,
            color: selectedColor,
            player1PowerUps: { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount },
            player2PowerUps: { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount },
            player1Tiles: getPlayerTiles(1),
            player2Tiles: getPlayerTiles(2),
            updatedBoard: board,
            currentPlayer: currentPlayer
        };


        if (powerUpType === 'sabotage') {
            applySabotageEffect(targetCell); // Apply effect locally immediately for visual feedback
            moveData.updatedBoard = board; // Send updated board
            moveData.player1PowerUps = { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
            moveData.player2PowerUps = { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
            moveData.player1Tiles = getPlayerTiles(1);
            moveData.player2Tiles = getPlayerTiles(2);
        } else if (powerUpType === 'wildcard') {
            applyWildcardEffect(targetCell); // Apply effect locally immediately
            moveData.updatedBoard = board;
            moveData.player1PowerUps = { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
            moveData.player2PowerUps = { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
            moveData.player1Tiles = getPlayerTiles(1);
            moveData.player2Tiles = getPlayerTiles(2);
        } else if (powerUpType === 'teleport') {
            applyTeleportEffect(targetCell); // Apply teleport effect locally
            moveData.updatedBoard = board;
            moveData.player1PowerUps = { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
            moveData.player2PowerUps = { sabotage: sabotageCount, wildcard: wildcardCount, teleport: teleportCount };
            moveData.player1Tiles = getPlayerTiles(1);
            moveData.player2Tiles = getPlayerTiles(2);
        }


        if (typeof window.sendMove === 'function') {
            window.sendMove(moveData);
        } else {
            console.error('sendMove function is not available.');
        }
    }


    function handleOpponentPowerUp(moveData) {
        if (!moveData || !moveData.type || moveData.type !== 'power-up') {
            console.error("Invalid power-up move data:", moveData);
            return;
        }

        const { powerUpType, targetRow, targetCol, gameState } = moveData;
        const targetCell = board[targetRow][targetCol];

        // Sync game state first to ensure power-up counts and board are up-to-date
        syncGameState(gameState);

        if (powerUpType === 'sabotage') {
            applySabotageEffect(targetCell); // Apply sabotage effect received from opponent
            messageElement.textContent = `${opponentName} used Sabotage on one of your tiles! ${playerName}'s turn.`;
        } else if (powerUpType === 'wildcard') {
            applyWildcardEffect(targetCell); // Apply wildcard effect from opponent
            messageElement.textContent = `${opponentName} used Wildcard to claim a tile! ${playerName}'s turn.`;
        } else if (powerUpType === 'teleport') {
            applyTeleportEffect(targetCell); // Apply teleport effect from opponent
            messageElement.textContent = `${opponentName} used Teleport to claim a tile! ${playerName}'s turn.`;
        }

        renderGameBoard();
        updateScoreDisplay();
        updateTurnIndicator();
        resetPowerUpStates(); // Reset power-up states after opponent's move
        playSound('power-up-sound');


        moveHistory.push({
            row: targetRow,
            col: targetCol,
            player: currentPlayer, // Note: currentPlayer was already switched by opponent's move
            color: selectedColor, // Color might not be relevant for power-ups, consider adjusting
            moveType: 'power-up-' + powerUpType,
            powerUp: powerUpType,
            timestamp: Date.now()
        });
        lastMoveType = 'power-up';
    }


    // Online Multiplayer Functions
    function setupOnlineGameElements() {
        isOnlineGame = true; // Set online game mode
        // Hide player name input in online mode
        playerNameContainer.style.display = 'none';
    }

    function initializeOnlineGame(playerNum, gameID, pName, oName) {
        isOnlineGame = true;
        gameId = gameID;
        playerNumber = playerNum;
        playerName = pName || playerNameInput.value.trim() || 'Player ' + playerNum;
        opponentName = oName || 'Opponent';
        currentPlayer = 1; // Game always starts with player 1

        // Set initial player names
        currentPlayerName = playerName;
        opponentPlayerName = opponentName;
        window.playerName = playerName; // Make playerName globally available if needed
        window.opponentName = opponentName; // Make opponentName globally available

        // Update UI to reflect player names and turn
        updateTurnIndicator();
        updateScoreDisplay(); // Initial score display

        // Hide Start Game button for online games, start is initiated by player 1 creating the game
        startGameButton.style.display = 'none';

        if (playerNumber === 2) {
            currentPlayer = 2; // Player 2 starts on their turn in UI but waits for player 1 action to truly begin
            switchTurn(); // Update UI to show it's player 2's turn in the UI (but wait for actual game start)
        } else {
            messageElement.textContent = "Waiting for player 2 to join..."; // Player 1 message
        }

        // Re-render board to ensure it's displayed
        renderGameBoard();
    }


    function getGameState() {
        return {
            board: board,
            currentPlayer: currentPlayer,
            player1Color: player1Color,
            player2Color: player2Color,
            player1Tiles: getPlayerTiles(1),
            player2Tiles: getPlayerTiles(2),
            player1PowerUps: getPowerUpCounts(1),
            player2PowerUps: getPowerUpCounts(2),
            landmines: landmines,
            player1Name: playerName,
            player2Name: opponentName
        };
    }

    function syncGameState(gameState) {
        if (!gameState) {
            console.error("Game state is undefined, cannot sync.");
            return;
        }

        board = gameState.board;
        currentPlayer = gameState.currentPlayer;
        player1Color = gameState.player1Color;
        player2Color = gameState.player2Color;
        player1Score = gameState.player1Tiles ? gameState.player1Tiles.length : 0;
        player2Score = gameState.player2Tiles ? gameState.player2Tiles.length : 0;
        sabotageCount = gameState.player1PowerUps?.sabotage || 2; // Default to 2 if undefined
        wildcardCount = gameState.player1PowerUps?.wildcard || 2;
        teleportCount = gameState.player1PowerUps?.teleport || 2;

        // Update power-up counts in UI
        sabotageCountElement.textContent = sabotageCount;
        wildcardCountElement.textContent = wildcardCount;
        teleportCountElement.textContent = teleportCount;

        landmines = gameState.landmines || []; // Ensure landmines are synced

        // Update player names from gameState if available, to keep names consistent
        if (gameState.player1Name && playerNumber === 1) playerName = gameState.player1Name;
        if (gameState.player2Name && playerNumber === 2) playerName = gameState.player2Name;
        if (gameState.player1Name && playerNumber === 2) opponentName = gameState.player1Name;
        if (gameState.player2Name && playerNumber === 1) opponentName = gameState.player2Name;
        currentPlayerName = currentPlayer === playerNumber ? playerName : opponentName;
        opponentPlayerName = currentPlayer === playerNumber ? opponentName : playerName;
        window.playerName = playerName;
        window.opponentName = opponentName;


        updateScoreDisplay();
        updateTurnIndicator();
        renderGameBoard();

        // After sync, if it's now the current player's turn, provide a turn message
        if (currentPlayer === playerNumber && gameStarted) {
            messageElement.textContent = `Your turn, ${playerName}! Select a color and make your move.`;
        } else if (currentPlayer !== playerNumber && gameStarted) {
            messageElement.textContent = `Waiting for ${opponentName} to make a move...`;
        }
    }

    // Adjust game board size for different orientations or screen sizes if needed
    function resizeGame() {
        const containerWidth = document.getElementById('game-container').offsetWidth;
        canvas.width = containerWidth; // Set canvas width to container width
        canvas.height = containerWidth * 0.85; // Adjust height to maintain aspect ratio
        renderGameBoard(); // Re-render board after resize
        updateTurnIndicator(); // Keep turn indicator updated on resize if needed
    }


    // Public functions to be accessible from multiplayer.js or other scripts
    window.initializeOnlineGame = initializeOnlineGame;
    window.getGameState = getGameState;
    window.syncGameState = syncGameState;
    window.renderGameBoard = renderGameBoard;
    window.resizeGame = resizeGame;
    window.updateScoreDisplay = updateScoreDisplay;
    window.restartGame = restartGame;
    window.handleOpponentMove = handleOpponentMove;
    window.handleOpponentPowerUp = handleOpponentPowerUp;


    // Initial setup and game start
    function init() {
        renderGameBoard();
        updateScoreDisplay();
        updateTurnIndicator();
        hideLandmineInfo();
        resizeGame(); // Initial resize setup
        window.addEventListener('resize', resizeGame); // Handle window resize

        // Set initial player names in UI (for local game mainly, online names will be set by server)
        updatePlayerNamesInScoreboard();
    }


    // Initialize the game when script loads
    document.addEventListener('DOMContentLoaded', init);
})();