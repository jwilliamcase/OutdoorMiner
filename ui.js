import { BOARD } from './constants.js';
import { GameState } from './gameLogic.js';
import { sendTilePlacement, sendChatMessage } from './network.js';  // Update import
import { uiManager } from './uiManager.js';  // Remove displayMessage import
import { HexService } from './services/HexService.js';
import { eventManager } from './eventManager.js';
import { UIEvents } from './eventTypes.js';

// --- Core State ---
let gameState = null;
let canvas = null;
let ctx = null;
let currentPlayerId = null;
let cameraOffset = { x: 0, y: 0 };

// --- DOM Elements ---
let setupContainer = null;
let gameContainer = null;
let connectionStatusElement = null;
let connectionIndicator = null;
let messageArea = null;
let player1Info = null;
let player2Info = null;
let chatMessages = null;

// --- Initialization ---
export function initializeUI() {
    console.log("Starting UI initialization...");
    
    try {
        // First initialize the UI manager
        if (!uiManager.initialize()) {
            throw new Error("UI Manager initialization failed");
        }

        // Initialize canvas and context
        canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error("Canvas element not found");
        }

        ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error("Failed to get canvas context");
        }

        // Cache critical elements
        setupContainer = document.getElementById('setup-container');
        gameContainer = document.getElementById('game-container');
        connectionStatusElement = document.getElementById('status-text');
        connectionIndicator = document.getElementById('connection-indicator');
        messageArea = document.getElementById('message-area');

        // Verify critical elements
        if (!setupContainer || !gameContainer) {
            throw new Error("Critical UI elements missing");
        }

        // Setup initial event listeners
        setupInitialEventListeners();

        console.log("UI Initialized successfully");
        return true;
    } catch (error) {
        console.error("UI initialization error:", error);
        displayFallbackError("Failed to initialize game interface");
        return false;
    }
}

function setupInitialEventListeners() {
    // Add only essential event listeners here
    window.addEventListener('resize', resizeGame);
    // Other critical listeners...
}

// Replace direct displayMessage calls with uiManager.displayMessage
function displayFallbackError(message) {
    uiManager.displayMessage(message, true);
}

// Add new function to update game code display
export function updateGameCode(code) {
    const shareLink = document.querySelector('.share-link');
    const fullUrl = `${window.location.origin}${window.location.pathname}?code=${code}`;
    
    if (!shareLink) {
        const shareDiv = document.createElement('div');
        shareDiv.className = 'share-link';
        shareDiv.innerHTML = `
            <span>Share Code: ${code}</span>
            <input type="text" value="${fullUrl}" readonly onclick="this.select()">
            <button onclick="navigator.clipboard.writeText('${fullUrl}')">Copy URL</button>
        `;
        document.body.appendChild(shareDiv);
    } else {
        shareLink.innerHTML = `
            <span>Share Code: ${code}</span>
            <input type="text" value="${fullUrl}" readonly onclick="this.select()">
            <button onclick="navigator.clipboard.writeText('${fullUrl}')">Copy URL</button>
        `;
        shareLink.style.display = 'flex';
    }
}

// --- Screen Management ---
export function showSetupScreen() {
    console.log("showSetupScreen - START");
    if (gameContainer) gameContainer.style.display = 'none';
    if (setupContainer) {
        setupContainer.style.display = 'flex';
        console.log("Setup screen displayed");
    } else {
        console.error("setupContainer not found");
    }

    // Clear player info
    if (player1Info) player1Info.textContent = "Player 1: -";
    if (player2Info) player2Info.textContent = "Player 2: -";

    // Make room code input editable
    const roomCodeInput = document.getElementById('room-code-input');
    if (roomCodeInput) {
        roomCodeInput.readOnly = false;
    }
    
    console.log("showSetupScreen - END");
}

// Update showGameScreen to use uiManager
export function showGameScreen() {
    const gameContainer = document.getElementById('game-container');
    const setupContainer = document.getElementById('setup-container');

    if (!gameContainer || !setupContainer) {
        console.error("Required containers not found");
        return;
    }

    // Clear any existing color buttons before showing screen
    const colorOptions = document.querySelector('.color-options');
    if (colorOptions) {
        colorOptions.innerHTML = '';
    }

    setupContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    
    // Single initialization of color buttons
    initializeColorButtons();

    // Make sure share link is visible when game screen shows
    const shareLink = document.querySelector('.share-link');
    if (shareLink) {
        shareLink.style.display = 'flex';
    }

    requestAnimationFrame(() => {
        resizeGame();
        if (gameState) {
            renderGameBoard();
            updateAvailableColors(gameState.lastUsedColor);
        }
    });
}

