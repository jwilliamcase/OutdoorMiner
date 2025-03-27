import { BOARD } from './constants.js';
import { getHexCenter, worldToHex, GameState } from './gameLogic.js';
import { sendTilePlacement, sendMessage } from './network.js'; // Import network functions
import { uiManager } from './uiManager.js';

// --- State ---
let gameState = null; // Holds the current game state object
let canvas = null;
let ctx = null;
let selectedColor = null; // Will be removed once we finish the refactor
let currentPlayerId = null; // Store the client's player ID for UI logic
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let cameraOffset = { x: 0, y: 0 }; // Pan offset
let isTransitioning = false;
const TURN_TRANSITION_DELAY = 800; // ms

// --- DOM Elements ---
let setupContainer = null;
let gameContainer = null;
let canvasContainer = null;
let connectionStatusElement = null;
let connectionIndicator = null;
let messageArea = null;
let player1Info = null;
let player2Info = null;
let colorButtons = [];
let chatInput = null;
let chatMessages = null;
let rowsInput = null;
let colsInput = null;

// Change to module-level elements object instead of using 'this'
let elements = {};

// --- Initialization ---
export function initializeUI() {
    try {
        // Initialize DOM elements first
        setupContainer = document.getElementById('setup-container');
        gameContainer = document.getElementById('game-container');
        connectionStatusElement = document.getElementById('status-text');
        connectionIndicator = document.getElementById('connection-indicator');
        messageArea = document.getElementById('message-area');
        player1Info = document.getElementById('player1-info');
        player2Info = document.getElementById('player2-info');
        canvasContainer = document.getElementById('game-area');

        if (!setupContainer || !gameContainer || !connectionStatusElement || !connectionIndicator) {
            throw new Error("Critical UI elements not found");
        }

        if (!uiManager.initialize()) {
            throw new Error("UI Manager initialization failed");
        }

        // Initialize canvas context
        canvas = uiManager.getElement('game.canvas');
        ctx = canvas?.getContext('2d');
        
        if (!canvas || !ctx) {
            throw new Error("Canvas initialization failed");
        }

        // Set up canvas event listeners
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);

        // Initialize color buttons
        setupColorButtons();

        // Add window resize listener
        window.addEventListener('resize', resizeGame);

        console.log("UI Initialized successfully");
        return true;
    } catch (error) {
        console.error("UI initialization error:", error);
        return false;
    }
}

function setupColorButtons() {
    if (!uiManager.initializeColorButtons()) {
        console.error("Failed to initialize color buttons");
        return;
    }

    const colorOptions = uiManager.getElement('game.colorOptions');
    colorOptions.querySelectorAll('.color-button').forEach(button => {
        button.addEventListener('click', handleColorSelection);
    });
}

// Add new function to update game code display
export function updateGameCode(code) {
    if (elements.currentGameCode) {
        elements.currentGameCode.textContent = code || '-';
    }
}

// --- Screen Management ---
export function showSetupScreen() {
    console.log("showSetupScreen - START");
    if (gameContainer) gameContainer.style.display = 'none';
    if (setupContainer) {
        setupContainer.style.display = 'flex'; // Or 'block', depending on layout
        console.log("Setup screen displayed");
    } else {
        console.error("setupContainer not found");
    }
     // Reset potentially selected color when going back to setup
    selectedColor = null;
    // Clear player info?
    if (player1Info) player1Info.textContent = "Player 1: -";
    if (player2Info) player2Info.textContent = "Player 2: -";
    console.log("showSetupScreen - END");
}

// Update showGameScreen to use uiManager
export function showGameScreen() {
    const gameContainer = uiManager.getElement('game.container');
    const setupContainer = uiManager.getElement('setup.container');

    if (!gameContainer || !setupContainer) {
        console.error("Required containers not found");
        return;
    }

    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    // Force a resize to ensure canvas is properly sized
    requestAnimationFrame(() => {
        resizeGame();
        if (gameState) {
            renderGameBoard();
            updateAvailableColors(gameState.lastUsedColor); // Update color buttons state
        }
    });

    console.log("showGameScreen - END");
}

// --- Rendering ---

// Resize canvas and re-render
export function resizeGame() {
    if (!canvas) {
        console.warn("Canvas not ready for resize.");
        return;
    }
    
    // Set default dimensions if container is not available or has no dimensions
    let width = 800;  // Default width
    let height = 600; // Default height
    
    if (canvasContainer) {
        // Get parent container dimensions
        const containerRect = canvasContainer.getBoundingClientRect();
        if (containerRect.width > 0 && containerRect.height > 0) {
            width = containerRect.width;
            height = containerRect.height;
        }
    }

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);

    if (gameState) {
        console.log("resizeGame triggered, re-rendering.");
        renderGameBoard();
    } else {
        console.log("resizeGame triggered, but gameState not ready for rendering.");
        // Draw placeholder
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#eee';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#555';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Waiting for game to start...", canvas.width / 2, canvas.height / 2);
        }
    }
}

