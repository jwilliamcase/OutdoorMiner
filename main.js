import { connectToServer, disconnectFromServer, checkUrlParameters } from './network.js';
import { initializeUI } from './ui.js';
import { eventManager } from './eventManager.js';
import { UIEvents, NetworkEvents, GameEvents } from './eventTypes.js';
import { CONFIG } from './config.js';
import { runBrowserTests } from './test/browser.test.js';
import { uiManager } from './uiManager.js';

// Add global error handler for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    eventManager.dispatchEvent(UIEvents.ERROR, {
        message: 'An unexpected error occurred. Please try again.'
    });
});

// Add config validation at startup
function validateConfig() {
    try {
        if (!CONFIG) {
            throw new Error('Configuration not loaded');
        }
        if (!CONFIG.SERVER_URL) {
            throw new Error('SERVER_URL not configured');
        }
        console.log('Configuration loaded:', CONFIG);
        return true;
    } catch (error) {
        console.error('Configuration error:', error);
        displayFallbackError('Failed to load configuration');
        return false;
    }
}

function setupEventListeners() {
    // UI Events
    eventManager.addEventListener(UIEvents.CREATE_CLICK, handleCreateGame);
    eventManager.addEventListener(UIEvents.JOIN_CLICK, handleJoinGame);
    eventManager.addEventListener(UIEvents.ERROR, handleError);

    // Game Events
    eventManager.addEventListener(GameEvents.STATE_UPDATE, handleGameUpdate);
    eventManager.addEventListener(GameEvents.GAME_OVER, handleGameOver);
    eventManager.addEventListener(GameEvents.GAME_START, handleGameStart);
}

async function handleCreateGame(data) {
    try {
        const { playerName } = data;
        console.log('Creating game with player name:', playerName);

        if (!playerName?.trim()) {
            throw new Error('Please enter your name');
        }

        const response = await connectToServer('create', playerName);
        
        if (response.success) {
            // Store player info
            localStorage.setItem('playerName', playerName);
            
            // First update UI with player name
            uiManager.updatePlayerName(playerName);
            
            // Then dispatch success event with all required data
            eventManager.dispatchEvent(UIEvents.CREATE_GAME_SUCCESS, {
                code: response.challengeCode,
                playerName: playerName,
                playerId: response.playerId
            });

            return response;
        } else {
            throw new Error(response.message || 'Failed to create game');
        }
    } catch (error) {
        console.error('Create game error:', error);
        eventManager.dispatchEvent(UIEvents.CREATE_GAME_FAILURE, {
            message: error.message
        });
    }
}

// Add state tracking
let joinRequestInProgress = false;
let gameState = null;
let currentPlayerId = null;

async function handleJoinGame(data) {
    try {
        if (joinRequestInProgress) {
            console.log('Join request already in progress');
            return;
        }

        joinRequestInProgress = true;
        const { playerName, roomCode } = data;
        
        // Create deep copy of data
        const joinData = {
            playerName: playerName?.trim(),
            roomCode: roomCode?.trim()
        };

        if (!joinData.playerName || !joinData.roomCode) {
            throw new Error('Player name and room code are required');
        }

        const response = await connectToServer('join', joinData.playerName, joinData.roomCode);
        console.log('Server join response:', response);

        if (response.success) {
            localStorage.setItem('playerName', joinData.playerName);
            localStorage.setItem('playerId', response.gameId);

            // Ensure we have complete data before UI update
            const eventData = {
                gameState: response.gameState,
                playerId: response.gameId, // Use gameId as playerId
                players: response.players,
                roomCode: joinData.roomCode,
                localPlayer: {
                    name: joinData.playerName,
                    id: response.gameId
                }
            };

            eventManager.dispatchEvent(UIEvents.JOIN_GAME_SUCCESS, eventData);
            return response;
        } else {
            throw new Error(response.message || 'Failed to join game');
        }
    } catch (error) {
        console.error('Join game error:', error);
        eventManager.dispatchEvent(UIEvents.ERROR, {
            message: error.message
        });
    } finally {
        joinRequestInProgress = false;
    }
}

// Update error handler to use uiManager
function handleError(data) {
    console.error('Game error:', data.message);
    uiManager.displayMessage(data.message || 'An unexpected error occurred', true);
}

function handleGameUpdate(data) {
    console.log('Game state update:', data);
    // Handle game state updates
}

function handleGameOver(data) {
    console.log('Game over:', data);
    // Handle game over state
}

function handleGameStart(data) {
    console.log('Handling game start:', data);
    
    if (!data?.gameState || !data?.players) {
        console.error('Invalid game start data');
        return;
    }

    gameState = data.gameState;
    currentPlayerId = data.playerId;

    // Store in localStorage
    localStorage.setItem('gameId', data.gameState.gameId);
    localStorage.setItem('playerId', data.playerId);

    // Dispatch success event with complete data
    eventManager.dispatchEvent(UIEvents.JOIN_GAME_SUCCESS, {
        gameState: data.gameState,
        players: data.players,
        playerId: data.playerId,
        roomCode: data.roomCode
    });
}

let currentGameState;
let localPlayerId;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG: DOMContentLoaded - START");

    // Validate config before proceeding
    if (!validateConfig()) {
        return;
    }

    try {
        // Run browser compatibility tests
        if (!runBrowserTests()) {
            throw new Error('Browser compatibility check failed');
        }

        // Initialize UI first
        if (!await initializeUI()) {
            throw new Error('UI initialization failed');
        }

        // Set up critical error handler
        window.onerror = (msg, url, line, col, error) => {
            console.error('Global error:', { msg, url, line, col, error });
            displayMessage('An error occurred. Please refresh the page.', true);
        };

        // Check connection
        console.log('Server URL:', CONFIG.SERVER_URL);

        // Initialize event listeners
        setupEventListeners();

        // Then check URL parameters
        checkUrlParameters();

        // --- Get DOM elements for setup actions ---
        const createChallengeButton = document.getElementById('create-challenge-button');
        const joinChallengeButton = document.getElementById('join-challenge-button');
        const playerNameInput = document.getElementById('player-name-input');
        const roomCodeInput = document.getElementById('room-code-input');

        // Add input validation
        const joinButton = document.getElementById('join-challenge-button');

        // Fix join button validation
        const validateJoinInputs = () => {
            const hasName = playerNameInput.value.trim().length > 0;
            const hasCode = roomCodeInput.value.trim().length > 0;
            joinButton.disabled = !(hasName && hasCode);
        };

        // Add input listeners
        if (playerNameInput) {
            playerNameInput.addEventListener('input', validateJoinInputs);
        }
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', validateJoinInputs);
            roomCodeInput.readOnly = false; // Ensure input is editable
        }

        // Initial validation
        validateJoinInputs();

        // --- Add Event Listeners for Setup ---
        if (createChallengeButton) {
            createChallengeButton.addEventListener('click', handleCreateGame);
        } else {
            console.error("Create Challenge button not found");
        }

        if (joinChallengeButton) {
            joinChallengeButton.addEventListener('click', handleJoinGame);
        } else {
            console.error("Join Challenge button not found");
        }

        // Show the initial screen
        uiManager.showSetupScreen();

    } catch (error) {
        console.error('Initialization error:', error);
        uiManager.displayMessage('Failed to initialize game. Please refresh.', true);
    }

    console.log("DEBUG: DOMContentLoaded - END");
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    eventManager.clearEventLog();
    disconnectFromServer();
});