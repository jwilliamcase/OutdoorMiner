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
    playSound,
    updateGameCode, // Add this import
    centerOnPlayerStart, // Add this import
    showSetupScreen // Add this import
} from './ui.js';

import { eventManager, EventTypes } from './eventManager.js';
import { NetworkEvents, GameEvents } from './eventTypes.js';

let socketInstance = null;
let currentRoomId = null;
let currentPlayerId = null; // Store player ID assigned by server
let connectionInProgress = false;

// Function to connect to the server
/**
 * Connects to the game server and initializes the socket connection.
 * @param {string} action - The action to perform (e.g., 'create' or 'join').
 * @param {string} playerName - The player's name to send to the server.
 * @param {string} [roomCode=''] - Optional room code if joining a game.
 */
export function connectToServer(action, playerName, roomCode = '') {
    console.log(`connectToServer - START action: ${action}`);
    
    // Prevent multiple connection attempts
    if (connectionInProgress) {
        console.log("Connection already in progress");
        return Promise.reject(new Error("Connection in progress"));
    }

    connectionInProgress = true;
    
    return new Promise((resolve, reject) => {
        try {
            if (socketInstance?.connected) {
                socketInstance.disconnect();
            }

            socketInstance = io(CONFIG.SERVER_URL, {
                transports: ['websocket'],
                reconnectionAttempts: 3,
                timeout: 10000,
                autoConnect: false,
                query: { 
                    playerName: playerName.trim(),
                    action,
                    roomCode: roomCode.trim()
                }
            });

            // Set up one-time handlers before connecting
            const connectHandler = () => {
                if (!socketInstance.id) {
                    cleanup("No socket ID received");
                    return;
                }
                console.log('Connected with ID:', socketInstance.id);
                connectionInProgress = false;
                updateConnectionStatus(true, `Connected as Player ${socketInstance.id.substring(0, 4)}`);
                resolve(socketInstance.id);
            };

            const errorHandler = (error) => {
                cleanup(error.message);
            };

            const cleanup = (error) => {
                socketInstance.off('connect', connectHandler);
                socketInstance.off('connect_error', errorHandler);
                connectionInProgress = false;
                if (error) {
                    reject(new Error(error));
                }
            };

            socketInstance.once('connect', connectHandler);
            socketInstance.once('connect_error', errorHandler);

            // Start connection
            socketInstance.connect();
            updateConnectionStatus(false, 'Connecting...');

            // Add timeout
            setTimeout(() => {
                if (connectionInProgress) {
                    cleanup("Connection timeout");
                }
            }, 10000);

        } catch (error) {
            connectionInProgress = false;
            reject(error);
        }
    });
}

