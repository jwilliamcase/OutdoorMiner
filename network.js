import { CONFIG } from './config.js';
import { GameState } from './gameLogic.js';
// Import UI functions needed for network events
import {
    updateConnectionStatus,
    displayMessage,
    showGameScreen,
    handleGameUpdate,
    handleInitialState,
    addChatMessage,
    updatePlayerInfo,
    showGameOver,
    playSound // Import playSound
} from './ui.js';

let socketInstance = null;
let currentRoomId = null;
let currentPlayerId = null; // Store player ID assigned by server


// Function to connect to the server
/**
 * Connects to the game server and initializes the socket connection.
 * @param {string} action - The action to perform (e.g., 'create' or 'join').
 * @param {string} playerName - The player's name to send to the server.
 * @param {string} [roomCode=''] - Optional room code if joining a game.
 */
export function connectToServer(action, playerName, roomCode = '') {
    console.log(`connectToServer - START action: ${action}`);

    if (!CONFIG.SERVER_URL) {
        console.error("CONFIG.SERVER_URL is not defined. Cannot connect.");
        displayMessage("Configuration error: Server URL not set.", true);
        playSound('error'); // Keep error sound for config issues
        return;
    }

    if (socketInstance && socketInstance.connected) {
        console.log("Already connected, disconnecting first...");
        socketInstance.disconnect();
    }

    try {
        socketInstance = io(CONFIG.SERVER_URL, {
            transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 3,
            timeout: 10000, // Increase timeout
            query: { playerName, action, roomCode } // Send player name on connection
        });
        console.log("Socket.IO client initialized, attempting connection...");
        updateConnectionStatus(false, 'Connecting...'); // Update UI - Connecting

        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
            if (!socketInstance.connected) {
                console.error("Connection attempt timed out");
                displayMessage("Connection timed out. Server may be down.", true);
                socketInstance.disconnect();
            }
        }, 10000);

        setupSocketEventListeners(); // Setup listeners after creating instance

        // Clear timeout on successful connection
        socketInstance.on('connect', () => {
            clearTimeout(connectionTimeout);
        });

    } catch (error) {
        console.error("Socket.IO connection failed:", error);
        displayMessage("Connection failed. Is the server running?", true);
        updateConnectionStatus(false, 'Connection Failed');
        playSound('error');
    }

}

