import { connectToServer, disconnectFromServer, emitCreateChallenge, emitJoinChallenge, checkUrlParameters } from './network.js';
import { initializeUI, showSetupScreen, displayMessage } from './ui.js';
import { CONFIG } from './config.js';
import { eventManager, EventTypes } from './eventManager.js'; // Add this import

let currentGameState;
let localPlayerId;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded - START");

    // Initialize UI first
    if (!initializeUI()) {
        console.error("Failed to initialize UI - stopping initialization");
        displayMessage("Failed to initialize game interface", true);
        return;
    }

    // Then check URL parameters
    checkUrlParameters();

    // --- Get DOM elements for setup actions ---
    const createChallengeButton = document.getElementById('create-challenge-button');
    const joinChallengeButton = document.getElementById('join-challenge-button');
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('room-code-input');

    // Add input validation
    const joinButton = document.getElementById('join-challenge-button');

    // Enable/disable join button based on inputs
    function validateJoinInputs() {
        const hasName = playerNameInput.value.trim().length > 0;
        const hasCode = roomCodeInput.value.trim().length > 0;
        joinButton.disabled = !(hasName && hasCode);
    }

    playerNameInput.addEventListener('input', validateJoinInputs);
    roomCodeInput.addEventListener('input', validateJoinInputs);

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

    // Add event listener for join game events
    eventManager.addEventListener(EventTypes.UI.JOIN_GAME, (data) => {
        if (!data || typeof data !== 'object') {
            console.error('Invalid join data:', data);
            return;
        }
        handleJoinGame(data.playerName, data.roomCode);
    });

    // Show the initial screen
    showSetupScreen();

    console.log("DEBUG: DOMContentLoaded - END");
});

// --- Network Action Handlers ---
async function handleCreateGame() {
    const playerNameInput = document.getElementById('player-name-input');
    const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player';
    
    if (!playerName) {
        displayMessage("Please enter your name.", true);
        return;
    }
    
    if (!CONFIG.SERVER_URL) {
        displayMessage("Server URL not configured.", true);
        return;
    }

    console.log("DEBUG: 'Create Game' button clicked.");
    displayMessage("Creating game...");

    try {
        // Use emitCreateChallenge instead of connectToServer
        emitCreateChallenge(playerName);
    } catch (error) {
        console.error("Error creating game:", error);
        displayMessage(`Failed to create game: ${error}`, true);
        showSetupScreen();
    }
}

// Update join game handler
async function handleJoinGame(playerName, roomCode) {
    const joinButton = document.getElementById('join-challenge-button');
    
    try {
        if (!playerName || !roomCode) {
            throw new Error("Name and room code are required");
        }

        // Disable button and show loading state
        if (joinButton) joinButton.disabled = true;
        displayMessage("Connecting...");
        
        await emitJoinChallenge(playerName, roomCode);
    } catch (error) {
        console.error("Join game error:", error);
        displayMessage(error.message || "Failed to join game", true);
        showSetupScreen();
    } finally {
        // Re-enable button
        if (joinButton) joinButton.disabled = false;
    }
}

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    disconnectFromServer();
});