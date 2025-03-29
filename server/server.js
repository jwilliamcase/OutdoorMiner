const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // Ensure .env is loaded early
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Correct way to import Server class
const cors = require('cors');

const app = express();

// --- CORS Configuration ---
// Use environment variable for client URL, default to localhost for development
const clientUrl = process.env.CLIENT_URL || 'http://localhost:8080'; // Provide a default if CLIENT_URL might be undefined
const allowedOrigins = [
    clientUrl,
    'https://jwilliamcase.github.io',
    'https://jwilliamcase.github.io/OutdoorMiner',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
].filter(Boolean); // Remove any undefined/empty values

console.log("Allowed CORS origins:", allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl)
        if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.error(`CORS Error: Origin ${origin} not allowed.`);
            callback(new Error('CORS not allowed'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

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
        origin: allowedOrigins,
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
        let p1Score = 0;
        let p2Score = 0;
        // Iterate through the tiles owned on the board
        for (const owner of Object.values(this.boardState)) {
            // Correctly increment score based on the owner of each tile
            if (owner === 'P1') {
                p1Score++;
            } else if (owner === 'P2') {
                p2Score++;
            }
        }
        // Update scores in the players object
        // Ensure player objects exist before assigning score
        if (this.players.P1) {
            this.players.P1.score = p1Score;
        }
        if (this.players.P2) {
            this.players.P2.score = p2Score;
        }
        // console.log(`Scores updated: P1=${p1Score}, P2=${p2Score}`); // Optional: logging
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
                        isCurrentTurn: gameState.currentPlayer === 'P1'
                    },
                    P2: { 
                        name: playerName, 
                        socketId: socket.id,
                        isCurrentTurn: gameState.currentPlayer === 'P2'
                    }
                }
            };

            io.to(gameId).emit('game-start', gameStartData);
            
            // Remove used challenge code
            delete challenges[challengeCode];

            callback({ 
                success: true,
                gameId,
                gameState: gameState.getSerializableState(),
                players: gameStartData.players
            });

        } catch (error) {
            console.error('Join error:', error);
            callback({ success: false, message: "Server error processing join request." });
        }
    });

    socket.on('place-tile', ({ q, r }, callback) => {
        try {
            const playerInfo = playerSockets[socket.id];
            // Validate player is tracked and associated with a game
            if (!playerInfo || !playerInfo.gameId) {
                console.error(`'place-tile' error: No player/game info for socket ${socket.id}.`);
                return callback({ success: false, message: 'Error: Player not associated with a game.' });
            }

            const game = activeGames[playerInfo.gameId];
            // Validate game instance exists
            if (!game) {
                console.error(`'place-tile' error: Game ${playerInfo.gameId} not found for socket ${socket.id}. Cleaning up inconsistent player data.`);
                // Player is tracked but game is missing - cleanup state
                delete playerSockets[socket.id];
                return callback({ success: false, message: 'Error: Game instance not found. Please try joining again.' });
            }

            // Delegate move validation and state update to the ServerGameState instance
            const result = game.placeTile(q, r, playerInfo.playerSymbol);
            if (result.success) {
                console.log(`Game ${game.gameId}: Tile placed by ${playerInfo.playerName} (${playerInfo.playerSymbol}) at (${q},${r}). Turn ${game.turnNumber}. Next: ${game.currentPlayer}`);
                // Broadcast the updated game state to all players in the room
                io.to(game.gameId).emit('game-update', result.newState);
                // Acknowledge success to the sender
                callback({ success: true });
                // Log if the game just ended
                if (result.newState.isOver) {
                    console.log(`Game ${game.gameId} ended on this move. Winner: ${result.newState.winner}`);
                    // Optional: Add post-game cleanup logic here or via setTimeout
                }
            } else {
                // Move was invalid according to game logic
                console.log(`Game ${game.gameId}: Invalid move by ${playerInfo.playerName} at (${q},${r}). Reason: ${result.reason}`);
                // Send failure reason back to the sender
                callback({ success: false, message: result.reason || 'Invalid move.' });
            }
        } catch (error) {
            console.error(`Error in 'place-tile' handler for ${socket.id}:`, error);
            callback({ success: false, message: "Server error processing your move." });
        }
    });

    // --- Chat Event Handler ---
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
const PORT = process.env.PORT || 10000; // Match Render's default port
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`==> Your service is live 🎉`);
    console.log(`Expecting client connections from: ${allowedOrigins.join(', ')}`);
});