// Centralized setup for socket event listeners
function setupSocketEventListeners() {
    if (!socketInstance) return;

    // --- Connection Events ---
    socketInstance.on('connect', () => {
        console.log('Connected to server with ID:', socketInstance.id);
        currentPlayerId = socketInstance.id; // Store the session ID as player ID
        updateConnectionStatus(true, `Connected as Player ${socketInstance.id.substring(0, 4)}`); // Update UI - Connected
        // Now join or create room based on the original action (might need player name etc.)
        // This part needs refinement - how do we pass the original action (create/join)?
        // Maybe pass it inside connectToServer or have separate functions join/create
        // For now, assume connection is step 1. User clicks create/join AFTER connecting.
        // OR pass data in the initial query.

        // Temporary: Assume create/join happens via buttons after connection
        // Let's rethink: connection should include intent (create/join)

        /* Example: Refined connectToServer to handle create/join
        export function createGame(playerName) {
             connectAndSetup({ action: 'create', playerName });
        }
        export function joinGame(playerName, roomCode) {
             connectAndSetup({ action: 'join', playerName, roomCode });
        }
        function connectAndSetup(options) {
             // ... socket init ...
             socketInstance.on('connect', () => {
                  currentPlayerId = socketInstance.id;
                  updateConnectionStatus(true, `Connected`);
                  if (options.action === 'create') {
                       socketInstance.emit('create-challenge', { playerName: options.playerName });
                  } else if (options.action === 'join') {
                       socketInstance.emit('join-challenge', { playerName: options.playerName, roomCode: options.roomCode });
                  }
             });
        }
        */
         // Reverting to simpler connect, assuming create/join emit is called separately for now
    });

    socketInstance.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        updateConnectionStatus(false, 'Disconnected');
        currentPlayerId = null;
        currentRoomId = null;
        // Optionally show setup screen or a disconnected message
        displayMessage("Disconnected from server.", true);
        // Potentially need ui.showSetupScreen() here if not handled elsewhere
    });

    socketInstance.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        updateConnectionStatus(false, 'Connection Error');
        displayMessage(`Connection error: ${error.message}`, true);
        playSound('error');
        socketInstance = null; // Reset instance on connection failure
    });


    // --- Custom Game Events ---
    // Listeners for 'challenge-created' and 'challenge-joined' removed.
    // Server response handled via callbacks in emitCreateChallenge/emitJoinChallenge.

    socketInstance.on('game-start', (data) => {
        console.log('Game starting with data:', data);
        if (!data || !data.gameState) {
            console.error('Invalid game start data received:', data);
            displayMessage("Error starting game: Invalid data", true);
            return;
        }

        currentRoomId = data.roomCode;
        displayMessage(`Game started in room ${data.roomCode}!`, false);
        
        // Initialize game state before showing screen
        if (handleInitialState(data.gameState, data.players, currentPlayerId)) {
            console.log("Game state initialized, showing game screen");
            showGameScreen(); // This should now work properly
            updatePlayerInfo(data.players, currentPlayerId);
        } else {
            console.error("Failed to initialize game state");
            displayMessage("Failed to start game", true);
        }
    });

     socketInstance.on('game-update', (data) => {
         console.log('Game state update received:', data);
         // Pass the gameState object directly, assume server sends object, not string
         handleGameUpdate(data.gameState); // Update UI and local game state using the nested gameState object
         // Player info update should happen within handleGameUpdate if needed, using the received state.
         // Game over check also likely happens within handleGameUpdate now.
         // We can still update player info here if handleGameUpdate doesn't do it.
         if(data.gameState && data.gameState.players) {
            updatePlayerInfo(data.gameState.players, currentPlayerId);
            // Check for game over state from the update
            if (data.gameState.gameOver) {
                showGameOver(data.gameState.winner, data.gameState.players, currentPlayerId);
            }
         } else {
            console.warn("Game update received without gameState or players data");
         }
     });

    socketInstance.on('game-error', (errorMessage) => {
        console.error('Game Error:', errorMessage);
        displayMessage(errorMessage, true);
        playSound('message'); // Use message sound for game logic errors
    });

     socketInstance.on('opponent-disconnected', (data) => { // Changed from 'player-disconnected'
         console.log('Opponent disconnected:', data.playerId);
         displayMessage(`Opponent ${data.playerId.substring(0,4)} disconnected. Game may have ended.`, true);
         // Handle game pausing or ending based on rules
         // Maybe reset UI or show a specific message
     });

    // --- Chat Events ---
    socketInstance.on('chat-message', (data) => {
        console.log('Chat message received:', data);
        // Ensure data has expected format { sender: '...', message: '...' }
        if (data && data.sender && data.message) {
            addChatMessage(data.sender, data.message);
            playSound('message'); // Play sound on receiving message
        } else {
            console.warn("Received malformed chat message:", data);
        }
    });
}

// Function to disconnect from the server
export function disconnectFromServer() {
    if (socketInstance && socketInstance.connected) {
        console.log("Disconnecting...");
        socketInstance.disconnect();
        updateConnectionStatus(false, 'Disconnected');
        currentRoomId = null;
        currentPlayerId = null;
    } else {
        console.log("Already disconnected.");
    }
}

// --- Emitters ---

// Function to send a chat message
export function sendMessage(message) {
    if (socketInstance && socketInstance.connected && currentRoomId) {
        console.log(`Sending message: "${message}" to room ${currentRoomId}`);
        socketInstance.emit('chat-message', { roomCode: currentRoomId, message: message });
    } else {
        console.error("Cannot send message: Not connected or not in a room.");
        displayMessage("Cannot send message. Not connected?", true);
    }
}

// Function to send tile placement action
export function sendTilePlacement(q, r, color) {
    if (socketInstance && socketInstance.connected && currentRoomId && currentPlayerId) {
        console.log(`Sending tile placement: q=${q}, r=${r}, color=${color} by ${currentPlayerId} to room ${currentRoomId}`);
         socketInstance.emit('place-tile', {
             roomCode: currentRoomId,
             playerId: currentPlayerId, // Send player ID with the move
             q: q,
             r: r,
             color: color // Color might be redundant if server uses player ID to determine color
         });
    } else {
        console.error("Cannot place tile: Not connected or not in a room.");
        displayMessage("Cannot place tile. Not connected?", true);
    }
}

