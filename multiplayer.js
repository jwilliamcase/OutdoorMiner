// Outdoor Miner - Multiplayer Module
(function() {
    // --- State Variables ---
    let socket = null;
    let connected = false;
    let playerId = null;
    let localPlayerNumber = null; // 1 or 2
    let pendingAction = null;
    let pendingArgs = {};
    let unreadMessages = 0;

    // --- UI Elements (Mainly for Chat/Status) ---
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendMessageButton = document.getElementById('send-message');
    const showTauntsButton = document.getElementById('show-taunts');
    const tauntMenu = document.getElementById('taunt-menu');
    const tauntList = document.querySelector('.taunt-list');
    const closeChat = document.getElementById('close-chat');
    const toggleChat = document.getElementById('toggle-chat'); // Assuming toggle button is created in HTML or script.js
    const statusIndicator = document.getElementById('multiplayer-status'); // Assuming status indicator exists

    // --- Initialization ---
    function init() {
        // Check if socket.io is loaded globally
        if (typeof io === 'undefined') {
            console.error('Socket.IO library not found!');
            if (statusIndicator) statusIndicator.innerHTML = '<span class="connection-status status-error"></span> Error: Lib Missing';
        // Function to connect to the server
    function connectToServer(playerName, action, args) {
        // Prevent multiple connections if already connected
        if (connected) {
            console.log("Already connected.");
            // If connection exists, try the action immediately?
            // Or rely on caller to check? Let's assume caller handles this for now.
            // If an action was requested, attempt it directly.
            if (action === 'create' && args.playerName) {
                createChallenge(args.playerName);
            } else if (action === 'join' && args.playerName && args.gameId) {
                joinChallenge(args.playerName, args.gameId);
            }
            return;
        }
    
        // Avoid multiple connection attempts simultaneously
        if (socket && socket.connecting) {
            console.log("Connection already in progress.");
            return;
        }
    
    
        // Store the intended action
        pendingAction = action;
        pendingArgs = args || {}; // Store arguments like playerName, gameId
        pendingArgs.playerName = playerName; // Ensure playerName is always included
    
        // Show connecting message
        window.updateMessage('Connecting to server...', false);
        console.log(`Attempting to connect to server for action: ${action}`);
    
        // Connect to the server (adjust URL if needed)
        const serverUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : "/"; // Use relative path for deployed
        socket = io(serverUrl, {
            reconnectionAttempts: 3, // Limit reconnection attempts
            timeout: 5000 // Connection timeout
        });
    
        // --- Socket Event Listeners ---
        setupSocketListeners(playerName); // Setup listeners immediately (they are defined below)
        // Connection attempt is initiated by io()
    }
                    // withCredentials: true, // Use if sessions/cookies are needed
                    transports: ['websocket'], // Prioritize WebSocket
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000, // Slightly longer delay
                    timeout: 10000, // Connection timeout
                    autoConnect: true // Connect immediately
                });

                // --- Centralized Socket Event Listeners ---
                setupSocketListeners(socket, resolve, reject, playerNameFromSetup);

            } catch (error) {
                console.error("Socket.IO connection initiation failed:", error);
            socket.on('connect', () => {
        connected = true;
        playerId = socket.id;
        console.log('Connected to server with ID:', playerId);
        window.updateMessage('Connected! Ready.', false); // General connected message
        // heartbeatInterval = setupHeartbeat(socket); // Optional: If implementing heartbeats
        // syncInterval = setupStateSync(socket); // Optional: If implementing periodic sync

        // Execute the pending action now that connection is established
        if (pendingAction) {
            console.log(`Executing pending action: ${pendingAction}`);
            if (pendingAction === 'create' && pendingArgs.playerName) {
                createChallenge(pendingArgs.playerName);
            } else if (pendingAction === 'join' && pendingArgs.playerName && pendingArgs.gameId) {
                joinChallenge(pendingArgs.playerName, pendingArgs.gameId);
            }
            // Clear pending action once executed or attempted
            pendingAction = null;
            pendingArgs = {};
        }

        // UI is managed by script.js based on game state updates, not here directly
        // window.hideSetupScreen(); // Should already be hidden by script.js
        // window.showGameScreen(); // Should already be shown by script.js
    });
            isOnlineGame = true; // Mark as online mode potentially starting
            updateStatusIndicator(true, 'Connected');
            resolve(socketInstance); // Resolve the connection promise
            // Note: Player name is passed from script.js during create/join
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            const wasConnected = connected;
            connected = false;
            isOnlineGame = false; // Reset online status
            gameId = null;
            updateStatusIndicator(false, 'Disconnected');
            // If disconnected unexpectedly during a game, notify script.js
            if (wasConnected && reason !== 'io client disconnect') {
                window.handleUnexpectedDisconnect('Disconnected: ' + reason);
            }
            // Clean up listeners specific to this socket instance might be needed if not relying on garbage collection
        });

        socketInstance.on('connect_error', (error) => {
            console.error('Connection Error:', error);
            connected = false;
            isOnlineGame = false;
            gameId = null;
            updateStatusIndicator(false, 'Connection Failed');
            window.handleConnectionError(`Connection failed: ${error.message}`); // Notify script.js
            reject(error); // Reject the connection promise
            // Attempt to disconnect cleanly if possible?
             disconnectFromServer(true);
        });

        // --- Game Logic Events ---
        socketInstance.on('game-setup', (data) => {
            console.log("Game setup received:", data);
            if (data.error) {
                console.error("Game setup error:", data.error);
                window.handleGameSetupError(data.error); // Let script.js handle UI reset/message
                disconnectFromServer(); // Disconnect if setup fails critically
            } else {
                gameId = data.gameId;
                // Player name is already known client-side from setup
                // Player index and colors come from server
                window.initializeOnlineGame(data.gameId, data.playerIndex, data.playerNames, data.playerColors, data.gameState); // Pass all info to script.js
                updateStatusIndicator(true, 'In Game');
            }
        });

        socketInstance.on('game-state', (newGameState) => {
            console.log("Received game state update");
            window.syncGameState(newGameState); // Delegate state sync and UI update to script.js
        });

        socketInstance.on('game-over', (data) => {
            console.log('Game Over received:', data);
            // Sync final state if provided
            if (data.gameState) {
                window.syncGameState(data.gameState);
            }
             window.handleGameOver(data.message || "Game Over!"); // Let script.js handle UI
             updateStatusIndicator(true, 'Game Over'); // Keep connected status
             // Game is over, but connection might persist for rematch etc.
             // gameId = null; // Keep gameId for potential rematch? Depends on server logic
        });

        socketInstance.on('player-disconnected', (data) => {
            console.log('Opponent disconnected:', data);
            window.handleOpponentDisconnect(data.message || 'Opponent disconnected. Game ended.'); // Let script.js handle UI
            updateStatusIndicator(true, 'Opponent Left'); // Keep connected status
            gameId = null; // Game is over
            isOnlineGame = false; // Can't play online alone
        });

        socketInstance.on('game-restarted', (data) => {
            console.log('Game restart confirmed:', data);
            window.initializeOnlineGame(data.gameId, data.playerIndex, data.playerNames, data.playerColors, data.gameState); // Re-initialize with new state
            updateStatusIndicator(true, 'In Game'); // Back to in-game status
        });

        // --- Error Handling ---
        socketInstance.on('error-message', (data) => {
            console.error('Server Error:', data.message);
            // Let script.js decide how to display based on context/severity
            window.handleGenericServerError(data.message, data.errorType);

            // Specific handling for critical errors that end the attempt/game
            if (data.errorType === 'GAME_FULL' || data.errorType === 'GAME_NOT_FOUND' || data.errorType === 'INVALID_ACTION') {
                 updateStatusIndicator(connected, connected ? 'Error' : 'Connection Failed'); // Show error but keep connection status if connected
                 if (data.errorType !== 'INVALID_ACTION') {
                    // For game not found/full, disconnect might be appropriate if we can't recover
                    disconnectFromServer();
                 }
            }
        });

        // --- Chat/Taunt Events ---
        socketInstance.on('chat-message', (data) => {
            console.log("Chat message received:", data);
            displayChatMessage(data);
            // Play sound via script.js helper if needed
            window.playSound(data.isTaunt ? 'taunt' : 'message');
             // Update unread count and notify user visually
             if (chatContainer && chatContainer.classList.contains('hidden')) {
                 unreadMessages++;
                 updateUnreadIndicator();
             }
        });
    }

     function disconnectFromServer(isInternal = false) {
        if (socket) {
            console.log("Disconnecting from server...");
            // Remove listeners - crucial to prevent memory leaks or unexpected behavior on reconnect
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
            socket.off('game-setup');
            socket.off('game-state');
            socket.off('chat-message');
            socket.off('game-over');
            socket.off('player-disconnected');
            socket.off('game-restarted');
            socket.off('error-message');

            if (!isInternal) { // Only emit leave if it's a user action, not internal cleanup
                 notifyLeaveGame(); // Tell server we're leaving (if connected and in a game)
            }

            socket.disconnect();
        }
        socket = null; // Clear the socket reference
        connected = false;
        isOnlineGame = false;
        gameId = null;
        updateStatusIndicator(false, 'Disconnected');
    }


    // --- Actions (Called by script.js, exposed via window) ---
    // Function to create a new challenge
    function createChallenge(playerName) {
        if (socket && socket.connected) { // Check socket.connected specifically
            console.log(`Emitting create-challenge for player: ${playerName}`);
            socket.emit('create-challenge', { playerName });
            window.updateMessage('Challenge created. Waiting for opponent...', false);
            // UI should update based on server response ('game-created')
        } else {
            console.error('Socket not connected when trying to create challenge.');
            window.updateMessage('Error: Could not create challenge. Not connected.', true);
    // Function to join an existing challenge
    function joinChallenge(playerName, gameId) {
        if (!gameId) {
            console.error("Game ID is required to join.");
            window.updateMessage('Error: Game ID is required.', true);
            // Reset pending action if it failed?
            pendingAction = null;
            pendingArgs = {};
            return;
        }
        if (socket && socket.connected) { // Check socket.connected specifically
            console.log(`Emitting join-challenge for game ${gameId}, player: ${playerName}`);
            socket.emit('join-challenge', { gameId, playerName });
            window.updateMessage(`Attempting to join game ${gameId}...`, false);
            // UI should update based on server response ('game-joined' or error)
        } else {
            console.error('Socket not connected when trying to join challenge.');
            window.updateMessage('Error: Could not join challenge. Not connected.', true);
            // Reset pending action if it failed?
            pendingAction = null;
            pendingArgs = {};
        }
    }
    }

    function sendMove(moveData) {
        if (!connected || !socket || !gameId) {
            console.warn("Cannot send move. Not connected or not in a game.");
            // Optionally provide feedback to the user via window.updateMessage
            return;
        }
        // Player name should be part of gameState managed by script.js, or passed reliably
        const currentGameState = window.getGameState ? window.getGameState() : {}; // Get current state if possible
        socket.emit('make-move', {
            gameId: gameId,
            // playerIndex is more reliable than playerNumber if available from gameState
            playerIndex: currentGameState.playerIndex ?? moveData.playerNumber - 1, // Fallback to number if index unknown
            move: moveData // Contains type, details, coords etc.
        });
        // Optimistic updates are handled in script.js, waiting for server confirmation (game-state)
    }

     function requestRestartGame() {
        if (!connected || !socket || !gameId) {
            console.warn("Cannot request restart. Not connected or not in a game.");
            // Handle local restart if offline? script.js should decide based on isOnlineGame
            if (!isOnlineGame && window.restartGame) {
                 console.log("Performing local restart.");
                 window.restartGame(); // Call local restart function
            } else if (isOnlineGame) {
                 window.updateMessage("Cannot request restart: Not connected or not in a game.");
            }
            return;
        }
        console.log("Requesting game restart...");
        socket.emit('request-restart', { gameId });
        window.updateMessage("Restart requested. Waiting for opponent...");
        // Optionally disable restart button in script.js until response
    }

    function notifyLeaveGame() {
        if (connected && socket && gameId) {
            console.log("Notifying server of leaving game...");
            socket.emit('leave-game', { gameId });
        }
        // Client-side cleanup happens in disconnectFromServer or UI reset in script.js
        // Do NOT call disconnectFromServer() here directly, as it might be called BY disconnectFromServer
    }


    // --- Chat and Taunts ---
    function setupUIEventListeners() {
        if (toggleChat) {
            toggleChat.addEventListener('click', toggleChatVisibility);
        }
        if (closeChat) {
            closeChat.addEventListener('click', () => {
                if (chatContainer) chatContainer.classList.add('hidden');
                // Don't reset unread count here, only when opening
            });
        }
        if (sendMessageButton) {
            sendMessageButton.addEventListener('click', handleSendChatMessage);
        }
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline?
                    e.preventDefault(); // Prevent default newline insertion
                    handleSendChatMessage();
                }
            });
        }
        if (showTauntsButton) {
            showTauntsButton.addEventListener('click', toggleTauntMenu);
        }

        // Close taunt menu if clicking outside
        document.addEventListener('click', (e) => {
            if (tauntMenu && showTauntsButton && !tauntMenu.contains(e.target) && e.target !== showTauntsButton) {
                tauntMenu.classList.add('hidden');
            }
        });
    }

    function setupTaunts() {
        if (!window.CONFIG || !window.CONFIG.TAUNTS || !window.CONFIG.TAUNTS.length || !tauntList) return;

        tauntList.innerHTML = ''; // Clear existing
        window.CONFIG.TAUNTS.forEach(taunt => {
            const tauntOption = document.createElement('div');
            tauntOption.className = 'taunt-option';
            tauntOption.textContent = taunt;
            tauntOption.addEventListener('click', () => {
                sendTaunt(taunt);
                if (tauntMenu) tauntMenu.classList.add('hidden');
            });
            tauntList.appendChild(tauntOption);
        });
    }

    function toggleChatVisibility() {
        if (!chatContainer) return;
        const isHidden = chatContainer.classList.toggle('hidden');
        if (!isHidden) {
            unreadMessages = 0; // Reset count when opening
            updateUnreadIndicator();
            if (chatInput) chatInput.focus(); // Focus input when opening
             // Scroll to bottom when opening
             if(chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

     function updateUnreadIndicator() {
         if (!toggleChat) return;
         if (unreadMessages > 0) {
             // Ensure the notification span exists or create it
             let notificationSpan = toggleChat.querySelector('.notification');
             if (!notificationSpan) {
                 notificationSpan = document.createElement('span');
                 notificationSpan.className = 'notification';
                 toggleChat.appendChild(notificationSpan);
             }
             notificationSpan.textContent = unreadMessages;
             toggleChat.innerHTML = `💬${notificationSpan.outerHTML}`; // Keep the emoji
         } else {
             // Remove notification span if it exists
             const notificationSpan = toggleChat.querySelector('.notification');
             if (notificationSpan) {
                 notificationSpan.remove();
             }
             toggleChat.innerHTML = '💬'; // Just the emoji
         }
     }


    function toggleTauntMenu() {
        if (tauntMenu) tauntMenu.classList.toggle('hidden');
    }

    function handleSendChatMessage() {
        if (!chatInput || !chatInput.value.trim()) return;
        const message = chatInput.value.trim();
        sendChatMessage(message);
        chatInput.value = ''; // Clear input
        chatInput.focus(); // Keep focus
    }

    function sendChatMessage(message) {
        if (!connected || !socket || !gameId) {
            console.warn("Cannot send chat message. Not connected or not in a game.");
            return;
        }
        socket.emit('send-message', {
            gameId,
            message,
            isTaunt: false
        });
    }

    function sendTaunt(taunt) {
        if (!connected || !socket || !gameId) {
            console.warn("Cannot send taunt. Not connected or not in a game.");
            return;
        }
        socket.emit('send-message', {
            gameId,
            message: taunt,
            isTaunt: true
        });
         // Maybe play taunt sound locally immediately?
         window.playSound('taunt');
    }

    // Display received chat messages (called by socket event)
    function displayChatMessage(data) {
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        // Use names from the message data, fall back to placeholders
        const senderName = data.senderName || (data.isFromServer ? 'System' : 'Unknown');

        messageDiv.classList.add(data.isFromServer ? 'system-message' : (data.isMine ? 'my-message' : 'other-message'));
        if (data.isTaunt) {
            messageDiv.classList.add('taunt-message');
        }

        // Sender Name (optional for system messages)
        if (!data.isFromServer) {
            const nameSpan = document.createElement('div');
            nameSpan.className = 'sender-name';
            nameSpan.textContent = senderName;
            messageDiv.appendChild(nameSpan);
        }

        // Message Text
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = data.message; // Use textContent to prevent HTML injection
        messageDiv.appendChild(messageText);

        // Timestamp
        const timestampSpan = document.createElement('div');
        timestampSpan.className = 'message-timestamp';
        const time = data.timestamp ? new Date(data.timestamp) : new Date(); // Use server time or local time as fallback
        timestampSpan.textContent = `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`;
        messageDiv.appendChild(timestampSpan);

        // Append and scroll
        const shouldScroll = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 20; // Check if near bottom before appending
        chatMessages.appendChild(messageDiv);
        if (shouldScroll || data.isMine) { // Always scroll if it's my message or was already near bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }


    // --- Utility Functions ---
    function updateStatusIndicator(isConnected, statusText) {
        if (!statusIndicator) return;
        const statusClass = isConnected ? 'status-connected' : (statusText === 'Connecting...' ? 'status-connecting' : (statusText.includes('Error') || statusText.includes('Failed') ? 'status-error' : 'status-disconnected'));
        statusIndicator.innerHTML = `<span class="connection-status ${statusClass}"></span> ${statusText}`;
    }

    // --- Expose Functions to Global Scope (for script.js) ---
    window.multiplayer = {
        connectToServer,
        disconnectFromServer,
        createChallenge,
        joinChallenge,
        sendMove,
        requestRestartGame,
        notifyLeaveGame,
        sendChatMessage, // Expose if script.js needs to send system messages
        sendTaunt
    };

    // --- Auto-Initialize ---
    // Delay initialization slightly to ensure DOM is fully ready and config is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOMContentLoaded has already fired
        setTimeout(init, 0); // Use setTimeout to ensure it runs after current execution context
    }

})();