// --- Rendering Core ---
function drawHexagon(ctx, x, y, color, isOwned = false) {
    const size = gameState.currentHexSize;
    const geometry = getHexGeometry(size);
    ctx.beginPath();

    // Use exact geometry for pointy-top hex
    geometry.vertices.forEach((vertex, i) => {
        const px = x + vertex.x;
        const py = y + vertex.y;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();

    // Fill and stroke
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isOwned ? '#000' : '#666';
    ctx.lineWidth = isOwned ? 2 : 1;
    ctx.stroke();
}

export function renderGameBoard() {
    if (!ctx || !gameState?.boardState) return;

    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        const isPlayer2 = currentPlayerId === gameState.players.P2?.socketId;
        const size = gameState.currentHexSize;
        
        // Calculate exact board dimensions using hex geometry
        const hexGeo = getHexGeometry(size);
        const boardWidth = (gameState.cols * hexGeo.colSpacing) + size;
        const boardHeight = (gameState.rows * hexGeo.rowSpacing) + hexGeo.height / 2;

        // Center board with proper padding
        const offsetX = (canvas.width - boardWidth) / 2 + BOARD.PADDING;
        const offsetY = (canvas.height - boardHeight) / 2 + BOARD.PADDING;

        // Handle player 2's rotated view
        if (isPlayer2) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(Math.PI);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
        }
        ctx.translate(offsetX, offsetY);

        // Render each hex using precise positioning
        Object.entries(gameState.boardState).forEach(([coord, tile]) => {
            const [q, r] = coord.split(',').map(Number);
            const pos = HexService.hexToPixel(q, r, size);
            drawHexagon(ctx, pos.x, pos.y, tile.color, tile.owner !== null);
        });

        ctx.restore();
    } catch (error) {
        console.error('Render error:', error);
        eventManager.dispatchEvent(UIEvents.ERROR, { message: 'Render failed', error });
    }
}

export function resizeGame() {
    if (!canvas || !gameState) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const hexSize = calculateOptimalHexSize(rect.width, rect.height, gameState.cols, gameState.rows);
    
    // Set canvas size
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Update game state
    gameState.currentHexSize = hexSize;
    
    renderGameBoard();
}

// --- Game State Handling ---
export function handleInitialState(gameStateObject, playersData, ownPlayerId) {
    if (!gameStateObject || !playersData || !ownPlayerId) {
        console.error("Invalid initialization data");
        uiManager.displayMessage("Failed to initialize game state", true);
        return false;
    }

    try {
        // Initialize game state with validation
        gameState = new GameState(
            gameStateObject.rows || CONFIG.BOARD_SIZE,
            gameStateObject.cols || CONFIG.BOARD_SIZE
        );

        if (!gameState.initializeState(gameStateObject, ownPlayerId)) {
            throw new Error('State initialization failed');
        }

        // Update UI with verified state
        currentPlayerId = ownPlayerId;
        updateUI();
        showGameScreen();

        return true;
    } catch (error) {
        console.error("Error in state initialization:", error);
        uiManager.displayMessage("Failed to initialize game. Please refresh.", true);
        return false;
    }
}

// --- UI Updates ---
function updateUI() {
    updateTurnIndicator();
    updatePlayerInfo();
    updateAvailableColors();
    renderGameBoard();
}

