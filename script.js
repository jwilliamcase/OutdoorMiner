// ============================================================================
// Global Variables & Constants
// ============================================================================

// Game constants
const BOARD_SIZE = 12; // Increased from 11 to 12 for larger board
const HEX_SIZE = 30; // Increased size to fill the canvas better
const HEX_HEIGHT = HEX_SIZE * 2;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const BOARD_PADDING = 5; // Slight padding
const LANDMINE_COUNT = 4; // One mine per quadrant
const COLORS = [ // Adjusted color palette
    '#F8E9A1', // Soft Yellow
    '#F76C6C', // Salmon Pink
    '#B8E0F6', // Lighter Blue (lightened)
    '#374785', // Medium Blue
    '#0F1A40'  // Navy Blue (darkened)
];
const EXPLOSION_COLOR = '#000000'; // Black
const EXPLOSION_RECOVERY_TURNS = 3; // Number of turns before exploded tiles fully recover
const COMBO_THRESHOLD = 4; // Minimum tiles to capture to possibly get a power-up
const POWER_UPS = {
    SABOTAGE: 'sabotage',
    WILDCARD: 'wildcard',
    TELEPORT: 'teleport'
};

// DOM Element References (initialized in DOMContentLoaded)
let canvas, ctx, player1ScoreElement, player2ScoreElement, messageElement, turnIndicator, currentPlayerElement;
let setupContainer, playerNameSetupInput, startLocalButton, setupCreateChallengeButton, challengeCodeSetupInput, setupJoinChallengeButton, setupMessageElement;
let scoreContainer, gameArea, colorPalette, gameControls, landmineInfo, chatContainer, toggleChatButton, leaveGameButton; // Added leaveGameButton

// ============================================================================
// Game State Class
// ============================================================================
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.gameBoard = [];
        this.player1Tiles = new Set();
        this.player2Tiles = new Set();
        this.currentPlayer = 1;
        this.player1Color = '';
        this.player2Color = '';
        this.availableColors = [...COLORS];
        this.hoverTile = null; // { row, col }
        this.landmines = []; // { row, col }
        this.explodedTiles = []; // { row, col, turnsLeft, type? }
        this.lastMove = null;
        this.moveHistory = [];
        this.gameStarted = false;
        this.gameOver = false;
        this.winner = null;
    }

    serialize() {
        // Basic serialization, consider refining if needed
        return {
            board: this.gameBoard, // Note: This could be large
            player1Tiles: Array.from(this.player1Tiles),
            player2Tiles: Array.from(this.player2Tiles),
            currentPlayer: this.currentPlayer,
            player1Color: this.player1Color,
            player2Color: this.player2Color,
            landmines: this.landmines,
            explodedTiles: this.explodedTiles,
            // lastMove and moveHistory might not be needed by server always
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            winner: this.winner
            // Note: Does not include power-ups managed outside the class currently
        };
    }

    deserialize(data) {
        // Basic deserialization, consider refining
        if (!data) return;
        this.gameBoard = data.board || [];
        this.player1Tiles = new Set(data.player1Tiles || []);
        this.player2Tiles = new Set(data.player2Tiles || []);
        this.currentPlayer = data.currentPlayer || 1;
        this.player1Color = data.player1Color || '';
        this.player2Color = data.player2Color || '';
        this.landmines = data.landmines || [];
        this.explodedTiles = data.explodedTiles || [];
        this.lastMove = data.lastMove || null;
        this.gameStarted = data.gameStarted || false;
        this.gameOver = data.gameOver || false;
        this.winner = data.winner || null;
        // Note: Assumes board structure matches
    }

    getTile(row, col) {
        return this.gameBoard?.[row]?.[col];
    }

    isOwnedBy(row, col, player) {
        const key = `${row},${col}`;
        if (player === 1) return this.player1Tiles.has(key);
        if (player === 2) return this.player2Tiles.has(key);
        return false;
    }

    getOwner(row, col) {
        const key = `${row},${col}`;
        if (this.player1Tiles.has(key)) return 1;
        if (this.player2Tiles.has(key)) return 2;
        return 0; // 0 means unowned
    }
}

// Game State Variables (consider moving more into the GameState class eventually)
const gameState = new GameState(); // Central game state object
let player1PowerUps = []; // Array of power-ups player 1 has available
let player2PowerUps = []; // Array of power-ups player 2 has available
let selectedPowerUp = null; // Currently selected power-up
let isOnlineGame = false;
let playerNumber = 1; // 1 or 2, relevant for online games
let playerName = ''; // Local player's name
let opponentName = ''; // Opponent's name
let gameId = null; // ID for online games
let waitingForOpponent = false; // Flag when waiting for server response/opponent move

    reset() {
        this.gameBoard = [];
        this.player1Tiles = new Set();
        this.player2Tiles = new Set();
        this.currentPlayer = 1;
        this.player1Color = '';
        this.player2Color = '';
        this.availableColors = [...COLORS];
        this.hoverTile = null; // { row, col }
        this.landmines = []; // { row, col }
        this.explodedTiles = []; // { row, col, turnsLeft, type? }
        this.lastMove = null;
        this.moveHistory = [];
        this.gameStarted = false;
        this.gameOver = false;
        this.winner = null;
    }

    serialize() {
        // Basic serialization, consider refining if needed
        return {
            board: this.gameBoard, // Note: This could be large
            player1Tiles: Array.from(this.player1Tiles),
            player2Tiles: Array.from(this.player2Tiles),
            currentPlayer: this.currentPlayer,
            player1Color: this.player1Color,
            player2Color: this.player2Color,
            landmines: this.landmines,
            explodedTiles: this.explodedTiles,
            // lastMove and moveHistory might not be needed by server always
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            winner: this.winner
            // Note: Does not include power-ups managed outside the class currently
        };
    }

    deserialize(data) {
        // Basic deserialization, consider refining
        if (!data) return;
        this.gameBoard = data.board || [];
        this.player1Tiles = new Set(data.player1Tiles || []);
        this.player2Tiles = new Set(data.player2Tiles || []);
        this.currentPlayer = data.currentPlayer || 1;
        this.player1Color = data.player1Color || '';
        this.player2Color = data.player2Color || '';
        this.landmines = data.landmines || [];
        this.explodedTiles = data.explodedTiles || [];
        this.lastMove = data.lastMove || null;
        this.gameStarted = data.gameStarted || false;
        this.gameOver = data.gameOver || false;
        this.winner = data.winner || null;
        // Note: Assumes board structure matches
    }

    getTile(row, col) {
        return this.gameBoard?.[row]?.[col];
    }

    isOwnedBy(row, col, player) {
        const key = `${row},${col}`;
        if (player === 1) return this.player1Tiles.has(key);
        if (player === 2) return this.player2Tiles.has(key);
        return false;
    }

    getOwner(row, col) {
        const key = `${row},${col}`;
        if (this.player1Tiles.has(key)) return 1;
        if (this.player2Tiles.has(key)) return 2;
        return 0; // 0 means unowned
    }
}

