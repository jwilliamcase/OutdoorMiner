document.addEventListener('DOMContentLoaded', () => {
    // Add resize event listener to handle responsive canvas
    window.addEventListener('resize', function() {
        resizeGame();
        renderGameBoard();
    });
    // Canvas setup
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    const player1ScoreElement = document.getElementById('your-score');
    const player2ScoreElement = document.getElementById('opponent-score-value');
    const messageElement = document.getElementById('message');
    const turnIndicator = document.getElementById('turn-indicator');
    const currentPlayerElement = document.getElementById('current-player');
    const startGameButton = document.getElementById('start-game');
    const createChallengeButton = document.getElementById('create-challenge');
    // Setup elements
    const setupContainer = document.getElementById('setup-container');
    const playerNameSetupInput = document.getElementById('player-name-setup');
    const startLocalButton = document.getElementById('start-local-game');
    const setupCreateChallengeButton = document.getElementById('setup-create-challenge');
    const challengeCodeSetupInput = document.getElementById('challenge-code-setup');
    const setupJoinChallengeButton = document.getElementById('setup-join-challenge');
    const setupMessageElement = document.getElementById('setup-message');

    // Main Game elements (to show/hide)
    const scoreContainer = document.getElementById('score-container');
    const gameArea = document.getElementById('game-area');
    const colorPalette = document.getElementById('color-palette');
    const gameControls = document.getElementById('game-controls'); // Contains message divs now
    const landmineInfo = document.getElementById('landmine-info');
    const chatContainer = document.getElementById('chat-container');
    const toggleChatButton = document.getElementById('toggle-chat');

    // Game constants
    const BOARD_SIZE = 12; // Increased from 11 to 12 for larger board
    const HEX_SIZE = 30; // Increased size to fill the canvas better
    const HEX_HEIGHT = HEX_SIZE * 2;
    const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
    const BOARD_PADDING = 5; // Slight padding
    const LANDMINE_COUNT = 4; // One mine per quadrant
    
    // Colors for the game - adjusted color palette
    const COLORS = [
        '#F8E9A1', // Soft Yellow
        '#F76C6C', // Salmon Pink
        '#B8E0F6', // Lighter Blue (lightened)
        '#374785', // Medium Blue
        '#0F1A40'  // Navy Blue (darkened)
    ];
    
    // Explosion colors
    const EXPLOSION_COLOR = '#000000'; // Black
    const EXPLOSION_RECOVERY_TURNS = 3; // Number of turns before exploded tiles fully recover
    
// Game state management
class GameState {
    constructor() {
        this.gameBoard = [];
        this.player1Tiles = new Set();
        this.player2Tiles = new Set();
        this.currentPlayer = 1;
        this.player1Color = '';
        this.player2Color = '';
        this.availableColors = [...COLORS];
        this.hoverTile = null;
        this.landmines = [];
        this.explodedTiles = [];
        this.lastMove = null;
        this.moveHistory = [];
        this.gameStarted = false;
        this.gameOver = false;
        this.winner = null;
    }

    serialize() {
        return {
            board: this.gameBoard,
            player1Tiles: Array.from(this.player1Tiles),
            player2Tiles: Array.from(this.player2Tiles),
            currentPlayer: this.currentPlayer,
            player1Color: this.player1Color,
            player2Color: this.player2Color,
            landmines: this.landmines,
            explodedTiles: this.explodedTiles,
            lastMove: this.lastMove,
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            winner: this.winner
        };
    }

    deserialize(data) {
        this.gameBoard = data.board;
        this.player1Tiles = new Set(data.player1Tiles);
        this.player2Tiles = new Set(data.player2Tiles);
        this.currentPlayer = data.currentPlayer;
        this.player1Color = data.player1Color;
        this.player2Color = data.player2Color;
        this.landmines = data.landmines;
        this.explodedTiles = data.explodedTiles;
        this.lastMove = data.lastMove;
        this.gameStarted = data.gameStarted;
        this.gameOver = data.gameOver;
        this.winner = data.winner;
    }

    validateMove(row, col, color) {
        // Check if it's a valid tile
        if (!this.gameBoard[row] || !this.gameBoard[row][col]) {
            return { valid: false, reason: 'Invalid coordinates' };
        }

        // Check if it's the player's turn
        const playerTiles = this.currentPlayer === 1 ? this.player1Tiles : this.player2Tiles;
        if (!playerTiles.has(`${row},${col}`)) {
            return { valid: false, reason: 'Not your territory' };
        }

        // Check if the color is available
        if (!this.availableColors.includes(color)) {
            return { valid: false, reason: 'Color not available' };
        }

        return { valid: true };
    }

    applyMove(row, col, color) {
        const move = {
            row,
            col,
            color,
            player: this.currentPlayer,
            timestamp: Date.now()
        };

        this.lastMove = move;
        this.moveHistory.push(move);

        // Apply the move
        const playerTiles = this.currentPlayer === 1 ? this.player1Tiles : this.player2Tiles;
        const capturable = this.getCaptureableTiles(playerTiles, color);

        // Add captured tiles
        for (const tileKey of capturable) {
            playerTiles.add(tileKey);
        }

        // Update colors
        if (this.currentPlayer === 1) {
            this.player1Color = color;
        } else {
            this.player2Color = color;
        }

        // Switch turns
        this.currentPlayer = 3 - this.currentPlayer;
        this.resetAvailableColors();

        return capturable;
    }
}

// Initialize game state
const gameState = new GameState();
    
    // Power-up system
    const COMBO_THRESHOLD = 4; // Minimum tiles to capture to possibly get a power-up
    const POWER_UPS = {
        SABOTAGE: 'sabotage',
        WILDCARD: 'wildcard',
        TELEPORT: 'teleport'
    };
    let player1PowerUps = []; // Array of power-ups player 1 has available
    let player2PowerUps = []; // Array of power-ups player 2 has available
    let selectedPowerUp = null; // Currently selected power-up
    
    initializeGame(player1NameLocal, player2NameLocal); // Use provided names
}


// Initial setup when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // References to setup elements
    const setupContainer = document.getElementById('setup-container');
    const playerNameInput = document.getElementById('playerNameInput');
    const localGameButton = document.getElementById('localGameButton');
    const createChallengeButton = document.getElementById('createChallengeButton');
    const joinChallengeButton = document.getElementById('joinChallengeButton');
    const setupMessage = document.getElementById('setup-message');

    // References to main game elements that need to be shown/hidden
    const scoreContainer = document.getElementById('score-container');
    const gameArea = document.getElementById('game-area');
    const colorPalette = document.getElementById('color-palette');
    const gameControls = document.getElementById('game-controls');
    const messageDiv = document.getElementById('message'); // Renamed from message
    const landmineInfo = document.getElementById('landmine-info');
    const chatContainer = document.getElementById('chat-container');
    const toggleChatButton = document.getElementById('toggle-chat'); // Added toggle chat button reference

    function showGameUI() {
        setupContainer.style.display = 'none';
        scoreContainer.style.display = 'flex'; // Or 'block' depending on your layout
        gameArea.style.display = 'block';
        colorPalette.style.display = 'flex';
        gameControls.style.display = 'block'; // Or 'flex'
        messageDiv.style.display = 'block';
        landmineInfo.style.display = 'block';
    // Function to initialize or sync the game state for online play
    function initializeOnlineGame(gameState) {
        console.log("Initializing online game with state:", gameState);
        isOnlineGame = true;
        gameBoard = gameState.board;
        scores = gameState.scores;
        playerColors = gameState.playerColors;
        currentPlayerIndex = gameState.currentPlayerIndex;
        playerNames = gameState.playerNames; // Sync player names
        landmines = gameState.landmines || {}; // Sync landmines
        powerUpInventory = gameState.powerUpInventory || initialPowerUpInventory(); // Sync power-ups
        gameActive = gameState.gameActive;
    
        // Determine local player's index and name based on socket ID or other identifier if needed
        // Player name should be set during the setup phase before connection.
        playerIndex = playerNames.findIndex(name => name === playerName);
    
        // Fallback if name isn't found (shouldn't happen in normal flow)
        if (playerIndex === -1) {
            console.warn("Player name not found in game state, attempting identification via socket ID.");
             if (socket && socket.id === gameState.playerSocketIds[0]) {
                playerIndex = 0;
            } else if (socket && socket.id === gameState.playerSocketIds[1]) {
                playerIndex = 1;
            } else {
                 console.error("Could not determine player index. Defaulting to 0.");
                 playerIndex = 0; // Default assumption if name not found and socket ID doesn't match
            }
            // Update playerName if identified via socket ID and name was missing/wrong
            playerName = playerNames[playerIndex];
             createChallenge(playerName); // Call multiplayer function
        opponentPlayerIndex = 1 - playerIndex;
    
        console.log(`Local player determined as Player ${playerIndex + 1} (${playerNames[playerIndex]})`);
    
    
        lastPlayedColor = gameState.lastPlayedColors ? gameState.lastPlayedColors[playerIndex] : null; // Sync last played color for the local player
    
        // Show the game UI now that the game state is received
        showGameUI(); // Defined in DOMContentLoaded listener
    
        setupInitialTiles(); // Make sure starting tiles are correctly owned
            setupMessage.textContent = "Failed to connect to the server. Please try again.";
        updateScoreDisplay();
        updateColorPalette();
        updatePowerUpDisplay(); // Update power-up UI
        updateMessage(`Game started! It's ${playerNames[currentPlayerIndex]}'s turn.`);
            isOnlineGame = false; // Reset flag if connection failed
        updateLandmineInfo(); // Update landmine display
    
        // Disable controls if it's not the local player's turn
        const isMyTurn = currentPlayerIndex === playerIndex;
        enablePlayerControls(isMyTurn);
    
        // Add canvas listeners now that the game is set up
        canvas.removeEventListener('click', handleCanvasClick); // Remove potential duplicates if any
        canvas.removeEventListener('mousemove', handleCanvasMouseMove);
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
    }
        if (!name) {
            setupMessage.textContent = "Please enter your name.";
            setupMessage.style.color = 'red';
            return;
        }
        const gameId = prompt("Enter the Game ID to join:");
        if (!gameId) {
            // Don't show error in setup message, prompt handles cancellation
            return; // Don't proceed if no game ID entered
        }

        isOnlineGame = true; // Set game mode flag
        playerName = name; // Set the global player name

        // Attempt to connect first
        connectToServer().then(() => {
            console.log("Connected to server, joining challenge...");
             // Don't show UI here, wait for 'game-setup' or 'game-state' from server
            joinChallenge(gameId, playerName); // Call multiplayer function
            chatContainer.style.display = 'flex'; // Show chat for online games
        }).catch(error => {
            console.error("Failed to connect to server:", error);
            setupMessage.textContent = "Failed to connect to the server. Please try again.";
            setupMessage.style.color = 'red';
            isOnlineGame = false; // Reset flag if connection failed
        });
    });


    // General listeners (restart, leave, chat toggle) - should be active after game starts
    restartGameButton.addEventListener('click', restartGame);
    leaveGameButton.addEventListener('click', leaveGame);
    toggleChatButton.addEventListener('click', toggleChat);

    // Logic to show game UI is now inside the specific button handlers (local, create, join)
    // or triggered by server events for online games ('game-setup', 'sync-game-state').

});
        
        // Only resize if the container is smaller than canvas size
        if (containerWidth < canvas.width) {
            const scaleFactor = containerWidth / canvas.width;
            canvas.style.width = containerWidth + 'px';
            canvas.style.height = (canvas.height * scaleFactor) + 'px';
        } else {
            canvas.style.width = '';
            canvas.style.height = '';
        }
        
        // Handle Player 2's perspective without rotating the canvas
        if (isOnlineGame && playerNumber === 2) {
            // Transform coordinates instead of rotating canvas
            const transformCoord = (coord, max) => max - coord - 1;
            
            // Apply coordinate transformation for rendering
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const transformedRow = transformCoord(row, BOARD_SIZE);
                    const transformedCol = transformCoord(col, BOARD_SIZE);
                    
                    // Store original coordinates for move handling
                    gameBoard[row][col].originalRow = row;
                    gameBoard[row][col].originalCol = col;
                    
                    // Use transformed coordinates for display
                    gameBoard[row][col].displayRow = transformedRow;
                    gameBoard[row][col].displayCol = transformedCol;
                }
            }
        }
    }
    
    // Create the game board with random colors
    function createGameBoard() {
        gameBoard = [];
        landmines = []; // Clear any existing landmines
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            gameBoard[row] = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                gameBoard[row][col] = {
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    row: row,
                    col: col,
                    hasMine: false
                };
            }
        }
        
        // Place landmines - one in each quadrant
        placeLandminesInQuadrants();
    }
    
    // Place landmines in each quadrant of the board
    function placeLandminesInQuadrants() {
        // Define the quadrants (avoid the very corners where players start)
        // Use Math.floor for consistent integer boundaries
        const halfBoard = Math.floor(BOARD_SIZE/2);
        
        const quadrants = [
            {minRow: 1, maxRow: halfBoard - 1, minCol: 1, maxCol: halfBoard - 1},                // bottom-left quadrant
            {minRow: 1, maxRow: halfBoard - 1, minCol: halfBoard + 1, maxCol: BOARD_SIZE - 2},   // bottom-right quadrant
            {minRow: halfBoard + 1, maxRow: BOARD_SIZE - 2, minCol: 1, maxCol: halfBoard - 1},   // top-left quadrant
            {minRow: halfBoard + 1, maxRow: BOARD_SIZE - 2, minCol: halfBoard + 1, maxCol: BOARD_SIZE - 2} // top-right quadrant
        ];
        
        // Place one mine in each quadrant
        for (const quadrant of quadrants) {
            let placed = false;
            let attempts = 0;
            const maxAttempts = 100; // Prevent infinite loop
            
            while (!placed && attempts < maxAttempts) {
                attempts++;
                
                // Random position within the quadrant
                const row = Math.floor(Math.random() * (quadrant.maxRow - quadrant.minRow + 1)) + quadrant.minRow;
                const col = Math.floor(Math.random() * (quadrant.maxCol - quadrant.minCol + 1)) + quadrant.minCol;
                
                // Make sure the position is valid
                if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
                    continue;
                }
                
                // Make sure this isn't a player's starting position
                if ((row === BOARD_SIZE - 1 && col === 0) || (row === 0 && col === BOARD_SIZE - 1)) {
                    continue;
                }
                
                // Place a mine
                try {
                    gameBoard[row][col].hasMine = true;
                    landmines.push({row, col});
                    placed = true;
                    console.log(`Placed mine at ${row},${col}`);
                } catch (e) {
                    console.error(`Error placing mine at ${row},${col}:`, e);
                }
            }
            
            if (!placed) {
                console.warn(`Failed to place mine in quadrant after ${maxAttempts} attempts`);
            }
        }
    }
    
    // Set up initial player territories
    function setupInitialTiles() {
        // Clear existing territories
        player1Tiles.clear();
        player2Tiles.clear();
        
        // Both players start at bottom left
        const startRow = BOARD_SIZE - 1;
        const startCol = 0;
        player1Color = gameBoard[startRow][startCol].color;
        player1Tiles.add(`${startRow},${startCol}`);
        
        // Player 2 also starts at bottom left (but board is flipped for them visually)
        // Use a different color for player 2
        const differentColors = COLORS.filter(c => c !== player1Color);
        player2Color = differentColors[Math.floor(Math.random() * differentColors.length)];
        
        currentPlayer = 1; // Player 1 starts
    }
    
    // Reset available colors for the new turn
    function resetAvailableColors() {
        availableColors = [...COLORS];
        
        // Players can't select their own current color or opponent's current color
        if (currentPlayer === 1) {
            // Can't select own or opponent's current color
            availableColors = availableColors.filter(c => c !== player1Color && c !== player2Color);
        } else {
            // Can't select own or opponent's current color
            availableColors = availableColors.filter(c => c !== player1Color && c !== player2Color);
        }
    }
    
    // Draw a single hexagon
    function drawHexagon(x, y, size, color, isOwned = false, ownedBy = 0, hasMine = false) {
        const sides = 6;
        const angle = (2 * Math.PI) / sides;
        
        // Save current context state
        ctx.save();
        
        // Drop shadow for all hexagons
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Create hexagon path
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const pointX = x + size * Math.cos(angle * i - Math.PI / 6);
            const pointY = y + size * Math.sin(angle * i - Math.PI / 6);
            if (i === 0) {
                ctx.moveTo(pointX, pointY);
            } else {
                ctx.lineTo(pointX, pointY);
            }
        }
        ctx.closePath();
        
        // Fill the hexagon with 3D lighting effect
        const gradient = ctx.createRadialGradient(
            x - size/4, y - size/4, size/10,  // Inner circle position and radius
            x, y, size                         // Outer circle position and radius
        );
        
        // Create color variations for gradient
        const colorObj = hexToRgb(color);
        const lighterColor = `rgba(${Math.min(colorObj.r + 40, 255)}, ${Math.min(colorObj.g + 40, 255)}, ${Math.min(colorObj.b + 40, 255)}, 1.0)`;
        const darkerColor = `rgba(${Math.max(colorObj.r - 30, 0)}, ${Math.max(colorObj.g - 30, 0)}, ${Math.max(colorObj.b - 30, 0)}, 1.0)`;
        
        // Set gradient colors
        gradient.addColorStop(0, lighterColor);
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, darkerColor);
        
        // Draw a subtle border for definition
        ctx.strokeStyle = '#222'; // Darker border color
        ctx.lineWidth = 0.5; // Fine line
        ctx.stroke();
    
        // Draw highlight if applicable
        if (highlight) {
            ctx.strokeStyle = '#FFFFFF'; // White highlight
            ctx.lineWidth = 2; // Thicker line for highlight
            ctx.stroke();
        }
    
        // Draw outline for unowned tiles
        if (!ownerColor || ownerColor === 'white' || ownerColor === '#FFFFFF') { // Assuming 'white' or hex equivalent is unowned
            ctx.strokeStyle = '#CCCCCC'; // Light gray outline for unowned
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    
    function drawBoard() {
            ctx.beginPath();
            ctx.arc(x, y, size / 3, 0, 2 * Math.PI);
            const ownerColor = ownedBy === 1 ? '#374785' : '#F76C6C';
            
            // Create a radial gradient for the circle
            const circleGradient = ctx.createRadialGradient(
                x, y, 0,
                x, y, size / 3
            );
            circleGradient.addColorStop(0, '#fff');
            circleGradient.addColorStop(0.7, ownerColor);
            circleGradient.addColorStop(1, darkenColor(ownerColor, 0.3));
            ctx.globalAlpha = 1.0; // Reset alpha for fill
            // Set fill style based on owner
            ctx.fillStyle = owner === 0 ? '#CCCCCC' : (owner === 1 ? playerColors[0] : playerColors[1]); // Use playerColors
            ctx.fill();
            // Add a slightly softer, inset-like border for unowned tiles
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; // Dark grey, slightly transparent
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Optional: Add a very subtle inner light line for depth
            // ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            // ctx.lineWidth = 0.5;
            // ctx.stroke();
        }
        
        // We don't visually show the landmines - they're hidden surprises
        // But we could add code here to make them visible for debugging
        
        // Restore context state
        ctx.restore();
    }
    
    // Helper function to convert hex color to RGB
    function hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');
        
        // Parse r, g, b values
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;
        
        return { r, g, b };
    }
    
    // Helper function to darken a color
    function darkenColor(color, amount) {
        // Convert hex to rgb
        let hex = color.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        
        // Darken
        r = Math.max(0, Math.floor(r * (1 - amount)));
        g = Math.max(0, Math.floor(g * (1 - amount)));
        b = Math.max(0, Math.floor(b * (1 - amount)));
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Enhanced board rendering with proper coordinate handling
    function renderGameBoard() {
        // Clear the canvas with a subtle gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ensure gameBoard is initialized
        if (!gameState || !gameState.gameBoard || gameState.gameBoard.length === 0) {
            console.error("RenderGameBoard called before gameBoard was initialized.");
            // Optionally draw a loading message
            ctx.fillStyle = 'black';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading game board...', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Calculate board dimensions and scaling
        const boardPhysicalWidth = (BOARD_SIZE * HEX_WIDTH) + (HEX_WIDTH / 2); // Account for row offsets
        const boardPhysicalHeight = (BOARD_SIZE * HEX_HEIGHT * 0.75) + (HEX_HEIGHT * 0.25);

        // Calculate maximum scaling factor while maintaining aspect ratio
        const xScale = (canvas.width - BOARD_PADDING * 2) / boardPhysicalWidth;
        const yScale = (canvas.height - BOARD_PADDING * 2) / boardPhysicalHeight;
        const scaleFactor = Math.min(xScale, yScale, 1.0); // Cap at 1.0

        // Center the board
        const scaledHexWidth = HEX_WIDTH * scaleFactor;
        const scaledHexHeight = HEX_HEIGHT * scaleFactor;
        const scaledBoardWidth = (BOARD_SIZE * scaledHexWidth) + (scaledHexWidth / 2);
        const scaledBoardHeight = (BOARD_SIZE * scaledHexHeight * 0.75) + (scaledHexHeight * 0.25);

        // Adjust startX/Y to center the hexagonal grid correctly
        const startX = (canvas.width - scaledBoardWidth) / 2 + (scaledHexWidth / 2); // Start drawing from hex center effectively
        const startY = (canvas.height - scaledBoardHeight) / 2 + (scaledHexHeight / 2);

        // Draw board grid (optional background visualization)
        // drawBoardGrid(startX, startY, scaleFactor); // You might need to define this

        // Draw hexagons with proper coordinate transformation
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                 // Ensure tile exists before trying to access properties
                 if (!gameState.gameBoard[row] || !gameState.gameBoard[row][col]) {
                    console.warn(`Tile data missing for ${row}, ${col}`);
                    continue; // Skip rendering this tile
                 }
                const tile = gameState.gameBoard[row][col];
                // Use transformCoordinates for potential player 2 perspective flip
                const { displayRow, displayCol } = transformCoordinates(row, col);

                // Calculate hex center position with proper offset for odd rows
                const x = startX + (displayCol * scaledHexWidth + (displayRow % 2 === 1 ? scaledHexWidth / 2 : 0));
                const y = startY + (displayRow * scaledHexHeight * 0.75);


                // Determine tile ownership and color using gameState
                const tileKey = `${row},${col}`; // Use original row/col for state checking
                const isPlayer1 = gameState.player1Tiles.has(tileKey);
                const isPlayer2 = gameState.player2Tiles.has(tileKey);

                let displayColor;
                 if (isPlayer1 && gameState.player1Color) {
                    displayColor = gameState.player1Color;
                 } else if (isPlayer2 && gameState.player2Color) {
                    displayColor = gameState.player2Color;
                 } else {
                    displayColor = tile.color || '#CCCCCC'; // Fallback color if undefined
                 }


                // Check if this tile is being hovered over (using original row/col)
                const isHovered = gameState.hoverTile && gameState.hoverTile.row === row && gameState.hoverTile.col === col;

                // Calculate hex size with hover effect
                let currentHexSize = HEX_SIZE * scaleFactor;
                if (isHovered) {
                    // Make hovered hexagons slightly larger
                    currentHexSize = currentHexSize * 1.1;
                }

                // Draw the hexagon using the defined function
                drawHexagon(
                    x, y,
                    currentHexSize, // Use potentially larger size for hover
                    displayColor,
                    isPlayer1 || isPlayer2,
                    isPlayer1 ? 1 : (isPlayer2 ? 2 : 0),
                    tile.hasMine // Pass mine status (though not visually shown by default)
                );
            }
        }

        // Draw any active animations (e.g., explosions) - Need definition for drawAnimations()
        // drawAnimations();
    }

    // Transform coordinates based on player perspective
    function transformCoordinates(row, col) {
        // Flips the board visually for player 2 in online games
        if (isOnlineGame && playerNumber === 2) {
            return {
                displayRow: BOARD_SIZE - 1 - row,
                displayCol: BOARD_SIZE - 1 - col
            };
        }
        // Player 1 or local game uses original coordinates
        return { displayRow: row, displayCol: col };
    }

    // Get adjacent tiles (neighbors)
    function getNeighbors(row, col) {
        const neighbors = [];
        // Define the 6 possible directions for hex grid (depends on even/odd row)
        const directions = row % 2 === 0 ? 
            [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]] : // even row
            [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]];    // odd row
            
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            // Check if the neighbor is within the board boundaries
            if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }
        
        return neighbors;
    }
    
    // Get all neighboring tiles that can be captured
    function getCaptureableTiles(playerTiles, targetColor) {
        const capturable = new Set();
        const queue = [];
        const visited = new Set();
        
        // First, find all direct neighbors of owned tiles that match the target color
        for (const tileKey of playerTiles) {
            const [row, col] = tileKey.split(',').map(Number);
            const neighbors = getNeighbors(row, col);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;
                // If this tile is not already owned, not already visited, and matches the target color
                if (!player1Tiles.has(neighborKey) && 
                    !player2Tiles.has(neighborKey) && 
                    !visited.has(neighborKey) &&
                    gameBoard[neighbor.row][neighbor.col].color === targetColor) {
                    capturable.add(neighborKey);
                    queue.push(neighbor);
                    visited.add(neighborKey);
                }
            }
        }
        
        // Now expand to find connected tiles of the same color (flooding algorithm)
        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = getNeighbors(current.row, current.col);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;
                // If not already owned, not visited, and matches our target color
                if (!player1Tiles.has(neighborKey) && 
                    !player2Tiles.has(neighborKey) && 
                    !visited.has(neighborKey) &&
                    gameBoard[neighbor.row][neighbor.col].color === targetColor) {
                    capturable.add(neighborKey);
                    queue.push(neighbor);
                    visited.add(neighborKey);
                }
            }
        }
        
        return capturable;
    }
    
    // Handle explosion when a landmine is hit
    function triggerLandmineExplosion(row, col) {
        // Get all neighboring tiles including the mine tile itself
        const explosionTiles = [...getNeighbors(row, col), {row, col}];
        
        // Play explosion sound if available
        const explosionSound = document.getElementById('explosion-sound');
        if (explosionSound) {
            explosionSound.currentTime = 0;
            explosionSound.play().catch(error => console.log('Error playing sound:', error));
        }
        
        // Animation for explosion
        let explosionStep = 0;
        const totalSteps = 10; // Total animation steps
        
        function animateExplosion() {
            if (explosionStep <= totalSteps) {
                // Clear previous frame
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw the board 
                renderGameBoard();
                
                // Draw explosion effect
                const boardWidth = BOARD_SIZE * HEX_WIDTH;
                const boardHeight = BOARD_SIZE * HEX_HEIGHT * 0.75;
                const startX = (canvas.width - boardWidth) / 2;
                const startY = (canvas.height - boardHeight) / 2;
                
                // Calculate the explosion radius
                const progress = explosionStep / totalSteps;
                const maxRadius = HEX_SIZE * 3.5; // Increased for larger hexagons
                const currentRadius = progress * maxRadius;
                
                // Draw explosion for each affected tile
                for (const tile of explosionTiles) {
                    const x = startX + tile.col * HEX_WIDTH + (tile.row % 2) * (HEX_WIDTH / 2) + BOARD_PADDING;
                    const y = startY + tile.row * (HEX_HEIGHT * 0.75) + BOARD_PADDING;
                    
                    // Create explosion gradient
                    const gradient = ctx.createRadialGradient(
                        x, y, 0,
                        x, y, currentRadius
                    );
                    gradient.addColorStop(0, 'rgba(255, 255, 150, ' + (1 - progress) + ')');
                    gradient.addColorStop(0.5, 'rgba(255, 100, 20, ' + (0.8 - progress) + ')');
                    gradient.addColorStop(1, 'rgba(255, 0, 0, ' + (0.4 - progress) + ')');
                    
                    ctx.beginPath();
                    ctx.fillStyle = gradient;
                    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                explosionStep++;
                requestAnimationFrame(animateExplosion);
            } else {
                // Explosion animation complete, apply the effects
                finishExplosion();
            }
        }
        
        function finishExplosion() {
            // For each affected tile, set to explosion color and remove ownership
            for (const tile of explosionTiles) {
                const tileKey = `${tile.row},${tile.col}`;
                
                // Change color to explosion color (black)
                gameBoard[tile.row][tile.col].color = EXPLOSION_COLOR;
                
                // Remove ownership
                player1Tiles.delete(tileKey);
                player2Tiles.delete(tileKey);
                
                // Add to exploded tiles with recovery countdown
                explodedTiles.push({
                    row: tile.row,
                    col: tile.col,
                    turnsLeft: EXPLOSION_RECOVERY_TURNS
                });
            }
            
            // Clear the mine
            gameBoard[row][col].hasMine = false;
            // Remove from landmines array
            landmines = landmines.filter(mine => !(mine.row === row && mine.col === col));
            
            // Check if any player territories have been split into disconnected segments
            handleDisconnectedTerritories();
            
            // Begin color shuffling animation for all unclaimed tiles
            shuffleUnclaimedTiles(() => {
                // Redraw the board with changes
                renderGameBoard();
                
                // Update score display
                updateScoreDisplay();
                
                // Show message about explosion
                messageElement.textContent = `💥 BOOM! A landmine was triggered! Unclaimed tiles have been shuffled!`;
                
                // Switch turns
                switchPlayerTurn();
            });
        }
        
        // Start explosion animation
        animateExplosion();
    }
    
    // Handle disconnected territories after an explosion
    function handleDisconnectedTerritories() {
        // First, check player 1's territories
        const player1Segments = findDisconnectedSegments(player1Tiles);
        
        // If player 1 has disconnected segments
        if (player1Segments.length > 1) {
            // Keep only the largest segment
            const largestSegment = player1Segments.reduce((largest, current) => 
                current.size > largest.size ? current : largest, player1Segments[0]);
            
            // Create new set with only the largest segment
            const newPlayer1Tiles = new Set();
            for (const tileKey of largestSegment) {
                newPlayer1Tiles.add(tileKey);
            }
            
            // Remove smaller segments (they become unclaimed)
            player1Tiles = newPlayer1Tiles;
        }
        
        // Then check player 2's territories
        const player2Segments = findDisconnectedSegments(player2Tiles);
        
        // If player 2 has disconnected segments
        if (player2Segments.length > 1) {
            // Keep only the largest segment
            const largestSegment = player2Segments.reduce((largest, current) => 
                current.size > largest.size ? current : largest, player2Segments[0]);
            
            // Create new set with only the largest segment
            const newPlayer2Tiles = new Set();
            for (const tileKey of largestSegment) {
                newPlayer2Tiles.add(tileKey);
            }
            
            // Remove smaller segments (they become unclaimed)
            player2Tiles = newPlayer2Tiles;
        }
    }
    
    // Find disconnected segments in a territory
    function findDisconnectedSegments(playerTiles) {
        const segments = [];
        const visited = new Set();
        
        // Iterate through all the player's tiles
        for (const tileKey of playerTiles) {
            // Skip tiles we've already assigned to a segment
            if (visited.has(tileKey)) continue;
            
            // Start a new segment with this tile
            const segment = new Set();
            const queue = [tileKey];
            segment.add(tileKey);
            visited.add(tileKey);
            
            // Use BFS to find all connected tiles
            while (queue.length > 0) {
                const currentTileKey = queue.shift();
                const [row, col] = currentTileKey.split(',').map(Number);
                
                // Get neighbors
                const neighbors = getNeighbors(row, col);
                
                // Check each neighbor
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.row},${neighbor.col}`;
                    
                    // If this neighbor is part of player's territory and not visited yet
                    if (playerTiles.has(neighborKey) && !visited.has(neighborKey)) {
                        queue.push(neighborKey);
                        segment.add(neighborKey);
                        visited.add(neighborKey);
                    }
                }
            }
            
            // Add this segment to our list
            segments.push(segment);
        }
        
        return segments;
    }
    
    // Shuffle colors of unclaimed tiles
    function shuffleUnclaimedTiles(callback) {
        let shuffleCount = 0;
        const shuffleTimes = 10; // Number of rapid shuffles
        const shuffleDelay = 80; // Time between shuffles (ms)
        
        function doShuffle() {
            // If we've completed all shuffles, end the animation
            if (shuffleCount >= shuffleTimes) {
                if (callback) callback();
                return;
            }
            
            // Shuffle colors of all unclaimed tiles
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const tileKey = `${row},${col}`;
                    
                    // Only shuffle unclaimed tiles
                    if (!player1Tiles.has(tileKey) && !player2Tiles.has(tileKey)) {
                        // Skip tiles that are currently exploded (black)
                        if (gameBoard[row][col].color !== EXPLOSION_COLOR) {
                            // Assign a random color from the palette
                            gameBoard[row][col].color = COLORS[Math.floor(Math.random() * COLORS.length)];
                        }
                    }
                }
            }
            
            // Draw the board with new colors
            renderGameBoard();
            
            // Increment counter and schedule next shuffle
            shuffleCount++;
            setTimeout(doShuffle, shuffleDelay);
        }
        
        // Start the shuffle animation
        doShuffle();
    }
    
    // Handle color selection and tile capture
    function handleColorSelection(selectedColor) {
        // In online mode, only allow moves on your turn
        if (isOnlineGame && (currentPlayer !== playerNumber || waitingForOpponent)) {
            messageElement.textContent = "It's not your turn!";
            return;
        }
        
        // Make sure the color is available
        if (!availableColors.includes(selectedColor)) {
            messageElement.textContent = "This color is not available this turn!";
            return;
        }
        
        // Check if this is the same as current color
        const isCurrentColor = (currentPlayer === 1 && selectedColor === player1Color) ||
                               (currentPlayer === 2 && selectedColor === player2Color);
        
        // Update player's color
        if (currentPlayer === 1) {
            player1Color = selectedColor;
        } else {
            player2Color = selectedColor;
        }
        
        // Find tiles to capture
        const playerTiles = currentPlayer === 1 ? player1Tiles : player2Tiles;
        
        // Only check for new tiles if not re-selecting current color
        const capturable = isCurrentColor ? new Set() : getCaptureableTiles(playerTiles, selectedColor);
        
        if (capturable.size === 0 && !isCurrentColor) {
            messageElement.textContent = `No tiles can be captured with this color. Try another!`;
            return;
        }
        
        // In online mode, send the move to the server
        if (isOnlineGame) {
            // Add captured tiles to player's territory before sending
            // so the server and other player get the correct board state
            for (const tileKey of capturable) {
                if (currentPlayer === 1) {
                    player1Tiles.add(tileKey);
                } else {
                    player2Tiles.add(tileKey);
                }
            }
            
            sendMoveToServer(selectedColor);
            
            // Don't proceed with local animations - wait for server update
            updateScoreDisplay();
            return;
        }
        
        // Check if any of the captured tiles has a landmine
        let mineTriggerInfo = null;
        
        for (const tileKey of capturable) {
            const [row, col] = tileKey.split(',').map(Number);
            if (gameBoard[row][col].hasMine) {
                mineTriggerInfo = {row, col};
                break;
            }
        }
        
        // If we triggered a mine, handle that first
        if (mineTriggerInfo) {
            // Capture a single tile to show what happened
            const [mineRow, mineCol] = [mineTriggerInfo.row, mineTriggerInfo.col];
            const mineKey = `${mineRow},${mineCol}`;
            
            if (currentPlayer === 1) {
                player1Tiles.add(mineKey);
            } else {
                player2Tiles.add(mineKey);
            }
            
            renderGameBoard();
            
            // Short delay before explosion
            setTimeout(() => {
                triggerLandmineExplosion(mineRow, mineCol);
            }, 500);
            
            return;
        }
        
        // No mine triggered, proceed with normal capture
        // Capture the tiles with animation
        let captureCount = 0;
        const tilesToCapture = Array.from(capturable);
        
        function animateCapture() {
            if (captureCount < tilesToCapture.length) {
                const tileKey = tilesToCapture[captureCount];
                
                if (currentPlayer === 1) {
                    player1Tiles.add(tileKey);
                } else {
                    player2Tiles.add(tileKey);
                }
                
                captureCount++;
                renderGameBoard();
                
                // Continue animation with slight delay
                setTimeout(animateCapture, 20); // 20ms delay between captures for animation
            } else {
                // Animation complete, finish turn
                // Show which color was selected
                messageElement.textContent = `${currentPlayer === 1 ? 'You' : 'Opponent'} selected ${selectedColor} and captured ${capturable.size} tiles.`;
                
                // Check for power-up eligibility (captured 4+ tiles)
                if (capturable.size >= COMBO_THRESHOLD) {
                    awardPowerUp();
                }
                
                updateScoreDisplay();
                
                // Switch turns
                switchPlayerTurn();
            }
        }
        
        // If re-selecting the same color, just switch turns
        if (isCurrentColor) {
            messageElement.textContent = `${currentPlayer === 1 ? 'You' : 'Opponent'} kept the same color.`;
            updateScoreDisplay();
            switchPlayerTurn();
        } else {
            // Start the animation for capturing new tiles
            animateCapture();
        }
    }
    
    // Award a random power-up to the current player
    function awardPowerUp() {
        // Choose a random power-up type
        const powerUpTypes = Object.values(POWER_UPS);
        const randomPowerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        
        // Add to the current player's power-ups
        if (currentPlayer === 1) {
            player1PowerUps.push(randomPowerUp);
        } else {
            player2PowerUps.push(randomPowerUp);
        }
        
        // Play power-up sound if available
        const powerUpSound = document.getElementById('power-up-sound');
        if (powerUpSound) {
            powerUpSound.currentTime = 0;
            powerUpSound.play().catch(error => console.log('Error playing sound:', error));
        }
        
        // Update the display
        updatePowerUpDisplay();
        
        // Show a message
        messageElement.textContent += ` You earned a ${randomPowerUp.charAt(0).toUpperCase() + randomPowerUp.slice(1)} power-up!`;
    }
    
    // Update the power-up display
    function updatePowerUpDisplay() {
        // Get the power-ups for the current player
        const playerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        
        // Update counts
        const sabotageCount = playerPowerUps.filter(p => p === POWER_UPS.SABOTAGE).length;
        const wildcardCount = playerPowerUps.filter(p => p === POWER_UPS.WILDCARD).length;
        const teleportCount = playerPowerUps.filter(p => p === POWER_UPS.TELEPORT).length;
        
        // Update the display
        document.getElementById('sabotage-count').textContent = sabotageCount;
        document.getElementById('wildcard-count').textContent = wildcardCount;
        document.getElementById('teleport-count').textContent = teleportCount;
        
        // Enable/disable slots based on availability
        const slots = document.querySelectorAll('.power-up-slot');
        slots.forEach(slot => {
            const type = slot.getAttribute('data-type');
            const count = playerPowerUps.filter(p => p === type).length;
            
            // Only enable if player has at least one of this power-up
            if (count > 0) {
                slot.classList.remove('disabled');
            } else {
                slot.classList.add('disabled');
            }
            
            // Remove active state if the selected power-up is no longer available
            if (selectedPowerUp === type && count === 0) {
                selectedPowerUp = null;
            }
            
            // Update active state
            if (selectedPowerUp === type) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }
    
    // Update the turn indicator UI
    function updateTurnIndicator() {
        // Update turn indicator text
        currentPlayerElement.textContent = currentPlayer === 1 ? 'You' : 'Opponent';
        
        // Update turn indicator styling
        turnIndicator.classList.remove('player1-turn', 'player2-turn');
        turnIndicator.classList.add(currentPlayer === 1 ? 'player1-turn' : 'player2-turn');
    }
    
    // Switch to the next player's turn
    function switchPlayerTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        resetAvailableColors();
        setupColorButtons();
        updateTurnIndicator();
        updatePowerUpDisplay(); // Update power-up display for the new current player
        
        // Process exploded tiles recovery
        processExplodedTilesRecovery();
        
        // Check for game over
        if (isGameOver()) {
            endGame();
        }
    }
    
    // Process the recovery of exploded tiles
    function processExplodedTilesRecovery() {
        // Create a new array for tiles that are still recovering
        const stillRecovering = [];
        
        // Process each exploded tile
        for (const tile of explodedTiles) {
            // Decrement turns left for recovery
            tile.turnsLeft--;
            
            // If fully recovered, assign a new random color
            if (tile.turnsLeft <= 0) {
                // Choose a random game color
                const newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                
                // Update the tile color
                gameBoard[tile.row][tile.col].color = newColor;
                
                // We don't add this tile to stillRecovering since it's fully recovered
            } 
            // If still in recovery phase, show partial recovery
            else {
                // Different recovery effects based on type
                if (tile.type === 'sabotage') {
                    // Sabotaged tiles gradually fade from dark red to neutral
                    const recoveryProgress = 1 - (tile.turnsLeft / 3); // 3 is the sabotage recovery turns
                    
                    // Mix dark red with random color based on recovery progress
                    const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                    const targetColorObj = hexToRgb(targetColor);
                    
                    // Start with dark red (139, 0, 0)
                    const r = Math.floor(139 + (targetColorObj.r - 139) * recoveryProgress);
                    const g = Math.floor(0 + (targetColorObj.g - 0) * recoveryProgress);
                    const b = Math.floor(0 + (targetColorObj.b - 0) * recoveryProgress);
                    
                    // Set the transitional color
                    const transitionColor = `rgb(${r}, ${g}, ${b})`;
                    gameBoard[tile.row][tile.col].color = transitionColor;
                } else {
                    // Standard explosion recovery (black to random color)
                    const recoveryProgress = 1 - (tile.turnsLeft / EXPLOSION_RECOVERY_TURNS);
                    
                    // Create a darker color based on recovery progress
                    // As recovery progresses, the tile gets less black and more colorful
                    if (recoveryProgress >= 0.5) {
                        // In the second half of recovery, start introducing a random color
                        const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                        const targetColorObj = hexToRgb(targetColor);
                        
                        // Mix black with the target color based on recovery progress
                        const r = Math.floor(targetColorObj.r * (recoveryProgress - 0.5) * 2);
                        const g = Math.floor(targetColorObj.g * (recoveryProgress - 0.5) * 2);
                        const b = Math.floor(targetColorObj.b * (recoveryProgress - 0.5) * 2);
                        
                        // Set the transitional color
                        const transitionColor = `rgb(${r}, ${g}, ${b})`;
                        gameBoard[tile.row][tile.col].color = transitionColor;
                    }
                }
                
                // Keep this tile in the recovery list
                stillRecovering.push(tile);
            }
        }
        
        // Update the exploded tiles array to only include tiles still recovering
        explodedTiles = stillRecovering;
        
        // Redraw the board to show the changes
        renderGameBoard();
    }
    
    // Check if the game is over (no more tiles to capture)
    function isGameOver() {
        // If either player has no moves, the game is over
        return (getCaptureableTiles(player1Tiles, player1Color).size === 0 &&
                COLORS.every(color => getCaptureableTiles(player1Tiles, color).size === 0)) ||
               (getCaptureableTiles(player2Tiles, player2Color).size === 0 &&
                COLORS.every(color => getCaptureableTiles(player2Tiles, color).size === 0));
    }
    
    // End the game and display results
    function endGame() {
        const player1Score = player1Tiles.size;
        const player2Score = player2Tiles.size;
        
        if (player1Score > player2Score) {
            messageElement.textContent = `Game over! You win ${player1Score} to ${player2Score}!`;
        } else if (player2Score > player1Score) {
            messageElement.textContent = `Game over! Opponent wins ${player2Score} to ${player1Score}.`;
        } else {
            messageElement.textContent = `Game over! It's a tie at ${player1Score} tiles each.`;
        }
        
        // Disable color selection
        document.querySelectorAll('.color-button').forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
        });
    }
    
    // Update score display
    function updateScoreDisplay() {
        const player1Score = player1Tiles.size;
        const player2Score = player2Tiles.size;
        
        // Update score display based on player number
        if (isOnlineGame) {
            // Determine who is player 1 score display and who is player 2 score display
            const player1Display = playerNumber === 1 ? playerName : opponentName;
            const player2Display = playerNumber === 1 ? opponentName : playerName;

            player1ScoreElement.innerHTML = `<span class="player-name ${gameState.currentPlayer === 1 ? 'active-player' : ''}">${player1Display || 'Player 1'}</span>: <span id="your-score">${player1Score}</span>`;
            player2ScoreElement.innerHTML = `<span class="player-name ${gameState.currentPlayer === 2 ? 'active-player' : ''}">${player2Display || 'Player 2'}</span>: <span id="opponent-score-value">${player2Score}</span>`;

            // Update turn indicator text more accurately
             const turnPlayerName = gameState.currentPlayer === playerNumber ? (playerName || 'Your') : (opponentName || 'Opponent');
             currentPlayerElement.textContent = `${turnPlayerName}`; // Removed "'s turn" for brevity

        } else {
            // Local player mode - Use Player 1 / Player 2 if names weren't set (fallback)
            const p1Name = playerName || 'Player 1';
            const p2Name = opponentName || 'Player 2';
            player1ScoreElement.innerHTML = `<span class="player-name ${gameState.currentPlayer === 1 ? 'active-player' : ''}">${p1Name}</span>: <span id="your-score">${player1Score}</span>`;
            player2ScoreElement.innerHTML = `<span class="player-name ${gameState.currentPlayer === 2 ? 'active-player' : ''}">${p2Name}</span>: <span id="opponent-score-value">${player2Score}</span>`;
             const turnPlayerName = gameState.currentPlayer === 1 ? p1Name : p2Name;
             currentPlayerElement.textContent = `${turnPlayerName}`; // Removed "'s turn"
        }
    }
    
    // Set up color buttons
    function setupColorButtons() {
        document.querySelectorAll('.color-button').forEach(button => {
            const color = button.getAttribute('data-color');
            const swatch = button.closest('.color-swatch');
            
            // Disable colors that aren't available
            if (availableColors.includes(color)) {
                button.disabled = false;
                button.classList.remove('disabled');
                swatch.classList.remove('disabled');
            } else {
                button.disabled = true;
                button.classList.add('disabled');
                swatch.classList.add('disabled');
            }
            
            // Highlight current player's turn
            swatch.classList.toggle('current-player', currentPlayer === 1 && !button.disabled);
            swatch.classList.toggle('opponent-player', currentPlayer === 2 && !button.disabled);
        });
    }
    
    // Find the hex tile at a specific canvas position
    function findHexAtPosition(x, y) {
        // Calculate board position and scaling factor
        const boardWidth = BOARD_SIZE * HEX_WIDTH;
        const boardHeight = BOARD_SIZE * HEX_HEIGHT * 0.75;
        
        // Calculate scaling factor (same as in renderGameBoard)
        const xScale = (canvas.width - BOARD_PADDING * 2) / boardWidth;
        const yScale = (canvas.height - BOARD_PADDING * 2) / boardHeight;
        const scaleFactor = Math.min(xScale, yScale, 1.0);
        
        // Apply the scaling to center the board
        const scaledWidth = boardWidth * scaleFactor;
        const scaledHeight = boardHeight * scaleFactor;
        const startX = (canvas.width - scaledWidth) / 2;
        const startY = (canvas.height - scaledHeight) / 2;
        
        // Find the closest hexagon to the click point
        let minDistance = Infinity;
        let closestHex = null;
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const hexX = startX + (col * HEX_WIDTH + (row % 2) * (HEX_WIDTH / 2)) * scaleFactor + BOARD_PADDING;
                const hexY = startY + (row * (HEX_HEIGHT * 0.75)) * scaleFactor + BOARD_PADDING;
                
                const distance = Math.sqrt(Math.pow(hexX - x, 2) + Math.pow(hexY - y, 2));
                // Use scaled hex size for distance check
                if (distance < minDistance && distance < HEX_SIZE * scaleFactor) {
                    minDistance = distance;
                    closestHex = { row, col };
                }
            }
        }
        
        return closestHex;
    }
    
    // Setup Power-Up listeners
    function setupPowerUpListeners() {
        const powerUpSlots = document.querySelectorAll('.power-up-slot');
        
        powerUpSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                const powerUpType = slot.getAttribute('data-type');
                const currentPlayerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
                
                // Make sure it's the player's turn
                if (isOnlineGame && currentPlayer !== playerNumber) {
                    messageElement.textContent = "It's not your turn!";
                    return;
                }
                
                // Check if player has this power-up
                if (!currentPlayerPowerUps.includes(powerUpType)) {
                    return; // No power-up available
                }
                
                // Toggle power-up selection
                if (selectedPowerUp === powerUpType) {
                    selectedPowerUp = null;
                    messageElement.textContent = "Power-up deselected.";
                } else {
                    selectedPowerUp = powerUpType;
                    messageElement.textContent = `${powerUpType.charAt(0).toUpperCase() + powerUpType.slice(1)} power-up selected. Click on a tile to use it.`;
                }
                
                // Update the display
                updatePowerUpDisplay();
            });
        });
    }
    
    // Handle canvas click events
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        const closestHex = findHexAtPosition(clickX, clickY);
        
        // If a power-up is selected, handle power-up usage
        if (selectedPowerUp && closestHex) {
            usePowerUp(selectedPowerUp, closestHex.row, closestHex.col);
            return;
        }
        
        // Debug: Show info about the clicked tile
        if (closestHex) {
            const { row, col } = closestHex;
            const tile = gameBoard[row][col];
            const isPlayer1 = player1Tiles.has(`${row},${col}`);
            const isPlayer2 = player2Tiles.has(`${row},${col}`);
            
            console.log(`Clicked tile: (${row}, ${col})`);
            console.log(`Color: ${tile.color}`);
            console.log(`Owner: ${isPlayer1 ? 'Player 1' : isPlayer2 ? 'Player 2' : 'None'}`);
            console.log(`Has mine: ${tile.hasMine ? 'Yes' : 'No'}`);
        }
    });
    
    // Use a power-up on a specific tile
    function usePowerUp(powerUpType, row, col) {
        const tileKey = `${row},${col}`;
        const isPlayer1Owned = player1Tiles.has(tileKey);
        const isPlayer2Owned = player2Tiles.has(tileKey);
        const isOwnedByCurrentPlayer = (currentPlayer === 1 && isPlayer1Owned) || (currentPlayer === 2 && isPlayer2Owned);
        const isOwnedByOpponent = (currentPlayer === 1 && isPlayer2Owned) || (currentPlayer === 2 && isPlayer1Owned);
        
        switch (powerUpType) {
            case POWER_UPS.SABOTAGE:
                // Can only use on opponent's territory
                if (!isOwnedByOpponent) {
                    messageElement.textContent = "Sabotage can only be used on opponent's territory!";
                    return;
                }
                
                applySabotage(row, col);
                break;
                
            case POWER_UPS.WILDCARD:
                // Can only use on unclaimed tiles adjacent to owned territory
                if (isPlayer1Owned || isPlayer2Owned) {
                    messageElement.textContent = "Wildcard can only be used on unclaimed tiles!";
                    return;
                }
                
                // Check if adjacent to current player's territory
                const neighbors = getNeighbors(row, col);
                let isAdjacentToOwn = false;
                
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.row},${neighbor.col}`;
                    if ((currentPlayer === 1 && player1Tiles.has(neighborKey)) || 
                        (currentPlayer === 2 && player2Tiles.has(neighborKey))) {
                        isAdjacentToOwn = true;
                        break;
                    }
                }
                
                if (!isAdjacentToOwn) {
                    messageElement.textContent = "Wildcard must be adjacent to your territory!";
                    return;
                }
                
                applyWildcard(row, col);
                break;
                
            case POWER_UPS.TELEPORT:
                // Can use on any unclaimed tile
                if (isPlayer1Owned || isPlayer2Owned) {
                    messageElement.textContent = "Teleport can only be used on unclaimed tiles!";
                    return;
                }
                
                applyTeleport(row, col);
                break;
        }

        // Consume the power-up
        const playerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        const powerUpIndex = playerPowerUps.indexOf(powerUpType);
        if (powerUpIndex !== -1) {
            playerPowerUps.splice(powerUpIndex, 1);
        }

        // Reset selected power-up
        selectedPowerUp = null;

        // Update display and switch turns (unless handled within the specific power-up function)
        updatePowerUpDisplay();
        renderGameBoard();
        updateScoreDisplay();

        // Sabotage applies effect and switches turn itself
        if (powerUpType !== POWER_UPS.SABOTAGE) {
             // If online, send move to server
             if (isOnlineGame) {
                sendPowerUpToServer(powerUpType, row, col);
                // Don't switch turn locally, wait for server update
             } else {
                // Switch turn locally for offline game
                switchPlayerTurn();
             }
        }
    }

    // Apply sabotage power-up (convert opponent territory to neutral over time)
    function applySabotage(row, col) {
        const tileKey = `${row},${col}`;

        // Remove from opponent's territory
        if (currentPlayer === 1) {
            player2Tiles.delete(tileKey);
        } else {
            player1Tiles.delete(tileKey);
        }

        // Change the tile color to indicate sabotage (dark red)
        gameBoard[row][col].color = '#8B0000';

        // Add to exploded tiles with longer recovery time (sabotage lasts longer)
        explodedTiles.push({
            row: row,
            col: col,
            turnsLeft: 3, // 3 turns to recover
            type: 'sabotage'
        });

        messageElement.textContent = "Sabotage successful! Territory will return to neutral over time.";

        // If online, send move to server
        if (isOnlineGame) {
            sendPowerUpToServer(POWER_UPS.SABOTAGE, row, col);
            // Don't switch turn locally, wait for server update
        } else {
            // Switch turn locally for offline game
            switchPlayerTurn();
        }
    }

    // Apply wildcard power-up (claim an adjacent unclaimed tile)
    function applyWildcard(row, col) {
        const tileKey = `${row},${col}`;

        // Add to player's territory
        if (currentPlayer === 1) {
            player1Tiles.add(tileKey);
        } else {
            player2Tiles.add(tileKey);
        }

        // Set tile to player's current color
        gameBoard[row][col].color = currentPlayer === 1 ? player1Color : player2Color;

        messageElement.textContent = "Wildcard used! Tile claimed.";
    }

    // Apply teleport power-up (start a new territory base on any unclaimed tile)
    function applyTeleport(row, col) {
        const tileKey = `${row},${col}`;

        // Add to player's territory
        if (currentPlayer === 1) {
            player1Tiles.add(tileKey);
        } else {
            player2Tiles.add(tileKey);
        }

        // Set tile to player's current color
        gameBoard[row][col].color = currentPlayer === 1 ? player1Color : player2Color;

        messageElement.textContent = "Teleport successful! New territory started.";
        // No powerup logic specific implementation details here.
        // Actual application logic is in applyWildcard/applyTeleport
   function initializeGame(initialSetup = {}) {

    // Initial setup for the game board.
   function initializeGame(initialServerState = null) {
        // Reset core game state variables
        gameState.gameBoard = [];
        gameState.player1Tiles = new Set();
        gameState.player2Tiles = new Set();
        gameState.currentPlayer = 1;
        gameState.player1Color = '';
        gameState.player2Color = '';
        gameState.availableColors = [...COLORS];
        gameState.hoverTile = null;
        gameState.landmines = [];
        gameState.explodedTiles = [];
        gameState.lastMove = null;
        gameState.moveHistory = [];
        gameState.gameStarted = false;
        gameState.gameOver = false;
        gameState.winner = null;

        player1PowerUps = []; // Reset local power-up tracking
        player2PowerUps = [];
        selectedPowerUp = null;

        if (isOnlineGame && initialServerState) {
            // Sync with server state if provided (e.g., on game start or restart)
            window.syncGameState(initialServerState);
            gameState.gameStarted = true; // Mark game as started
        } else {
            // Local game or initial setup before server state arrives
            createGameBoard(); // Create board structure and place mines
            setupInitialTiles(); // Set starting positions and colors
            resetAvailableColors();
            gameState.gameStarted = !isOnlineGame; // Start immediately if local game
        }
        // Correct for canvas scaling if applicable (using style vs width/height)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (event.clientX - rect.left) * scaleX;
        const clickY = (event.clientY - rect.top) * scaleY;
        renderGameBoard(); // Draw the initial board
        updateTurnIndicator();

        if (isOnlineGame && waitingForOpponent) {
            console.log("Ignoring click, waiting for opponent.");
        // Use gameState.hoverTile
        if (gameState.hoverTile) {
            gameState.hoverTile = null;
            renderGameBoard();
        }



        setupColorButtons();
            console.log(`Clicked Hex: (${clickedHex.row}, ${clickedHex.col})`);
            // If a power-up is selected, cancel it before selecting color
            if (selectedPowerUp) {
                selectedPowerUp = null;
                updatePowerUpDisplay();
                messageElement.textContent = "Power-up deselected. Choose a color.";
                return;
            }
            // Handle power-up usage if one is selected
        updatePowerUpDisplay(); // Show initial power-ups (likely none)
                 // Check if it's the player's turn (relevant for online)
                 if (isOnlineGame && gameState.currentPlayer !== playerNumber) {

                    return;
                 }
                usePowerUp(selectedPowerUp, clickedHex.row, clickedHex.col);
        // Set initial message
                // If no power-up selected, treat as potential debug info click
                // (Color selection is handled by buttons now)
        opponentName = 'Player 2'; // Set default opponent name for local
        // Pass null to initializeGame for local mode
        initializeGame(null);
        messageElement.textContent = "Started Outdoor Miner in local mode. Player 1's turn.";
                 const isPlayer1 = gameState.player1Tiles.has(`${row},${col}`);

    // Setup button listeners are added further down in DOMContentLoaded

    // Helper function to generate a simple game code (fallback if server fails)
    function generateGameCode() {
        // In a real implementation, this would generate a unique ID or get one from the server
        return Math.floor(100000 + Math.random() * 900000); // 6-digit code
    }

    // Send a standard color selection move to the server
    function sendMoveToServer(selectedColor) {
        // Don't send if not an online game or no window.sendMove function
        if (!isOnlineGame || !window.sendMove) return;

        console.log(`NETWORK: Player ${playerNumber} selected color: ${selectedColor}`);
        console.log(`NETWORK: Player 1 has ${gameState.player1Tiles.size} tiles, Player 2 has ${gameState.player2Tiles.size} tiles`);
        console.log(`NETWORK: Game ID: ${gameId}`);

        // Prepare move data using gameState
        const moveData = {
            type: 'color-selection',
            color: selectedColor,
            player1Tiles: Array.from(gameState.player1Tiles), // Send updated tiles
            player2Tiles: Array.from(gameState.player2Tiles),
            player1Color: gameState.player1Color, // Send updated colors
            player2Color: gameState.player2Color,
            playerName: playerName // Include sender's name
        };

        // Log full move data
        console.log("Move data being sent:", JSON.stringify(moveData));

        // Set waiting state
        waitingForOpponent = true;
        disableControls(); // Disable controls while waiting for server response
        messageElement.textContent = "Waiting for opponent...";


        // Send move to server using the multiplayer client
        window.sendMove(moveData);
    }

    // Send a power-up move to the server
    function sendPowerUpToServer(powerUpType, row, col) {
        if (!isOnlineGame || !window.sendMove) return;

        console.log(`NETWORK: Player ${playerNumber} used ${powerUpType} at (${row}, ${col})`);
        console.log(`NETWORK: Game ID: ${gameId}`);

        // Prepare move data using gameState
        const moveData = {
            type: 'power-up',
            powerUpType: powerUpType,
            row: row,
            col: col,
            player1Tiles: Array.from(gameState.player1Tiles), // Send updated tiles
            player2Tiles: Array.from(gameState.player2Tiles),
            player1PowerUps: player1PowerUps, // Send updated power-up lists
            player2PowerUps: player2PowerUps,
            landmines: gameState.landmines, // Send potentially updated mines (e.g., if teleport reveals one)
            playerName: playerName // Include sender's name
        };

         // If sabotage, include the updated board state as the color changed
         if (powerUpType === POWER_UPS.SABOTAGE) {
             moveData.updatedBoard = gameState.gameBoard; // Send board because color changed
         }


        console.log("Power-up move data being sent:", JSON.stringify(moveData));

        // Set waiting state
        waitingForOpponent = true;
        disableControls();
        messageElement.textContent = "Waiting for opponent...";

        // Send move to server
        window.sendMove(moveData);
    }

    // Send a landmine trigger event to the server
    function sendLandmineTriggerToServer(row, col) {
        if (!isOnlineGame || !window.sendMove) return;

        console.log(`NETWORK: Player ${playerNumber} triggered landmine at (${row}, ${col})`);
        console.log(`NETWORK: Game ID: ${gameId}`);

        // Prepare data - include board state *after* explosion effects applied locally
        // (color change, ownership removal, mine removal)
        const moveData = {
            type: 'landmine',
            row: row,
            col: col,
            player1Tiles: Array.from(gameState.player1Tiles),
            player2Tiles: Array.from(gameState.player2Tiles),
            landmines: gameState.landmines, // Mines list updated locally
            updatedBoard: gameState.gameBoard, // Board updated locally
            playerName: playerName
        };

        console.log("Landmine trigger data being sent:", JSON.stringify(moveData));

        // Set waiting state
        waitingForOpponent = true;
        disableControls();
        messageElement.textContent = "Waiting for opponent...";

        // Send event to server
        window.sendMove(moveData);
    }

<<<<<<< HEAD
    // Initialize the game for online play
    window.initializeOnlineGame = function(pNumber, gId, pName) {
=======
    // Initialize the game for online play - now accepts opponentName
    window.initializeOnlineGame = function(pNumber, gId, pName, oName) {
>>>>>>> parent of 10af48f (gamestate tracking)
        // Set multiplayer variables
                 console.log(`Color: ${tile.color}`);
        playerNumber = pNumber;
        messageElement.innerHTML += `<br><span class="online-note">Share this code with your opponent. Currently simulating online play.</span>`;
        
        // Show the URL that could be shared (would redirect to a page with the game code pre-filled)
        const shareUrl = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
        console.log(`Share this URL: ${shareUrl}`);
    });
    
    connectChallengeButton.addEventListener('click', () => {
        const enteredCode = challengeCodeInput.value.trim();
        if (enteredCode) {
            // Join an existing game
            isOnlineGame = true;
            playerNumber = 2;
            gameId = enteredCode;
            
            // In a real implementation, we would fetch the game state from the server here
            // For now, we'll simulate joining a game
            messageElement.textContent = `Connected to game with code: ${gameId}`;
            messageElement.innerHTML += `<br><span class="online-note">Currently simulating online play.</span>`;
            
            // Initialize a new game (in a real implementation, we'd use the state from the server)
            initializeGame();
            
            // Since we're player 2, switch to player 1's turn
            currentPlayer = 1;
            setupColorButtons();
        } else {
            messageElement.textContent = "Please enter a challenge code.";
        }
    });
    
    
    // Helper function to generate a simple game code
    function generateGameCode() {
        // In a real implementation, this would generate a unique ID or get one from the server
        return Math.floor(100000 + Math.random() * 900000); // 6-digit code
    }
    
    // Send a move to the server
    function sendMoveToServer(selectedColor) {
        // Don't send if not an online game
        if (!isOnlineGame || !window.sendMove) return;
        
        console.log(`NETWORK: Player ${playerNumber} selected color: ${selectedColor}`);
        console.log(`NETWORK: Player 1 has ${player1Tiles.size} tiles, Player 2 has ${player2Tiles.size} tiles`);
        console.log(`NETWORK: Game ID: ${gameId}`);
        
        // Prepare move data
        const moveData = {
            type: 'color-selection',
            color: selectedColor,
            player1Tiles: Array.from(player1Tiles),
            player2Tiles: Array.from(player2Tiles),
            playerName: playerName
        };
        
        // Add the player colors to ensure they're synced properly
        moveData.player1Color = player1Color;
        moveData.player2Color = player2Color;
        
        // Log full move data
        console.log("Move data being sent:", JSON.stringify(moveData));
        
        // Set waiting state
        waitingForOpponent = true;
        
    }

    // Initialize the game for online play - Called by multiplayer.js after connection/setup
    // It now primarily sets online-specific variables and relies on syncGameState for board setup.
    window.initializeOnlineGame = function(pNumber, gId, pName, oName = '') {
        console.log(`Setting up online game specifics. Player: ${pNumber}, Game: ${gId}, Name: ${pName}, Opponent: ${oName}`);

        isOnlineGame = true;
        playerNumber = pNumber;
        gameId = gId;
        playerName = pName; // Name is already set from setup screen
        opponentName = oName || (playerNumber === 1 ? 'Player 2' : 'Player 1'); // Get opponent name if provided

        // Make names globally accessible
        window.playerName = playerName;
        window.opponentName = opponentName;

        // Show the game screen elements (board might still be empty until sync)
        showGameScreen();

        // Update score display with names immediately
        updateScoreDisplay();
        updateTurnIndicator(); // Set initial turn indicator

        // Message indicating connection success, waiting for game state/start
        messageElement.textContent = `Connected to game ${gId}! Waiting for opponent/state...`;
        disableControls(); // Start disabled until server confirms turn/state

        // IMPORTANT: Actual game board state (tiles, colors, etc.)
        // is now set via window.syncGameState when the server sends it.
        // We don't call the full initializeGame() here anymore to avoid overwriting.
    };

    // Get current game state for sending initial state (Player 1 only)
    window.getGameStateForServer = function() {
        console.log("Getting initial game state to send to server");
        console.log("P1 tiles:", gameState.player1Tiles.size, "P2 tiles:", gameState.player2Tiles.size);
        console.log("Mines:", gameState.landmines.length);

        // Use the gameState object
        return {
            board: gameState.gameBoard,
            currentPlayer: gameState.currentPlayer,
            player1Color: gameState.player1Color,
            player2Color: gameState.player2Color,
            player1Tiles: Array.from(gameState.player1Tiles),
            player2Tiles: Array.from(gameState.player2Tiles),
            player1PowerUps: player1PowerUps, // Use local tracking for initial state
            player2PowerUps: player2PowerUps,
            landmines: gameState.landmines,
            // Player 1 includes their name when creating
            player1Name: playerName
        };
    };

    // Sync game state from server data
    window.syncGameState = function(serverState) {
        console.log("Syncing game state from server:", serverState);
        // Ensure we have a board to work with
        if (!serverState || !serverState.board) {
            console.error("Cannot sync game state, server data is incomplete:", serverState);
            return;
        }

        // Update core game state from server data
        gameState.gameBoard = JSON.parse(JSON.stringify(serverState.board)); // Deep copy
        gameState.currentPlayer = serverState.currentPlayer;
        gameState.player1Color = serverState.player1Color;
        gameState.player2Color = serverState.player2Color;
        gameState.player1Tiles = new Set(serverState.player1Tiles || []);
        gameState.player2Tiles = new Set(serverState.player2Tiles || []);
        gameState.landmines = serverState.landmines || [];
        gameState.gameStarted = true; // Mark game as started on first sync

        // Sync power-ups (use local arrays)
        player1PowerUps = serverState.player1PowerUps || [];
        player2PowerUps = serverState.player2PowerUps || [];

        // Update player names (ensure consistency)
        if (serverState.player1Name) {
             if (playerNumber === 1) playerName = serverState.player1Name;

        // Refresh UI elements
        resetAvailableColors(); // Based on new player colors and current player
        setupColorButtons();
             else opponentName = serverState.player2Name;
        }
        window.playerName = playerName;
        renderGameBoard(); // Redraw the board with synced state

        // Ensure correct orientation (resize handles this if needed)
        resizeGame();

        // Update controls based on whose turn it is
        if (gameState.currentPlayer === playerNumber) {
            waitingForOpponent = false;
            enableControls();
            messageElement.textContent = "It's your turn!";
        } else {
            waitingForOpponent = true;
            disableControls();
            messageElement.textContent = `${opponentName || 'Opponent'}'s turn.`;
        }

        console.log(`After sync - Current: P${gameState.currentPlayer}. You are P${playerNumber}`);
        console.log(`Scores: P1 ${gameState.player1Tiles.size}, P2 ${gameState.player2Tiles.size}`);
        console.log(`Names: You (${playerName}), Opponent (${opponentName})`);

        // Ensure game screen is visible after sync
        showGameScreen();
    };

    // Disable game controls (color buttons, power-ups)
    function disableControls() {
        document.querySelectorAll('.color-button').forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            button.closest('.color-swatch').classList.add('disabled');
        });
        document.querySelectorAll('.power-up-slot').forEach(slot => {
            slot.classList.add('disabled'); // Visually disable, click handler also checks turn
        });
        canvas.style.cursor = 'default'; // Change cursor when disabled
    }

    // Enable game controls
    function enableControls() {
        setupColorButtons(); // Re-evaluates which colors are available and enables them
        updatePowerUpDisplay(); // Re-evaluates which power-ups are available
        canvas.style.cursor = 'pointer'; // Restore pointer cursor
    }


    // Handle game restarted event from server
    window.handleGameRestarted = function(serverState) {
        console.log("Handling game restarted event from server", serverState);
        if (isOnlineGame) {
             // Remove play again button if it exists
            const playAgainButton = document.getElementById('play-again-button');
            if(playAgainButton) playAgainButton.remove();

            // Sync to the new state provided by the server
            window.syncGameState(serverState);
            messageElement.textContent = `Game restarted! ${gameState.currentPlayer === playerNumber ? "Your" : opponentName+"'s"} turn.`;
        }
    };


    // Handle player disconnected event
    function handlePlayerDisconnected(data) {


        // Re-initialize the game locally (server dictates initial state)
        initializeGame(null); // Pass null, wait for server state update

        // Update UI text
        messageElement.textContent = "Game restarted! Waiting for server update...";
        disableControls(); // Disable controls until state is synced
    }

    // Handle player disconnected event
    function handlePlayerDisconnected(data) {
        console.log('Player disconnected:', data);
        if (isOnlineGame) {
            messageElement.textContent = `${opponentName || `Player ${data.playerNumber}`} has disconnected! Game ended.`;
            opponentName = ''; // Clear opponent name
             window.opponentName = '';
            updateScoreDisplay(); // Update display to reflect missing opponent
            disableControls(); // Disable game controls
            isOnlineGame = false; // Consider the online session over
            gameId = null;
            // Optionally show a button to return to main menu or start new game
        }
    }

    // Handle receiving a chat message
    function handleReceiveMessage(data) {
        console.log('Message received:', data);
    }
    
    // Add a function to handle game replay
    window.restartGame = function() {
        console.log("Restarting game...");
        
        // Swap who goes first
        if (isOnlineGame) {
            // If this was player 1, now become player 2 and vice versa
            playerNumber = playerNumber === 1 ? 2 : 1;
        }
        
        // Reset the game state
        initializeGame();
        
        // If online game, notify the other player
        if (isOnlineGame && window.sendMove) {
            window.sendMove({
                type: 'restart-game',
                playerNumber: playerNumber
            });
        }
        
        messageElement.textContent = "Game restarted! " + 
            (currentPlayer === playerNumber ? "Your" : "Opponent's") + " turn.";
    };
    
    // Add a Play Again button at the end of the game
    function showPlayAgainButton() {
        const existingButton = document.getElementById('play-again-button');
        
        if (!existingButton) {
            const playAgainButton = document.createElement('button');
            // Function to start or join a multiplayer game.
        function initializeOnlineGame() {
            // Generate a unique game ID if the player is creating a new game.
            gameId = isCreatingGame ? generateGameId() : document.getElementById('game-id-input').value;
            playerName = document.getElementById('player-name-input').value || 'Player ' + playerNumber; // Default name
    
            showGameScreen();
            // Join the game room.
            socket.emit('initialize-game', { gameId: gameId, playerName: playerName, singlePlayer: false });
            document.getElementById('game-id-display').textContent = "Game ID: " + gameId;
            document.getElementById('player-name').textContent = playerName; // Ensure the player's name is displayed.

        }
    // initializeGame(); // Don't call initializeGame here anymore, wait for user setup interaction

    // --- Setup Screen Event Listeners ---
    startLocalButton.addEventListener('click', () => {
        const name = playerNameSetupInput.value.trim();
        if (!name) {
            setupMessageElement.textContent = "Please enter your name.";
            return;
        }
        setupMessageElement.textContent = ""; // Clear message
        initializeGame(false, name, 'Player 2'); // Start local game
    });

    setupCreateChallengeButton.addEventListener('click', () => {
        const name = playerNameSetupInput.value.trim();
        if (!name) {
            setupMessageElement.textContent = "Please enter your name.";
            return;
        }
        setupMessageElement.textContent = "Creating challenge...";
        playerName = name; // Set player name now
        window.playerName = name; // Make available globally
        // Trigger multiplayer logic to create game (multiplayer.js)
        if (window.createGame) {
            window.createGame(name);
            // initializeOnlineGame will be called by multiplayer.js on success
        } else {
            setupMessageElement.textContent = "Error: Multiplayer function not available.";
        }
    });

    setupJoinChallengeButton.addEventListener('click', () => {
        const name = playerNameSetupInput.value.trim();
        const code = challengeCodeSetupInput.value.trim();
        if (!name) {
            setupMessageElement.textContent = "Please enter your name.";
            return;
        }
        if (!code) {
            setupMessageElement.textContent = "Please enter a challenge code.";
            return;
        }
        setupMessageElement.textContent = `Joining game ${code}...`;
        playerName = name; // Set player name now
        window.playerName = name; // Make available globally
        // Trigger multiplayer logic to join game (multiplayer.js)
        if (window.joinGame) {
            window.joinGame(code, name);
             // initializeOnlineGame will be called by multiplayer.js on success
        } else {
            setupMessageElement.textContent = "Error: Multiplayer function not available.";
        }
    });

    // Show setup screen on initial load
    showSetupScreen();

});