// Draw the entire game board
export function renderGameBoard() {
    if (!ctx || !gameState) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Calculate board dimensions using BOARD constants
    const boardWidth = gameState.cols * BOARD.HORIZONTAL_SPACING;
    const boardHeight = gameState.rows * BOARD.VERTICAL_SPACING;

    // Center the board
    const centerX = (canvas.width - boardWidth) / 2;
    const centerY = (canvas.height - boardHeight) / 2;

    // Apply camera offset
    ctx.translate(centerX + cameraOffset.x, centerY + cameraOffset.y);

    // If player 2, flip the board 180 degrees around its center
    if (currentPlayerId === gameState.players[1]?.id) {
        ctx.translate(boardWidth / 2, boardHeight / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-boardWidth / 2, -boardHeight / 2);
    }

    // Render the board
    Object.entries(gameState.board).forEach(([key, tile]) => {
        drawHexagon(tile.q, tile.r, tile.color, tile.owner !== null);
    });

    ctx.restore();
}

// Add new function to center view on player's starting position
export function centerOnPlayerStart() {
    if (!canvas || !gameState) return;

    // Always center on bottom-left corner of the board
    const startX = 0;
    const startY = (gameState.rows - 1) * BOARD.VERTICAL_SPACING;
    
    cameraOffset.x = (canvas.width / 2) - startX;
    cameraOffset.y = (canvas.height / 2) - startY;
    
    renderGameBoard();
}

// Draw a single hexagon
function drawHexagon(q, r, color, isOwned = false) {
    if (!ctx) return;

    const center = getHexCenter(q, r);
    const points = [];
    
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        points.push({
            x: center.x + BOARD.HEX_SIZE * Math.cos(angle),
            y: center.y + BOARD.HEX_SIZE * Math.sin(angle)
        });
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();

    // Fill with color
    ctx.fillStyle = color;
    ctx.fill();

    // Draw stronger border for owned territories
    ctx.strokeStyle = isOwned ? '#000' : '#666';
    ctx.lineWidth = isOwned ? 2 : 1;
    ctx.stroke();
}

// --- UI Updates ---

// Update the connection status display
export function updateConnectionStatus(isConnected, message = '') {
    console.log(`Updating connection status: ${isConnected}, ${message}`);
    if (!connectionStatusElement || !connectionIndicator) {
        console.warn("Connection status elements not found.");
        return;
    }
    connectionIndicator.style.backgroundColor = isConnected ? 'lime' : 'red';
    connectionStatusElement.textContent = message || (isConnected ? 'Connected' : 'Disconnected');
}

// Display messages to the user
export function displayMessage(message, isError = false) {
    if (!messageArea) return;
    messageArea.textContent = message;
    messageArea.className = isError ? 'error' : 'info'; // Apply CSS class
     // Clear message after a delay
     setTimeout(() => {
        if (messageArea.textContent === message) { // Only clear if message hasn't changed
             messageArea.textContent = '';
             messageArea.className = '';
         }
     }, 5000); // Clear after 5 seconds
}


// Update player information display (name, score)
export function updatePlayerInfo(playersData, ownPlayerId) {
     console.log("Updating player info:", playersData, "My ID:", ownPlayerId);
     if (!player1Info || !player2Info || !playersData) {
         console.warn("Cannot update player info: Missing elements or data.");
         return;
     }

     const playerIds = Object.keys(playersData);
     // Simple assignment: first player is P1, second is P2
     // This might be incorrect if player join order != desired display order.
     // Server should ideally assign player numbers or colors consistently.

     if (playerIds.length > 0) {
         const p1Id = playerIds[0];
         const p1 = playersData[p1Id];
         let p1Name = p1.name || `Player ${p1Id.substring(0, 4)}`;
         if (p1Id === ownPlayerId) p1Name += " (You)";
         player1Info.textContent = `${p1Name}: ${p1.score}`;
         player1Info.style.color = p1.color || '#000'; // Use player color
     } else {
         player1Info.textContent = "Player 1: -";
         player1Info.style.color = '#000';
     }

     if (playerIds.length > 1) {
         const p2Id = playerIds[1];
         const p2 = playersData[p2Id];
         let p2Name = p2.name || `Player ${p2Id.substring(0, 4)}`;
         if (p2Id === ownPlayerId) p2Name += " (You)";
         player2Info.textContent = `${p2Name}: ${p2.score}`;
         player2Info.style.color = p2.color || '#000'; // Use player color
     } else {
         player2Info.textContent = "Player 2: -";
         player2Info.style.color = '#000';
     }
}