// ============================================================================
// DOMContentLoaded Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Element References ---
    canvas = document.getElementById('game-board');
    ctx = canvas.getContext('2d');
    player1ScoreElement = document.getElementById('your-score-container'); // Changed ID
    player2ScoreElement = document.getElementById('opponent-score-container'); // Changed ID
    messageElement = document.getElementById('message');
    turnIndicator = document.getElementById('turn-indicator');
    currentPlayerElement = document.getElementById('current-player');

    // Setup Screen Elements
    setupContainer = document.getElementById('setup-container');
    playerNameSetupInput = document.getElementById('player-name-setup');
    startLocalButton = document.getElementById('start-local-game');
    setupCreateChallengeButton = document.getElementById('setup-create-challenge');
    challengeCodeSetupInput = document.getElementById('challenge-code-setup');
    setupJoinChallengeButton = document.getElementById('setup-join-challenge');
    setupMessageElement = document.getElementById('setup-message');

    // Main Game Elements
    scoreContainer = document.getElementById('score-container');
    gameArea = document.getElementById('game-area');
    colorPalette = document.getElementById('color-palette');
    gameControls = document.getElementById('game-controls');
    landmineInfo = document.getElementById('landmine-info');
    chatContainer = document.getElementById('chat-container');
    toggleChatButton = document.getElementById('toggle-chat');
    leaveGameButton = document.getElementById('leave-game'); // Get leave button

    // --- Initial UI State ---
    showSetupScreen(); // Start by showing the setup screen

    // --- Event Listeners ---

    // Window Resize
    window.addEventListener('resize', () => {
        resizeGame();
        renderGameBoard(); // Re-render after resize
    });

    // Setup Screen Button Listeners
    startLocalButton.addEventListener('click', () => {
        const name = playerNameSetupInput.value.trim();
        if (!name) {
            setupMessageElement.textContent = "Please enter your name.";
            setupMessageElement.style.color = 'red';
            return;
        }
        setupMessageElement.textContent = ""; // Clear message
        playerName = name;
        window.playerName = name; // Make global if needed elsewhere quickly
        opponentName = 'Player 2'; // Default opponent name for local
    joinChallengeButton.addEventListener('click', () => {
        playerName = nameInput.value.trim();
        if (!playerName) {
            setupMessage.textContent = 'Please enter your name.';
            return;
        }
        showGameScreen();
        const gameId = prompt("Enter the Game ID to join:"); // Simple prompt for now
        if (!gameId) {
            // User cancelled or entered nothing
            setupMessage.textContent = 'Game ID is required to join.';
        // Update status message
        updateMessage("Connecting...", false);

        console.log(`Requesting to join challenge ${gameId} as ${playerName}`);
        gameState.isOnline = true; // Set online mode
        showGameScreen();
        updateMessage("Connecting...", false);

        // Connect to server and pass the action 'join'
        if (window.connectToServer) {
            // Pass action 'join' and necessary args
            window.connectToServer(playerName, 'join', { playerName: playerName, gameId: gameId });
            // joinChallenge will be called by multiplayer.js after connection
        }
            console.error("Multiplayer functions not available.");
            updateMessage('Error: Multiplayer unavailable.', true);
            showSetupScreen(); // Go back to setup
            isOnlineGame = false; // Reset flag
        }

    setupJoinChallengeButton.addEventListener('click', () => {
        const name = playerNameSetupInput.value.trim();
        const code = challengeCodeSetupInput.value.trim();
        if (!name) {
            setupMessageElement.textContent = "Please enter your name.";
            setupMessageElement.style.color = 'red';
            return;
        }
        if (!code) {
            setupMessageElement.textContent = "Please enter a challenge code.";
            setupMessageElement.style.color = 'red';
            return;
        }
        setupMessageElement.textContent = `Joining game ${code}...`;
        setupMessageElement.style.color = 'black';
        playerName = name;
        window.playerName = name;
        isOnlineGame = true; // Set flag early
        // Trigger multiplayer logic (multiplayer.js should define window.joinGame)
        if (window.joinGame) {
            window.joinGame(code, name);
            // UI transition (showGameScreen) will be handled by initializeOnlineGame or syncGameState later
        } else {
            setupMessageElement.textContent = "Error: Multiplayer function (joinGame) not available.";
            setupMessageElement.style.color = 'red';
            isOnlineGame = false; // Reset flag
        }
    });

    // Canvas Listeners (for hover and power-up clicks)
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', () => { // Clear hover when mouse leaves canvas
        if (gameState.hoverTile) {
            gameState.hoverTile = null;
            renderGameBoard(); // Re-render to remove hover effect
        }
    });

    // Color Palette Button Listeners (added dynamically in setupColorButtons)

    // Power-Up Slot Listeners
    setupPowerUpListeners();

    // General Game Control Listeners
    leaveGameButton.addEventListener('click', leaveGame);
    toggleChatButton.addEventListener('click', toggleChat);

    // --- Initialize ---
    // Game initialization (initializeGame/initializeOnlineGame) is called by setup buttons or server events
    // No automatic initialization here anymore.

}); // End DOMContentLoaded

// ============================================================================
// UI State Management Functions
// ============================================================================

function showSetupScreen() {
    if (setupContainer) setupContainer.style.display = 'flex';
    if (scoreContainer) scoreContainer.style.display = 'none';
    if (gameArea) gameArea.style.display = 'none';
    if (colorPalette) colorPalette.style.display = 'none';
    if (gameControls) gameControls.style.display = 'none'; // Contains message, landmine, powerups, leave/chat buttons
    if (chatContainer) chatContainer.style.display = 'none'; // Hide chat initially
}

function showGameScreen() {
    if (setupContainer) setupContainer.style.display = 'none';
    if (scoreContainer) scoreContainer.style.display = 'flex'; // Use flex as per CSS
    if (gameArea) gameArea.style.display = 'block';
    if (colorPalette) colorPalette.style.display = 'flex'; // Use flex
    if (gameControls) gameControls.style.display = 'block'; // Or flex, check layout needs
    if (isOnlineGame && chatContainer) { // Show chat only in online games
         chatContainer.style.display = 'flex'; // Or block, check layout
         toggleChatButton.style.display = 'inline-block'; // Show toggle button
    } else {
        if (chatContainer) chatContainer.style.display = 'none';
        if (toggleChatButton) toggleChatButton.style.display = 'none';
    }
}

function toggleChat() {
    if (chatContainer) {
        const isHidden = chatContainer.style.display === 'none';
        chatContainer.style.display = isHidden ? 'flex' : 'none'; // Or block
        toggleChatButton.textContent = isHidden ? 'Hide Chat' : 'Show Chat';
    }
}

// Disable game controls (color buttons, power-ups, canvas clicks for moves)
function disableControls() {
    waitingForOpponent = true; // Set flag
    document.querySelectorAll('.color-button').forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');
        button.closest('.color-swatch')?.classList.add('disabled'); // Use optional chaining
    });
    document.querySelectorAll('.power-up-slot').forEach(slot => {
        slot.classList.add('disabled'); // Visual disable, click handler also checks turn
    });
    if (canvas) canvas.style.cursor = 'default'; // Change cursor when disabled
    if (messageElement) messageElement.textContent = `${opponentName || 'Opponent'}'s turn. Waiting...`;
}

// Enable game controls
function enableControls() {
    waitingForOpponent = false; // Clear flag
    setupColorButtons(); // Re-evaluates which colors are available and enables/disables them
    updatePowerUpDisplay(); // Re-evaluates which power-ups are available and enables/disables slots
    if (canvas) canvas.style.cursor = 'pointer'; // Restore pointer cursor
    if (messageElement) messageElement.textContent = "It's your turn!";
}

// ============================================================================
// Game Initialization & State Sync
// ============================================================================

// Initialize a new game (local or first player online)
function initializeGame() {
    console.log(`Initializing game. Online: ${isOnlineGame}, PlayerName: ${playerName}`);
    gameState.reset();
    player1PowerUps = []; // Reset local power-up tracking
    player2PowerUps = [];
    selectedPowerUp = null;
    waitingForOpponent = false;

    createGameBoard(); // Create board structure and place mines
    setupInitialTiles(); // Set starting positions and colors
    resetAvailableColors();
    gameState.gameStarted = true;

    // Initial UI updates
    resizeGame(); // Ensure canvas size is correct
    renderGameBoard();
    updateScoreDisplay();
    updateTurnIndicator();
    setupColorButtons();
    updatePowerUpDisplay();
    updateLandmineInfo();

    // Enable controls for player 1 (or local player)
    if (gameState.currentPlayer === playerNumber) {
        enableControls();
    } else {
        // This case might happen if Player 2 joins and gets state immediately,
        // but typically syncGameState handles enabling/disabling.
        disableControls();
    }
}

// Called by multiplayer.js after connection and basic setup (IDs, names) are confirmed.
// Primarily sets online-specific variables. Board state comes via syncGameState.
window.initializeOnlineGame = function(pNum, gId, pName, oName = '') {
    console.log(`Setting up online game specifics. Player: ${pNum}, Game: ${gId}, Name: ${pName}, Opponent: ${oName}`);

    isOnlineGame = true;
    playerNumber = pNum; // Server assigns 1 or 2
    gameId = gId;
    playerName = pName; // Already set from setup screen or server
    opponentName = oName || (playerNumber === 1 ? 'Player 2' : 'Player 1'); // Get opponent name

    // Make names globally accessible if needed by other scripts
    window.playerName = playerName;
    window.opponentName = opponentName;
    window.playerNumber = playerNumber;
    window.gameId = gameId;


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
    // We don't call the full initializeGame() here anymore unless this player is P1 creating the game.
    // If P1, multiplayer.js might call initializeGame() THEN getGameStateForServer().
};

