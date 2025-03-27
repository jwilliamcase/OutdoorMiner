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
    showGameOver
} from './ui.js';

let socketInstance = null;
let currentRoomId = null;
let currentPlayerId = null; // Store player ID assigned by server


// Function to connect to the server
export function connectToServer(action, playerName, roomCode = '') {
    console.log(`connectToServer - START action: ${action}`);

    if (!CONFIG.SERVER_URL) {
        console.error("CONFIG.SERVER_URL is not defined. Cannot connect.");
        displayMessage("Configuration error: Server URL not set.", true);
        playSound('error'); // Keep error sound for config issues
        return;
    }

    if (socketInstance && socketInstance.connected) {
        console.log("Already connected.");
        // Maybe disconnect first if changing rooms or actions?
        // socketInstance.disconnect();
        // For now, just return or show message
        displayMessage("Already connected.", false);
        return;
    }

    // Establish connection - Use the global `io` from the CDN script
     try {
        socketInstance = io(CONFIG.SERVER_URL, {
             // Optional: Add transports, reconnection options etc.
             // transports: ['websocket'],
             reconnectionAttempts: 5,
             query: { playerName } // Send player name on connection
        });
        console.log("Socket.IO client initialized, attempting connection...");
        updateConnectionStatus(false, 'Connecting...'); // Update UI - Connecting

        setupSocketEventListeners(); // Setup listeners after creating instance

     } catch (error) {
         console.error("Socket.IO connection failed:", error);
         displayMessage("Connection failed. See console for details.", true);
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
        console.log('Game starting:', data);
        currentRoomId = data.roomCode; // Ensure room ID is set
        // currentPlayerId is already set on connect
        displayMessage(`Game started in room ${data.roomCode}!`, false);
        // Pass the gameState object directly, assume server sends object, not string
        handleInitialState(data.gameState, data.players, currentPlayerId);
        showGameScreen(); // Switch UI view
        updatePlayerInfo(data.players, currentPlayerId); // Update player displays
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
    if (socketInstance && socketInstance.connected) {
        console.log(`Emitting create-challenge for player: ${playerName}`);
        // Emit with a callback function to handle the server's response
        socketInstance.emit('create-challenge', { playerName }, (response) => {
            console.log('create-challenge response:', response);
            if (response.success) {
                currentRoomId = response.roomCode;
                displayMessage(`Challenge created! Code: ${response.roomCode}. Waiting for opponent...`, false);
                updateConnectionStatus(true, `Connected | Room: ${response.roomCode}`);
                // Optionally, update UI further (e.g., show waiting state)
            } else {
                console.error('Failed to create challenge:', response.message);
                displayMessage(`Error creating challenge: ${response.message}`, true);
                // Optionally, reset UI state
            }
        });
    } else {
        console.error("Cannot create challenge: Not connected.");
        displayMessage("Connect to the server first.", true);
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


// Helper function to play sounds (assuming sounds are loaded globally or accessible)
// Might move this to ui.js if it manipulates DOM/Audio elements directly
function playSound(soundName) {
    // Example: find audio element and play
    try {
        const sound = document.getElementById(`sound-${soundName}`);
        if (sound) {
             // sound.currentTime = 0; // Reset playback
            sound.play().catch(error => console.error(`Error playing sound ${soundName}:`, error));
        } else {
            console.warn(`Sound element not found: sound-${soundName}`);
            // Attempt dynamic load as fallback (if not preloaded)
            const audio = new Audio(`sounds/${soundName}.mp3`);
            audio.play().catch(error => console.error(`Error playing dynamic sound ${soundName}:`, error));
        }
     } catch (error) {
         console.error(`General error playing sound ${soundName}:`, error);
     }
}