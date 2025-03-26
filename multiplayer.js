// Outdoor Miner - Multiplayer Module
(function() {
    // UI Elements
    const startGameButton = document.getElementById('start-game');
    const createChallengeButton = document.getElementById('create-challenge');
    const challengeCodeInput = document.getElementById('challenge-code');
    const connectChallengeButton = document.getElementById('connect-challenge');
    const messageElement = document.getElementById('message');
    
    // Chat elements
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendMessageButton = document.getElementById('send-message');
    const showTauntsButton = document.getElementById('show-taunts');
    const tauntMenu = document.getElementById('taunt-menu');
    const tauntList = document.querySelector('.taunt-list');
    const closeChat = document.getElementById('close-chat');
    
    // Create toggle chat button and status indicator
    const gameArea = document.getElementById('game-area');
    
    const toggleChat = document.createElement('button');
    toggleChat.id = 'toggle-chat';
    toggleChat.innerHTML = '💬';
    document.body.appendChild(toggleChat);
    
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'multiplayer-status';
    statusIndicator.innerHTML = '<span class="connection-status status-disconnected"></span> Offline';
    document.body.appendChild(statusIndicator);
    
    // Socket and game state management
    const gameState = {
        socket: null,
        gameId: null,
        playerNumber: 1,
        playerName: '',
        opponentName: '',
        connected: false,
        unreadMessages: 0,
        isOnlineGame: false,
        currentTurn: 1,
        board: null,
        scores: { 1: 0, 2: 0 },
        powerUps: { 1: [], 2: [] },
        lastMove: null,
        gameStarted: false
    };

    // Game synchronization
    const syncInterval = 5000; // Sync every 5 seconds
    let syncTimer = null;
    
    // Initialize multiplayer
    function init() {
        // Check if socket.io is available
        if (!window.io) {
            console.error('Socket.io not loaded!');
            return;
        }
        
        setupEventListeners();
        setupTaunts();
        
        // Check URL for game code (for direct link joining)
        checkUrlForGameCode();
    }
    
    // Check if there's a game code in the URL params
    function checkUrlForGameCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameCodeFromUrl = urlParams.get('game');
        
        if (gameCodeFromUrl) {
            challengeCodeInput.value = gameCodeFromUrl;
            messageElement.textContent = `Found game code in URL: ${gameCodeFromUrl}. Click Connect to join.`;
            
            // Auto-connect if the code is present
            setTimeout(() => {
                joinChallenge();
            }, 1000);
        }
    }
    
    // Set up UI event listeners
    function setupEventListeners() {
        // Override the create challenge button
        createChallengeButton.addEventListener('click', createChallenge);
        
        // Override the connect challenge button
        connectChallengeButton.addEventListener('click', joinChallenge);
        
        // Chat system
        toggleChat.addEventListener('click', toggleChatVisibility);
        closeChat.addEventListener('click', () => {
            chatContainer.classList.add('hidden');
        });
        
        sendMessageButton.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
        
        showTauntsButton.addEventListener('click', toggleTauntMenu);
        
        // Add click outside handling for taunt menu
        document.addEventListener('click', (e) => {
            if (!tauntMenu.contains(e.target) && e.target !== showTauntsButton) {
                tauntMenu.classList.add('hidden');
            }
        });
    }
    
    // Set up taunt options
    function setupTaunts() {
        if (!CONFIG.TAUNTS || !CONFIG.TAUNTS.length) return;
        
        // Clear existing taunts
        tauntList.innerHTML = '';
        
        // Add each taunt as an option
        CONFIG.TAUNTS.forEach(taunt => {
            const tauntOption = document.createElement('div');
            tauntOption.className = 'taunt-option';
            tauntOption.textContent = taunt;
            tauntOption.addEventListener('click', () => {
                sendTaunt(taunt);
                tauntMenu.classList.add('hidden');
            });
            tauntList.appendChild(tauntOption);
        });
    }
    
    // Toggle chat visibility
    function toggleChatVisibility() {
        chatContainer.classList.toggle('hidden');
        
        // Reset unread count
        if (!chatContainer.classList.contains('hidden')) {
            unreadMessages = 0;
            toggleChat.innerHTML = '💬';
        }
    }
    
    // Toggle taunt menu
    function toggleTauntMenu() {
        tauntMenu.classList.toggle('hidden');
    }
    
    // Send a chat message
    function sendChatMessage() {
        if (!socket || !isOnlineGame || !chatInput.value.trim()) return;
        
        const message = chatInput.value.trim();
        
        // Emit message to server
        socket.emit('send-message', {
            gameId,
            playerNumber,
            playerName: playerName,
            message,
            isTaunt: false
        });
        
        // Clear input
        chatInput.value = '';
        
        // Focus back on input
        chatInput.focus();
    }
    
    // Send a taunt message
    function sendTaunt(taunt) {
        if (!socket || !isOnlineGame) return;
        
        // Emit taunt to server
        socket.emit('send-message', {
            gameId,
            playerNumber,
            playerName: playerName,
            message: taunt,
            isTaunt: true
        });
        
        // Play taunt sound
        playSound('taunt-sound');
    }
    
    // Play sound effect
    function playSound(elementId) {
        const sound = document.getElementById(elementId);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(err => console.log('Error playing sound:', err));
        }
    }
    
    // Create a multiplayer challenge
    function createChallenge() {
        // Connect to server if not already connected
        if (!connected) {
            connectToServer();
        }
        
        // Function to create a new challenge
    function createChallenge(pName) {
        if (!connected || !socket) {
            console.error("Not connected to server. Cannot create challenge.");
            updateMessage("Error: Not connected to server.");
            // Potentially re-enable setup buttons or show error message persistently
            return;
        }
        // Player name should already be set globally in script.js before calling connectToServer/createChallenge
        console.log(`Attempting to create challenge for player: ${playerName}`);
        if (!playerName) {
            console.error("Player name is not set before creating challenge.");
            updateMessage("Error: Player name not set.");
            return; // Should not happen if setup flow is correct
        }
        socket.emit('create-challenge', { playerName: playerName });
        updateMessage("Challenge created. Waiting for opponent...");
        console.log("create-challenge event emitted with playerName:", playerName);
        // Buttons are part of the setup screen, which is now hidden. No need to disable here.
    }
    
    // Function to join an existing challenge
    function joinChallenge(gId, pName) {
         if (!connected || !socket) {
            console.error("Not connected to server. Cannot join challenge.");
            updateMessage("Error: Not connected to server.");
            // Potentially re-enable setup buttons or show error message persistently
            return;
        }
        // Player name should already be set globally. Game ID comes from prompt.
        gameId = gId; // Store game ID
        console.log(`Attempting to join challenge ${gameId} as player: ${playerName}`);
        if (!playerName || !gameId) {
            console.error("Player name or Game ID is missing for joining challenge.");
            updateMessage("Error: Player name or Game ID missing.");
            return; // Should not happen if setup flow is correct
        }
        socket.emit('join-challenge', { gameId: gameId, playerName: playerName });
        updateMessage(`Joining game ${gameId}...`);
        // Buttons are part of the setup screen, which is now hidden. No need to disable here.
    }
    
    // Define hideGameUI helper (or move this logic if defined elsewhere)
    function hideGameUI() {
        const UIElementsToHide = [
            'score-container', 'game-area', 'color-palette',
            'game-controls', 'message', 'landmine-info',
            'chat-container', 'toggle-chat'
        ];
        UIElementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
         // Also reset relevant game state variables if needed
         gameActive = false;
         // Reset player index?
         // playerIndex = -1;
    }
    
    
    // --- Socket Event Handlers ---
    function setupSocketListeners(socket) {
    
        // Listen for game setup confirmation
        socket.on('game-setup', (data) => {
        });
        
        // Update UI
        messageElement.textContent = `Connecting to game ${enteredCode}...`;
        
        // Disable all game buttons while waiting
        createChallengeButton.disabled = true;
        connectChallengeButton.disabled = true;
    }
    
    // Connect to the multiplayer server
    function connectToServer() {
        try {
            // Update status to connecting
            statusIndicator.innerHTML = '<span class="connection-status status-connecting"></span> Connecting...';
            
            // Initialize Socket.io connection with improved settings
            gameState.socket = io(CONFIG.SERVER_URL, {
                withCredentials: false,
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000
            });

            // Setup heartbeat
            setupHeartbeat();
            
            // Setup state synchronization
            setupStateSync();
            
            // Connection event handlers
            socket.on('connect', handleConnect);
            socket.on('disconnect', handleDisconnect);
            socket.on('connect_error', handleConnectionError);
            
            // Game events
            socket.on('game-created', handleGameCreated);
            socket.on('game-joined', handleGameJoined);
            socket.on('game-error', handleGameError);
            socket.on('player-joined', handlePlayerJoined);
            document.getElementById('joinChallengeButton').disabled = true; // These buttons might not exist or be relevant anymore
    }
    
    
    // --- Socket Event Handlers ---
    // Encapsulate listeners setup to be called after connection is established
    function setupSocketListeners(socket) {
    
        // Remove existing listeners to prevent duplicates if re-connecting
        socket.off('game-setup');
        socket.off('game-state');
        socket.off('chat-message');
        socket.off('game-over');
        socket.off('player-disconnected');
        socket.off('game-restarted');
        socket.off('error-message');
    
        // Listen for game setup confirmation
        socket.on('game-setup', (data) => {
            console.log("Game setup received:", data);
            gameId = data.gameId;
            // Player name is already set on the client during setup
            // Server confirms names and assigns index based on join order/creation
            playerNames = data.playerNames;
            playerIndex = playerNames.findIndex(name => name === playerName); // Find our index
            opponentPlayerIndex = 1 - playerIndex; // Determine opponent index
    
            playerColors = data.playerColors; // Get colors from server
            isOnlineGame = true;
            console.log(`Assigned player index: ${playerIndex} (${playerNames[playerIndex]})`);
            updateMessage(`Game ${gameId} ready. You are ${playerNames[playerIndex]}. Waiting for first state...`);
    
            // Server should send initial game state either with setup or immediately after
            if (data.gameState) {
                initializeOnlineGame(data.gameState); // Initialize based on server state
            } else {
                console.log("Waiting for initial game state sync...");
                // UI is shown in initializeOnlineGame or syncGameState
            }
    
            // Enable chat if not already visible
            const chatContainer = document.getElementById('chat-container');
            const toggleChatButton = document.getElementById('toggle-chat');
            if (chatContainer) chatContainer.style.display = 'flex'; // Show chat interface
            if (toggleChatButton) toggleChatButton.style.display = 'block'; // Show toggle button
        });
    
        // Listen for game state updates
        socket.on('game-state', (gameState) => {
            console.log("Received game state update");
            syncGameState(gameState); // This function now also handles showing the UI if needed
        });
    
        // Listen for chat messages
        socket.on('chat-message', (data) => {
            displayChatMessage(data.sender, data.message);
        });
    
    
        // Listen for game over
        socket.on('game-over', (data) => {
            console.log('Game Over:', data);
            gameActive = false;
            if(data.gameState) { // Ensure final state is provided
               syncGameState(data.gameState); // Sync final state
            }
            updateMessage(data.message || "Game Over!");
            enablePlayerControls(false); // Disable controls
            displayGameResults(); // Show results overlay or message
        });
    
        // Listen for player disconnection
        socket.on('player-disconnected', (data) => {
            console.log('Opponent disconnected:', data);
            gameActive = false; // Stop the game
            updateMessage(data.message || 'Opponent disconnected. Game over.');
            enablePlayerControls(false); // Disable controls
            // Maybe offer to start a new game or return to setup
            const restartBtn = document.getElementById('restartGameButton');
            if (restartBtn) {
                 restartBtn.textContent = "Find New Game"; // Change button text/functionality
                 // Or disable it if returning to main menu
                 restartBtn.disabled = true;
            }
             const leaveBtn = document.getElementById('leaveGameButton');
             if(leaveBtn) leaveBtn.textContent = "Back to Menu"; // Change leave button text
    
    
        });
    
        // Listen for game restart confirmation or initiation
        socket.on('game-restarted', (data) => {
            console.log('Game is restarting with new state:', data);
            // Re-initialize the game with the new state provided by the server
            initializeOnlineGame(data.gameState); // This handles UI setup and state sync
            updateMessage('Game restarted! New round begins.');
            // Ensure buttons are correctly enabled/named
             const restartBtn = document.getElementById('restartGameButton');
             if (restartBtn) {
                 restartBtn.textContent = "Restart Game";
                 restartBtn.disabled = false; // Re-enable if previously disabled
             }
              const leaveBtn = document.getElementById('leaveGameButton');
             if(leaveBtn) leaveBtn.textContent = "Leave Game";
    
        });
    
    
        // Listen for errors from the server
        socket.on('error-message', (data) => {
            console.error('Server Error:', data.message);
            updateMessage(`Error: ${data.message}`);
    
            // Go back to setup screen for critical errors like game not found/full
            if (data.errorType === 'GAME_FULL' || data.errorType === 'GAME_NOT_FOUND') {
                 // Hide game elements, show setup screen
                 hideGameUI();
                 const setupContainer = document.getElementById('setup-container');
                 if(setupContainer) setupContainer.style.display = 'block';
    
                 const setupMessage = document.getElementById('setup-message');
                 if(setupMessage) {
                     setupMessage.textContent = data.message;
                     setupMessage.style.color = 'red';
                 }
    
                 // Disconnect if the error means we can't proceed
                 disconnectFromServer();
            }
        });
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    connected = true; // Update connection status
    resolve(socket); // Resolve the promise when connected
    // Maybe update UI to show connected status
    updateMessage("Connected to server. Ready to create or join a game."); // Inform user
});
    function sendChatMessage(message) {
        if (socket && connected && gameId) {
            socket.emit('chat-message', { gameId, message });
        } else {
            console.log("Cannot send chat message. Not connected or not in a game.");
        }
    }
    
    // Request restart game (client asks server)
    function requestRestartGame() {
        if (socket && connected && gameId) {
            console.log("Requesting game restart...");
            socket.emit('request-restart', { gameId });
            updateMessage("Restart requested. Waiting for opponent...");
            // Disable restart button temporarily
            const restartBtn = document.getElementById('restartGameButton');
            if(restartBtn) restartBtn.disabled = true;
        } else {
            console.log("Cannot request restart. Not connected or not in a game.");
             // If not online, maybe just call local restart? Check isOnlineGame flag.
             if (!isOnlineGame) {
                 console.log("Performing local restart.");
                 initializeGame(playerNames[0], playerNames[1]); // Restart local game
             }
        }
    }
    
    // Notify server of leaving the game
    function notifyLeaveGame() {
        console.log('Connected to server with ID:', socket.id);
        connected = true; // Update connection status
        setupSocketListeners(socket); // Setup event listeners now
        resolve(socket); // Resolve the promise when connected
        // Maybe update UI to show connected status
        // Message is now updated within button handlers based on next action
        // updateMessage("Connected to server. Ready to create or join a game.");
    });

    socket.on('connect_error', (error) => {
        const setupContainer = document.getElementById('setup-container');
        if(setupContainer) setupContainer.style.display = 'block';
        // Reset relevant state
        gameId = null;
        isOnlineGame = false;
        playerIndex = -1;
        opponentPlayerIndex = -1;
        // Clear messages
        updateMessage("Choose an option to play.");
        const setupMessage = document.getElementById('setup-message');
        if(setupMessage) setupMessage.textContent = ''; // Clear previous errors
        // Reset button states in setup if needed (e.g., if they were disabled)
    
    }
    
    // Disconnect function
    function disconnectFromServer() {
        if (socket) {
            // Remove listeners before disconnecting to avoid issues on manual disconnect
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
            // Call the function to remove game-specific listeners
            setupSocketListeners(socket); // Call with socket to remove listeners added by it
    
            socket.disconnect();
            console.log("Disconnected manually.");
            // 'disconnect' event handler should set connected = false
        }
         connected = false; // Ensure flag is false even if event doesn't fire immediately
         gameId = null; // Clear gameId on disconnect
         isOnlineGame = false; // Assume not in online game anymore
    }
        connectChallengeButton.disabled = false;
        
        // Update URL with game code
        updateUrlWithGameCode(gameId);
        
        // Initialize game for player 2
        window.initializeOnlineGame(playerNumber, gameId, playerName);
    }
    
    // Handle game error
    function handleGameError(data) {
        console.error('Game error:', data);
        messageElement.textContent = `Error: ${data.message}`;
        
        // Re-enable buttons
        createChallengeButton.disabled = false;
        connectChallengeButton.disabled = false;
    }
    
    // Handle player joined event
    function handlePlayerJoined(data) {
        console.log('Player joined:', data);
        
        // Save opponent name if provided
        if (data.playerName) {
            opponentName = data.playerName;
        }
        
        if (playerNumber === 1) {
            messageElement.textContent = `${opponentName || 'Player 2'} has joined the game!`;
            
            // As player 1, initialize the game
            socket.emit('initialize-game', {
                gameId: gameId,
                gameData: window.getGameState()
            });
        }
    }
    
    // Handle game started event
    function handleGameStarted(data) {
        console.log('Game started:', data);
        
        // Save player names
        if (data.gameState.player1Name && playerNumber === 1) {
            playerName = data.gameState.player1Name;
            window.playerName = playerName;
        }
        
        if (data.gameState.player2Name && playerNumber === 2) {
            playerName = data.gameState.player2Name;
            window.playerName = playerName;
        }
        
        // Save opponent name
        if (data.gameState.player1Name && playerNumber === 2) {
            opponentName = data.gameState.player1Name;
            window.opponentName = opponentName;
        }
        
        if (data.gameState.player2Name && playerNumber === 1) {
            opponentName = data.gameState.player2Name;
            window.opponentName = opponentName;
        }
        
        // Both players should get the complete game state
        window.syncGameState(data.gameState);
        
        // Force update display
        if (window.updateScoreDisplay) {
            window.updateScoreDisplay();
        }
        
        // Set board orientation based on player number
        window.resizeGame();
        
        messageElement.textContent = `Game started! ${data.gameState.currentPlayer === playerNumber ? 'Your' : 'Opponent\'s'} turn.`;
    }
    
    console.log(`Updating power-up counts for player ${playerId}`, counts); // Debug log