// Get current game state for sending initial state (Player 1 only when creating)
window.getGameStateForServer = function() {
    console.log("Getting initial game state to send to server");
    // Ensure game state is current before sending
    const stateToSend = gameState.serialize();
    // Add power-ups (currently managed outside gameState class)
    stateToSend.player1PowerUps = player1PowerUps;
    stateToSend.player2PowerUps = player2PowerUps;
    // Add player names if needed (P1 includes theirs)
    stateToSend.player1Name = playerName; // Player 1 sets their name
    // player2Name will be added by server when P2 joins

    console.log("State to send:", stateToSend);
    return stateToSend;
};

// Sync local game state from server data
window.syncGameState = function(serverState) {
    console.log("Syncing game state from server:", serverState);
    if (!serverState || !serverState.board) { // Basic validation
        console.error("Cannot sync game state, server data is incomplete:", serverState);
        messageElement.textContent = "Error receiving game state from server.";
        return;
    }

    // Update core game state from server data using deserialize
    gameState.deserialize(serverState);

    // Sync power-ups (use local arrays) - ensure server sends these
    player1PowerUps = serverState.player1PowerUps || [];
    player2PowerUps = serverState.player2PowerUps || [];

    // Update player names if provided by server (ensure consistency)
    // Server should ideally send both names once both players are known
    if (serverState.player1Name) {
        if (playerNumber === 1) playerName = serverState.player1Name;
        else opponentName = serverState.player1Name;
    }
    if (serverState.player2Name) {
        if (playerNumber === 2) playerName = serverState.player2Name;
        else opponentName = serverState.player2Name;
    }
    window.playerName = playerName; // Update globals
    window.opponentName = opponentName;


    // Refresh UI elements based on new state
    resetAvailableColors(); // Based on new player colors and current player
    renderGameBoard(); // Redraw the board with synced state
    updateScoreDisplay();
    updateTurnIndicator();
    setupColorButtons();
    updatePowerUpDisplay();
    updateLandmineInfo();

    // Ensure correct orientation (resize handles visual flipping if needed)
    resizeGame();

    // Update controls based on whose turn it is
    if (!gameState.gameOver) {
        if (gameState.currentPlayer === playerNumber) {
            enableControls(); // Your turn
        } else {
            disableControls(); // Opponent's turn
        }
    } else {
        // Game is over, disable everything
        disableControls();
        // Display winner message (endGame logic should handle this via server state)
        handleGameOver();
    }


    console.log(`After sync - Current: P${gameState.currentPlayer}. You are P${playerNumber}`);
    console.log(`Scores: P1 ${gameState.player1Tiles.size}, P2 ${gameState.player2Tiles.size}`);
    console.log(`Names: You (${playerName}), Opponent (${opponentName})`);

    // Ensure game screen is visible after sync (might be first sync)
    showGameScreen();
};

// ============================================================================
// Board Creation & Setup
// ============================================================================

// Create the game board structure and place items
function createGameBoard() {
    gameState.gameBoard = [];
    gameState.landmines = []; // Clear existing landmines

    for (let row = 0; row < BOARD_SIZE; row++) {
        gameState.gameBoard[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            gameState.gameBoard[row][col] = {
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                row: row,
                col: col,
                hasMine: false
                // Add displayRow/displayCol if needed for P2 flip, handle in render
            };
        }
    }

    placeLandminesInQuadrants();
}

// Place landmines in each quadrant
function placeLandminesInQuadrants() {
    const halfBoard = Math.floor(BOARD_SIZE / 2);
    const quadrants = [
        { minR: 1, maxR: halfBoard - 1, minC: 1, maxC: halfBoard - 1 },             // Top-left (adjusting for 0,0 start)
        { minR: 1, maxR: halfBoard - 1, minC: halfBoard, maxC: BOARD_SIZE - 2 },    // Top-right
        { minR: halfBoard, maxR: BOARD_SIZE - 2, minC: 1, maxC: halfBoard - 1 },    // Bottom-left
        { minR: halfBoard, maxR: BOARD_SIZE - 2, minC: halfBoard, maxC: BOARD_SIZE - 2 } // Bottom-right
    ];

    gameState.landmines = []; // Ensure it's clear before placing

    for (const quad of quadrants) {
        let placed = false;
        let attempts = 0;
        const maxAttempts = 100;

        while (!placed && attempts < maxAttempts) {
            attempts++;
            const row = Math.floor(Math.random() * (quad.maxR - quad.minR + 1)) + quad.minR;
            const col = Math.floor(Math.random() * (quad.maxC - quad.minC + 1)) + quad.minC;

            // Ensure tile exists and doesn't already have a mine
            const tile = gameState.getTile(row, col);
            if (tile && !tile.hasMine) {
                // Avoid player starting positions (adjust if start changes)
                if (!((row === 0 && col === 0) || (row === BOARD_SIZE - 1 && col === BOARD_SIZE - 1))) { // Assuming 0,0 and N-1,N-1 start
                     tile.hasMine = true;
                     gameState.landmines.push({ row, col });
                     placed = true;
                     console.log(`Placed mine at ${row},${col}`);
                }
            }
        }
        if (!placed) {
            console.warn(`Failed to place mine in quadrant after ${maxAttempts} attempts`, quad);
        }
    }
}

// Set up initial player territories (adjust starting positions if needed)
function setupInitialTiles() {
    gameState.player1Tiles.clear();
    gameState.player2Tiles.clear();

    // Player 1 starts top-left
    const p1StartRow = 0;
    const p1StartCol = 0;
    const p1StartTile = gameState.getTile(p1StartRow, p1StartCol);
    if (p1StartTile) {
        gameState.player1Color = p1StartTile.color;
        gameState.player1Tiles.add(`${p1StartRow},${p1StartCol}`);
        // Ensure start tile doesn't have a mine initially
        p1StartTile.hasMine = false;
        gameState.landmines = gameState.landmines.filter(m => !(m.row === p1StartRow && m.col === p1StartCol));
    } else {
        console.error("Player 1 start tile not found!");
    }


    // Player 2 starts bottom-right
    const p2StartRow = BOARD_SIZE - 1;
    const p2StartCol = BOARD_SIZE - 1;
    const p2StartTile = gameState.getTile(p2StartRow, p2StartCol);
     if (p2StartTile) {
        // Choose a different starting color for P2
        const availableP2Colors = COLORS.filter(c => c !== gameState.player1Color);
        gameState.player2Color = availableP2Colors.length > 0
            ? availableP2Colors[Math.floor(Math.random() * availableP2Colors.length)]
            : COLORS[0]; // Fallback if only one color exists
        p2StartTile.color = gameState.player2Color; // Force P2 start tile color
        gameState.player2Tiles.add(`${p2StartRow},${p2StartCol}`);
         // Ensure start tile doesn't have a mine initially
         p2StartTile.hasMine = false;
         gameState.landmines = gameState.landmines.filter(m => !(m.row === p2StartRow && m.col === p2StartCol));
     } else {
         console.error("Player 2 start tile not found!");
     }


    gameState.currentPlayer = 1; // Player 1 starts
}


// ============================================================================
// Rendering Functions
// ============================================================================