// Update player information display (name, score)
export function updatePlayerInfo(playersData, ownPlayerId) {
    console.log("Updating player info:", playersData, "My ID:", ownPlayerId);
    
    const player1Info = document.getElementById('player1-info');
    const player2Info = document.getElementById('player2-info');
    
    if (!player1Info || !player2Info || !playersData) {
        console.warn("Cannot update player info: Missing elements or data.");
        return;
    }

    const players = Object.entries(playersData);
    
    // Update player 1 info
    if (players.length > 0) {
        const [id, data] = players[0];
        const name = data.name || `Player ${id.substring(0, 4)}`;
        player1Info.textContent = `${name}: ${data.score || 0}`;
        player1Info.style.color = data.color || '#000';
    }
    
    // Update player 2 info
    if (players.length > 1) {
        const [id, data] = players[1];
        const name = data.name || `Player ${id.substring(0, 4)}`;
        player2Info.textContent = `${name}: ${data.score || 0}`;
        player2Info.style.color = data.color || '#000';
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
    
    // Use the renamed import
    sendChatMessage(message);
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
    if (!gameState || !isCurrentPlayer()) return;

    const rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left - BOARD.PADDING;
    let y = event.clientY - rect.top - BOARD.PADDING;

    // Handle Player 2's rotated view
    const isPlayer2 = currentPlayerId === gameState.players.P2?.socketId;
    if (isPlayer2) {
        x = canvas.width - x - (2 * BOARD.PADDING);
        y = canvas.height - y - (2 * BOARD.PADDING);
    }

    // Use HexService for coordinate conversion
    const hexCoords = HexService.pixelToHex(x, y, gameState.currentHexSize);
    
    if (HexService.isValidPosition(hexCoords.q, hexCoords.r, gameState.cols)) {
        const key = `${hexCoords.q},${hexCoords.r}`;
        if (gameState.boardState[key] && !gameState.boardState[key].owner) {
            sendTilePlacement(hexCoords.q, hexCoords.r);
        }
    }
}

// Handle color selection from buttons
function handleColorSelection(event) {
    if (!gameState || gameState.gameOver) {
        displayMessage("Game is not active", true);
        return;
    }

    const mySymbol = currentPlayerId === gameState.players.P1?.socketId ? 'P1' : 'P2';
    
    console.log('Color selection attempt:', {
        currentPlayer: gameState.currentPlayer,
        mySymbol,
        myId: currentPlayerId,
        p1Id: gameState.players.P1?.socketId,
        p2Id: gameState.players.P2?.socketId
    });

    if (gameState.currentPlayer !== mySymbol) {
        displayMessage("Not your turn!", true);
        return;
    }

    const selectedColor = event.target.dataset.color;
    if (selectedColor === gameState.lastUsedColor) {
        displayMessage("This color was just used!", true);
        return;
    }

    // Send the move to server
    sendTilePlacement({
        type: 'color-select',
        color: selectedColor,
        player: mySymbol
    });
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
export function handleTurnTransition(newState) {
    console.log("Handling turn transition:", newState);
    
    if (!newState || !newState.boardState) {
        console.error("Invalid state received:", newState);
        return;
    }

    try {
        // Create new game state
        gameState = new GameState(newState.rows, newState.cols);
        
        // Deep copy the entire state properly
        gameState.boardState = {};
        Object.entries(newState.boardState).forEach(([key, tile]) => {
            gameState.boardState[key] = {
                q: parseInt(key.split(',')[0]),
                r: parseInt(key.split(',')[1]),
                color: tile.color,
                owner: tile.owner
            };
        });

        // Copy other state properties
        gameState.currentPlayer = newState.currentPlayer;
        gameState.lastUsedColor = newState.lastUsedColor;
        gameState.players = JSON.parse(JSON.stringify(newState.players)); // Deep copy players
        gameState.currentHexSize = newState.currentHexSize || BOARD.HEX_SIZE;
        gameState.rows = newState.rows;
        gameState.cols = newState.cols;

        // Debug logging
        console.log("Board state after update:", {
            tiles: Object.keys(gameState.boardState).length,
            players: gameState.players,
            currentPlayer: gameState.currentPlayer
        });

        // Update UI elements
        const mySymbol = currentPlayerId === gameState.players.P1?.socketId ? 'P1' : 'P2';
        const isMyTurn = gameState.currentPlayer === mySymbol;
        
        // Ensure canvas is ready
        if (!canvas || !ctx) {
            console.error("Canvas not initialized");
            return;
        }

        // Clear the canvas completely
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update other UI elements
        updateScores(gameState.players);
        updateTurnIndicator(gameState.currentPlayer);
        updateAvailableColors(newState.lastUsedColor);
        
        // Force a resize to ensure proper board setup
        resizeGame();
        
        // Render with a slight delay to ensure state is fully updated
        setTimeout(() => {
            renderGameBoard();
        }, 50);

    } catch (error) {
        console.error("Error in turn transition:", error);
        console.error(error.stack);
        uiManager.displayMessage("Error updating game state", true);
    }
}

function updateScores(players) {
    if (!players) return;

    const p1Info = document.getElementById('player1-info');
    const p2Info = document.getElementById('player2-info');
    
    if (p1Info && players.P1) {
        p1Info.textContent = `${players.P1.name}: ${players.P1.score || 0}`;
        p1Info.style.color = players.P1.color || '#000';
        
        // Add score animation if this player just captured tiles
        if (players.P1.lastCaptured > 0) {
            p1Info.classList.add('score-update');
            setTimeout(() => p1Info.classList.remove('score-update'), 1000);
        }
    }
    
    if (p2Info && players.P2) {
        p2Info.textContent = `${players.P2.name}: ${players.P2.score || 0}`;
        p2Info.style.color = players.P2.color || '#000';
        
        // Add score animation if this player just captured tiles
        if (players.P2.lastCaptured > 0) {
            p2Info.classList.add('score-update');
            setTimeout(() => p2Info.classList.remove('score-update'), 1000);
        }
    }
}

// Separate state update logic
function updateGameState(newState) {
    if (!newState) return;
    
    try {
        // Update game state
        gameState = new GameState(newState.rows, newState.cols);
        Object.assign(gameState, newState);
        
        // Update UI elements safely
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            updateTurnIndicator(newState.currentPlayer);
        }
        
        updateAvailableColors(gameState.lastUsedColor);
        updateScores(gameState.players);
        renderGameBoard();
        
    } catch (error) {
        console.error('Error updating game state:', error);
        uiManager.displayMessage('Error updating game state', true);
    }
}

// Add new function for turn indicator
function updateTurnIndicator(currentPlayer) {
    const turnIndicator = document.getElementById('turn-indicator');
    if (!turnIndicator || !gameState?.players) return;

    // Get player symbols based on socket IDs
    const mySymbol = currentPlayerId === gameState.players.P1?.socketId ? 'P1' : 
                     currentPlayerId === gameState.players.P2?.socketId ? 'P2' : null;

    console.log('Turn Update Debug:', {
        currentPlayer,
        mySymbol,
        currentPlayerId,
        p1Id: gameState.players.P1?.socketId,
        p2Id: gameState.players.P2?.socketId,
        isMyTurn: currentPlayer === mySymbol
    });

    // Only show "Your Turn" if it's actually this player's turn
    const isMyTurn = currentPlayer === mySymbol;
    turnIndicator.className = `turn-indicator ${isMyTurn ? 'my-turn' : 'opponent-turn'}`;
    turnIndicator.textContent = isMyTurn ? "Your Turn!" : "Opponent's Turn";

    // Update color buttons based on whose turn it is
    const colorButtons = document.querySelectorAll('.color-button');
    colorButtons.forEach(button => {
        const isLastUsedColor = button.dataset.color === gameState.lastUsedColor;
        button.disabled = !isMyTurn || isLastUsedColor;
        button.style.opacity = (!isMyTurn || isLastUsedColor) ? '0.5' : '1';
        button.classList.toggle('disabled', !isMyTurn || isLastUsedColor);
    });
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
    if (!colorOptions) return;
    
    colorOptions.innerHTML = ''; // Clear existing buttons
    CONFIG.GAME_COLORS.forEach(color => {
        const button = document.createElement('button');
        button.className = 'color-button';
        button.style.backgroundColor = color;
        button.dataset.color = color;
        button.addEventListener('click', handleColorSelection);
        colorOptions.appendChild(button);
    });
}

export function updateAvailableColors(lastUsedColor) {
    const buttons = document.querySelectorAll('.color-button');
    if (!buttons.length || !gameState) return;

    const mySymbol = currentPlayerId === gameState.players.P1?.socketId ? 'P1' : 'P2';
    const isMyTurn = gameState.currentPlayer === mySymbol;

    buttons.forEach(button => {
        const isLastUsed = button.dataset.color === lastUsedColor;
        button.disabled = !isMyTurn || isLastUsed;
        button.classList.toggle('disabled', !isMyTurn || isLastUsed);
        // Keep button visible but show disabled state
        button.style.opacity = (!isMyTurn || isLastUsed) ? '0.5' : '1';
    });
}