// Function to emit create challenge event, uses callback for response
export function emitCreateChallenge(playerName) {
    if (!socketInstance || !socketInstance.connected) {
        connectToServer('create', playerName);
        
        socketInstance.once('connect', () => {
            console.log(`Emitting create-challenge for player: ${playerName}`);
            socketInstance.emit('create-challenge', playerName, (response) => {
                console.log("Create challenge response:", response);
                if (response.success) {
                    currentRoomId = response.challengeCode;
                    // Initialize game state with default board
                    const initialState = {
                        rows: CONFIG.BOARD_SIZE,
                        cols: CONFIG.BOARD_SIZE,
                        board: {},
                        players: {
                            [socketInstance.id]: {
                                name: playerName,
                                color: '#F76C6C', // Player 1 color (red)
                                score: 1,
                                playerNumber: 1,
                                position: { q: 0, r: 0 } // Top-left start
                            }
                        },
                        currentPlayerIndex: 0,
                        turnNumber: 1
                    };
                    
                    // Initialize board with proper hex grid
                    for (let r = 0; r < CONFIG.BOARD_SIZE; r++) {
                        for (let q = 0; q < CONFIG.BOARD_SIZE; q++) {
                            initialState.board[`${q},${r}`] = {
                                q, r,
                                owner: null,
                                color: '#cccccc',
                                captured: false
                            };
                        }
                    }
                    
                    // Set starting positions
                    initialState.board['0,0'].owner = socketInstance.id;
                    initialState.board['0,0'].color = '#F76C6C';
                    initialState.board['0,0'].captured = true;
                    
                    // Pass to UI for initialization
                    handleInitialState(initialState, initialState.players, socketInstance.id);
                    displayMessage(`Challenge created! Code: ${response.challengeCode}`);
                } else {
                    displayMessage(response.message || "Failed to create challenge", true);
                }
            });
        });
    } else {
        // Similar code for when already connected
        socketInstance.emit('create-challenge', playerName, (response) => {
            console.log("Create challenge response:", response);
            if (response.success) {
                currentRoomId = response.challengeCode;
                // Initialize game state with default board (same as above)
                const initialState = {
                    rows: CONFIG.BOARD_SIZE,
                    cols: CONFIG.BOARD_SIZE,
                    board: {},
                    players: {
                        [socketInstance.id]: {
                            name: playerName,
                            color: '#F76C6C', // Player 1 color (red)
                            score: 1,
                            playerNumber: 1,
                            position: { q: 0, r: 0 } // Top-left start
                        }
                    },
                    currentPlayerIndex: 0,
                    turnNumber: 1
                };
                
                for (let r = 0; r < CONFIG.BOARD_SIZE; r++) {
                    for (let q = 0; q < CONFIG.BOARD_SIZE; q++) {
                        initialState.board[`${q},${r}`] = {
                            q, r,
                            owner: null,
                            color: '#cccccc',
                            captured: false
                        };
                    }
                }
                
                initialState.board['0,0'].owner = socketInstance.id;
                initialState.board['0,0'].color = '#F76C6C';
                initialState.board['0,0'].captured = true;
                
                handleInitialState(initialState, initialState.players, socketInstance.id);
                displayMessage(`Challenge created! Code: ${response.challengeCode}`);
            } else {
                displayMessage(response.message || "Failed to create challenge", true);
            }
        });
    }
}

// Function to emit join challenge event, uses callback for response
export function emitJoinChallenge(playerName, roomCode) {
     if (socketInstance && socketInstance.connected) {
         console.log(`Emitting join-challenge for player: ${playerName} to room: ${roomCode}`);
         // Emit with a callback function to handle the server's response
         socketInstance.emit('join-challenge', { playerName, roomCode }, (response) => {
             console.log('join-challenge response:', response);
             if (response.success) {
                 currentRoomId = response.roomCode;
                 displayMessage(`Joined room: ${response.roomCode}. Waiting for game to start...`, false);
                 updateConnectionStatus(true, `Connected | Room: ${response.roomCode}`);
                 // The server should emit 'game-start' soon after successful join
             } else {
                 console.error('Failed to join challenge:', response.message);
                 displayMessage(`Error joining challenge: ${response.message}`, true);
                 // Optionally, reset UI state
             }
         });
     } else {
         console.error("Cannot join challenge: Not connected.");
         displayMessage("Connect to the server first.", true);
     }
}

// playSound function moved to ui.js