// Adjust canvas size based on container
function resizeGame() {
    if (!canvas || !gameArea) return;
    const containerWidth = gameArea.clientWidth;
    // Maintain aspect ratio (approximate for hex grid)
    const aspectRatio = (BOARD_SIZE * HEX_HEIGHT * 0.75) / (BOARD_SIZE * HEX_WIDTH);
    const targetHeight = containerWidth * aspectRatio;

    // Set canvas internal resolution
    canvas.width = containerWidth; // Use clientWidth for responsive sizing
    canvas.height = targetHeight;

    // Adjust style for display size if needed (less common now with direct width/height)
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${targetHeight}px`;
}


// Enhanced board rendering
function renderGameBoard() {
    if (!ctx || !canvas) return;

    // Clear the canvas with a subtle gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f8f9fa'); // Light grey
    gradient.addColorStop(1, '#e9ecef'); // Slightly darker grey
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ensure gameBoard is initialized
    if (!gameState || !gameState.gameBoard || gameState.gameBoard.length === 0) {
        console.warn("RenderGameBoard called before gameBoard was initialized.");
        // Optionally draw a loading message
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading game board...', canvas.width / 2, canvas.height / 2);
        return;
    }

    // --- Calculate Scaling and Centering ---
    // Calculate the total dimensions the hex grid *would* take unscaled
    const boardPhysicalWidth = (BOARD_SIZE * HEX_WIDTH) + (HEX_WIDTH / 2); // Account for row offsets
    const boardPhysicalHeight = (BOARD_SIZE * HEX_HEIGHT * 0.75) + (HEX_HEIGHT * 0.25); // Approx

    // Calculate maximum scaling factor based on available canvas space minus padding
    const availableWidth = canvas.width - BOARD_PADDING * 2;
    const availableHeight = canvas.height - BOARD_PADDING * 2;
    const xScale = availableWidth / boardPhysicalWidth;
    const yScale = availableHeight / boardPhysicalHeight;
    const scaleFactor = Math.min(xScale, yScale); // Use the smaller scale factor to fit

    // Calculate the actual scaled dimensions of the grid
    const scaledHexWidth = HEX_WIDTH * scaleFactor;
    const scaledHexHeight = HEX_HEIGHT * scaleFactor;
    const scaledHexSize = HEX_SIZE * scaleFactor; // Scaled radius
    const scaledBoardWidth = (BOARD_SIZE * scaledHexWidth) + (scaledHexWidth / 2);
    const scaledBoardHeight = (BOARD_SIZE * scaledHexHeight * 0.75) + (scaledHexHeight * 0.25);

    // Calculate starting offset to center the grid
    const startX = (canvas.width - scaledBoardWidth) / 2 + (scaledHexWidth / 2); // Center based on hex centers
    const startY = (canvas.height - scaledBoardHeight) / 2 + (scaledHexHeight / 2);

    // --- Draw Hexagons ---
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const tile = gameState.getTile(row, col);
            if (!tile) {
                console.warn(`Tile data missing for ${row}, ${col}`);
                continue; // Skip rendering this tile
            }

            // Determine visual position (potential flip for P2)
            const { displayRow, displayCol } = transformCoordinates(row, col);

            // Calculate hex center position on canvas
            // Stagger odd rows
            const hexCenterX = startX + (displayCol * scaledHexWidth) + (displayRow % 2 === 1 ? scaledHexWidth / 2 : 0);
            const hexCenterY = startY + (displayRow * scaledHexHeight * 0.75);

            // Determine tile ownership and display color
            const owner = gameState.getOwner(row, col); // 0, 1, or 2
            let displayColor = tile.color || '#CCCCCC'; // Fallback for safety
            if (owner === 1 && gameState.player1Color) {
                displayColor = gameState.player1Color;
            } else if (owner === 2 && gameState.player2Color) {
                displayColor = gameState.player2Color;
            }

             // Check if this tile is being hovered over (using original row/col)
             const isHovered = gameState.hoverTile && gameState.hoverTile.row === row && gameState.hoverTile.col === col;
             let currentHexSize = scaledHexSize;
             if (isHovered && (owner === 0 || gameState.isOwnedBy(row, col, gameState.currentPlayer))) { // Only hover effect on unowned or own tiles
                 currentHexSize *= 1.1; // Slightly larger on hover
             }


            // Draw the hexagon
            drawHexagon(
                hexCenterX, hexCenterY,
                currentHexSize, // Use potentially larger size for hover
                displayColor,
                owner // Pass owner (0, 1, or 2)
                // tile.hasMine // Not visually shown by default
            );
        }
    }

    // Draw any active animations (e.g., explosions) - Needs definition
    // drawAnimations();
}


// Draw a single hexagon with effects
function drawHexagon(x, y, size, color, owner) {
    const sides = 6;
    const angle = (2 * Math.PI) / sides;

    ctx.save();

    // Drop shadow for all hexagons
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Create hexagon path
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        // Use PI/2 offset to point top up
        const pointX = x + size * Math.cos(angle * i - Math.PI / 2);
        const pointY = y + size * Math.sin(angle * i - Math.PI / 2);
        if (i === 0) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();

    // Fill with lighting effect (radial gradient)
    const gradient = ctx.createRadialGradient(
        x - size / 4, y - size / 4, size / 10, // Inner light source offset
        x, y, size                           // Outer edge
    );

    try {
        const colorObj = hexToRgb(color);
        if (colorObj) {
            const lighterColor = `rgba(${Math.min(colorObj.r + 40, 255)}, ${Math.min(colorObj.g + 40, 255)}, ${Math.min(colorObj.b + 40, 255)}, 1.0)`;
            const darkerColor = `rgba(${Math.max(colorObj.r - 30, 0)}, ${Math.max(colorObj.g - 30, 0)}, ${Math.max(colorObj.b - 30, 0)}, 1.0)`;

            gradient.addColorStop(0, lighterColor); // Center highlight
            gradient.addColorStop(0.7, color);      // Main color
            gradient.addColorStop(1, darkerColor);  // Edge shadow
            ctx.fillStyle = gradient;
        } else {
             ctx.fillStyle = color; // Fallback to solid color if hexToRgb fails
        }
    } catch (e) {
        console.warn("Error creating gradient:", e);
        ctx.fillStyle = color; // Fallback
    }

    ctx.fill();

     // Clear shadow for stroke
    if (tile && tile.owner !== null) {
        // Darker shade of owner color for border
        ctx.strokeStyle = darkenColor(fillColor, 0.7);
    } else { // Correctly associate else with the if
        ctx.strokeStyle = '#888888'; // Dark grey border for unowned
    }
    ctx.stroke();
        ctx.lineWidth = 1.5;
    } else {
        // Unowned tiles: lighter grey border
        ctx.strokeStyle = '#bbb'; // Lighter border for unowned
        ctx.lineWidth = 1;
    }
    ctx.stroke();


    ctx.restore();
}


// Transform coordinates based on player perspective (flips board visually for P2)
function transformCoordinates(row, col) {
    if (isOnlineGame && playerNumber === 2) {
        return {
            displayRow: BOARD_SIZE - 1 - row,
            displayCol: BOARD_SIZE - 1 - col
        };
    }
    // Player 1 or local game uses original coordinates
    return { displayRow: row, displayCol: col };
}

// ============================================================================
// UI Update Functions
// ============================================================================

// Update score display
function updateScoreDisplay() {
    const p1Score = gameState.player1Tiles.size;
    const p2Score = gameState.player2Tiles.size;

    const p1NameDisplay = playerName || 'Player 1';
    const p2NameDisplay = opponentName || 'Player 2';

    // Update player 1 score area
    if (player1ScoreElement) {
        const nameSpan = player1ScoreElement.querySelector('.player-name');
        const scoreSpan = player1ScoreElement.querySelector('.score-value'); // Use class
        if (nameSpan) nameSpan.textContent = p1NameDisplay;
        if (scoreSpan) scoreSpan.textContent = p1Score;
        player1ScoreElement.classList.toggle('active-player', gameState.currentPlayer === 1);
    }

    // Update player 2 score area
    if (player2ScoreElement) {
        const nameSpan = player2ScoreElement.querySelector('.player-name');
        const scoreSpan = player2ScoreElement.querySelector('.score-value'); // Use class
        if (nameSpan) nameSpan.textContent = p2NameDisplay;
        if (scoreSpan) scoreSpan.textContent = p2Score;
        player2ScoreElement.classList.toggle('active-player', gameState.currentPlayer === 2);
    }
}


// Update the turn indicator UI
function updateTurnIndicator() {
    if (!currentPlayerElement || !turnIndicator) return;

    const turnPlayerName = gameState.currentPlayer === playerNumber ? (playerName || 'Your') : (opponentName || 'Opponent');
    currentPlayerElement.textContent = `${turnPlayerName}`; // Removed "'s turn"

    // Update turn indicator styling (if using classes like player1-turn)
    turnIndicator.classList.remove('player1-turn', 'player2-turn');
    if (gameState.gameStarted && !gameState.gameOver) {
         turnIndicator.classList.add(gameState.currentPlayer === 1 ? 'player1-turn' : 'player2-turn');
    }
}


// Set up color buttons and their click handlers
function setupColorButtons() {
    const palette = document.getElementById('color-palette');
    if (!palette) return;

    palette.innerHTML = ''; // Clear existing buttons

    COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.classList.add('color-swatch');
        swatch.style.backgroundColor = color; // Set background for visual cue

        const button = document.createElement('button');
        button.classList.add('color-button');
        button.setAttribute('data-color', color);
        // button.style.backgroundColor = color; // Button itself can be styled via CSS maybe
        button.textContent = ''; // Or color name if needed

        swatch.appendChild(button);
        palette.appendChild(swatch);

        // Check availability
        const isAvailable = gameState.availableColors.includes(color);
        button.disabled = !isAvailable;
        swatch.classList.toggle('disabled', !isAvailable);
        button.classList.toggle('disabled', !isAvailable);

        // Add click listener
        button.addEventListener('click', () => {
            if (!button.disabled) { // Double check if enabled
                handleColorSelection(color);
            }
        });
    });
}

// Update the power-up display (counts and enabled state)
function updatePowerUpDisplay() {
    // Determine current player's power-ups based on playerNumber perspective
    const myPowerUps = (playerNumber === 1) ? player1PowerUps : player2PowerUps;
    // Note: If local game, playerNumber is 1, currentPlayer switches 1/2
    // Need to display based on gameState.currentPlayer for local games?
    // Let's assume playerNumber perspective is fine for now.

    const counts = { sabotage: 0, wildcard: 0, teleport: 0 };
    myPowerUps.forEach(p => { if (counts[p] !== undefined) counts[p]++; });

    document.getElementById('sabotage-count').textContent = counts.sabotage;
    document.getElementById('wildcard-count').textContent = counts.wildcard;
    document.getElementById('teleport-count').textContent = counts.teleport;

    // Enable/disable slots and update active state
    document.querySelectorAll('.power-up-slot').forEach(slot => {
        const type = slot.getAttribute('data-type');
        const hasPowerUp = counts[type] > 0;
        const isSlotActive = selectedPowerUp === type;

        // Enable clickability ONLY if it's player's turn AND they have the powerup
        const canUse = hasPowerUp && gameState.currentPlayer === playerNumber && !waitingForOpponent;
        slot.classList.toggle('disabled', !canUse); // Visual state based on usability

        // Visual active state
        slot.classList.toggle('active', isSlotActive);

        // If the selected power-up is no longer available, deselect it
        if (isSlotActive && !hasPowerUp) {
            selectedPowerUp = null;
            slot.classList.remove('active');
        }
    });
}

// Update landmine info display
function updateLandmineInfo() {
    if (landmineInfo) {
        landmineInfo.textContent = `Landmines remaining: ${gameState.landmines.length}`;
    }
}


// ============================================================================
// Game Logic Functions
// ============================================================================

// Reset available colors for the new turn
function resetAvailableColors() {
    // Cannot select own current color or opponent's current color
    gameState.availableColors = COLORS.filter(c => c !== gameState.player1Color && c !== gameState.player2Color);
}


// Get adjacent tiles (neighbors)
function getNeighbors(row, col) {
    const neighbors = [];
    // Offsets depend on row parity (odd rows are shifted right)
    const directions = row % 2 === 0 ?
        [ [-1, 0], [-1, -1], [0, -1], [+1, -1], [+1, 0], [0, +1] ] // Even rows
      : [ [-1, +1], [-1, 0], [0, -1], [+1, 0], [+1, +1], [0, +1] ]; // Odd rows

    for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        // Check bounds
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            neighbors.push({ row: nr, col: nc });
        }
    }
    return neighbors;
}

// Find all connected tiles of a target color adjacent to player's current territory (BFS)
function getCaptureableTiles(playerTilesSet, targetColor) {
    const capturable = new Set(); // Keys of capturable tiles
    const queue = [];             // Tiles to visit {row, col}
    const visited = new Set();    // Keys of visited tiles

    // 1. Find initial candidates: unowned neighbors matching targetColor
    for (const tileKey of playerTilesSet) {
        const [row, col] = tileKey.split(',').map(Number);
        const neighbors = getNeighbors(row, col);

        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.row},${neighbor.col}`;
            const neighborTile = gameState.getTile(neighbor.row, neighbor.col);

            // Must be unowned, match target color, and not already visited/queued
            if (neighborTile &&
                !gameState.player1Tiles.has(neighborKey) &&
                !gameState.player2Tiles.has(neighborKey) &&
                neighborTile.color === targetColor &&
                !visited.has(neighborKey))
            {
                visited.add(neighborKey);
                queue.push(neighbor);
            }
        }
    }

    // 2. BFS from initial candidates to find all connected matching tiles
    while (queue.length > 0) {
        const current = queue.shift();
        const currentKey = `${current.row},${current.col}`;
        capturable.add(currentKey); // Add to capturable result

        const neighbors = getNeighbors(current.row, current.col);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.row},${neighbor.col}`;
            const neighborTile = gameState.getTile(neighbor.row, neighbor.col);

            // Expand if neighbor is unowned, matches target, and not visited
            if (neighborTile &&
                !gameState.player1Tiles.has(neighborKey) &&
                !gameState.player2Tiles.has(neighborKey) &&
                neighborTile.color === targetColor &&
                !visited.has(neighborKey))
            {
                visited.add(neighborKey);
                queue.push(neighbor);
            }
        }
    }

    return capturable; // Return Set of keys 'row,col'
}


// Switch to the next player's turn
function switchPlayerTurn() {
    if (gameState.gameOver) return;

    gameState.currentPlayer = 3 - gameState.currentPlayer; // Toggle 1 and 2
    resetAvailableColors();
    processExplodedTilesRecovery(); // Recover tiles before UI updates for new turn

    // Update UI for the new turn
    updateTurnIndicator();
    setupColorButtons();
    updatePowerUpDisplay();
    updateScoreDisplay(); // Update score highlights

    // Check for game over *after* switching (can the new player move?)
    if (checkGameOver()) {
        handleGameOver();
        // If online, server should also detect and broadcast game over
        if (isOnlineGame && window.sendMove) {
            // Optional: Send confirmation that client also detected game over
            // window.sendMove({ type: 'game-over-acknowledged' });
        }
    } else {
        // Update message for the new player's turn
         const turnPlayerName = gameState.currentPlayer === playerNumber ? (playerName || 'Your') : (opponentName || 'Opponent');
         messageElement.textContent = `${turnPlayerName}'s turn.`;

         // If online and it's now the local player's turn, enable controls
         if (isOnlineGame && gameState.currentPlayer === playerNumber) {
             enableControls();
         } else if (!isOnlineGame) {
             enableControls(); // Always enable for local player turn
         }
         // Disable is handled by syncGameState or disableControls() if waiting
    }
}

