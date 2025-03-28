import { connectToServer, disconnectFromServer, emitCreateChallenge, emitJoinChallenge, checkUrlParameters } from './network.js';
import {
    initializeUI,
    showSetupScreen,
    displayMessage
} from './ui.js';
import { CONFIG } from './config.js';

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

async function handleJoinGame() {
    const joinButton = document.getElementById('join-challenge-button');
    
    // Prevent multiple clicks
    if (joinButton.disabled) {
        return;
    }
    
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const playerName = playerNameInput?.value.trim();
    const roomCode = roomCodeInput?.value.trim();

    if (!playerName || !roomCode) {
        displayMessage("Please enter both your name and room code.", true);
        return;
    }

    try {
        // Disable button during join attempt
        joinButton.disabled = true;
        displayMessage(`Joining game ${roomCode}...`);
        await emitJoinChallenge(playerName, roomCode);
    } catch (error) {
        console.error("Error joining game:", error);
        displayMessage(`Failed to join game: ${error.message}`, true);
        showSetupScreen();
    } finally {
        // Re-enable button after attempt (success or failure)
        joinButton.disabled = false;
    }
}

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    disconnectFromServer();
});