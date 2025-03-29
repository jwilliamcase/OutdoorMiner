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

// Change handleJoinGame to handle DOM elements directly
async function handleJoinGame() {
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const joinButton = document.getElementById('join-challenge-button');
    
    try {
        const playerName = playerNameInput?.value?.trim();
        const roomCode = roomCodeInput?.value?.trim();

        console.log('Join attempt:', { playerName, roomCode }); // Debug log

        if (!playerName || !roomCode) {
            displayMessage("Please enter both name and room code", true);
            return;
        }

        if (joinButton) joinButton.disabled = true;
        displayMessage("Connecting...");
        
        await emitJoinChallenge(playerName, roomCode);
    } catch (error) {
        console.error("Join game error:", error);
        displayMessage(error.message || "Failed to join game", true);
        showSetupScreen();
    } finally {
        if (joinButton) joinButton.disabled = false;
    }
}

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    disconnectFromServer();
});