try {
    const playerIndex = playerId === socket.id ? 0 : 1;
    if (playerStates[playerIndex]) {
         // Ensure the powerUpCounts object exists
        if (!playerStates[playerIndex].powerUpCounts) {
            playerStates[playerIndex].powerUpCounts = { landmine: 0, shield: 0, steal: 0 };
        }
         // Update counts safely
        playerStates[playerIndex].powerUpCounts.landmine = counts.landmine !== undefined ? counts.landmine : playerStates[playerIndex].powerUpCounts.landmine;
        playerStates[playerIndex].powerUpCounts.shield = counts.shield !== undefined ? counts.shield : playerStates[playerIndex].powerUpCounts.shield;
        playerStates[playerIndex].powerUpCounts.steal = counts.steal !== undefined ? counts.steal : playerStates[playerIndex].powerUpCounts.steal;

        // Update the UI if this is the local player
        if (playerId === socket.id) {
            updatePowerUpDisplay(playerStates[playerIndex].powerUpCounts);
        }
    } else {
        console.error(`Player state not found for index ${playerIndex} (playerId: ${playerId})`);
    }
} catch (error) {
    console.error("Error updating power-up counts:", error);
}
}
        
        if (data.gameState.player2Name && playerNumber === 2) {
            playerName = data.gameState.player2Name;
            window.playerName = playerName;
        }
        
        // Update opponent names
        if (data.gameState.player1Name && playerNumber === 2) {
            opponentName = data.gameState.player1Name;
            window.opponentName = opponentName;
        }
        
        if (data.gameState.player2Name && playerNumber === 1) {
            opponentName = data.gameState.player2Name;
            window.opponentName = opponentName;
        }
        
        // Sync game state
        window.syncGameState(data.gameState);
        
        // Update player names in UI
        updatePlayerNames();
        
        // Update message based on move type
        switch (data.type) {
            case 'color-selection':
                messageElement.textContent = `${data.gameState.currentPlayer === playerNumber ? 'Your' : `${opponentName || 'Opponent'}'s`} turn.`;
                break;
            case 'power-up':
                messageElement.textContent = `${data.gameState.currentPlayer === playerNumber ? opponentName || 'Opponent' : 'You'} used a power-up!`;
                break;
            case 'landmine':
                messageElement.textContent = `💥 BOOM! A landmine was triggered!`;
                break;
        }
        
        // Check if the game is over - Logic might need refinement based on your game rules
        const totalTiles = gameState.board.length * gameState.board[0].length; // Assuming rectangular board
        if ((player1Tiles.size + player2Tiles.size) >= totalTiles) {
             // Determine winner
             let winnerMessage = "";
             if (player1Tiles.size > player2Tiles.size) winnerMessage = `${data.gameState.player1Name || 'Player 1'} wins!`;
             else if (player2Tiles.size > player1Tiles.size) winnerMessage = `${data.gameState.player2Name || 'Player 2'} wins!`;
             else winnerMessage = "It's a tie!";

             messageElement.textContent = `Game Over! ${winnerMessage}`;
             showPlayAgainButton(); // You need to define this function
        }

    } // End of handleGameUpdate function


    // Handle game restarted event
    function handleGameRestarted(data) {
        console.log('Game restarted command received from server');

        // Reset the local game state via initializeGame, waiting for server's definitive state
        initializeGame(null); // Pass null to reset locally

        // Update UI
        messageElement.textContent = "Game is restarting! Waiting for server...";
        disableControls(); // Disable controls until synced

        // Remove play again button if it exists
        const playAgainButton = document.getElementById('play-again-button');
        if (playAgainButton) {
            playAgainButton.remove();
        }
    }

    // Handle player disconnected event
    function handlePlayerDisconnected(data) {
        console.log('Player disconnected:', data);
         if (isOnlineGame) {
            messageElement.textContent = `${opponentName || `Player ${data.playerNumber}`} has disconnected! Game ended.`;
            opponentName = ''; // Clear opponent name
             window.opponentName = '';
            });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            connected = false; // Reset connection status
            updateMessage('Disconnected from server. Please refresh to reconnect.');
            gameActive = false; // Stop game activity
            enablePlayerControls(false); // Disable controls
             // Hide game elements and potentially show setup screen again or a message
             hideGameUI(); // You might need to define this function or implement the logic here
             // Show setup container again
             const setupContainer = document.getElementById('setup-container');
             if (setupContainer) setupContainer.style.display = 'block';

        });

        // Handle errors during connection or gameplay
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        // Get sender name - use the name that was sent with the message if available
        const senderName = data.playerNumber === playerNumber ? 
            playerName : (data.playerName || opponentName || `Player ${data.playerNumber}`);
        
        // Add additional classes based on sender and type
        if (data.isTaunt) {
            messageDiv.classList.add('taunt-message');
        } else if (data.playerNumber === playerNumber) {
            messageDiv.classList.add('my-message');
        } else {
            messageDiv.classList.add('other-message');
        }
        
        // Add sender name
        const nameSpan = document.createElement('div');
        nameSpan.className = 'sender-name';
        nameSpan.textContent = senderName;
        messageDiv.appendChild(nameSpan);
        
        // Add message text
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = data.message;
        messageDiv.appendChild(messageText);
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        const time = new Date(data.timestamp);
        timestamp.textContent = `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`;
        messageDiv.appendChild(timestamp);
        
        // Add to chat container
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Update unread count if chat is hidden
        if (chatContainer.classList.contains('hidden')) {
            unreadMessages++;
            toggleChat.innerHTML = `💬<span class="notification">${unreadMessages}</span>`;
            
            // Play message sound
            playSound(data.isTaunt ? 'taunt-sound' : 'message-sound');
        }
        
        // Make chat visible if it's a message from the opponent
        if (data.playerNumber !== playerNumber && chatContainer.classList.contains('hidden')) {
            toggleChatVisibility();
        }
    }
    
    // Send a move to the server
    window.sendMove = function(moveData) {
        if (!socket || !isOnlineGame) return;
        
        // Make sure we include the player's name
        moveData.playerName = playerName;
        
        socket.emit('make-move', {
            gameId,
            playerNumber,
            playerName: playerName,
            move: moveData
        });
    };
    
    // Initialize
    init();
    
    // Try to connect on startup after a short delay
    setTimeout(() => {
        if (!connected) {
            console.log("Attempting automatic connection to server...");
            connectToServer();
        }
    }, 1000);
})();