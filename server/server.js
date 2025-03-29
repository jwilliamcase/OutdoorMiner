const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // Ensure .env is loaded early
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Correct way to import Server class
const cors = require('cors');

const app = express();

const isDevelopment = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 3000;

// --- CORS Configuration ---
// Create a function to get allowed origins that can be updated
const getDefaultOrigins = () => [
    'https://jwilliamcase.github.io',
    'https://jwilliamcase.github.io/OutdoorMiner',
    'http://localhost:3000',     // Add local development
    'http://127.0.0.1:3000'     // Add local development IP
];

let allowedOrigins = getDefaultOrigins();

// Update CORS middleware to use dynamic origins
const corsMiddleware = cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl)
        if (!origin || isDevelopment) {
            callback(null, true);
        } else if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.warn(`Origin attempted: ${origin}`);
            console.warn(`Currently allowed origins:`, allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
});

app.use(corsMiddleware);

// --- Static File Serving ---
// Serve static files (index.html, CSS, client-side JS modules) from the parent directory
const staticPath = path.resolve(__dirname, '..');
console.log(`Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));

// --- Root Path Handling ---
// Explicitly serve index.html for the root path to handle client-side routing/refresh
// IMPORTANT: This needs to be defined *after* express.static
app.get('/', (req, res) => {
    res.sendFile(path.resolve(staticPath, 'index.html'));
});

// --- Server Initialization ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: isDevelopment ? true : allowedOrigins, // Allow all origins in development
        methods: ['GET', 'POST'],
        credentials: true
    },
    // Add transport configuration
    transports: ['websocket'],
    pingTimeout: 30000,
    pingInterval: 25000
});

// --- Server State Management ---
const challenges = {}; // Stores active challenge codes: { challengeCode: { hostSocketId: '...', hostPlayerName: '...' } }
const activeGames = {}; // Stores active game states: { gameId: ServerGameState }
const playerSockets = {}; // Maps socket IDs to player info: { socketId: { gameId: '...', playerName: '...', playerSymbol: 'P1' | 'P2' } }

// --- GameState Class (Server-Side Representation) ---
// Manages game rules, state, and player turns on the server.
class ServerGameState {
    constructor(gameId, player1Name, player2Name, player1SocketId, player2SocketId) {
        this.gameId = gameId;
        this.players = {
            P1: { name: player1Name, socketId: player1SocketId, score: 0 },
            P2: { name: player2Name, socketId: player2SocketId, score: 0 }
        };
        this.boardSize = 16; // Move this up before board initialization
        
        // Initialize with same random seed for both players
        this.gameSeed = Date.now();
        this.boardState = this.initializeBoard(this.gameSeed);
        
        // Random first player
        this.currentPlayer = Math.random() < 0.5 ? 'P1' : 'P2';
        console.log(`Game ${gameId} starting with ${this.currentPlayer} as first player`);
        
        this.isOver = false;
        this.winner = null;
        this.turnNumber = 0;
    }

    initializeBoard(seed) {
        const board = {};
        const colors = ['#F76C6C', '#374785', '#F8E9A1', '#50C878', '#9B59B6'];
        const seededRandom = this.createSeededRandom(seed);
        
        // Create board with consistent random colors
        for (let q = 0; q < this.boardSize; q++) {
            for (let r = 0; r < this.boardSize; r++) {
                const colorIndex = Math.floor(seededRandom() * colors.length);
                board[`${q},${r}`] = {
                    q, r,
                    color: colors[colorIndex],
                    owner: null
                };
            }
        }

        // Set initial positions consistently for both players
        board['0,15'].owner = 'P1';  // Bottom left
        board['15,0'].owner = 'P2';  // Top right
        
        // Set initial colors
        const p1Color = board['0,15'].color;
        const p2Color = board['15,0'].color;
        this.lastUsedColor = p2Color; // P1 starts, can't use P2's color

        return board;
    }

    createSeededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    // Calculate total number of tiles based on board size (radius)
    calculateTotalTiles(size) {
        let count = 1; // Center tile
        for (let i = 1; i < size; i++) {
            count += 6 * i;
        }
        return count;
    }

    // --- Core Game Logic Methods ---

    // Validate and place a tile, update state
    placeTile(q, r, playerSymbol) {
        const key = `${q},${r}`;

        // --- Validation ---
        if (this.isOver) {
            return { success: false, reason: 'Game is already over.' };
        }
        if (playerSymbol !== this.currentPlayer) {
            return { success: false, reason: 'It is not your turn.' };
        }
        if (this.boardState[key]) {
            return { success: false, reason: 'This tile is already occupied.' };
        }
        // Optional: Add bounds checking based on boardSize if needed

        // --- Update State ---
        this.boardState[key] = playerSymbol;
        this.turnNumber++;

        // --- Scoring ---
        // Server only calculates simple score (tile count). Capture logic visualization is client-side.
        this.updateScores();

        // --- Check Game End Condition ---
        if (Object.keys(this.boardState).length >= this.totalTiles) {
            this.endGame(); // Board is full
        } else {
            // Switch turn to the other player
            this.currentPlayer = this.currentPlayer === 'P1' ? 'P2' : 'P1';
        }

        // Return success and the new state
        return {
            success: true,
            newState: this.getSerializableState()
        };
    }

    // Update player scores based on current tile ownership
    updateScores() {
        // Reset scores before counting
        this.players.P1.score = 0;
        this.players.P2.score = 0;
        
        // Count all owned tiles in board state
        Object.values(this.boardState).forEach(tile => {
            if (tile.owner === 'P1') {
                this.players.P1.score++;
            } else if (tile.owner === 'P2') {
                this.players.P2.score++;
            }
        });

        // Log score update
        console.log('Scores updated:', {
            P1: this.players.P1.score,
            P2: this.players.P2.score
        });

        return {
            P1: this.players.P1.score,
            P2: this.players.P2.score
        };
    }

    // Mark the game as ended and determine the winner
    endGame() {
        this.isOver = true;
        this.updateScores(); // Ensure scores are final before declaring winner
        if (this.players.P1.score > this.players.P2.score) {
            this.winner = 'P1';
        } else if (this.players.P2.score > this.players.P1.score) {
            this.winner = 'P2';
        } else {
            this.winner = 'Draw'; // Scores are equal
        }
        console.log(`Game ${this.gameId} ended. Final Score P1: ${this.players.P1.score}, P2: ${this.players.P2.score}. Winner: ${this.winner}`);
    }

    // Handle a player forfeiting the game
    forfeit(playerSymbol) {
        if (!this.isOver) {
            this.isOver = true;
            // The player who did *not* forfeit wins
            this.winner = playerSymbol === 'P1' ? 'P2' : 'P1';
            console.log(`Game ${this.gameId} forfeited by ${playerSymbol}. Winner declared: ${this.winner}`);
            // Scores might not be relevant on forfeit, but could be updated if desired
            // this.updateScores();
        }
    }

    // Prepare a state object suitable for sending to clients via Socket.IO
    getSerializableState() {
        // Add explicit player mapping to ensure consistent player identification
        const gameState = {
            gameId: this.gameId,
            players: {
                P1: {
                    ...this.players.P1,
                    symbol: 'P1'
                },
                P2: {
                    ...this.players.P2,
                    symbol: 'P2'
                }
            },
            boardState: this.boardState,
            currentPlayer: this.currentPlayer,
            isOver: this.isOver,
            winner: this.winner,
            boardSize: this.boardSize,
            rows: this.boardSize,
            cols: this.boardSize,
            turnNumber: this.turnNumber,
            lastUsedColor: this.lastUsedColor,
            initialP1Position: '0,15',
            initialP2Position: '15,0',
            gameSeed: this.gameSeed // Send seed to ensure consistent board generation
        };
        return gameState;
    }

    // Add method to get player symbol from socket ID
    getPlayerSymbolById(socketId) {
        if (this.players.P1.socketId === socketId) return 'P1';
        if (this.players.P2.socketId === socketId) return 'P2';
        return null;
    }

    findCapturableTiles(playerId, selectedColor) {
        console.log('Finding capturable tiles:', {
            playerId,
            selectedColor,
            boardSize: this.boardSize
        });

        const capturable = new Set();
        const checked = new Set();

        // Find all tiles owned by this player
        Object.entries(this.boardState)
            .filter(([_, tile]) => tile.owner === playerId)
            .forEach(([key, _]) => {
                this.findAdjacentMatchingColor(key, selectedColor, capturable, checked);
            });

        return Array.from(capturable);
    }

    findAdjacentMatchingColor(startKey, targetColor, capturable, checked) {
        if (checked.has(startKey)) return;
        checked.add(startKey);

        // Get coordinates
        const [q, r] = startKey.split(',').map(Number);
        
        // Check all 6 neighbors
        const directions = [
            {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
            {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
        ];

        directions.forEach(dir => {
            const nq = q + dir.q;
            const nr = r + dir.r;
            const neighborKey = `${nq},${nr}`;

            // Check if neighbor is within board bounds
            if (nq >= 0 && nq < this.boardSize && nr >= 0 && nr < this.boardSize) {
                const tile = this.boardState[neighborKey];
                if (tile && tile.color === targetColor && !tile.owner) {
                    capturable.add(neighborKey);
                    this.findAdjacentMatchingColor(neighborKey, targetColor, capturable, checked);
                }
            }
        });
    }

    handleColorSelection(playerId, selectedColor) {
        console.log('Processing color selection:', {
            playerId,
            selectedColor,
            currentState: {
                currentPlayer: this.currentPlayer,
                lastUsedColor: this.lastUsedColor
            }
        });

        try {
            // First find all capturable tiles
            const capturedTiles = this.findCapturableTiles(playerId, selectedColor);
            console.log('Found capturable tiles:', capturedTiles);

            // Track all tiles that need updating
            const tilesToUpdate = new Set([...capturedTiles]);

            // Add all existing owned tiles to the update set
            Object.entries(this.boardState).forEach(([key, tile]) => {
                if (tile.owner === playerId) {
                    tilesToUpdate.add(key);
                }
            });

            // THIS IS WHERE TILES ACTUALLY CHANGE COLOR:
            tilesToUpdate.forEach(key => {
                if (this.boardState[key]) {
                    this.boardState[key].owner = playerId;
                    this.boardState[key].color = selectedColor;  // Here's the color change
                }
            });

            // Update scores AFTER tiles are captured
            const newScores = this.updateScores();

            // Log the capture results
            console.log('Move results:', {
                player: playerId,
                newCaptured: capturedTiles.length,
                totalScore: newScores[playerId],
                allTilesUpdated: tilesToUpdate.size
            });

            // Update scores and turn state
            this.updateScores();
            this.lastUsedColor = selectedColor;
            this.currentPlayer = this.currentPlayer === 'P1' ? 'P2' : 'P1';

            console.log('Move completed successfully:', {
                capturedCount: capturedTiles.length,
                totalUpdated: tilesToUpdate.size,
                newCurrentPlayer: this.currentPlayer
            });

            return {
                success: true,
                capturedCount: capturedTiles.length,
                updatedTiles: Array.from(tilesToUpdate),
                newState: this.getSerializableState()
            };
        } catch (error) {
            console.error('Error in handleColorSelection:', error);
            return {
                success: false,
                message: 'Internal server error processing move'
            };
        }
    }
} // End of ServerGameState class

// --- Server Helper Functions ---
function generateChallengeCode() {
    // Generate a 6-character uppercase alphanumeric code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateGameId() {
    // Generate a longer, potentially prefixed ID for games
    return `game_${Math.random().toString(36).substring(2, 12)}`;
}

// --- Socket.IO Connection Handler ---
io.on('connection', (socket) => {
    const query = socket.handshake.query;
    console.log('=== New Connection ===');
    console.log('Socket ID:', socket.id);
    console.log('Query params:', query);
    console.log('Client IP:', socket.handshake.address);
    console.log('====================');

    socket.on('create-challenge', (playerName, callback) => {
        try {
            playerName = String(playerName || '').trim();
            console.log(`'create-challenge' received from ${socket.id} with name: '${playerName}'`);

            if (!playerName) {
                console.log(`Challenge creation rejected for ${socket.id}: Missing player name.`);
                return callback({ success: false, message: "Please enter a player name." });
            }

            // Check if player is already hosting or in a game
            const existingChallenge = Object.entries(challenges).find(([code, data]) => data.hostSocketId === socket.id);
            const existingGame = playerSockets[socket.id] && playerSockets[socket.id].gameId;
            if (existingChallenge || existingGame) {
                const msg = existingChallenge
                    ? `You are already hosting challenge ${existingChallenge[0]}.`
                    : `You are already in game ${playerSockets[socket.id].gameId}.`;
                console.log(`Player ${socket.id} (${playerName}) attempted to create a challenge but is already active.`);
                return callback({ success: false, message: msg });
            }

            const challengeCode = generateChallengeCode();
            challenges[challengeCode] = {
                hostSocketId: socket.id,
                hostPlayerName: playerName
            };
            playerSockets[socket.id] = { gameId: null, playerName: playerName, playerSymbol: 'P1' };
            console.log(`Challenge ${challengeCode} created by ${playerName} (${socket.id})`);
            callback({ success: true, challengeCode: challengeCode });
        } catch (error) {
            console.error(`Error in 'create-challenge' handler for ${socket.id}:`, error);
            callback({ success: false, message: "An internal server error occurred." });
        }
    });

    socket.on('join-challenge', ({ challengeCode, playerName }, callback) => {
        console.log('=== Join Attempt ===');
        console.log('Socket ID:', socket.id);
        console.log('Join data:', { challengeCode, playerName });
        console.log('Current challenges:', challenges);
        console.log('==================');

        try {
            // Validate and clean inputs
            if (!challengeCode || !playerName) {
                console.log('Join rejected - missing data:', { challengeCode, playerName });
                return callback({ 
                    success: false, 
                    message: "Player name and challenge code are required." 
                });
            }

            const cleanCode = String(challengeCode).trim().toUpperCase();
            const challenge = challenges[cleanCode];

            if (!challenge) {
                console.log('Challenge not found:', cleanCode);
                return callback({ 
                    success: false, 
                    message: "Challenge not found or expired." 
                });
            }

            // Check if challenge creator is still connected
            if (!io.sockets.sockets.has(challenge.hostSocketId)) {
                console.log('Host disconnected for challenge:', cleanCode);
                delete challenges[cleanCode];
                return callback({ 
                    success: false, 
                    message: "Game host has disconnected." 
                });
            }

            // Create game state and send response
            const gameId = generateGameId();
            const gameState = new ServerGameState(
                gameId,
                challenge.hostPlayerName,
                playerName,
                challenge.hostSocketId,
                socket.id
            );

            // Store game state and update player tracking
            activeGames[gameId] = gameState;
            
            // Update player tracking for both players
            playerSockets[socket.id] = {
                gameId,
                playerName,
                playerSymbol: 'P2'
            };
            
            playerSockets[challenge.hostSocketId] = {
                gameId,
                playerName: challenge.hostPlayerName,
                playerSymbol: 'P1'
            };

            // Join socket room and notify players
            socket.join(gameId);
            io.sockets.sockets.get(challenge.hostSocketId)?.join(gameId);

            // Send game start with complete player info
            const gameStartData = {
                roomCode: challengeCode,
                gameState: gameState.getSerializableState(),
                players: {
                    P1: { 
                        name: challenge.hostPlayerName, 
                        socketId: challenge.hostSocketId,
                        isCurrentTurn: gameState.currentPlayer === 'P1',
                        symbol: 'P1'  // Add explicit symbol
                    },
                    P2: { 
                        name: playerName, 
                        socketId: socket.id,
                        isCurrentTurn: gameState.currentPlayer === 'P2',
                        symbol: 'P2'  // Add explicit symbol
                    }
                },
                currentTurn: {
                    player: gameState.currentPlayer,
                    canMove: true
                }
            };

            io.to(gameId).emit('game-start', gameStartData);
            
            // Remove used challenge code
            delete challenges[challengeCode];

            callback({ 
                success: true,
                gameId,
                gameState: gameState.getSerializableState(),
                players: gameStartData.players,
                currentTurn: gameStartData.currentTurn  // Include in callback
            });

        } catch (error) {
            console.error('Join error:', error);
            callback({ success: false, message: "Server error processing join request." });
        }
    });

    socket.on('place-tile', ({ gameId, playerId, move }, callback) => {
        try {
            console.log('Server received move:', {
                gameId,
                playerId,
                move,
                currentGame: activeGames[gameId],
                playerInfo: playerSockets[playerId]
            });

            const playerInfo = playerSockets[socket.id];
            if (!playerInfo || !playerInfo.gameId) {
                return callback({ success: false, message: 'Not in a game' });
            }

            const game = activeGames[playerInfo.gameId];
            if (!game) {
                return callback({ success: false, message: 'Game not found' });
            }

            // Validate it's player's turn and move is valid
            if (game.currentPlayer !== playerInfo.playerSymbol) {
                return callback({ success: false, message: 'Not your turn' });
            }

            if (move.type === 'color-select') {
                if (move.color === game.lastUsedColor) {
                    return callback({ success: false, message: 'Color was just used' });
                }

                // Process move atomically
                const result = game.handleColorSelection(playerInfo.playerSymbol, move.color);
                console.log('Color selection result:', result);

                if (result.success) {
                    // Send update to all players in room
                    io.to(game.gameId).emit('game-update', {
                        state: result.newState,
                        lastMove: {
                            player: playerInfo.playerSymbol,
                            color: move.color,
                            capturedTiles: result.capturedCount
                        }
                    });

                    // Confirm success to moving player
                    return callback({ 
                        success: true,
                        state: result.newState // Send state back to moving player
                    });
                }
            }
            
            callback({ success: false, message: 'Invalid move' });
        } catch (error) {
            console.error('Server error processing move:', error);
            callback({ success: false, message: 'Server error', error: error.message });
        }
    });

    socket.on('chat-message', (message) => {
        try {
            message = String(message || '').trim(); // Basic sanitization
            if (!message) return; // Ignore empty messages

            const playerInfo = playerSockets[socket.id];
            // Ensure player is tracked and in an active game to send chat
            if (playerInfo && playerInfo.gameId && activeGames[playerInfo.gameId]) {
                const gameId = playerInfo.gameId;
                const playerName = playerInfo.playerName;
                console.log(`Game ${gameId} Chat: ${playerName}: ${message}`);
                // Broadcast message to everyone *else* in the room (and maybe sender too, TBC by client)
                // Using io.to(gameId) sends to all including sender.
                // Using socket.to(gameId).emit(...) sends to all *except* sender. Choose based on client needs.
                io.to(gameId).emit('chat-message', { sender: playerName, text: message });
            } else {
                console.log(`Chat message ignored from user not in active game (${socket.id}): ${message}`);
                // Optionally send an error back to sender if chat outside game is disallowed
                socket.emit('game-error', { message: 'You must be in an active game to send chat messages.' });
            }
        } catch (error) {
            console.error(`Error in 'chat-message' handler for ${socket.id}:`, error);
            // Optionally notify sender of chat error
            socket.emit('game-error', { message: 'Server error sending your chat message.' });
        }
    });

    // --- Disconnect Event Handler ---
    socket.on('disconnect', (reason) => {
        try {
            console.log(`User disconnected: ${socket.id}. Reason: ${reason}`);
            const playerInfo = playerSockets[socket.id]; // Get player info *before* deleting

            // --- Cleanup ---
            // 1. Clean up any challenges hosted by this socket
            const hostedChallengeCode = Object.keys(challenges).find(code => challenges[code]?.hostSocketId === socket.id);
            if (hostedChallengeCode) {
                console.log(`Cleaning up challenge ${hostedChallengeCode} (host ${socket.id} disconnected).`);
                delete challenges[hostedChallengeCode];
            }

            // 2. Handle disconnect if player was in an active game
            if (playerInfo && playerInfo.gameId) {
                const gameId = playerInfo.gameId;
                const game = activeGames[gameId];

                // Check if the game exists and is *not* already over
                if (game && !game.isOver) {
                    console.log(`Player ${playerInfo.playerName} (${playerInfo.playerSymbol}) disconnected from active game ${gameId}. Forfeiting game.`);

                    // Mark the game as forfeited by the disconnected player
                    game.forfeit(playerInfo.playerSymbol);

                    // Notify the *remaining* player(s) in the room about the disconnect and the forfeit result
                    // socket.to(gameId) targets others in the room.
                    socket.to(gameId).emit('opponent-disconnected', {
                        playerName: playerInfo.playerName,
                        playerSymbol: playerInfo.playerSymbol,
                        message: `${playerInfo.playerName} (${playerInfo.playerSymbol}) disconnected. Game forfeited.`
                    });
                    socket.to(gameId).emit('game-update', game.getSerializableState()); // Use game-update or a specific 'game-over' event

                    // Optional: Clean up the game object itself after a delay, allowing clients to see the result
                    // setTimeout(() => {
                    //     if (activeGames[gameId] && activeGames[gameId].isOver) { // Check if still exists and is over
                    //         delete activeGames[gameId];
                    //         console.log(`Cleaning up ended game object ${gameId}`);
                    //     }
                    // }, 30000); // e.g., 30 seconds
                } else if (game && game.isOver) {
                    console.log(`Player ${playerInfo.playerName} disconnected from already finished game ${gameId}. No action needed.`);
                } else {
                    console.log(`Player ${playerInfo.playerName} disconnected; associated game ${gameId} not found or already cleaned up.`);
                }
            } else {
                console.log(`Disconnected user ${socket.id} was not hosting or in an active game.`);
                // Disconnected user wasn't hosting or in a tracked game
            }

            // 3. Always remove the player from the socket tracking object on disconnect
            delete playerSockets[socket.id];

            // --- Logging Current State (Optional) ---
            // console.log("--- State after disconnect ---");
            // console.log("Active challenges:", Object.keys(challenges).length);
            // console.log("Active games:", Object.keys(activeGames).length);
            // console.log("Tracked sockets:", Object.keys(playerSockets).length);
            // console.log("-----------------------------");
        } catch (error) {
            console.error(`Error in 'disconnect' handler for ${socket.id}:`, error);
        }
    });
});

// Add periodic cleanup of stale challenges
setInterval(() => {
    Object.entries(challenges).forEach(([code, data]) => {
        if (!io.sockets.sockets.has(data.hostSocketId)) {
            console.log(`Cleaning up stale challenge: ${code}`);
            delete challenges[code];
        }
    });
}, 60000); // Run every minute

// --- Start Listening ---
const startServer = (initialPort) => {
    const basePort = parseInt(initialPort, 10);
    if (isNaN(basePort) || basePort < 0 || basePort > 65535) {
        console.error('Invalid initial port:', initialPort);
        process.exit(1);
    }

    const MAX_PORT = 65535;
    let currentServer = null;

    const tryPort = (port) => {
        if (port > MAX_PORT) {
            console.error(`No available ports found between ${basePort} and ${MAX_PORT}`);
            process.exit(1);
        }

        // Close previous server if it exists
        if (currentServer) {
            currentServer.close();
        }

        // Create new server for this attempt
        currentServer = server.listen(port)
            .once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying ${port + 1}...`);
                    tryPort(port + 1);
                } else {
                    console.error('Server error:', err);
                    process.exit(1);
                }
            })
            .once('listening', () => {
                const actualPort = server.address().port;
                allowedOrigins = [
                    ...getDefaultOrigins(),
                    ...(isDevelopment ? [
                        `http://localhost:${actualPort}`,
                        `http://127.0.0.1:${actualPort}`
                    ] : [])
                ];
                
                console.log(`Server running in ${isDevelopment ? 'development' : 'production'} mode on port ${actualPort}`);
                console.log(`==> Your service is live 🎉`);
                console.log(`Allowed origins:`, allowedOrigins);
            });
    };

    tryPort(basePort);
};

// Start server with initial port
startServer(process.env.PORT || 3000);