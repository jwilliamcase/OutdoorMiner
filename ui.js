// Import GameState class itself, not the whole module object if exporting default
import { HEX_SIZE, HEX_HEIGHT, HEX_WIDTH, getHexCenter, worldToHex, GameState } from './gameLogic.js';
import { sendTilePlacement, sendMessage } from './network.js'; // Import network functions

// --- State ---
let gameState = null; // Holds the current game state object
let canvas = null;
let ctx = null;
let selectedColor = null; // Store the selected color hex value
let currentPlayerId = null; // Store the client's player ID for UI logic
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let cameraOffset = { x: 0, y: 0 }; // Pan offset

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
        elements = {
            canvas: document.getElementById('gameCanvas'),
            canvasContainer: document.getElementById('game-area'),
            setupContainer: document.getElementById('setup-container'),
            gameContainer: document.getElementById('game-container'),
            connectionStatus: document.getElementById('status-text'),
            connectionIndicator: document.getElementById('connection-indicator'),
            messageArea: document.getElementById('message-area'),
            player1Info: document.getElementById('player1-info'),
            player2Info: document.getElementById('player2-info'),
            colorButtons: document.querySelectorAll('.color-button'),
            colorPalette: document.getElementById('color-palette')
        };

        // Update module-level references
        canvas = elements.canvas;
        canvasContainer = elements.canvasContainer;
        setupContainer = elements.setupContainer;
        gameContainer = elements.gameContainer;
        connectionStatusElement = elements.connectionStatus;
        connectionIndicator = elements.connectionIndicator;
        messageArea = elements.messageArea;
        player1Info = elements.player1Info;
        player2Info = elements.player2Info;
        colorButtons = Array.from(elements.colorButtons);

        // Initialize canvas if available
        if (canvas) {
            ctx = canvas.getContext('2d');
            canvas.addEventListener('click', handleCanvasClick);
            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', handleMouseUp);
            canvas.addEventListener('mouseleave', handleMouseUp);
        }

        // Add window resize listener
        window.addEventListener('resize', resizeGame);

        // Add color button listeners
        colorButtons.forEach(button => {
            button.addEventListener('click', handleColorSelection);
        });

        console.log("UI Initialized successfully");
        return true;
    } catch (error) {
        console.error("UI initialization error:", error);
        return false;
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

export function showGameScreen() {
    console.log("showGameScreen - START");
    if (!elements.gameContainer) {
        console.error("Cannot show game screen: Game container not found");
        return;
    }

    elements.setupContainer.style.display = 'none';
    elements.gameContainer.style.display = 'block';
    elements.colorPalette.style.display = 'flex';

    console.log("Game screen elements displayed");
    resizeGame();
    renderGameBoard();
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
     if (!ctx || !gameState) {
         console.warn("renderGameBoard: Canvas context or gameState missing.");
         // Optionally draw a placeholder or message
         if (ctx) {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             ctx.fillStyle = '#eee';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             ctx.fillStyle = '#555';
             ctx.font = '16px Arial';
             ctx.textAlign = 'center';
             ctx.fillText("Waiting for game state...", canvas.width / 2, canvas.height / 2);
         }
         return;
     }

    console.log("Rendering game board...");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

     // Apply camera offset for panning
     ctx.save();
     ctx.translate(cameraOffset.x, cameraOffset.y);


    // Iterate through the game board state and draw each hex
    for (const key in gameState.board) {
        const tile = gameState.board[key];
        if (tile) {
            drawHexagon(tile.q, tile.r, tile.color || '#cccccc'); // Use tile color or default
        }
    }
     ctx.restore(); // Restore context after applying camera offset

    console.log("Board rendering complete.");
}


// Draw a single hexagon
function drawHexagon(q, r, color) {
    if (!ctx) return;

     const center = getHexCenter(q, r); // Use logic from gameLogic.js
     const points = [];
     for (let i = 0; i < 6; i++) {
         const angle_deg = 60 * i - 30; // -30 degrees to start from pointy top edge
         const angle_rad = Math.PI / 180 * angle_deg;
         points.push({
             x: center.x + HEX_SIZE * Math.cos(angle_rad),
             y: center.y + HEX_SIZE * Math.sin(angle_rad)
         });
     }

     ctx.beginPath();
     ctx.moveTo(points[0].x, points[0].y);
     for (let i = 1; i < 6; i++) {
         ctx.lineTo(points[i].x, points[i].y);
     }
     ctx.closePath();

     ctx.fillStyle = color;
     ctx.fill();

     ctx.strokeStyle = '#333'; // Border color
     ctx.lineWidth = 1;
     ctx.stroke();

     // Optional: Draw coordinates for debugging
     // ctx.fillStyle = '#000';
     // ctx.font = '8px Arial';
     // ctx.textAlign = 'center';
     // ctx.textBaseline = 'middle';
     // ctx.fillText(`${q},${r}`, center.x, center.y);

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

    if (!selectedColor) {
        displayMessage("Please select a color first.", true);
        return;
    }

     // Convert click coordinates to world coordinates (relative to canvas, considering pan)
     const rect = canvas.getBoundingClientRect();
     const clickX = event.clientX - rect.left;
     const clickY = event.clientY - rect.top;

     // Adjust for camera offset
     const worldX = clickX - cameraOffset.x;
     const worldY = clickY - cameraOffset.y;


    // Convert world coordinates to hex coordinates
    const { q, r } = worldToHex(worldX, worldY); // Use logic from gameLogic.js
    console.log(`Canvas click at (${clickX}, ${clickY}), World (${worldX}, ${worldY}), Hex (${q}, ${r})`);


    // Check if the click corresponds to a valid hex on the board
    const key = `${q},${r}`;
    if (gameState.board[key]) {
        console.log(`Attempting to place tile at (${q}, ${r}) with color ${selectedColor}`);
        // Send placement to server via network module
        sendTilePlacement(q, r, selectedColor);
        // The UI should be updated based on server response ('game-update')
        // Optionally provide immediate feedback (e.g., temporary placement color)
        // but the authoritative state comes from the server.
    } else {
        console.log(`Click at (${q}, ${r}) is outside the defined board area.`);
        displayMessage("Clicked outside the board.", true);
    }
}


// Handle color selection from buttons
function handleColorSelection(event) {
    selectedColor = event.target.getAttribute('data-color');
    console.log(`Color selected: ${selectedColor}`);
    // Update UI to show selected color (e.g., border)
    colorButtons.forEach(button => {
        if (button.getAttribute('data-color') === selectedColor) {
            button.style.border = '3px solid black';
        } else {
            button.style.border = '1px solid #ccc';
        }
    });
    displayMessage(`Selected color: ${selectedColor}`, false);
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
    // Assume gameStateObject is already the correct structure (no deserialize needed here)
    if (gameStateObject) {
        // We might still want to create a GameState instance for its methods,
        // but let's first try using the plain object directly if possible.
        // If GameState class has important methods used elsewhere, we might need:
        // gameState = new GameState(gameStateObject.rows, gameStateObject.cols);
        // Object.assign(gameState.board, gameStateObject.board); // etc.
        // Create a GameState instance from the plain object received
        // This ensures methods like getCurrentPlayerId are available
        gameState = new GameState(gameStateObject.rows, gameStateObject.cols);
        // Copy properties from the received object to the instance
        Object.assign(gameState, gameStateObject);
        // Ensure players data is attached (might already be copied by Object.assign)
        gameState.players = playersData;

        currentPlayerId = ownPlayerId; // Store our own ID

         // Center the camera initially (approximate)
         centerCamera();
        resizeGame(); // Ensure correct size
        renderGameBoard();
        updatePlayerInfo(gameState.players, currentPlayerId); // Update player scores/names
        console.log("Initial game state processed.");

        // Add a check for the current player ID based on the new state
        if (!gameState || gameState.gameOver) {
             console.log("Initial state is game over or invalid.");
        } else if (!currentPlayerId || gameState.getCurrentPlayerId() !== currentPlayerId) {
             console.log("Initial state received, but it's not your turn.");
             displayMessage("Waiting for opponent's move.", false);
        } else {
            console.log("Initial state received, it's your turn.");
            displayMessage("Game started. Your turn!", false);
        }

    } else {
        console.error("Failed to initialize game state from server data (gameStateObject is null/undefined).");
        displayMessage("Error initializing game. Check console.", true);
    }
    return null; // Or handle error appropriately
}

// Expects gameStateObject to be a plain JS object from the server
export function handleGameUpdate(gameStateObject) {
    console.log("Handling game update:", gameStateObject);
    // Assume gameStateObject is already the correct structure (no deserialize needed here)
    if (gameStateObject) {
        // Create a GameState instance from the plain object received
        // This ensures methods like getCurrentPlayerId are available
        gameState = new GameState(gameStateObject.rows, gameStateObject.cols);
        // Copy properties from the received object to the instance
        Object.assign(gameState, gameStateObject);
        // gameState.players should be copied by Object.assign if present in gameStateObject

        renderGameBoard(); // Re-render the board with the new state

        // Player info and game over checks are now handled in the network.js 'game-update' listener
        // But we can add turn indication here:
        if (!gameState || gameState.gameOver) {
             console.log("Game update indicates game over or invalid state.");
             // Game over message should be displayed via showGameOver called from network.js
        } else if (!currentPlayerId || gameState.getCurrentPlayerId() !== currentPlayerId) {
             console.log("Game updated, now waiting for opponent's move.");
             displayMessage("Waiting for opponent's move.", false);
        } else {
            console.log("Game updated, now it's your turn.");
            displayMessage("Your turn!", false);
        }

        console.log("Game state updated and rendered.");
    } else {
        console.error("Failed to update game state from server data (gameStateObject is null/undefined).");
        displayMessage("Error updating game state. Check console.", true);
    }
}

// Helper to roughly center the view on the board
function centerCamera() {
    if (!canvas || !gameState || !gameState.rows || !gameState.cols) return;

    // Calculate approximate center of the board in world coordinates
    const centerQ = Math.floor(gameState.cols / 2);
    const centerR = Math.floor(gameState.rows / 2);
    const boardCenter = getHexCenter(centerQ, centerR);

    // Calculate desired offset to bring board center to canvas center
    cameraOffset.x = canvas.width / 2 - boardCenter.x;
    cameraOffset.y = canvas.height / 2 - boardCenter.y;
     console.log("Camera centered", cameraOffset);
    return { rows, cols };
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
