// main.js - Application Entry Point
import { initializeNetwork, connectToServer, disconnectFromServer } from './network.js';
import {
    initializeUI,
    showSetupScreen,
    displayMessage,
    createChallengeButton,
    joinChallengeButton,
    gameIdInput,
    playerNameInput
 } from './ui.js';
 // GameState might be needed if main orchestrates starting local games, but not for network focus
 // import { GameState } from './gameLogic.js';

let currentGameState = null;
let localPlayerId = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded - START");

    // Initialize Modules
    initializeUI(); // Sets up DOM elements and basic UI listeners
    initializeNetwork(); // Prepares network module (finds socket.io)

    // --- Add Event Listeners for Network Actions ---
    if (createChallengeButton) {
        createChallengeButton.addEventListener('click', handleCreateGame);
    } else {
        console.error("Create Challenge Button not found during initialization.");
    }

    if (joinChallengeButton) {
        joinChallengeButton.addEventListener('click', handleJoinGame);
    } else {
         console.error("Join Challenge Button not found during initialization.");
    }

    console.log("DEBUG: DOMContentLoaded - END - Event listeners attached.");
});

// --- Network Action Handlers ---
async function handleCreateGame() {
    const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player';
    if (!playerName) {
        displayMessage("Please enter your name.", true);
        return;
    }
    console.log("DEBUG: 'Create Game' button clicked.");
    displayMessage("Creating game..."); // Provide immediate feedback

    try {
        const { gameId, gameState, playerId } = await connectToServer('create', null, playerName);
        console.log(`DEBUG: Game created successfully in main.js. Game ID: ${gameId}, Player ID: ${playerId}`);
        currentGameState = gameState; // Store the initial state
        localPlayerId = playerId;
        // UI should be updated via network events ('game-created', 'game-joined') handled in network.js calling ui.js functions
    } catch (error) {
        console.error("Error creating game:", error);
        displayMessage(`Failed to create game: ${error}`, true);
        // Ensure UI is reset or appropriate feedback is given
        showSetupScreen(); // Go back to setup on failure
    }
}

async function handleJoinGame() {
    const gameIdToJoin = gameIdInput ? gameIdInput.value.trim() : '';
    const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player';

    if (!gameIdToJoin) {
        displayMessage("Please enter a Game ID to join.", true);
        return;
    }
     if (!playerName) {
        displayMessage("Please enter your name.", true);
        return;
    }

    console.log(`DEBUG: 'Join Game' button clicked for ID: ${gameIdToJoin}`);
    displayMessage(`Joining game ${gameIdToJoin}...`);

    try {
        const { gameId, gameState, playerId } = await connectToServer('join', gameIdToJoin, playerName);
        console.log(`DEBUG: Joined game successfully in main.js. Game ID: ${gameId}, Player ID: ${playerId}`);
        currentGameState = gameState; // Store the initial state
        localPlayerId = playerId;
        // UI updates handled by network events
    } catch (error) {
        console.error("Error joining game:", error);
        displayMessage(`Failed to join game: ${error}`, true);
        showSetupScreen(); // Go back to setup on failure
    }
}

// --- Global Access (if needed, though module imports are preferred) ---
// Example: Make a function globally accessible for debugging
// window.getMyGameState = () => currentGameState;

// Consider adding cleanup logic if needed, e.g., on window unload
window.addEventListener('beforeunload', () => {
    // Optional: Attempt to gracefully disconnect if connected
    // Note: This is not guaranteed to run fully
    disconnectFromServer();
});