// Centralized setup for socket event listeners
function setupSocketEventListeners() {
    if (!socketInstance) return;

    // --- Connection Events ---
    socketInstance.on('connect', () => {
        console.log('Connected to server with ID:', socketInstance.id);
        currentPlayerId = socketInstance.id; // Store the session ID as player ID
        updateConnectionStatus(true, `Connected as Player ${socketInstance.id.substring(0, 4)}`); // Update UI - Connected
        eventManager.dispatchEvent(EventTypes.NETWORK.CONNECTED, {
            id: socketInstance.id
        });
    });

    socketInstance.on('disconnect', (reason) => {
        const wasConnected = currentRoomId !== null;
        currentPlayerId = null;
        currentRoomId = null;

        updateConnectionStatus(false, `Disconnected: ${reason}`);
        eventManager.dispatchEvent(EventTypes.NETWORK.DISCONNECTED, { reason });

        if (wasConnected) {
            // Save current game state for potential recovery
            const lastState = gameState ? gameState.serialize() : null;
            sessionStorage.setItem('lastGameState', lastState);
            sessionStorage.setItem('lastRoomId', currentRoomId);
            
            displayMessage("Connection lost. Attempting to reconnect...", true);
            
            // Attempt to reconnect
            setTimeout(() => {
                if (!socketInstance.connected) {
                    reconnectToGame();
                }
            }, 1000);
        }
    });

    // Add reconnection handler
    socketInstance.on('reconnect', () => {
        const lastRoomId = sessionStorage.getItem('lastRoomId');
        if (lastRoomId) {
            socketInstance.emit('rejoin-game', {
                roomId: lastRoomId
            }, (response) => {
                if (response.success) {
                    handleGameUpdate(response.gameState);
                    displayMessage("Reconnected to game!", false);
                } else {
                    displayMessage("Could not rejoin game. Please refresh.", true);
                }
            });
        }
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
        eventManager.dispatchEvent(NetworkEvents.SYNC_START, { timestamp: Date.now() });
        
        try {
            // Apply changes atomically
            handleGameUpdate(data.gameState, data.changes);
            
            eventManager.dispatchEvent(NetworkEvents.SYNC_COMPLETE, {
                success: true,
                timestamp: Date.now()
            });
        } catch (error) {
            eventManager.dispatchEvent(NetworkEvents.SYNC_ERROR, {
                error: error.message,
                timestamp: Date.now()
            });
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

    // Add state validation event handlers
    eventManager.addEventListener(GameEvents.MOVE, (moveData) => {
        if (moveData.success) {
            socketInstance.emit('validate-move', moveData, (response) => {
                if (!response.valid) {
                    // Roll back invalid move
                    handleGameUpdate(response.correctState);
                }
            });
        }
    });
}

// Add reconnection helper
function reconnectToGame() {
    if (socketInstance.connected) return;
    
    try {
        socketInstance.connect();
    } catch (error) {
        console.error("Reconnection failed:", error);
        displayMessage("Reconnection failed. Please refresh.", true);
    }
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

// Update move protocol
export function sendTilePlacement(selectedColor) {
    if (!socketInstance?.connected || !currentRoomId || !currentPlayerId) {
        displayMessage("Connection error", true);
        return;
    }

    socketInstance.emit('make-move', {
        roomCode: currentRoomId,
        playerId: currentPlayerId,
        move: {
            type: 'color-select',
            color: selectedColor
        }
    });
}

// Function to emit create challenge event, uses callback for response
export function emitCreateChallenge(playerName) {
    if (!socketInstance || !socketInstance.connected) {
        connectToServer('create', playerName);
        
        socketInstance.once('connect', () => {
            socketInstance.emit('create-challenge', playerName, (response) => {
                if (response.success) {
                    currentRoomId = response.challengeCode;
                    
                    // Show game code to host
                    const gameIdDisplay = document.getElementById('game-id-display');
                    if (gameIdDisplay) {
                        gameIdDisplay.textContent = `Game Code: ${response.challengeCode}`;
                        gameIdDisplay.style.display = 'block';
                    }
                    
                    // Rest of initialization...
                    updateGameCode(response.challengeCode);
                        
                    // Initialize game state
                    const initialState = new GameState(CONFIG.BOARD_SIZE, CONFIG.BOARD_SIZE);
                    initialState.initializePlayerPositions(socketInstance.id, null);
                    
                    // Initialize UI with correct order
                    handleInitialState(initialState, {
                        [socketInstance.id]: {
                            name: playerName,
                            score: 1,
                            playerNumber: 1
                        }
                    }, socketInstance.id);

                    showGameScreen();
                    centerOnPlayerStart(); // Now correctly imported
                    
                    displayMessage(`Challenge created! Code: ${response.challengeCode}`);
                    
                    // Create and show shareable link
                    const shareUrl = new URL(window.location.href);
                    shareUrl.searchParams.set('code', response.challengeCode);
                    
                    const shareLink = document.querySelector('.share-link');
                    if (shareLink) {
                        shareLink.innerHTML = `
                            Share link: 
                            <span>${shareUrl.toString()}</span>
                            <button onclick="navigator.clipboard.writeText('${shareUrl.toString()}')">
                                Copy
                            </button>
                        `;
                        shareLink.style.display = 'block';
                    }
                }
            });
        });
    }
}

export function emitJoinChallenge(playerName, roomCode) {
    console.log('Join attempt:', { playerName, roomCode });
    
    // Validate inputs before attempting connection
    if (!playerName?.trim() || !roomCode?.trim()) {
        const error = new Error("Please enter both name and room code");
        displayMessage(error.message, true);
        return Promise.reject(error);
    }

    const cleanPlayerName = playerName.trim();
    const cleanRoomCode = roomCode.trim().toUpperCase();

    return new Promise((resolve, reject) => {
        // First connect to server
        connectToServer('join', cleanPlayerName, cleanRoomCode)
            .then(socketId => {
                if (!socketInstance) {
                    throw new Error("No socket connection");
                }

                const joinData = {
                    challengeCode: cleanRoomCode,  // Match server's expected field name
                    playerName: cleanPlayerName,
                    socketId: socketId
                };

                console.log('Emitting join data:', joinData);

                // Emit join event with properly structured data
                socketInstance.emit('join-challenge', joinData, (response) => {
                    console.log('Server join response:', response);
                    
                    if (response.success) {
                        currentRoomId = cleanRoomCode;
                        currentPlayerId = socketId;
                        
                        if (response.gameState) {
                            handleInitialState(response.gameState, response.players, socketId);
                            showGameScreen();
                            displayMessage("Successfully joined game!", false);
                            resolve(response);
                        } else {
                            reject(new Error("No game state received"));
                        }
                    } else {
                        const error = new Error(response.message || "Failed to join game");
                        displayMessage(error.message, true);
                        reject(error);
                    }
                });
            })
            .catch(error => {
                console.error('Join failed:', error);
                displayMessage(error.message || "Failed to join game", true);
                showSetupScreen();
                reject(error);
            });
    });
}

// Add URL parameter check on load
export function checkUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
        // Auto-fill room code input and handle UI updates
        const setupElements = {
            roomCodeInput: document.getElementById('room-code-input'),
            playerNameInput: document.getElementById('player-name-input'),
            joinButton: document.getElementById('join-challenge-button'),
            createButton: document.getElementById('create-challenge-button'),
            separator: document.querySelector('.separator')
        };

        if (setupElements.roomCodeInput && setupElements.playerNameInput) {
            // Fill in the room code
            setupElements.roomCodeInput.value = code;
            setupElements.roomCodeInput.readOnly = true;

            // Hide create game UI if we're joining
            if (setupElements.createButton) {
                setupElements.createButton.style.display = 'none';
            }
            if (setupElements.separator) {
                setupElements.separator.style.display = 'none';
            }

            // Update join button state based on name input
            const updateJoinButton = () => {
                if (setupElements.joinButton) {
                    setupElements.joinButton.disabled = !setupElements.playerNameInput.value.trim();
                }
            };

            // Add name input listener
            setupElements.playerNameInput.addEventListener('input', updateJoinButton);
            
            // Focus name input
            setupElements.playerNameInput.focus();
            
            // Initial button state
            updateJoinButton();
        }
    }
}

// playSound function moved to ui.js