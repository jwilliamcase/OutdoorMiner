import { CONFIG } from './config.js';
import { eventManager } from './eventManager.js';
import { NetworkEvents, GameEvents } from './eventTypes.js';
import { uiManager } from './uiManager.js';

// Core state tracking
let socketInstance = null;
let currentRoomId = null;
let currentPlayerId = null;
let currentGameState = null;
let connectionInProgress = false;
let connectionTimeout = null;

// Network utilities - moved to top level
function clearConnectionState() {
    connectionInProgress = false;
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
}

// Add connection initialization check
function initializeSocket(options) {
    if (!window.io) {
        throw new Error('Socket.IO not loaded');
    }

    return io(CONFIG.SERVER_URL, {
        transports: ['websocket'],
        query: options,
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000
    });
}

// Setup socket event listeners
function setupSocketEvents(socket) {
    if (!socket) return;

    socket.on('connect', () => {
        currentPlayerId = socket.id;
        eventManager.dispatchEvent(NetworkEvents.CONNECTED, {
            connected: true,
            message: 'Connected to server'
        });
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        eventManager.dispatchEvent(NetworkEvents.DISCONNECTED, {
            connected: false,
            message: `Disconnected: ${reason}`
        });
    });

    socket.on('game-start', (data) => {
        console.log('Received game-start:', data);
        eventManager.dispatchEvent(GameEvents.GAME_START, data);
    });

    socket.on('game-update', (data) => {
        console.log('Received game-update:', data);
        eventManager.dispatchEvent(GameEvents.STATE_UPDATE, data);
    });
}

// Core connection handling
export function connectToServer(action, playerName, roomCode = '') {
    if (connectionInProgress) {
        return Promise.reject(new Error('Connection already in progress'));
    }

    connectionInProgress = true;
    
    return new Promise((resolve, reject) => {
        try {
            // Validate inputs first
            if (!playerName || typeof playerName !== 'string') {
                throw new Error('Invalid player name');
            }

            const cleanPlayerName = playerName.trim();
            const cleanRoomCode = roomCode?.trim() || '';

            if (!cleanPlayerName) {
                throw new Error('Player name cannot be empty');
            }

            // Initialize socket with error handling
            try {
                const socket = initializeSocket({
                    action,
                    playerName: cleanPlayerName,
                    roomCode: cleanRoomCode,
                    timestamp: Date.now()
                });

                // Setup event listeners before assigning to socketInstance
                setupSocketEvents(socket);

                // Only after setup is complete, assign to socketInstance
                socketInstance = socket;
            } catch (error) {
                console.error('Socket initialization failed:', error);
                throw new Error('Failed to initialize socket connection');
            }

            // Add error handler for socket connection
            socketInstance.on('connect_error', (error) => {
                clearConnectionState();
                reject(new Error(`Connection failed: ${error.message}`));
            });

            // Add specific handler for join response
            if (action === 'join') {
                socketInstance.on('game-start', (data) => {
                    console.log('Received game-start:', data);
                    currentRoomId = data.roomCode;
                    currentGameState = data.gameState;
                    eventManager.dispatchEvent(GameEvents.GAME_START, data);
                });
            }

            // Setup event handlers after socket is initialized
            socketInstance.on('connect', () => {
                clearConnectionState();
                currentPlayerId = socketInstance.id;

                eventManager.dispatchEvent(NetworkEvents.CONNECTED, {
                    connected: true,
                    message: 'Connected to server'
                });

                if (action === 'join') {
                    socketInstance.emit('join-challenge', {
                        challengeCode: cleanRoomCode,
                        playerName: cleanPlayerName
                    }, (response) => {
                        connectionInProgress = false;
                        if (response.success) {
                            currentRoomId = response.gameId;
                            resolve(response);
                        } else {
                            reject(new Error(response.message));
                        }
                    });
                } else if (action === 'create') {
                    socketInstance.emit('create-challenge', cleanPlayerName, (response) => {
                        if (response.success) {
                            resolve({
                                success: true,
                                challengeCode: response.challengeCode,
                                playerId: socketInstance.id
                            });
                        } else {
                            reject(new Error(response.message));
                        }
                    });
                } else {
                    connectionInProgress = false;
                    resolve({ success: true, playerId: currentPlayerId });
                }
            });

            // Add game-start handler
            socketInstance.on('game-start', (data) => {
                console.log('Received game-start:', data);
                
                if (!data?.gameState || !data?.players) {
                    console.error('Invalid game start data received:', data);
                    return;
                }

                // Store game state and player info
                currentRoomId = data.gameState.gameId;
                currentPlayerId = socketInstance.id;

                // First dispatch game start event
                eventManager.dispatchEvent(GameEvents.GAME_START, {
                    gameState: data.gameState,
                    players: data.players,
                    currentTurn: data.currentTurn,
                    playerId: currentPlayerId
                });

                // Then update connection status
                eventManager.dispatchEvent(NetworkEvents.CONNECTED, {
                    connected: true,
                    message: 'Connected to game'
                });
            });

            socketInstance.on('disconnect', (reason) => {
                eventManager.dispatchEvent(NetworkEvents.DISCONNECTED, {
                    connected: false,
                    message: `Disconnected: ${reason}`
                });
            });

            socketInstance.on('connect_error', (error) => {
                clearConnectionState();
                uiManager.handleConnectionStatus({
                    connected: false,
                    message: 'Connection Error'
                });
                eventManager.dispatchEvent(NetworkEvents.ERROR, { error });
                reject(new Error(error.message || 'Connection failed'));
            });

        } catch (error) {
            clearConnectionState();
            reject(error);
        }
    });
}

