// Outdoor Miner - Multiplayer Module
(function() {
    // --- State Variables ---
    let socket = null;
    let connected = false;
    let playerId = null;
    let gameId = null; // Store gameId received from server
    let localPlayerNumber = null; // 1 or 2, set upon game setup
    let isOnlineGame = false; // Flag for online status
    let pendingAction = null;
    let pendingArgs = {};
    let unreadMessages = 0;

    // --- UI Elements (References assumed to exist) ---
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendMessageButton = document.getElementById('send-message');
    const showTauntsButton = document.getElementById('show-taunts');
    const tauntMenu = document.getElementById('taunt-menu');
    const tauntList = document.querySelector('.taunt-list');
    const closeChat = document.getElementById('close-chat');
    const toggleChat = document.getElementById('toggle-chat');
    const statusIndicator = document.getElementById('multiplayer-status');

    // --- Initialization ---
    function init() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO library (io) not found! Ensure index.html includes it.');
            updateStatusIndicator(false, 'Error: Lib Missing');
            return; // Stop initialization if io is missing
        }
        // Setup basic UI listeners (chat, taunts)
        setupUIEventListeners();
        setupTaunts();
        updateStatusIndicator(false, 'Offline'); // Initial status
        console.log("Multiplayer module initialized.");
    }

    // --- Connection Management ---
    function connectToServer(playerName, action, args) {
        if (connected) {
            console.log("connectToServer: Already connected.");
            // If connected, proceed with action directly
            executePendingAction(action, { ...args, playerName });
            return;
        }
        if (socket && socket.connecting) {
            console.log("connectToServer: Connection already in progress.");
            return; // Avoid multiple concurrent attempts
        }

        // Ensure config is loaded
        if (typeof window.CONFIG === 'undefined' || !window.CONFIG.SERVER_URL) {
            console.error("CONFIG.SERVER_URL is not defined. Cannot connect.");
            window.updateMessage('Error: Server configuration missing.', true);
            updateStatusIndicator(false, 'Error: Config');
            return;
        }

        // Store intended action
        pendingAction = action;
        pendingArgs = { ...args, playerName }; // Store playerName with other args

        updateStatusIndicator(false, 'Connecting...');
        window.updateMessage('Connecting to server...', false);
        console.log(`Attempting connection to ${window.CONFIG.SERVER_URL} for action: ${action}`);

        try {
            // Disconnect previous socket if exists? Not strictly necessary with check above.
            // if (socket) disconnectFromServer(true);

            socket = io(window.CONFIG.SERVER_URL, {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 2000,
                timeout: 10000, // Connection timeout
                // transports: ['websocket'], // Prioritize WebSocket, but allow fallback
                // autoConnect: false // We are connecting manually here
            });

            // --- Centralized Socket Event Listeners ---
            // Setup listeners immediately after creating the socket instance.
            // These will handle connect, disconnect, errors, and game events.
            setupSocketListeners(socket);

        } catch (error) {
            console.error("Socket.IO connection initiation failed:", error);
            window.updateMessage(`Error connecting: ${error.message}`, true);
            updateStatusIndicator(false, 'Error: Init Fail');
            // Clean up if socket object was partially created?
            socket = null;
        }
    }

    function setupSocketListeners(socketInstance) {
        // --- Core Connection Events ---
        socketInstance.on('connect', () => {
            connected = true;
            playerId = socketInstance.id;
            isOnlineGame = true; // Mark as potentially starting online mode
            console.log('Connected to server with ID:', playerId);
            updateStatusIndicator(true, 'Connected');
            window.updateMessage('Connected! Waiting for game setup...', false);

            // Execute the pending action now connection is established
            console.log("Executing pending action:", pendingAction, pendingArgs);
            executePendingAction(pendingAction, pendingArgs);

            pendingAction = null; // Clear pending action after execution attempt
            pendingArgs = {};
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            const wasConnected = connected; // Store previous state
            connected = false;
            isOnlineGame = false; // Reset online status
            // gameId = null; // Don't clear gameId on temporary disconnect? Needs testing.
            updateStatusIndicator(false, 'Disconnected');
            // If disconnected unexpectedly during a game, notify script.js
            if (wasConnected && reason !== 'io client disconnect' && reason !== 'io server disconnect') {
                 // Avoid notifying if disconnect was intentional (via disconnectFromServer)
                window.handleUnexpectedDisconnect('Lost connection: ' + reason);
            }
            // Should we attempt manual reconnection here? Socket.IO handles auto-reconnect based on options.
        });

        socketInstance.on('connect_error', (error) => {
            console.error('Connection Error:', error);
            connected = false;
            isOnlineGame = false;
            // gameId = null; // Clear gameId on connection failure
            updateStatusIndicator(false, 'Conn. Failed');
            window.handleConnectionError(`Connection failed: ${error.message}`); // Notify script.js
            // Clean up socket? Socket.IO might retry automatically.
            // Let's not call disconnectFromServer here to allow auto-reconnect attempts.
        });

        // --- Game Handshake/Setup Events ---
        socketInstance.on('game-created', (data) => {
            console.log("Server response: Game created", data);
            gameId = data.gameId; // Store the game ID provided by the server
            localPlayerNumber = data.playerNumber; // Store player number (should be 1)
            window.updateMessage(`Game created! Code: ${gameId}. Waiting for opponent...`, 'info');
            // Player 1 now needs to setup the board locally and send 'initialize-game'
            // This trigger should likely come from script.js after local setup is done.
            // For now, let's assume script.js handles this next step.
             window.setGameInfo(gameId, localPlayerNumber); // Tell script.js the gameId and player number
             // Consider triggering board setup in script.js here?
        });

        socketInstance.on('game-joined', (data) => {
            console.log("Server response: Game joined", data);
            gameId = data.gameId; // Store game ID
            localPlayerNumber = data.playerNumber; // Store player number (should be 2)
            window.updateMessage(`Joined game ${gameId} as Player ${localPlayerNumber}. Waiting for game start...`, 'info');
             window.setGameInfo(gameId, localPlayerNumber, data.opponentName); // Tell script.js the gameId, number, and opponent name
            // Player 2 just waits for 'game-setup' now.
        });

         socketInstance.on('player-joined', (data) => { // For Player 1 when Player 2 joins
             console.log("Server notification: Player joined", data);
             window.updateMessage(`Player ${data.playerName} (P${data.playerNumber}) joined. Initializing game...`, 'info');
             window.setOpponentInfo(data.playerNumber, data.playerName); // Update script.js with opponent info
             // If P1 has already sent 'initialize-game', the server will now send 'game-setup' soon.
             // If P1 hasn't sent 'initialize-game' yet, they should do so now. script.js needs to handle this logic.
         });

        socketInstance.on('waiting-for-opponent', () => {
            console.log("Server notification: Waiting for opponent");
            window.updateMessage(`Game ${gameId} initialized. Waiting for opponent to join...`, 'info');
        });

        // --- Core Game State Events ---
        socketInstance.on('game-setup', (data) => {
            // This event *starts* the game visually for both players
            console.log("Received game-setup:", data);
            if (data.error) {
                console.error("Game setup error:", data.error);
                window.handleGameSetupError(data.error);
                disconnectFromServer();
            } else {
                gameId = data.gameId; // Re-affirm gameId
                localPlayerNumber = data.playerNumber; // Re-affirm player number
                // Pass everything to script.js to draw the board and set up the game state
                window.initializeOnlineGame(data.gameId, data.playerNumber, data.playerNames, data.playerColors, data.initialGameState);
                updateStatusIndicator(true, 'In Game');
            }
        });

        socketInstance.on('game-state', (newGameState) => {
            // This event updates the board/scores during gameplay
            console.log("Received game-state update");
            window.syncGameState(newGameState); // Delegate state sync and UI update to script.js
        });

        socketInstance.on('game-over', (data) => {
            console.log('Received game-over:', data);
             if (data.gameState) { // Sync final state if provided
                 window.syncGameState(data.gameState);
             }
             window.handleGameOver(data.message || "Game Over!"); // Let script.js handle UI
             updateStatusIndicator(true, 'Game Over'); // Keep connected status
             // gameId = null; // Keep gameId for potential rematch?
        });

        socketInstance.on('player-disconnected', (data) => {
            console.log('Received player-disconnected:', data);
            window.handleOpponentDisconnect(data.message || 'Opponent disconnected. Game ended.'); // Let script.js handle UI
            updateStatusIndicator(true, 'Opponent Left'); // Keep connected status
            gameId = null; // Game is over
            isOnlineGame = false; // Can't play online alone
        });

        // socketInstance.on('game-restarted', (data) => { // Add if implementing restart fully
        //     console.log('Game restart confirmed:', data);
        //     // Similar to game-setup, re-initialize with new state
        //     window.initializeOnlineGame(data.gameId, data.playerNumber, data.playerNames, data.playerColors, data.initialGameState);
        //     updateStatusIndicator(true, 'In Game');
        // });

        // --- Error Handling ---
        socketInstance.on('game-error', (data) => { // General game-related errors from server
             console.error('Server Game Error:', data.message);
             window.handleGenericServerError(data.message, data.errorType); // Let script.js show user

             // Specific handling for critical errors
            if (data.errorType === 'GAME_FULL' || data.errorType === 'GAME_NOT_FOUND' || data.errorType === 'INVALID_STATE') {
                 updateStatusIndicator(connected, connected ? 'Error' : 'Connection Failed');
                 disconnectFromServer(); // Disconnect on critical game finding/state errors
             } else if (data.errorType === 'INVALID_ACTION' || data.errorType === 'NOT_YOUR_TURN') {
                 updateStatusIndicator(connected, 'Error'); // Show error, but don't disconnect for recoverable errors
             }
        });

        // --- Chat/Taunt Events ---
        socketInstance.on('receive-message', (data) => { // Changed from 'chat-message' based on server emit
            console.log("Chat message received:", data);
            displayChatMessage(data);
            window.playSound(data.isTaunt ? 'taunt' : 'message');
             if (chatContainer && chatContainer.classList.contains('hidden')) {
                 unreadMessages++;
                 updateUnreadIndicator();
             }
        });
    }

    function disconnectFromServer(isInternal = false) {
        if (socket) {
            console.log("Disconnecting from server...");
            if (connected && gameId && !isInternal) {
                // Only notify server if intentionally leaving a connected game
                notifyLeaveGame();
            }
            // socket.off(); // Remove all listeners - careful if this has unintended side effects
            socket.disconnect(); // Trigger the 'disconnect' event handler
        }
        // Reset state variables - the 'disconnect' handler also does this, maybe redundant?
        socket = null;
        connected = false;
        isOnlineGame = false;
        gameId = null;
        localPlayerNumber = null;
        playerId = null;
        updateStatusIndicator(false, 'Disconnected');
        console.log("Client-side disconnected.");
    }

    function executePendingAction(action, args) {
        if (!connected) {
            console.error("Cannot execute action - not connected.");
            window.updateMessage("Error: Not connected to server.", true);
            updateStatusIndicator(false, 'Error');
            return;
        }
        console.log(`Executing action: ${action} with args:`, args);
        switch (action) {
            case 'create':
                createChallenge(args.playerName);
                break;
            case 'join':
                joinChallenge(args.playerName, args.gameId);
                break;
             case 'initialize': // Action to send initial game state (called by script.js)
                 sendInitialGameState(args.gameId, args.gameData);
                 break;
            // Add other actions if needed
            default:
                console.warn("Unknown pending action:", action);
        }
    }

    // --- Actions (Called by script.js, exposed via window) ---

    function createChallenge(playerName) {
        if (!connected || !socket) {
            console.error('Socket not connected when trying to create challenge.');
            window.updateMessage('Error: Could not create challenge. Not connected.', true);
            updateStatusIndicator(false, 'Error');
            return; // Added return
        }
        console.log(`Emitting 'create-game' with name: ${playerName}`);
        socket.emit('create-game', { playerName });
        window.updateMessage("Creating challenge...", 'info');
        // Server will respond with 'game-created' or 'game-error'
    }

    function joinChallenge(playerName, joinGameId) { // Renamed param to avoid conflict with global gameId
        if (!joinGameId) {
            console.error("Game ID is required to join.");
            window.updateMessage('Error: Game ID is required.', true);
            return; // Added return
        }
        if (!connected || !socket) {
            console.error('Socket not connected when trying to join challenge.');
            window.updateMessage('Error: Could not join challenge. Not connected.', true);
            updateStatusIndicator(false, 'Error');
            return; // Added return
        }
        console.log(`Emitting 'join-game' for ${joinGameId} with name: ${playerName}`);
        socket.emit('join-game', { gameId: joinGameId, playerName });
        window.updateMessage(`Joining game ${joinGameId}...`, 'info');
        // Server will respond with 'game-joined', 'game-error'
    }

     // Called by script.js *after* P1 creates game and sets up board locally
     function sendInitialGameState(targetGameId, gameData) {
         if (!connected || !socket) {
             console.error('Cannot send initial game state: Not connected.');
             window.updateMessage('Error: Cannot initialize game - not connected.', true);
             return;
         }
         if (targetGameId !== gameId || localPlayerNumber !== 1) {
             console.error(`Cannot send initial game state: Game ID mismatch or not Player 1. (Local: ${gameId}/${localPlayerNumber}, Target: ${targetGameId})`);
             // window.updateMessage('Error: Cannot initialize game - state mismatch.', true); // Maybe too technical for user
             return;
         }
         console.log(`Emitting 'initialize-game' for game ${gameId} with data:`, gameData);
         socket.emit('initialize-game', { gameId: targetGameId, gameData });
         window.updateMessage('Game setup sent. Waiting for opponent or game start...', 'info');
     }

    function sendMove(moveData) {
        if (!connected || !socket || !gameId || !isOnlineGame) {
            console.warn("Cannot send move. Not connected or not in an online game.", { connected, socket: !!socket, gameId, isOnlineGame });
            // Provide feedback only if it's unexpected (e.g., mid-game)
            if (isOnlineGame) window.updateMessage("Cannot send move: Connection issue?", true);
            return;
        }
        // Get player number reliably (set during game setup)
        if (!localPlayerNumber) {
             console.error("Cannot send move: Local player number unknown.");
             return;
        }
        console.log(`Sending move for G:${gameId}, P:${localPlayerNumber}`, moveData);
        socket.emit('make-move', {
            gameId: gameId,
            playerNumber: localPlayerNumber, // Use player number stored locally
            move: moveData
        });
        // Optimistic updates handled in script.js; server sends 'game-state' to confirm/correct
    }

    function requestRestartGame() {
         if (!isOnlineGame) { // Handle local restart case
             if (window.restartGame) {
                 console.log("Performing local restart.");
                 window.restartGame();
             }
             return;
         }
        if (!connected || !socket || !gameId) {
            console.warn("Cannot request restart. Not connected or not in a game.");
            window.updateMessage("Cannot request restart: Not connected or not in a game.", true);
            return;
        }
        console.log("Requesting game restart...");
        socket.emit('request-restart', { gameId });
        window.updateMessage("Restart requested. Waiting for opponent...");
    }

    function notifyLeaveGame() {
        if (connected && socket && gameId) {
            console.log("Notifying server of leaving game...");
            socket.emit('leave-game', { gameId });
        }
        // Actual disconnect happens in disconnectFromServer
    }

    // --- Chat and Taunts (Mostly unchanged, check references) ---
    function setupUIEventListeners() {
        if (toggleChat) toggleChat.addEventListener('click', toggleChatVisibility);
        if (closeChat) closeChat.addEventListener('click', () => { if (chatContainer) chatContainer.classList.add('hidden'); });
        if (sendMessageButton) sendMessageButton.addEventListener('click', handleSendChatMessage);
        if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage(); } });
        if (showTauntsButton) showTauntsButton.addEventListener('click', toggleTauntMenu);
        document.addEventListener('click', (e) => { if (tauntMenu && showTauntsButton && !tauntMenu.contains(e.target) && e.target !== showTauntsButton) { tauntMenu.classList.add('hidden'); } });
    }

    function setupTaunts() {
        if (!window.CONFIG?.TAUNTS?.length || !tauntList) return;
        tauntList.innerHTML = '';
        window.CONFIG.TAUNTS.forEach(taunt => {
            const tauntOption = document.createElement('div');
            tauntOption.className = 'taunt-option';
            tauntOption.textContent = taunt;
            tauntOption.addEventListener('click', () => { sendTaunt(taunt); if (tauntMenu) tauntMenu.classList.add('hidden'); });
            tauntList.appendChild(tauntOption);
        });
    }

    function toggleChatVisibility() {
        if (!chatContainer) return;
        const isHidden = chatContainer.classList.toggle('hidden');
        if (!isHidden) {
            unreadMessages = 0; updateUnreadIndicator();
            if (chatInput) chatInput.focus();
            if(chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function updateUnreadIndicator() {
        if (!toggleChat) return;
        const existingBadge = toggleChat.querySelector('.notification-badge');
        if (existingBadge) existingBadge.remove(); // Clean previous badge

        if (unreadMessages > 0) {
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = unreadMessages > 9 ? '9+' : unreadMessages;
            toggleChat.appendChild(badge); // Append badge to button
            toggleChat.classList.add('has-unread');
        } else {
            toggleChat.classList.remove('has-unread');
        }
    }

    function toggleTauntMenu() { if (tauntMenu) tauntMenu.classList.toggle('hidden'); }

    function handleSendChatMessage() {
        if (!chatInput || !chatInput.value.trim()) return;
        sendChatMessage(chatInput.value.trim());
        chatInput.value = ''; chatInput.focus();
    }

    function sendChatMessage(message) {
        if (!connected || !socket || !gameId || !isOnlineGame) return;
        socket.emit('send-message', { gameId, playerNumber: localPlayerNumber, message, isTaunt: false });
    }

    function sendTaunt(taunt) {
        if (!connected || !socket || !gameId || !isOnlineGame) return;
        socket.emit('send-message', { gameId, playerNumber: localPlayerNumber, message: taunt, isTaunt: true });
        window.playSound('taunt'); // Play locally immediately
    }

    function displayChatMessage(data) {
        if (!chatMessages) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        // Determine if the message is from the current player
        const isMine = data.playerNumber === localPlayerNumber;

        const senderName = data.isFromServer ? 'System' : (data.playerName || `Player ${data.playerNumber}`);
        messageDiv.classList.add(data.isFromServer ? 'system-message' : (isMine ? 'my-message' : 'other-message'));
        if (data.isTaunt) messageDiv.classList.add('taunt-message');

        if (!data.isFromServer) {
            const nameSpan = document.createElement('div'); nameSpan.className = 'sender-name';
            nameSpan.textContent = senderName + (isMine ? " (You)" : ""); // Add "(You)" if mine
            messageDiv.appendChild(nameSpan);
        }
        const messageText = document.createElement('div'); messageText.className = 'message-text';
        messageText.textContent = data.message; // Use textContent to prevent XSS
        messageDiv.appendChild(messageText);
        const timestampSpan = document.createElement('div'); timestampSpan.className = 'message-timestamp';
        const time = data.timestamp ? new Date(data.timestamp) : new Date();
        timestampSpan.textContent = `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`;
        messageDiv.appendChild(timestampSpan);

        const shouldScroll = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 20;
        chatMessages.appendChild(messageDiv);
        if (shouldScroll || isMine) { chatMessages.scrollTop = chatMessages.scrollHeight; }
    }

    // --- Utility Functions ---
    function updateStatusIndicator(isConnected, statusText) {
        if (!statusIndicator) return;
        const statusClass = isConnected ? 'status-connected' : (statusText === 'Connecting...' ? 'status-connecting' : (statusText.includes('Error') || statusText.includes('Failed') || statusText.includes('Missing') ? 'status-error' : 'status-disconnected'));
        statusIndicator.innerHTML = `<span class="connection-status ${statusClass}"></span> ${statusText}`;
    }

    // --- Expose Functions to Global Scope (for script.js) ---
    window.multiplayer = {
        connectToServer,
        disconnectFromServer,
        // createChallenge, // Actions are now handled via connectToServer
        // joinChallenge,   // Actions are now handled via connectToServer
        sendInitialGameState, // Expose function for P1 to send initial state
        sendMove,
        requestRestartGame,
        notifyLeaveGame, // Maybe remove this if disconnectFromServer handles it
        sendChatMessage,
        sendTaunt
        // getLocalPlayerNumber: () => localPlayerNumber // Helper if script.js needs it
    };

    // --- Auto-Initialize ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0); // Ensure config/DOM ready
    }

})();