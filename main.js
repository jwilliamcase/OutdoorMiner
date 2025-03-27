import { connectToServer, disconnectFromServer, emitCreateChallenge, emitJoinChallenge } from './network.js';
import {
    initializeUI,
    showSetupScreen,
    displayMessage,
    getBoardDimensions
} from './ui.js';
import { CONFIG } from './config.js';

let currentGameState;
let localPlayerId;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded - START");

    // Initialize UI elements and basic event listeners
    initializeUI();

    // --- Get DOM elements for setup actions ---
    const createChallengeButton = document.getElementById('create-challenge-button');
    const joinChallengeButton = document.getElementById('join-challenge-button');
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('room-code-input');

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
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player';
    const roomCode = roomCodeInput ? roomCodeInput.value.trim() : '';

    if (!playerName) {
        displayMessage("Please enter your name.", true);
        return;
    }
    
    if (!roomCode) {
        displayMessage("Please enter a room code to join.", true);
        return;
    }

    if (!CONFIG.SERVER_URL) {
        displayMessage("Server URL not configured.", true);
        return;
    }

    console.log(`DEBUG: 'Join Game' button clicked for room: ${roomCode}`);
    displayMessage(`Joining game ${roomCode}...`);

    try {
        // Use emitJoinChallenge instead of connectToServer
        emitJoinChallenge(playerName, roomCode);
    } catch (error) {
        console.error("Error joining game:", error);
        displayMessage(`Failed to join game: ${error}`, true);
        showSetupScreen();
    }
}

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    disconnectFromServer();
});