// Process the recovery of exploded/sabotaged tiles
function processExplodedTilesRecovery() {
    const stillRecovering = [];
    let needsRender = false;

    for (const tileInfo of gameState.explodedTiles) {
        tileInfo.turnsLeft--;
        const tile = gameState.getTile(tileInfo.row, tileInfo.col);
        if (!tile) continue;

        if (tileInfo.turnsLeft <= 0) {
            // Fully recovered - assign a new random color
            tile.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            needsRender = true;
            // Don't add back to stillRecovering
        } else {
            // Still recovering - update visual state if needed (e.g., fade effect)
            // Simple approach: Keep it black/sabotaged until fully recovered
            // More complex: Interpolate color based on turnsLeft/totalTurns
            if (tileInfo.type === 'sabotage' && tile.color !== '#8B0000') { // Dark Red for Sabotage
                 tile.color = '#8B0000'; // Ensure it stays red during recovery
                 needsRender = true;
            } else if (tile.color !== EXPLOSION_COLOR) { // Black for Explosion
                tile.color = EXPLOSION_COLOR; // Ensure it stays black
                needsRender = true;
            }
            stillRecovering.push(tileInfo); // Keep in list
        }
    }

    gameState.explodedTiles = stillRecovering;

    // Re-render only if colors actually changed
    if (needsRender) {
        renderGameBoard();
    }
}

// Check if the game is over (current player has no valid moves)
function checkGameOver() {
    const currentTiles = gameState.currentPlayer === 1 ? gameState.player1Tiles : gameState.player2Tiles;
    const currentColor = gameState.currentPlayer === 1 ? gameState.player1Color : gameState.player2Color;

    // Can the current player capture anything with any available color?
    for (const color of gameState.availableColors) {
        if (getCaptureableTiles(currentTiles, color).size > 0) {
            return false; // Found a valid move
        }
    }
    // Also check if re-selecting current color captures anything (shouldn't, but for completeness)
    // if (getCaptureableTiles(currentTiles, currentColor).size > 0) {
    //     return false;
    // }

    // No available color allows capture - game over
    gameState.gameOver = true;
    return true;
}

