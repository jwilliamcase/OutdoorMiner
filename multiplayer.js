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
        
        // Get player name
        const playerNameInput = document.getElementById('player-name');
        const playerName = playerNameInput.value.trim() || 'Player 1';
        
        // Emit create game event with player name
        socket.emit('create-game', { playerName: playerName });
        
        // Update UI
        messageElement.textContent = 'Creating game...';
        
        // Disable all game buttons while waiting
        createChallengeButton.disabled = true;
        connectChallengeButton.disabled = true;
    }
    
    // Join an existing challenge
    function joinChallenge() {
        const enteredCode = challengeCodeInput.value.trim();
        if (!enteredCode) {
            messageElement.textContent = 'Please enter a challenge code.';
            return;
        }
        
        // Connect to server if not already connected
        if (!connected) {
            connectToServer();
        }
        
        // Get player name
        const playerNameInput = document.getElementById('player-name');
        const playerName = playerNameInput.value.trim() || 'Player 2';
        
        // Emit join game event
        socket.emit('join-game', { 
            gameId: enteredCode,
            playerName: playerName 
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
            socket.on('game-started', handleGameStarted);
            socket.on('game-update', handleGameUpdate);
            socket.on('game-restarted', handleGameRestarted);
            socket.on('player-disconnected', handlePlayerDisconnected);
            
            // Chat events
            socket.on('receive-message', handleReceiveMessage);
        } catch (error) {
            console.error('Error connecting to server:', error);
            statusIndicator.innerHTML = '<span class="connection-status status-disconnected"></span> Connection Failed';
        }
    }
    
    // Setup heartbeat mechanism
    function setupHeartbeat() {
        if (!gameState.socket) return;
        
        // Send heartbeat every 30 seconds
        setInterval(() => {
            if (gameState.connected) {
                gameState.socket.emit('heartbeat', {
                    gameId: gameState.gameId,
                    playerNumber: gameState.playerNumber,
                    timestamp: Date.now()
                });
            }
        }, 30000);
    }

    // Setup state synchronization
    function setupStateSync() {
        if (syncTimer) clearInterval(syncTimer);
        
        syncTimer = setInterval(() => {
            if (gameState.gameStarted && gameState.connected) {
                requestStateSync();
            }
        }, syncInterval);
    }

    // Request state sync from server
    function requestStateSync() {
        if (!gameState.socket || !gameState.gameId) return;
        
        gameState.socket.emit('request-sync', {
            gameId: gameState.gameId,
            playerNumber: gameState.playerNumber,
            lastMove: gameState.lastMove
        });
    }

    // Handle successful connection
    function handleConnect() {
        console.log('Connected to server!');
        gameState.connected = true;
        statusIndicator.innerHTML = '<span class="connection-status status-connected"></span> Connected';
        
        // Request immediate sync if game is in progress
        if (gameState.gameStarted) {
            requestStateSync();
        }
    }
    
    // Handle disconnection
    function handleDisconnect() {
        console.log('Disconnected from server!');
        connected = false;
        statusIndicator.innerHTML = '<span class="connection-status status-disconnected"></span> Disconnected';
        
        if (isOnlineGame) {
            messageElement.textContent = 'Disconnected from the game server!';
        }
    }
    
    // Handle connection error
    function handleConnectionError(error) {
        console.error('Connection error:', error);
        connected = false;
        
        // First, check if the server is even reachable with a simple fetch
        fetch(`${CONFIG.SERVER_URL}/api/status`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Server reached but status endpoint failed');
            })
            .then(data => {
                console.log('Server status check success:', data);
                statusIndicator.innerHTML = '<span class="connection-status status-connecting"></span> Server reachable, Socket.io connection failed';
                messageElement.textContent = 'Server is online but Socket.io connection failed. Try refreshing the page.';
            })
            .catch(err => {
                console.error('Server status check failed:', err);
                statusIndicator.innerHTML = '<span class="connection-status status-disconnected"></span> Server Unreachable';
                messageElement.textContent = 'Failed to connect to the game server! The server may be offline or starting up.';
            });
    }
    
    // Handle game created event
    function handleGameCreated(data) {
        console.log('Game created:', data);
        gameId = data.gameId;
        playerNumber = data.playerNumber;
        playerName = data.playerName || document.getElementById('player-name').value.trim() || 'Player 1';
        isOnlineGame = true;
        
        // Update UI
        messageElement.textContent = `Game created! Your code is: ${gameId}. Waiting for opponent...`;
        challengeCodeInput.value = gameId;
        
        // Re-enable buttons
        createChallengeButton.disabled = false;
        connectChallengeButton.disabled = false;
        
        // Add game code to URL for easy sharing
        updateUrlWithGameCode(gameId);
        
        // Initialize game for player 1
        window.initializeOnlineGame(playerNumber, gameId, playerName);
    }
    
    // Update URL with game code for easy sharing
    function updateUrlWithGameCode(code) {
        const url = new URL(window.location.href);
        url.searchParams.set('game', code);
        window.history.replaceState({}, '', url);
    }
    
    // Handle game joined event
    function handleGameJoined(data) {
        console.log('Game joined:', data);
        gameId = data.gameId;
        playerNumber = data.playerNumber;
        playerName = document.getElementById('player-name').value.trim() || 'Player 2';
        isOnlineGame = true;
        
        // Update UI
        messageElement.textContent = `Joined game ${gameId} as Player ${playerNumber}! Waiting for game to start...`;
        
        // Re-enable buttons
        createChallengeButton.disabled = false;
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
    
    // Update player names in the UI
    function updatePlayerNames() {
        const player1ScoreElement = document.getElementById('player-score');
        const player2ScoreElement = document.getElementById('opponent-score');
        
        if (playerNumber === 1) {
            player1ScoreElement.innerHTML = `<span class="player-name ${window.currentPlayer === 1 ? 'active-player' : ''}">${playerName || 'You'}</span>: <span id="your-score">0</span>`;
            player2ScoreElement.innerHTML = `<span class="player-name ${window.currentPlayer === 2 ? 'active-player' : ''}">${opponentName || 'Opponent'}</span>: <span id="opponent-score-value">0</span>`;
        } else {
            player1ScoreElement.innerHTML = `<span class="player-name ${window.currentPlayer === 1 ? 'active-player' : ''}">${opponentName || 'Opponent'}</span>: <span id="your-score">0</span>`;
            player2ScoreElement.innerHTML = `<span class="player-name ${window.currentPlayer === 2 ? 'active-player' : ''}">${playerName || 'You'}</span>: <span id="opponent-score-value">0</span>`;
        }
    }
    
    // Handle game update event
    function handleGameUpdate(data) {
        console.log('Game update:', data);
        
        // Update player names if available
        if (data.gameState.player1Name && playerNumber === 1) {
            playerName = data.gameState.player1Name;
            window.playerName = playerName;
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
        
        // Check if the game is over and show play again button
        const player1Tiles = new Set(data.gameState.player1Tiles);
        const player2Tiles = new Set(data.gameState.player2Tiles);
        }
    });

   socket.on('game-started', (data) => {
    isOnlineGame = true;
    playerNumber = data.playerNumber; // 1 or 2
    gameId = data.gameId; // Set the game ID

    // Ensure player names are correctly set up *before* initializing the game.
    if(data.playerNames) {
        playerName = data.playerNames[playerNumber];
        opponentName = data.playerNames[3 - playerNumber];
        document.getElementById('player-name').textContent = playerName;
        document.getElementById('opponent-name').textContent = opponentName;
    }
<<<<<<< HEAD

    //Initialize online game
    initializeGame({ board: data.board, turn: data.turn, scores: data.scores, availablePowerUps: data.availablePowerUps, playerNames: data.playerNames }); //Initialize
    document.getElementById('waiting-message').style.display = 'none';//remove waiting message
});


    socket.on('update-board', (data) => {
        // Update the game board, scores, and turn indicator
        board = data.board;
        scores = data.scores;
        playerTurn = data.turn;
        availablePowerUps = data.availablePowerUps;
        // *Always* rotate for player 2 after updating the board.
        if (playerNumber === 2) {
            board = rotateBoard180(board);
=======
    
    // Handle game restarted event
    function handleGameRestarted(data) {
        console.log('Game restarted');
        
        // Reset the game state
        window.initializeOnlineGame(playerNumber, gameId);
        
        // Update UI
        messageElement.textContent = "Game restarted! " + 
            (currentPlayer === playerNumber ? "Your" : "Opponent's") + " turn.";
        
        // Remove play again button if it exists
        const playAgainButton = document.getElementById('play-again-button');
        if (playAgainButton) {
            playAgainButton.remove();
>>>>>>> parent of 7da93be (improve code com)
        }
        updateScoreDisplay();
        updateTurnIndicator();
        drawBoard(); // Redraw the board with the updated state

    });

    socket.on('game-over', (data) => {
        if (data.winner === playerNumber) {
            document.getElementById('game-result').textContent = 'You Win!';
        } else if (data.winner === 3) {
            document.getElementById('game-result').textContent = 'It\'s a tie!';
        }
<<<<<<< HEAD
        else {
            document.getElementById('game-result').textContent = 'You Lose!';
        }
        document.getElementById('game-over-screen').style.display = 'flex';
        document.getElementById('play-again-button').style.display = 'block';
    });
    socket.on('player-disconnected', (data) => {
        resetGame(); //Clear up game state
        document.getElementById('opponent-name').textContent = '';
        //Display the modal
        document.getElementById('disconnected-modal').style.display = 'block';
    });

    socket.on('game-restarted', () => {
        // Hide the modal.
        document.getElementById('restart-modal').style.display = 'none';
        //Remove play again button.
        document.getElementById('play-again-button').style.display = 'none';

    });
=======
    }
    
    // Handle player disconnected event
    function handlePlayerDisconnected(data) {
        console.log('Player disconnected:', data);
        messageElement.textContent = `Player ${data.playerNumber} has disconnected!`;
    }
    
>>>>>>> parent of 7da93be (improve code com)
    // Handle receiving a chat message
    function handleReceiveMessage(data) {
        console.log('Message received:', data);
        
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