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
    
    // Socket connection
    let socket = null;
    let gameId = null;
    let playerNumber = 1;
    let connected = false;
    let unreadMessages = 0;

    // Game state
    let isOnlineGame = false;
    
    // Initialize multiplayer
    function init() {
        // Check if socket.io is available
        if (!window.io) {
            console.error('Socket.io not loaded!');
            return;
        }
        
        setupEventListeners();
        setupTaunts();
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
        
        // Emit create game event
        socket.emit('create-game');
        
        // Update UI
        messageElement.textContent = 'Creating game...';
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
        
        // Emit join game event
        socket.emit('join-game', { gameId: enteredCode });
        
        // Update UI
        messageElement.textContent = `Connecting to game ${enteredCode}...`;
    }
    
    // Connect to the multiplayer server
    function connectToServer() {
        try {
            // Update status to connecting
            statusIndicator.innerHTML = '<span class="connection-status status-connecting"></span> Connecting...';
            
            // Initialize Socket.io connection with explicit CORS settings
            socket = io(CONFIG.SERVER_URL, {
                withCredentials: true,
                extraHeaders: {
                    "Access-Control-Allow-Origin": "https://jwilliamcase.github.io"
                }
            });
            
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
            socket.on('player-disconnected', handlePlayerDisconnected);
            
            // Chat events
            socket.on('receive-message', handleReceiveMessage);
        } catch (error) {
            console.error('Error connecting to server:', error);
            statusIndicator.innerHTML = '<span class="connection-status status-disconnected"></span> Connection Failed';
        }
    }
    
    // Handle successful connection
    function handleConnect() {
        console.log('Connected to server!');
        connected = true;
        statusIndicator.innerHTML = '<span class="connection-status status-connected"></span> Connected';
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
        statusIndicator.innerHTML = '<span class="connection-status status-disconnected"></span> Connection Failed';
        
        messageElement.textContent = 'Failed to connect to the game server!';
    }
    
    // Handle game created event
    function handleGameCreated(data) {
        console.log('Game created:', data);
        gameId = data.gameId;
        playerNumber = data.playerNumber;
        isOnlineGame = true;
        
        // Update UI
        messageElement.textContent = `Game created! Your code is: ${gameId}. Waiting for opponent...`;
        challengeCodeInput.value = gameId;
        
        // Initialize game for player 1
        window.initializeOnlineGame(playerNumber, gameId);
    }
    
    // Handle game joined event
    function handleGameJoined(data) {
        console.log('Game joined:', data);
        gameId = data.gameId;
        playerNumber = data.playerNumber;
        isOnlineGame = true;
        
        // Update UI
        messageElement.textContent = `Joined game ${gameId} as Player ${playerNumber}!`;
        
        // Initialize game for player 2
        window.initializeOnlineGame(playerNumber, gameId);
    }
    
    // Handle game error
    function handleGameError(data) {
        console.error('Game error:', data);
        messageElement.textContent = `Error: ${data.message}`;
    }
    
    // Handle player joined event
    function handlePlayerJoined(data) {
        console.log('Player joined:', data);
        
        if (playerNumber === 1) {
            messageElement.textContent = `Player 2 has joined the game!`;
            
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
        
        // Update the game with the initial state
        if (playerNumber === 2) {
            window.syncGameState(data.gameState);
        }
        
        messageElement.textContent = `Game started! ${data.gameState.currentPlayer === playerNumber ? 'Your' : 'Opponent\'s'} turn.`;
    }
    
    // Handle game update event
    function handleGameUpdate(data) {
        console.log('Game update:', data);
        
        // Sync game state
        window.syncGameState(data.gameState);
        
        // Update message based on move type
        switch (data.type) {
            case 'color-selection':
                messageElement.textContent = `${data.gameState.currentPlayer === playerNumber ? 'Your' : 'Opponent\'s'} turn.`;
                break;
            case 'power-up':
                messageElement.textContent = `${data.gameState.currentPlayer === playerNumber ? 'Opponent' : 'You'} used a power-up!`;
                break;
            case 'landmine':
                messageElement.textContent = `💥 BOOM! A landmine was triggered!`;
                break;
        }
    }
    
    // Handle player disconnected event
    function handlePlayerDisconnected(data) {
        console.log('Player disconnected:', data);
        messageElement.textContent = `Player ${data.playerNumber} has disconnected!`;
    }
    
    // Handle receiving a chat message
    function handleReceiveMessage(data) {
        console.log('Message received:', data);
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        // Add additional classes based on sender and type
        if (data.isTaunt) {
            messageDiv.classList.add('taunt-message');
        } else if (data.playerNumber === playerNumber) {
            messageDiv.classList.add('my-message');
        } else {
            messageDiv.classList.add('other-message');
        }
        
        // Add message text
        messageDiv.textContent = data.message;
        
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
    }
    
    // Send a move to the server
    window.sendMove = function(moveData) {
        if (!socket || !isOnlineGame) return;
        
        socket.emit('make-move', {
            gameId,
            playerNumber,
            move: moveData
        });
    };
    
    // Initialize
    init();
})();