// Add a chat message to the chat area
export function addChatMessage(sender, message) {
    if (!chatMessages) return;
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Display game over message
export function showGameOver(winnerId, playersData, ownPlayerId) {
    let message = "Game Over! ";
    if (winnerId === 'draw') {
        message += "It's a draw!";
    } else if (playersData && playersData[winnerId]) {
        let winnerName = playersData[winnerId].name || `Player ${winnerId.substring(0,4)}`;
        if (winnerId === ownPlayerId) {
            winnerName = "You";
            message += `${winnerName} win!`;
        } else {
             message += `${winnerName} wins!`;
        }
    } else {
        message += `Winner: ${winnerId ? winnerId.substring(0,4) : 'Unknown'}`;
    }
    displayMessage(message, false);
    // Optionally disable further interaction
    // canvas.removeEventListener('click', handleCanvasClick);
}


// --- Event Handlers ---

// Handle clicks on the canvas
function handleCanvasClick(event) {
    if (!gameState || gameState.gameOver) {
        console.log("Canvas click ignored: Game not active or over.");
        return;
    }

     if (!currentPlayerId || gameState.getCurrentPlayerId() !== currentPlayerId) {
         displayMessage("Not your turn!", true);
         return;
     }

     // Convert click coordinates to world coordinates (relative to canvas, considering pan)
     const rect = canvas.getBoundingClientRect();
     let x = event.clientX - rect.left - cameraOffset.x;
     let y = event.clientY - rect.top - cameraOffset.y;

     // If player 2, transform the coordinates
     if (currentPlayerId === gameState.players[1]?.id) {
         const boardWidth = gameState.cols * BOARD.HORIZONTAL_SPACING;
         const boardHeight = gameState.rows * BOARD.VERTICAL_SPACING;
         x = boardWidth - x;
         y = boardHeight - y;
     }

     const hexCoords = worldToHex(x, y);
     console.log(`Canvas click at (${event.clientX}, ${event.clientY}), World (${x}, ${y}), Hex (${hexCoords.q}, ${hexCoords.r})`);


    // Check if the click corresponds to a valid hex on the board
    const key = `${hexCoords.q},${hexCoords.r}`;
    if (gameState.board[key]) {
        console.log(`Attempting to place tile at (${hexCoords.q}, ${hexCoords.r})`);
        // Send placement to server via network module
        sendTilePlacement(hexCoords.q, hexCoords.r);
        // The UI should be updated based on server response ('game-update')
        // Optionally provide immediate feedback (e.g., temporary placement color)
        // but the authoritative state comes from the server.
    } else {
        console.log(`Click at (${hexCoords.q}, ${hexCoords.r}) is outside the defined board area.`);
        displayMessage("Clicked outside the board.", true);
    }
}


// Handle color selection from buttons
function handleColorSelection(event) {
    if (!gameState || gameState.gameOver) {
        displayMessage("Game is not active", true);
        return;
    }

    if (!currentPlayerId || gameState.getCurrentPlayerId() !== currentPlayerId) {
        displayMessage("Not your turn!", true);
        return;
    }

    const selectedColor = event.target.dataset.color;
    if (selectedColor === gameState.lastUsedColor) {
        displayMessage("This color was just used by your opponent!", true);
        return;
    }

    sendTilePlacement(selectedColor);
}

// --- Panning Handlers ---
function handleMouseDown(event) {
    isDragging = true;
    lastMousePos = { x: event.clientX, y: event.clientY };
    canvas.style.cursor = 'grabbing';
}

function handleMouseMove(event) {
    if (!isDragging) return;

    const currentMousePos = { x: event.clientX, y: event.clientY };
    const dx = currentMousePos.x - lastMousePos.x;
    const dy = currentMousePos.y - lastMousePos.y;

    cameraOffset.x += dx;
    cameraOffset.y += dy;

    lastMousePos = currentMousePos;

    // Re-render the board with the new offset
    if (gameState) {
        renderGameBoard();
    }
}

function handleMouseUp() {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab'; // Or default
    }
}


// --- Game State Handling ---

// Called by network module when initial game state is received
// Expects gameStateObject to be a plain JS object from the server
export function handleInitialState(gameStateObject, playersData, ownPlayerId) {
    console.log("Handling initial state:", gameStateObject, "Players:", playersData, "My ID:", ownPlayerId);
    
    if (!gameStateObject) {
        console.error("Failed to initialize: No game state provided");
        return false;
    }

    try {
        // Create new game state instance with correct dimensions
        gameState = new GameState(gameStateObject.rows, gameStateObject.cols);
        
        // Ensure the board is properly copied
        gameState.board = gameStateObject.board || {};
        gameState.players = playersData || {};
        currentPlayerId = ownPlayerId;

        console.log("Game state initialized:", gameState);
        
        // Show game screen and set up display
        showGameScreen();
        centerCamera();
        
        // Force a redraw after a short delay to ensure DOM is ready
        setTimeout(() => {
            resizeGame();
            renderGameBoard();
            updatePlayerInfo(gameState.players, currentPlayerId);
        }, 100);
        
        console.log("Initial game state processed successfully");
        return true;
    } catch (error) {
        console.error("Error initializing game state:", error);
        displayMessage("Error initializing game. Check console.", true);
        return false;
    }
}