// Handle the end of the game state
function handleGameOver() {
    gameState.gameOver = true;
    disableControls(); // Disable all interactions

    const player1Score = gameState.player1Tiles.size;
    const player2Score = gameState.player2Tiles.size;

    let endMessage = "Game Over! ";
    if (player1Score > player2Score) {
        gameState.winner = 1;
        endMessage += `${playerName || 'Player 1'} wins ${player1Score} to ${player2Score}!`;
    } else if (player2Score > player1Score) {
        gameState.winner = 2;
        endMessage += `${opponentName || 'Player 2'} wins ${player2Score} to ${player1Score}.`;
    } else {
        gameState.winner = 0; // Tie
        endMessage += `It's a tie at ${player1Score} tiles each.`;
    }

    messageElement.textContent = endMessage;
    updateTurnIndicator(); // Clear active turn styling maybe

    // Optionally show a 'Play Again' button (requires server coordination if online)
    // showPlayAgainButton(); // Removed - server should handle restart initiation
}

// Handle leaving the game
function leaveGame() {
    // Simple reload for now, could be more sophisticated (confirmation, server notification)
    if (isOnlineGame && window.leaveMultiplayerGame) {
        window.leaveMultiplayerGame(); // Notify server if function exists
    }
    // Regardless of online/offline, reload to go back to setup screen
    window.location.reload();
}

// Handle game restarted event from server
window.handleGameRestarted = function(serverState) {
    console.log("Handling game restarted event from server", serverState);
    if (isOnlineGame) {
        // Sync to the new state provided by the server
        syncGameState(serverState); // This resets state and enables controls if needed
        messageElement.textContent = `Game restarted! ${gameState.currentPlayer === playerNumber ? "Your" : (opponentName || 'Opponent')+"'s"} turn.`;
    } else {
        // Local restart (if triggered somehow, e.g., a local restart button)
        initializeGame();
        messageElement.textContent = `Game restarted! ${playerName || 'Player 1'}'s turn.`;
    }
};

// Handle player disconnected event (called by multiplayer.js)
window.handlePlayerDisconnected = function(data) {
    console.log('Player disconnected:', data);
    if (isOnlineGame) {
        handleGameOver(); // Treat disconnect as game over
        messageElement.textContent = `${opponentName || `Player ${data?.playerNumber || '?'}`} has disconnected! Game ended.`;
        opponentName = ''; // Clear opponent name
        window.opponentName = '';
        updateScoreDisplay(); // Update display to reflect missing opponent
        // isOnlineGame = false; // Consider the online session over - maybe keep true until leave?
        gameId = null;
        // Server should handle cleanup, client just displays message and disables controls
    }
}

// ============================================================================
// Player Actions & Input Handling
// ============================================================================

// Handle click on a color button
function handleColorSelection(selectedColor) {
    // Check turn and game state
    if (gameState.gameOver || (isOnlineGame && (gameState.currentPlayer !== playerNumber || waitingForOpponent))) {
        messageElement.textContent = "Cannot make a move now.";
        return;
    }

     // If a power-up was selected, cancel it
     if (selectedPowerUp) {
         selectedPowerUp = null;
         updatePowerUpDisplay(); // Deselect visually
         messageElement.textContent = "Power-up cancelled. Color selected.";
         // Continue with color selection...
     }

    // Validate color choice
    if (!gameState.availableColors.includes(selectedColor)) {
        messageElement.textContent = "This color is not available this turn!";
        return;
    }

    const playerTiles = gameState.currentPlayer === 1 ? gameState.player1Tiles : gameState.player2Tiles;
    const capturable = getCaptureableTiles(playerTiles, selectedColor);

    // Check if the move is valid (must capture tiles unless it's the only option?)
    // Standard rules usually allow picking a color even if it captures nothing, just passes turn.
    // Let's allow it for now. If capturable.size === 0, message will indicate 0 captures.

    // --- Apply Move Locally (optimistic update for local, basis for server data) ---
    const currentPlayerBackup = gameState.currentPlayer; // Backup before potential change
    const playerColorProp = gameState.currentPlayer === 1 ? 'player1Color' : 'player2Color';
    const originalColor = gameState[playerColorProp];
    gameState[playerColorProp] = selectedColor; // Update color

    const capturedTileKeys = Array.from(capturable);
    capturedTileKeys.forEach(key => {
        if (gameState.currentPlayer === 1) gameState.player1Tiles.add(key);
        else gameState.player2Tiles.add(key);
    });

    // Check for landmine trigger on newly captured tiles
    let mineTriggered = null;
    for (const key of capturedTileKeys) {
        const [row, col] = key.split(',').map(Number);
        const tile = gameState.getTile(row, col);
        if (tile?.hasMine) {
            mineTriggered = { row, col };
            break;
        }
    }

    // --- Send to Server or Finalize Locally ---
    if (isOnlineGame && window.sendMove) {
        console.log(`NETWORK: Sending color selection: ${selectedColor}`);
        disableControls(); // Disable until server confirms

        // Send move data
        const moveData = {
            type: 'color-selection',
            color: selectedColor,
            // Server calculates captures based on color, player, and its state
            playerName: playerName // Include sender's name
        };
        window.sendMove(moveData);

        // Revert local state changes - wait for server's syncGameState
        // This avoids desync if server logic differs slightly
        gameState[playerColorProp] = originalColor; // Revert color
        capturedTileKeys.forEach(key => { // Revert captures
             if (currentPlayerBackup === 1) gameState.player1Tiles.delete(key);
             else gameState.player2Tiles.delete(key);
        });
        // Do NOT switch turn locally

    } else {
        // --- Local Game Logic ---
        if (mineTriggered) {
            // Render the board showing the captured mine tile briefly
            renderGameBoard();
            updateScoreDisplay();
            messageElement.textContent = `Selected ${selectedColor}. Oh no! Landmine!`;
            // Short delay before explosion animation/logic
            setTimeout(() => {
                triggerLandmineExplosion(mineTriggered.row, mineTriggered.col);
                // triggerLandmineExplosion handles score update, tile shuffling, and switching turn
            }, 500);
        } else {
            // No mine, normal capture - Animate capture?
            // Simple version: Update state, render, switch turn
            renderGameBoard(); // Show captured tiles
            messageElement.textContent = `${gameState.currentPlayer === 1 ? playerName : opponentName} selected ${selectedColor} and captured ${capturable.size} tiles.`;

            // Check for power-up award
            if (capturable.size >= COMBO_THRESHOLD) {
                awardPowerUp(gameState.currentPlayer); // Award to the player who just moved
            }

            updateScoreDisplay();
            switchPlayerTurn(); // Switch to next player
        }
    }
}


// Handle canvas click (primarily for power-ups now)
function handleCanvasClick(event) {
    if (gameState.gameOver || (isOnlineGame && waitingForOpponent)) return; // Ignore clicks if waiting or over

    // Correct for canvas scaling
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    const clickedHex = findHexAtPosition(clickX, clickY);

    if (clickedHex) {
        console.log(`Clicked Hex: (${clickedHex.row}, ${clickedHex.col})`);
        const tile = gameState.getTile(clickedHex.row, clickedHex.col);
        const owner = gameState.getOwner(clickedHex.row, clickedHex.col);
        console.log(` -> Color: ${tile?.color}, Owner: ${owner}, Mine: ${tile?.hasMine}`);

        // If a power-up is selected, try to use it
        if (selectedPowerUp && gameState.currentPlayer === playerNumber) { // Only allow use on own turn
            usePowerUp(selectedPowerUp, clickedHex.row, clickedHex.col);
        } else if (selectedPowerUp) {
             messageElement.textContent = "Cannot use power-up, not your turn.";
        }
        // If no power-up selected, click doesn't do anything for game moves (buttons handle that)
        // It just logs info.
    }
}

// Handle canvas mouse move (for hover effects)
function handleCanvasMouseMove(event) {
     if (gameState.gameOver) return; // No hover if game over

    // Correct for canvas scaling
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const moveX = (event.clientX - rect.left) * scaleX;
    const moveY = (event.clientY - rect.top) * scaleY;

    const hoveredHex = findHexAtPosition(moveX, moveY);

    // Update hover state only if it changed
    const currentHoverKey = gameState.hoverTile ? `${gameState.hoverTile.row},${gameState.hoverTile.col}` : null;
    const newHoverKey = hoveredHex ? `${hoveredHex.row},${hoveredHex.col}` : null;

    if (currentHoverKey !== newHoverKey) {
        gameState.hoverTile = hoveredHex;
        renderGameBoard(); // Re-render to show/hide hover effect
    }
}