// Centralized socket event setup
function setupSocketEventListeners() {
    if (!socketInstance) return;

    // --- Connection Events ---
    socketInstance.on('disconnect', (reason) => {
        const wasConnected = currentRoomId !== null;
        currentPlayerId = null;
        currentRoomId = null;

        eventManager.dispatchEvent(NetworkEvents.DISCONNECTED, { reason });

        if (wasConnected) {
            sessionStorage.setItem('lastRoomId', currentRoomId);
        }
    });

    // --- Game Events ---
    socketInstance.on('game-start', (data) => {
        if (!data?.gameState) return;

        currentPlayerId = socketInstance.id;
        currentRoomId = data.roomCode;
        
        eventManager.dispatchEvent(GameEvents.GAME_START, {
            gameState: data.gameState,
            players: data.players,
            playerId: currentPlayerId
        });
    });

    socketInstance.on('game-update', (data) => {
        eventManager.dispatchEvent(GameEvents.STATE_UPDATE, {
            state: data.state,
            lastMove: data.lastMove
        });
    });

    // ...existing game event handlers...
}

// Game actions
export function sendTilePlacement(moveData) {
    if (!socketInstance?.connected || !currentRoomId) {
        eventManager.dispatchEvent(NetworkEvents.ERROR, {
            message: "Not connected or no active game"
        });
        return;
    }

    socketInstance.emit('place-tile', {
        gameId: currentRoomId,
        playerId: currentPlayerId,
        move: {
            type: 'color-select',
            color: moveData.color,
            player: moveData.player || currentPlayerId
        }
    }, (response) => {
        if (response.success) {
            eventManager.dispatchEvent(GameEvents.MOVE_MADE, response);
        } else {
            eventManager.dispatchEvent(GameEvents.INVALID_MOVE, {
                message: response.message
            });
        }
    });
}

// Update chat message function to export
export function sendChatMessage(message) {
    if (!socketInstance?.connected || !currentRoomId) {
        eventManager.dispatchEvent(NetworkEvents.ERROR, {
            message: "Not connected or no active game"
        });
        return;
    }

    socketInstance.emit('chat-message', {
        roomCode: currentRoomId,
        message: message.trim()
    });
}

// Cleanup and disconnect
export function disconnectFromServer() {
    if (socketInstance?.connected) {
        socketInstance.disconnect();
        currentRoomId = null;
        currentPlayerId = null;
        eventManager.dispatchEvent(NetworkEvents.DISCONNECTED, {
            reason: 'user_disconnect'
        });
    }
}

// Export connection status check
export function isConnected() {
    return socketInstance?.connected || false;
}

// Add URL parameter check function
export function checkUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
        // If code exists in URL, automatically go to join mode
        const roomCodeInput = document.getElementById('room-code-input');
        if (roomCodeInput) {
            roomCodeInput.value = code;
            roomCodeInput.readOnly = true;
            // Add class to body to enable join-only mode styles
            document.body.classList.add('join-mode');
            // Hide create button since we're joining
            const createButton = document.getElementById('create-challenge-button');
            if (createButton) {
                createButton.style.display = 'none';
            }
        }
    }
    return code;
}

// Add color selection handler
export function sendColorSelection(color) {
    if (!socketInstance?.connected || !currentRoomId || !currentPlayerId) {
        console.error('Cannot send move: not connected');
        return false;
    }

    socketInstance.emit('place-tile', {
        gameId: currentRoomId,
        playerId: currentPlayerId,
        move: {
            type: 'color-select',
            color: color
        }
    }, (response) => {
        if (response.success) {
            console.log('Move accepted:', response);
        } else {
            console.error('Move rejected:', response.message);
            eventManager.dispatchEvent(GameEvents.INVALID_MOVE, {
                message: response.message
            });
        }
    });

    return true;
}

// Update game-start handler
socketInstance.on('game-start', (data) => {
    console.log('Received game-start:', data);
    
    if (!data?.gameState || !data?.players) {
        console.error('Invalid game start data:', data);
        return;
    }

    currentPlayerId = socketInstance.id;
    currentRoomId = data.roomCode;

    // First update connection status
    eventManager.dispatchEvent(NetworkEvents.CONNECTED, {
        connected: true,
        message: 'Connected to game'
    });

    // Then dispatch game start event
    eventManager.dispatchEvent(GameEvents.GAME_START, {
        gameState: data.gameState,
        players: data.players,
        currentTurn: data.currentTurn,
        playerId: currentPlayerId,
        roomCode: data.roomCode
    });
});