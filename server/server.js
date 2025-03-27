require('dotenv').config({ path: __dirname + '/.env' }); // Ensure .env is loaded early
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Correct way to import Server class
const cors = require('cors');
const path = require('path');

const app = express();

// --- CORS Configuration ---
// Use environment variable for client URL, default to localhost for development
const clientUrl = process.env.CLIENT_URL || 'http://localhost:8080'; // Provide a default if CLIENT_URL might be undefined
const allowedOrigins = [clientUrl];
// Allow localhost for local development regardless of CLIENT_URL setting
if (!allowedOrigins.includes('http://localhost:8080')) {
    allowedOrigins.push('http://localhost:8080');
}
if (!allowedOrigins.includes('http://127.0.0.1:8080')) { // Sometimes needed too
    allowedOrigins.push('http://127.0.0.1:8080');
}

console.log("Allowed CORS origins:", allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl) OR from allowed origins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`CORS Error: Origin ${origin} not allowed.`);
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            callback(new Error(msg), false);
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
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
        origin: allowedOrigins, // Apply CORS settings to Socket.IO connections
        methods: ["GET", "POST"],
        credentials: true
    },
    // Optional: Increase ping timeout if experiencing frequent disconnects on slow networks
    // pingTimeout: 60000,
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
        this.boardState = {}; // Store placed tiles: { 'q,r': 'P1' | 'P2' }
        this.currentPlayer = 'P1'; // P1 always starts
        this.isOver = false;
        this.winner = null;
        // Assuming a fixed board size matching the client for now
        this.boardSize = 7; // Consider making this dynamic or passed during game creation
        this.totalTiles = this.calculateTotalTiles(this.boardSize);
        this.turnNumber = 0; // Track number of turns played
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
        return {
            gameId: this.gameId,
            players: this.players, // Contains names, socketIds, scores
            boardState: this.boardState,
            currentPlayer: this.currentPlayer,
            isOver: this.isOver,
            winner: this.winner,
            boardSize: this.boardSize,
            turnNumber: this.turnNumber
        };
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
    console.log(`User connected: ${socket.id}`);

    // --- Challenge Event Handlers ---
    socket.on('create-challenge', (playerName, callback) => {
        // Wrap in try/catch for unexpected errors
        try {
            playerName = String(playerName || '').trim(); // Basic sanitization
            console.log(`'create-challenge' received from ${socket.id} with name: '${playerName}'`);

            if (!playerName) {
                console.log(`Challenge creation rejected for ${socket.id}: Missing player name.`);
                return callback({ success: false, message: "Please enter a player name." });
            }

            // Prevent player from creating multiple challenges or creating while in game
            // Check if the player is already hosting a different challenge
           if (socket.id && challenges) {
                const existingChallenge = Object.entries(challenges).find(([code, data]) => data.hostSocketId === socket.id);
                if (existingChallenge) {
                    console.log(`Player ${socket.id} (${playerName}) attempted to create a challenge but is already hosting room ${existingChallenge[0]}`);
                     return callback({ success: false, message: `You are already hosting challenge ${existingChallenge[0]}.` });
                } else if (playerSockets[socket.id].gameId) {
                     return callback({ success: false, message: `You are already in game ${playerSockets[socket.id].gameId}.` });
                }
                // If somehow playerSocket exists but no game/challenge, log it maybe?
            }

            const challengeCode = generateChallengeCode();
            // Store challenge data
            challenges[challengeCode] = {
                hostSocketId: socket.id,
                hostPlayerName: playerName
            };
            // Track the player socket, initially not in a game, defaults to P1 if they host
            playerSockets[socket.id] = { gameId: null, playerName: playerName, playerSymbol: 'P1' };

            console.log(`Challenge ${challengeCode} created by ${playerName} (${socket.id})`);
            // Send success and the code back to the client
            callback({ success: true, challengeCode: challengeCode });

        } catch (error) {
            console.error(`Error in 'create-challenge' handler for ${socket.id}:`, error);
            callback({ success: false, message: "An internal server error occurred." });
        }
    });

    socket.on('join-challenge', ({ challengeCode, playerName }, callback) => {
        try {
            // Basic sanitization
            playerName = String(playerName || '').trim();
            challengeCode = String(challengeCode || '').trim().toUpperCase();
            console.log(`'join-challenge' received from ${socket.id} for code '${challengeCode}' with name: '${playerName}'`);

            if (!playerName || !challengeCode) {
                console.log(`Join rejected for ${socket.id}: Missing player name or challenge code.`);
                return callback({ success: false, message: "Player name and challenge code are required." });
            }

            const challenge = challenges[challengeCode];
            if (!challenge) {
                console.log(`Join rejected for ${socket.id}: Challenge code '${challengeCode}' not found.`);
                return callback({ success: false, message: "Challenge code not found or has expired." });
            }

            // Prevent joining own challenge
            if (challenge.hostSocketId === socket.id) {
                console.log(`Join rejected for ${socket.id}: Attempted to join own challenge '${challengeCode}'.`);
                return callback({ success: false, message: "You cannot join your own challenge." });
            }

            // Prevent player from joining if already in a game or hosting
            if (playerSockets[socket.id]) {
                console.warn(`Player ${socket.id} (${playerSockets[socket.id].playerName}) attempted to join challenge while already tracked.`);
                 const existingChallenge = Object.entries(challenges).find(([code, data])]) => data.hostSocketId === socket.id);
                 if(existingChallenge){
                     return callback({ success: false, message: `You are already hosting challenge ${existingChallenge[0]}. Leave it first.` });
                 } else if (playerSockets[socket.id].gameId) {
                     return callback({ success: false, message: `You are already in game ${playerSockets[socket.id].gameId}. Leave it first.` });
                 }
            }

            // Check if the host is still connected
            const hostSocket = io.sockets.sockets.get(challenge.hostSocketId);
            if (!hostSocket) {
                console.log(`Join rejected for ${socket.id}: Host (${challenge.hostSocketId}) for challenge '${challengeCode}' is disconnected.`);
                // Clean up the stale challenge
                delete challenges[challengeCode];
                return callback({ success: false, message: "The host has disconnected or the challenge expired." });
            }

            // --- All checks passed, Start the Game ---
            const gameId = generateGameId();
            const hostPlayerName = challenge.hostPlayerName;
            const guestSocketId = socket.id;
            const guestPlayerName = playerName;

            console.log(`Starting game ${gameId}: Host=${hostPlayerName}(${challenge.hostSocketId}), Guest=${guestPlayerName}(${guestSocketId})`);

            // Create the server-side game state instance
            const newGame = new ServerGameState(gameId, hostPlayerName, guestPlayerName, challenge.hostSocketId, guestSocketId);
            activeGames[gameId] = newGame;

            // Update player socket tracking information for both players
            if (playerSockets[challenge.hostSocketId]) {
                playerSockets[challenge.hostSocketId].gameId = gameId;
                playerSockets[challenge.hostSocketId].playerSymbol = 'P1'; // Host is always P1
            } else {
                 // This shouldn't happen if create-challenge worked, but handle defensively
                 console.error(`CRITICAL: Host socket ${challenge.hostSocketId} not found in playerSockets during game start!`);
                 // Clean up attempt?
                 delete activeGames[gameId];
                 return callback({ success: false, message: "Server error: Host player data lost." });
            }
            playerSockets[guestSocketId] = { gameId: gameId, playerName: guestPlayerName, playerSymbol: 'P2' }; // Joining player is P2

            // Add both player sockets to a Socket.IO room named after the gameId
            hostSocket.join(gameId);
            socket.join(gameId); // The joining player's socket

            // Remove the challenge code now that it's been used
            delete challenges[challengeCode];

            // Emit 'game-start' event to BOTH players in the room with the initial game state
            const initialState = newGame.getSerializableState();
            io.to(gameId).emit('game-start', initialState);

            console.log(`Game ${gameId} started successfully.`);
            // Send success callback to the joining player
            callback({ success: true, gameId: gameId });

        } catch (error) {
            console.error(`Error in 'join-challenge' handler for ${socket.id}:`, error);
            callback({ success: false, message: "An internal server error occurred." });
        }
    });

    // --- Game Action Event Handlers ---
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
                    // Send the final game state reflecting the forfeit to the remaining player(s)
                    socket.to(gameId).emit('game-update', game.getSerializableState()); // Use game-update or a specific 'game-over' event

                    // Optional: Clean up the game object itself after a delay, allowing clients to see the result
                    // setTimeout(() => {
                    //     if (activeGames[gameId] && activeGames[gameId].isOver) { // Check if still exists and is over
                    //         console.log(`Cleaning up ended game object ${gameId}`);
                    //         delete activeGames[gameId];
                    //         // Optionally remove players from playerSockets if game is truly done? Depends on if they can start new games.
                    //     }
                    // }, 30000); // e.g., 30 seconds

                } else if (game && game.isOver) {
                     console.log(`Player ${playerInfo.playerName} disconnected from already finished game ${gameId}. No action needed.`);
                } else {
                    // Player was associated with a gameId, but the game object wasn't found. Might have been cleaned up already.
                    console.log(`Player ${playerInfo.playerName} disconnected; associated game ${gameId} not found or already cleaned up.`);
                }
            } else {
                // Disconnected user wasn't hosting or in a tracked game
                console.log(`Disconnected user ${socket.id} was not hosting or in an active game.`);
            }

            // 3. Always remove the player from the socket tracking object on disconnect
            delete playerSockets[socket.id];

            // --- Logging Current State (Optional) ---
            // console.log("--- State after disconnect ---");
            // console.log("Tracked sockets:", Object.keys(playerSockets).length);
            // console.log("Active games:", Object.keys(activeGames).length);
            // console.log("Active challenges:", Object.keys(challenges).length);
            // console.log("-----------------------------");

        } catch (error) {
            console.error(`Error in 'disconnect' handler for ${socket.id}:`, error);
        }
    }); // End of 'disconnect' handler

}); // End of io.on('connection') handler

// --- Start Listening ---
const PORT = process.env.PORT || 3000; // Use port from environment or default to 3000
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Expecting client connections from: ${allowedOrigins.join(', ')}`);
});