// Find the hex tile at a specific scaled canvas position
function findHexAtPosition(canvasX, canvasY) {
    // Recalculate scaling and centering (same logic as renderGameBoard)
    const boardPhysicalWidth = (BOARD_SIZE * HEX_WIDTH) + (HEX_WIDTH / 2);
    const boardPhysicalHeight = (BOARD_SIZE * HEX_HEIGHT * 0.75) + (HEX_HEIGHT * 0.25);
    const availableWidth = canvas.width - BOARD_PADDING * 2;
    const availableHeight = canvas.height - BOARD_PADDING * 2;
    const scaleFactor = Math.min(availableWidth / boardPhysicalWidth, availableHeight / boardPhysicalHeight);
    const scaledHexWidth = HEX_WIDTH * scaleFactor;
    const scaledHexHeight = HEX_HEIGHT * scaleFactor;
    const scaledHexSize = HEX_SIZE * scaleFactor;
    const scaledBoardWidth = (BOARD_SIZE * scaledHexWidth) + (scaledHexWidth / 2);
    const scaledBoardHeight = (BOARD_SIZE * scaledHexHeight * 0.75) + (scaledHexHeight * 0.25);
    const startX = (canvas.width - scaledBoardWidth) / 2 + (scaledHexWidth / 2);
    const startY = (canvas.height - scaledBoardHeight) / 2 + (scaledHexHeight / 2);

    // Iterate through grid to find closest hex center within range
    // This is an approximation, more accurate point-in-hexagon test is complex
    let closestHex = null;
    let minDistSq = (scaledHexSize * scaledHexSize); // Only consider clicks within roughly one hex radius

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Use potentially flipped coordinates for hit-testing calculation
            const { displayRow, displayCol } = transformCoordinates(r, c);
            const hexCenterX = startX + (displayCol * scaledHexWidth) + (displayRow % 2 === 1 ? scaledHexWidth / 2 : 0);
            const hexCenterY = startY + (displayRow * scaledHexHeight * 0.75);

            const dx = canvasX - hexCenterX;
            const dy = canvasY - hexCenterY;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestHex = { row: r, col: c }; // Store original row/col
            }
        }
    }
    return closestHex;
}


// ============================================================================
// Landmine Logic
// ============================================================================

// Handle explosion when a landmine is hit
function triggerLandmineExplosion(row, col) {
    console.log(`BOOM! Landmine triggered at ${row},${col}`);
    const explosionCenterKey = `${row},${col}`;
    const tile = gameState.getTile(row, col);
    if (!tile) return;

    // Play sound
    playSound('explosion-sound');

    // Determine affected tiles (center + neighbors)
    const affectedCoords = [...getNeighbors(row, col), { row, col }];
    const affectedKeys = new Set(affectedCoords.map(coord => `${coord.row},${coord.col}`));

    // Apply immediate effects locally
    affectedCoords.forEach(coord => {
        const currentTile = gameState.getTile(coord.row, coord.col);
        if (currentTile) {
            currentTile.color = EXPLOSION_COLOR; // Change color
             // Remove ownership
             const key = `${coord.row},${coord.col}`;
             gameState.player1Tiles.delete(key);
             gameState.player2Tiles.delete(key);
             // Add to exploded list for recovery tracking
             // Avoid duplicates if already exploded
             if (!gameState.explodedTiles.some(et => et.row === coord.row && et.col === coord.col)) {
                 gameState.explodedTiles.push({
                     row: coord.row,
                     col: coord.col,
                     turnsLeft: EXPLOSION_RECOVERY_TURNS
                 });
             }
        }
    });

    // Remove the mine itself
    tile.hasMine = false;
    gameState.landmines = gameState.landmines.filter(mine => !(mine.row === row && mine.col === col));

    // Handle disconnected territories *after* removing exploded tiles
    handleDisconnectedTerritories(1); // Check P1
    handleDisconnectedTerritories(2); // Check P2

     // Update UI immediately
     renderGameBoard();
     updateScoreDisplay();
     updateLandmineInfo();

    // Shuffle unclaimed tiles (visual effect)
    // Shuffle should happen *after* state changes but *before* sending to server if online
    shuffleUnclaimedTiles(() => {
        // --- Send to Server or Finalize Locally ---
        if (isOnlineGame && window.sendMove) {
            console.log(`NETWORK: Sending landmine trigger: ${row},${col}`);
            disableControls(); // Wait for server confirmation

            const moveData = {
                type: 'landmine',
                row: row,
                col: col,
                // Server recalculates state based on trigger, doesn't need full client state usually
                playerName: playerName
            };
            window.sendMove(moveData);
            // Do NOT switch turn locally, wait for syncGameState
        } else {
             // Local game: Explosion happened, shuffle done, now switch turn
             messageElement.textContent = `💥 BOOM! Landmine triggered! Unclaimed tiles shuffled.`;
             switchPlayerTurn();
        }
    });
}


// Handle disconnected territories after an explosion for a specific player
function handleDisconnectedTerritories(player) {
    const playerTiles = (player === 1) ? gameState.player1Tiles : gameState.player2Tiles;
    if (playerTiles.size === 0) return; // No tiles, nothing to disconnect

    const segments = findDisconnectedSegments(playerTiles);

    if (segments.length > 1) {
        console.log(`Player ${player} territory split into ${segments.length} segments.`);
        // Find the largest segment (by tile count)
        let largestSegment = segments[0];
        for (let i = 1; i < segments.length; i++) {
            if (segments[i].size > largestSegment.size) {
                largestSegment = segments[i];
            }
        }

        // Keep only the largest segment
        console.log(`Keeping largest segment with ${largestSegment.size} tiles.`);
        if (player === 1) {
            gameState.player1Tiles = largestSegment;
        } else {
            gameState.player2Tiles = largestSegment;
        }
        // The other tiles implicitly become unowned
    }
}

// Find disconnected segments in a set of tiles using BFS
function findDisconnectedSegments(playerTilesSet) {
    const segments = [];      // Array of Sets (each Set is a segment)
    const visited = new Set(); // Keys of tiles already assigned to a segment

    for (const startTileKey of playerTilesSet) {
        if (visited.has(startTileKey)) continue; // Already part of a segment

        // Start a new segment search (BFS)
        const currentSegment = new Set();
        const queue = [startTileKey];
        visited.add(startTileKey);
        currentSegment.add(startTileKey);

        while (queue.length > 0) {
            const tileKey = queue.shift();
            const [row, col] = tileKey.split(',').map(Number);

            const neighbors = getNeighbors(row, col);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;
                // If neighbor is owned by the player and not yet visited
                if (playerTilesSet.has(neighborKey) && !visited.has(neighborKey)) {
                    visited.add(neighborKey);
                    currentSegment.add(neighborKey);
                    queue.push(neighborKey);
                }
            }
        }
        segments.push(currentSegment); // Add the found segment to the list
    }
    return segments;
}

// Shuffle colors of unclaimed tiles (visual effect)
function shuffleUnclaimedTiles(callback) {
    let shuffleCount = 0;
    const shuffleTimes = 8; // Number of rapid shuffles
    const shuffleDelay = 60; // ms between shuffles

    function doShuffle() {
        if (shuffleCount >= shuffleTimes) {
            if (callback) callback(); // Execute callback after shuffling
            return;
        }

        // Iterate through board and shuffle colors of unowned, non-exploded tiles
        let changed = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                 const tile = gameState.getTile(r, c);
                 // Check if tile exists, is unowned, and not currently black (exploded)
                 if (tile && gameState.getOwner(r, c) === 0 && tile.color !== EXPLOSION_COLOR && tile.color !== '#8B0000') { // Avoid black/red
                     tile.color = COLORS[Math.floor(Math.random() * COLORS.length)];
                     changed = true;
                 }
            }
        }

        if (changed) renderGameBoard(); // Re-render if colors changed

        shuffleCount++;
        setTimeout(doShuffle, shuffleDelay);
    }

    doShuffle(); // Start shuffling
}


// ============================================================================
// Power-Up Logic
// ============================================================================

// Setup listeners for power-up slots
function setupPowerUpListeners() {
    document.querySelectorAll('.power-up-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const powerUpType = slot.getAttribute('data-type');

            // Check if player can interact
             if (gameState.gameOver || slot.classList.contains('disabled')) {
                 messageElement.textContent = "Cannot select power-up now.";
                 return; // Ignore click if disabled (not turn, or no powerup)
             }

            // Toggle selection
            if (selectedPowerUp === powerUpType) {
                selectedPowerUp = null; // Deselect
                messageElement.textContent = "Power-up deselected.";
            } else {
                selectedPowerUp = powerUpType; // Select
                messageElement.textContent = `${powerUpType.charAt(0).toUpperCase() + powerUpType.slice(1)} selected. Click target tile.`;
            }
            updatePowerUpDisplay(); // Update visual feedback
        });
    });
}


