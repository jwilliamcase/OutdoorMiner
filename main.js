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
// Main application entry point
import { initializeUI, showSetupScreen, displayMessage, getBoardDimensions } from './ui.js'; // Import UI functions
import { connectToServer, emitCreateChallenge, emitJoinChallenge } from './network.js'; // Import Network functions
import { CONFIG } from './config.js'; // Import config if needed directly (e.g., validation)

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
        createChallengeButton.addEventListener('click', () => {
            console.log("DEBUG: createChallengeButton clicked.");
            const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player';
            if (!playerName) {
                displayMessage("Please enter a player name.", true);
                return;
            }
            // Connect AND create challenge (simplified flow)
            // We might need a two-step process: connect first, then create/join
            // Let's try emitting directly, assuming network.js handles connection state
            if (!CONFIG.SERVER_URL) {
                 displayMessage("Server URL not configured.", true);
                 return;
            }
             // Assume connectToServer is called implicitly or needs explicit call first
             // For now: Try direct emit, network.js should check connection
             // connectToServer(); // Potentially needed if not auto-connecting
             emitCreateChallenge(playerName);

        });
    } else {
        console.error("Create Challenge button not found");
    }

    if (joinChallengeButton) {
        joinChallengeButton.addEventListener('click', () => {
            console.log("DEBUG: joinChallengeButton clicked.");
            const playerName = playerNameInput ? playerNameInput.value.trim() : 'Player';
            const roomCode = roomCodeInput ? roomCodeInput.value.trim() : '';
            if (!playerName) {
                displayMessage("Please enter a player name.", true);
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
            // connectToServer(); // Potentially needed if not auto-connecting
            emitJoinChallenge(playerName, roomCode);
        });
    } else {
        console.error("Join Challenge button not found");
    }

    // Show the initial screen
    showSetupScreen(); // Make sure setup is visible first

    console.log("DEBUG: DOMContentLoaded - END");
});

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