// Expects gameStateObject to be a plain JS object from the server
export function handleGameUpdate(gameStateObject) {
    if (!gameStateObject) {
        console.error("Failed to update game state");
        return;
    }

    // Start turn transition if it's a new turn
    const isNewTurn = gameState && 
        gameState.currentPlayerIndex !== gameStateObject.currentPlayerIndex;
    
    if (isNewTurn) {
        isTransitioning = true;
        handleTurnTransition(gameStateObject);
    } else {
        updateGameState(gameStateObject);
    }
}

// Add new function for turn transition
function handleTurnTransition(newState) {
    // Flash turn indicator
    const turnIndicator = elements.turnIndicator;
    turnIndicator.classList.add('transitioning');
    
    // Show who's turn is next
    const nextPlayer = newState.getCurrentPlayerId() === currentPlayerId ? "Your" : "Opponent's";
    turnIndicator.textContent = `${nextPlayer} turn...`;
    
    // Add transition delay
    setTimeout(() => {
        updateGameState(newState);
        turnIndicator.classList.remove('transitioning');
        isTransitioning = false;
    }, TURN_TRANSITION_DELAY);
}

// Separate state update logic
function updateGameState(newState) {
    gameState = new GameState(newState.rows, newState.cols);
    Object.assign(gameState, newState);

    // Update UI elements
    updateAvailableColors(gameState.lastUsedColor);
    updateTurnIndicator();
    renderGameBoard();
    updatePlayerInfo(gameState.players, currentPlayerId);
}

// Add new function for turn indicator
function updateTurnIndicator() {
    const turnIndicator = elements.turnIndicator;
    if (!turnIndicator || !gameState) return;

    const isMyTurn = gameState.getCurrentPlayerId() === currentPlayerId;
    turnIndicator.className = `turn-indicator ${isMyTurn ? 'my-turn' : 'opponent-turn'}`;
    turnIndicator.textContent = isMyTurn ? "Your Turn!" : "Opponent's Turn";
}

// Helper to roughly center the view on the board
function centerCamera() {
    if (!canvas || !gameState || !gameState.rows || !gameState.cols) return;

    const centerQ = Math.floor(gameState.cols / 2);
    const centerR = Math.floor(gameState.rows / 2);
    const boardCenter = getHexCenter(centerQ, centerR);

    // Adjust camera to center the board
    cameraOffset.x = (canvas.width / 2) - boardCenter.x;
    cameraOffset.y = (canvas.height / 2) - boardCenter.y;
    
    console.log("Camera centered", { x: cameraOffset.x, y: cameraOffset.y });
}

// --- Audio ---
// Helper function to play sounds
export function playSound(soundName) {
    // Example: find audio element and play
    try {
        const sound = document.getElementById(`sound-${soundName}`);
        if (sound) {
            sound.currentTime = 0; // Reset playback to play again if clicked rapidly
            sound.play().catch(error => console.error(`Error playing sound ${soundName}:`, error));
        } else {
            console.warn(`Sound element not found: sound-${soundName}`);
            // Attempt dynamic load as fallback (if not preloaded) - less reliable
            const audio = new Audio(`sounds/${soundName}.mp3`);
             audio.play().catch(error => console.error(`Error playing dynamic sound ${soundName}:`, error));
        }
     } catch (error) {
         console.error(`General error playing sound ${soundName}:`, error);
     }
}

function initializeColorButtons() {
    const colorOptions = document.querySelector('.color-options');
    CONFIG.GAME_COLORS.forEach(color => {
        const button = document.createElement('button');
        button.className = 'color-button';
        button.style.backgroundColor = color;
        button.dataset.color = color;
        button.addEventListener('click', handleColorSelection);
        colorOptions.appendChild(button);
    });
}

function updateAvailableColors(lastUsedColor) {
    const buttons = document.querySelectorAll('.color-button');
    buttons.forEach(button => {
        button.classList.remove('disabled', 'last-used');
        if (button.dataset.color === lastUsedColor) {
            button.classList.add('disabled');
        }
    });

    // Update last used color display
    const lastUsedDisplay = document.getElementById('last-used-color');
    if (lastUsedDisplay) {
        lastUsedDisplay.style.backgroundColor = lastUsedColor;
    }
}