// Award a random power-up to the specified player
function awardPowerUp(player) {
    const powerUpTypes = Object.values(POWER_UPS);
    const randomPowerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

    if (player === 1) {
        player1PowerUps.push(randomPowerUp);
    } else if (player === 2) {
        player2PowerUps.push(randomPowerUp);
    }

    // Play sound
    playSound('power-up-sound');

    // Update display if the current turn matches the local player number
    if (player === playerNumber) {
        updatePowerUpDisplay();
    }

    // Update message (append to existing message)
    const awardeeName = player === playerNumber ? 'You' : (opponentName || `Player ${player}`);
    messageElement.textContent += ` ${awardeeName} earned a ${randomPowerUp} power-up!`;
}


// Use a selected power-up on a target tile
function usePowerUp(powerUpType, row, col) {
    if (!selectedPowerUp || powerUpType !== selectedPowerUp) return; // Safety check

    const targetKey = `${row},${col}`;
    const targetTile = gameState.getTile(row, col);
    if (!targetTile) return; // Invalid target

    const owner = gameState.getOwner(row, col);
    const isMyTile = owner === gameState.currentPlayer;
    const isOpponentTile = owner !== 0 && owner !== gameState.currentPlayer;
    const isUnclaimed = owner === 0;

    let isValidTarget = false;
    let requiresServerUpdate = false; // Flag if state changes need server sync

    // --- Validate Target based on Power-Up Type ---
    switch (powerUpType) {
        case POWER_UPS.SABOTAGE:
            if (isOpponentTile) {
                isValidTarget = true;
                applySabotage(row, col); // Apply locally
                requiresServerUpdate = true;
            } else {
                messageElement.textContent = "Sabotage must target opponent's tile.";
            }
            break;

        case POWER_UPS.WILDCARD:
            if (isUnclaimed) {
                // Check adjacency to own territory
                const neighbors = getNeighbors(row, col);
                const isAdjacent = neighbors.some(n => gameState.isOwnedBy(n.row, n.col, gameState.currentPlayer));
                if (isAdjacent) {
                    isValidTarget = true;
                    applyWildcard(row, col); // Apply locally
                    requiresServerUpdate = true;
                } else {
                    messageElement.textContent = "Wildcard must target unclaimed tile adjacent to yours.";
                }
            } else {
                messageElement.textContent = "Wildcard must target an unclaimed tile.";
            }
            break;

        case POWER_UPS.TELEPORT:
            if (isUnclaimed) {
                isValidTarget = true;
                applyTeleport(row, col); // Apply locally
                requiresServerUpdate = true;
            } else {
                messageElement.textContent = "Teleport must target an unclaimed tile.";
            }
            break;
    }

    // --- If Target Was Valid ---
    if (isValidTarget) {
        // Consume the power-up locally
        const currentPowerUps = gameState.currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        const index = currentPowerUps.indexOf(powerUpType);
        if (index !== -1) {
            currentPowerUps.splice(index, 1);
        }

        selectedPowerUp = null; // Deselect after use

        // Update UI locally
        renderGameBoard();
        updateScoreDisplay();
        updatePowerUpDisplay(); // Reflect consumed power-up

        // --- Send to Server or Finalize Locally ---
        if (isOnlineGame && window.sendMove && requiresServerUpdate) {
             console.log(`NETWORK: Sending power-up use: ${powerUpType} at ${row},${col}`);
             disableControls(); // Wait for server confirmation

             const moveData = {
                 type: 'power-up',
                 powerUpType: powerUpType,
                 row: row,
                 col: col,
                 playerName: playerName
                 // Server recalculates state based on action, target, and player
             };
             window.sendMove(moveData);
             // Do NOT switch turn locally - wait for syncGameState
             // Note: We keep the local optimistic update for now, server state will overwrite
        } else if (!isOnlineGame) {
             // Local game: Power-up applied, now switch turn
             switchPlayerTurn();
        }
    } else {
        // Invalid target, deselect power-up
        selectedPowerUp = null;
        updatePowerUpDisplay();
    }
}


// Apply Sabotage effect locally
function applySabotage(row, col) {
    const tileKey = `${row},${col}`;
    const tile = gameState.getTile(row, col);
    if (!tile) return;

    // Remove from opponent's territory
    if (gameState.currentPlayer === 1) gameState.player2Tiles.delete(tileKey);
    else gameState.player1Tiles.delete(tileKey);

    // Change color and add to recovery list
    tile.color = '#8B0000'; // Dark Red
    // Avoid duplicates
     if (!gameState.explodedTiles.some(et => et.row === row && et.col === col)) {
        gameState.explodedTiles.push({
            row: row, col: col, turnsLeft: 3, type: 'sabotage' // 3 turns recovery
        });
     }

    messageElement.textContent = "Sabotage applied! Tile turns neutral over time.";
}

// Apply Wildcard effect locally
function applyWildcard(row, col) {
    const tileKey = `${row},${col}`;
    const tile = gameState.getTile(row, col);
    if (!tile) return;

    // Add to current player's territory
    if (gameState.currentPlayer === 1) gameState.player1Tiles.add(tileKey);
    else gameState.player2Tiles.add(tileKey);

    // Set tile to player's current color
    tile.color = gameState.currentPlayer === 1 ? gameState.player1Color : gameState.player2Color;

    messageElement.textContent = "Wildcard claimed an adjacent tile!";
}

// Apply Teleport effect locally
function applyTeleport(row, col) {
    const tileKey = `${row},${col}`;
    const tile = gameState.getTile(row, col);
    if (!tile) return;

     // Add to current player's territory
     if (gameState.currentPlayer === 1) gameState.player1Tiles.add(tileKey);
     else gameState.player2Tiles.add(tileKey);

    // Set tile to player's current color
    tile.color = gameState.currentPlayer === 1 ? gameState.player1Color : gameState.player2Color;

    // Check if teleport revealed a mine (can happen)
    if (tile.hasMine) {
        messageElement.textContent = "Teleport successful! Uh oh, it's a mine!";
        // Trigger explosion immediately (no brief capture shown)
         // Render board to show teleported tile color briefly?
         renderGameBoard();
         updateScoreDisplay();
         setTimeout(() => {
              triggerLandmineExplosion(row, col); // This will handle state updates and turn switch
         }, 300);
         // Prevent normal turn switch after teleport if mine triggered
         // The triggerLandmineExplosion handles the turn switch after its process
         // We need a way to signal this... maybe return true from applyTeleport if mine?
         // For now, assume triggerLandmine takes over.
    } else {
         messageElement.textContent = "Teleport successful! New territory started.";
         // Normal turn switch happens after applyTeleport finishes in usePowerUp
    }
}


// ============================================================================
// Network Communication Wrappers (Called by game logic)
// ============================================================================

// NOTE: window.sendMove is expected to be defined by multiplayer.js
// These functions prepare data and call window.sendMove.

// Example structure (actual calls are embedded in handleColorSelection, usePowerUp, triggerLandmineExplosion)
/*
function sendColorMoveToServer(selectedColor) {
    if (!isOnlineGame || !window.sendMove) return;
    disableControls();
    window.sendMove({
        type: 'color-selection',
        color: selectedColor,
        playerName: playerName
    });
}

function sendPowerUpMoveToServer(powerUpType, row, col) {
    if (!isOnlineGame || !window.sendMove) return;
    disableControls();
    window.sendMove({
        type: 'power-up',
        powerUpType: powerUpType,
        row: row,
        col: col,
        playerName: playerName
    });
}

function sendLandmineTriggerToServer(row, col) {
     if (!isOnlineGame || !window.sendMove) return;
     disableControls();
     window.sendMove({
         type: 'landmine',
         row: row,
         col: col,
         playerName: playerName
     });
}
*/

// ============================================================================
// Utility Functions
// ============================================================================

// Helper function to convert hex color to RGB object
function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null; // Basic validation
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) { // Expand shorthand hex
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return null; // Invalid length

    const bigint = parseInt(hex, 16);
    if (isNaN(bigint)) return null; // Invalid hex characters

    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
}

// Helper to play sound by ID
function playSound(soundId) {
    const soundElement = document.getElementById(soundId);
    if (soundElement instanceof HTMLAudioElement) {
        soundElement.currentTime = 0; // Rewind
        soundElement.play().catch(error => console.log(`Sound play error (${soundId}):`, error));
    }
}