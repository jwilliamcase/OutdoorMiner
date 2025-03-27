require('dotenv').config();
const express = require('express'); // Keep only one
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
// Removed duplicate express require
const app = express();
const server = http.createServer(app);

// --- CORS Configuration ---
// Allow requests from any origin. For production, restrict this to your frontend URL.
app.use(cors());
console.log("CORS middleware enabled for all origins.");

// --- Static File Serving ---
// Serve files from the parent directory of the 'server' directory
const staticPath = path.join(__dirname, '..');
console.log(`Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));

// --- Socket.IO Setup ---
// Note: The 'server' variable from the first http.createServer(app) call is used here.
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*", // Use client URL from env if available
    methods: ["GET", "POST"],
  }
});

// Game Constants (should match client if possible)
const BOARD_SIZE = 12;
const COLORS = ['#F8E9A1', '#F76C6C', '#B8E0F6', '#374785', '#0F1A40'];
const EXPLOSION_COLOR = '#000000';
const SABOTAGE_COLOR = '#8B0000'; // Dark Red
const EXPLOSION_RECOVERY_TURNS = 3;
const COMBO_THRESHOLD = 4;
const POWER_UPS = { SABOTAGE: 'sabotage', WILDCARD: 'wildcard', TELEPORT: 'teleport' };

// Middleware
// app.use(cors({ origin: "*", methods: ["GET", "POST"] })); // CORS is handled by socket.io config
app.use(express.json());

// Store active games (gameId -> gameState)
const activeGames = new Map();
// Store player sockets (socketId -> gameId)
const players = new Map();

// --- Server Routes ---
app.get('/', (req, res) => {
  res.send('Outdoor Miner Game Server Running');
});

// --- Socket.io Handling ---
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new game challenge
  socket.on('create-game', (data) => {
    try {
      const gameId = generateGameCode();
      const playerName = data?.playerName || 'Player 1';

      // Basic game state structure (will be populated by Player 1)
      const gameState = {
        id: gameId,
        players: [ // Player 1 joins immediately
          { id: socket.id, number: 1, name: playerName, isReady: false }
        ],
        initialStateProvided: false, // Flag if P1 has sent the board etc.
        board: null, // Board details filled by P1 via 'initialize-game'
        currentPlayer: 1,
        player1Color: null,
        player2Color: null,
        player1Tiles: [], // Store as array ['row,col', ...]
        player2Tiles: [],
        player1PowerUps: [],
        player2PowerUps: [],
        landmines: [], // Store as array [{row, col}, ...]
        explodedTiles: [], // Store as array [{row, col, turnsLeft, type}, ...]
        gameStarted: false,
        gameOver: false,
        winner: null,
        lastActivity: Date.now()
      };

      activeGames.set(gameId, gameState);
      players.set(socket.id, gameId);

      socket.join(gameId); // Player 1 joins the room

      console.log(`Game created: ${gameId} by Player ${socket.id} (${playerName})`);
      socket.emit('game-created', { gameId, playerNumber: 1, playerName: playerName });

    } catch (error) {
        console.error(`Error creating game for ${socket.id}:`, error);
        socket.emit('game-error', { message: 'Internal server error creating game.' });
    }
  });

  // Join an existing game challenge
  socket.on('join-game', (data) => {
    try {
        const { gameId, playerName } = data;
        const name = playerName || 'Player 2';

        if (!activeGames.has(gameId)) {
            socket.emit('game-error', { message: `Game ${gameId} not found.` });
            return;
        }

        const game = activeGames.get(gameId);

        if (game.players.length >= 2) {
            socket.emit('game-error', { message: `Game ${gameId} is full.` });
            return;
        }

        // Player 2 joins
        game.players.push({ id: socket.id, number: 2, name: name, isReady: true }); // Assume ready on join for now
        players.set(socket.id, gameId);
        socket.join(gameId);

        const player1 = game.players.find(p => p.number === 1);

        console.log(`Player ${socket.id} (${name}) joined game ${gameId}. Player 1: ${player1?.id}`);

        // Notify Player 2 they joined successfully
        socket.emit('game-joined', {
            gameId,
            playerNumber: 2,
            playerName: name,
            opponentName: player1?.name || 'Player 1' // Send P1's name to P2
        });

        // Notify Player 1 that Player 2 joined
        io.to(player1.id).emit('player-joined', {
            playerNumber: 2,
            playerName: name // Send P2's name to P1
        });

        // If P1 already sent initial state, start the game
        if (game.initialStateProvided) {
            startGame(gameId);
        } else {
             console.log(`Game ${gameId}: Player 2 joined, waiting for Player 1 to initialize.`);
             // Optionally prompt Player 1 if needed: io.to(player1.id).emit('prompt-initialize');
        }
    } catch (error) {
        console.error(`Error joining game for ${socket.id} (${data?.gameId}):`, error);
        socket.emit('game-error', { message: 'Internal server error joining game.' });
    }
  });

  // Player 1 provides the initial game state after creating the game
  socket.on('initialize-game', (data) => {
    try {
        const { gameId, gameData } = data;

        if (!activeGames.has(gameId)) {
            socket.emit('game-error', { message: 'Game not found for initialization.' });
            return;
        }
        const game = activeGames.get(gameId);
        const player1 = game.players.find(p => p.number === 1);

        // Basic validation: Only Player 1 can initialize
        if (!player1 || player1.id !== socket.id) {
            socket.emit('game-error', { message: 'Only Player 1 can initialize the game.' });
            return;
        }
        if (game.initialStateProvided) {
             socket.emit('game-error', { message: 'Game already initialized.' });
             return;
        }

        if (!gameData || !gameData.board || !gameData.player1Tiles || !gameData.player2Tiles) {
             socket.emit('game-error', { message: 'Incomplete initial game data provided.' });
             console.warn(`Incomplete init data for ${gameId}:`, gameData);
             return;
        }

        // Store initial state provided by Player 1
        game.board = gameData.board;
        game.player1Color = gameData.player1Color;
        game.player2Color = gameData.player2Color;
        game.player1Tiles = gameData.player1Tiles || []; // Expects ['r,c', ...]
        game.player2Tiles = gameData.player2Tiles || []; // Expects ['r,c', ...]
        game.player1PowerUps = gameData.player1PowerUps || [];
        game.player2PowerUps = gameData.player2PowerUps || [];
        game.landmines = gameData.landmines || []; // Expects [{row, col}, ...]
        game.explodedTiles = []; // Start with none
        game.currentPlayer = 1; // P1 always starts
        game.initialStateProvided = true;
        player1.isReady = true;
        game.lastActivity = Date.now();

        console.log(`Game ${gameId} initialized by Player 1 (${socket.id}). Board: ${game.board.length}x${game.board[0]?.length}. P1 Tiles: ${game.player1Tiles.length}, P2 Tiles: ${game.player2Tiles.length}. Mines: ${game.landmines.length}`);

        // Check if Player 2 is already present and ready
        const player2 = game.players.find(p => p.number === 2);
        if (player2 && player2.isReady) {
            startGame(gameId);
        } else {
            console.log(`Game ${gameId}: Player 1 initialized, waiting for Player 2.`);
            // Notify P1 that server is waiting for P2
            socket.emit('waiting-for-opponent');
        }
    } catch (error) {
        console.error(`Error initializing game ${data?.gameId} by ${socket.id}:`, error);
        socket.emit('game-error', { message: 'Internal server error initializing game.' });
    }
  });

  // Handle player moves
  socket.on('make-move', (data) => {
    try {
        const { gameId, playerNumber, move } = data;
        // console.log(`DEBUG: Received move from P${playerNumber} in game ${gameId}:`, move); // Verbose log

        if (!activeGames.has(gameId)) {
            socket.emit('game-error', { message: 'Game not found.' });
            return;
        }
        const game = activeGames.get(gameId);

        if (!game.gameStarted || game.gameOver) {
             socket.emit('game-error', { message: 'Game not started or is over.' });
             return;
        }

        // Validate player turn
        if (game.currentPlayer !== playerNumber) {
            socket.emit('game-error', { message: 'Not your turn.' });
             console.warn(`Turn mismatch: Game ${gameId}, Expected P${game.currentPlayer}, Got P${playerNumber}`);
            return;
        }

        let mineTriggered = false;
        let powerUpAwarded = false;

        // --- Process Move Server-Side ---
        switch (move.type) {
            case 'color-selection':
                if (!move.color || !COLORS.includes(move.color)) {
                    socket.emit('game-error', { message: 'Invalid color selected.' });
                    return;
                }
                mineTriggered = handleColorSelectionServer(game, playerNumber, move.color);
                if (!mineTriggered) { // Award powerup only if mine didn't explode
                    powerUpAwarded = checkForPowerUpAward(game, playerNumber);
                }
                break;

            case 'power-up':
                 if (!move.powerUpType || !move.row === undefined || !move.col === undefined) {
                     socket.emit('game-error', { message: 'Invalid power-up data.' });
                     return;
                 }
                mineTriggered = handlePowerUpServer(game, playerNumber, move);
                // Power-ups generally don't award new power-ups
                break;

            default:
                socket.emit('game-error', { message: `Unknown move type: ${move.type}` });
                return;
        }

        // --- Post-Move Processing ---
        game.lastActivity = Date.now();

        if (!mineTriggered) { // Mine explosions handle their own turn switch
             switchPlayerTurnServer(game);
        }
        // Recover any exploded tiles for the *next* turn
        processExplodedTilesRecoveryServer(game);

        // Check for Game Over for the *new* current player
        if (checkForGameOverServer(game)) {
            handleGameOverServer(game); // This function now emits 'game-over'
            // No need to broadcast state separately here
        } else {
            // Send regular game update
             broadcastGameState(gameId, game); // Broadcast the latest state
        }

    } catch (error) {
        console.error(`Error processing move for ${socket.id} in game ${data?.gameId}:`, error, data?.move);
        // Map to store game states, keyed by game ID
const games = {};
// Map to store player sockets, keyed by socket ID
const players = {};

// Central GameState class definition (moved here for clarity, could be in separate file)
class GameState {
constructor(rows = 11, cols = 11) {
    this.rows = rows;
    this.cols = cols;
    this.board = {}; // Using object { 'q,r': 'P1' | 'P2' }
    this.currentPlayer = 'P1'; // P1 starts
    this.winner = null;
    this.winningPath = [];
    // Axial directions for neighbor finding
    this.directions = [
        { dq: +1, dr: 0 }, { dq: +1, dr: -1 }, { dq: 0, dr: -1 },
        { dq: -1, dr: 0 }, { dq: -1, dr: +1 }, { dq: 0, dr: +1 }
    ];
}

// Basic check for valid coordinates using axial system (simple rectangular boundary)
// NOTE: For a true hexagonal board shape, bounds checking is more complex.
// This assumes a roughly parallelogram/rectangular layout within the q,r range.
isValid(q, r) {
    // Example check for a parallelogram grid:
    // return q >= 0 && q < this.cols && r >= 0 && r < this.rows;
    // Example check for pointy-top hex grid filling a rectangle more naturally:
    const minQ = 0;
    const maxQ = this.cols - 1;
    const minR = 0;
    const maxR = this.rows - 1;
    // This check might need refinement based on exact board shape and origin (0,0) position
    return q >= minQ && q <= maxQ && r >= minR && r <= maxR;
}

getTile(q, r) {
    return this.board[`${q},${r}`];
}

setTile(q, r, player) {
    if (player === null || player === undefined) {
        delete this.board[`${q},${r}`];
    } else {
        this.board[`${q},${r}`] = player;
    }
}

placeTile(q, r, player) {
    if (this.winner) {
        return { success: false, error: 'Game is already over.' };
    }
    if (player !== this.currentPlayer) {
        return { success: false, error: 'Not your turn.' };
    }
    if (!this.isValid(q, r)) {
        return { success: false, error: 'Invalid coordinates.' };
    }
    if (this.getTile(q, r)) {
        return { success: false, error: 'Cell already occupied.' };
    }

    this.setTile(q, r, player);

    const winCheckResult = this.checkWin(player);
    if (winCheckResult.won) {
        this.winner = player;
        this.winningPath = winCheckResult.path;
        console.log(`${player} wins! Path:`, winCheckResult.path.map(c => `(${c.q},${c.r})`).join(' -> '));
        return { success: true, winner: this.winner, winningPath: this.winningPath };
    }

    this.currentPlayer = this.currentPlayer === 'P1' ? 'P2' : 'P1';
    return { success: true };
}

checkWin(player) {
    const visited = new Set();
    const queue = [];
    const parentMap = new Map();

    let startNodes = [];
    let isEndNode;

    // Define start edges and end condition based on player
    if (player === 'P1') { // Top (r=0) to Bottom (r=rows-1)
        for (let q = 0; q < this.cols; q++) {
            if (this.isValid(q, 0) && this.getTile(q, 0) === player) {
                const nodeKey = `${q},0`;
                if (!visited.has(nodeKey)) {
                    startNodes.push({ q, r: 0 });
                    visited.add(nodeKey);
                    parentMap.set(nodeKey, null);
                }
            }
        }
        isEndNode = (coord) => coord.r === this.rows - 1;
    } else { // Left (q=0) to Right (q=cols-1)
        for (let r = 0; r < this.rows; r++) {
            if (this.isValid(0, r) && this.getTile(0, r) === player) {
                const nodeKey = `0,${r}`;
                 if (!visited.has(nodeKey)) {
                    startNodes.push({ q: 0, r });
                    visited.add(nodeKey);
                    parentMap.set(nodeKey, null);
                 }
            }
        }
        isEndNode = (coord) => coord.q === this.cols - 1;
    }

    queue.push(...startNodes);
    let finalNode = null;

    while (queue.length > 0) {
        const current = queue.shift();
        const currentKey = `${current.q},${current.r}`;

        if (isEndNode(current)) {
            finalNode = current;
            break;
        }

        for (const dir of this.directions) {
            const nq = current.q + dir.dq;
            const nr = current.r + dir.dr;
            const neighborKey = `${nq},${nr}`;

            if (this.isValid(nq, nr) && this.getTile(nq, nr) === player && !visited.has(neighborKey)) {
                visited.add(neighborKey);
                queue.push({ q: nq, r: nr });
                parentMap.set(neighborKey, currentKey);
            }
        }
    }

    if (finalNode) {
        const path = [];
        let currentKey = `${finalNode.q},${finalNode.r}`;
        while (currentKey) {
            const [qStr, rStr] = currentKey.split(',');
            path.push({ q: parseInt(qStr), r: parseInt(rStr) });
            currentKey = parentMap.get(currentKey);
        }
        return { won: true, path: path.reverse() };
    }

    return { won: false, path: [] };
}

serialize() {
    return JSON.stringify({
        rows: this.rows,
        cols: this.cols,
        board: this.board,
        currentPlayer: this.currentPlayer,
        winner: this.winner,
        winningPath: this.winningPath
    });
}

static deserialize(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data || typeof data.rows !== 'number' || typeof data.cols !== 'number' || typeof data.board !== 'object' || typeof data.currentPlayer !== 'string') {
            console.error("Deserialize Error: Invalid game state data format", data);
            return new GameState(); // Return default state
        }
        const gameState = new GameState(data.rows, data.cols);
        gameState.board = data.board || {}; // Ensure board is at least an empty object
        gameState.currentPlayer = data.currentPlayer;
        gameState.winner = data.winner;
        gameState.winningPath = data.winningPath || [];
        return gameState;
    } catch (error) {
        console.error("Deserialize Error: Failed to parse game state JSON:", error);
        return new GameState(); // Return default state on JSON parse error
    }
}
} // End of GameState class


// Utility function to generate unique game IDs
function generateGameId() {
return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Main Socket.IO connection handler
io.on('connection', (socket) => {
console.log(`User connected: ${socket.id}`);
players[socket.id] = { socket: socket, gameId: null, player: null }; // Track player info

// --- Game Creation ---
socket.on('create-game', (playerName) => {
    try {
        if (!playerName || playerName.trim().length === 0) {
            socket.emit('game-error', 'Player name cannot be empty.');
            return;
        }
        const gameId = generateGameId();
        console.log(`Game created with ID: ${gameId} by ${playerName} (${socket.id})`);
        games[gameId] = {
            id: gameId,
            players: {}, // { socketId: { name: string, player: 'P1' | 'P2' } }
            playerCount: 0,
            gameState: null, // Initialized when P2 joins
            spectators: new Set()
        };

        games[gameId].players[socket.id] = { name: playerName, player: 'P1' };
        games[gameId].playerCount = 1;
        players[socket.id].gameId = gameId;
        players[socket.id].player = 'P1';

        socket.join(gameId);
        socket.emit('game-created', { gameId, player: 'P1' });
        console.log(`Player ${playerName} (${socket.id}) joined ${gameId} as P1`);
    } catch (error) {
        console.error(`[create-game] Error for ${socket.id}:`, error);
        socket.emit('game-error', 'Server error creating game.');
    }
});

// --- Game Joining ---
socket.on('join-game', ({ gameId, playerName }) => {
    try {
        if (!playerName || playerName.trim().length === 0) {
            socket.emit('game-error', 'Player name cannot be empty.');
            return;
        }
        if (!gameId) {
             socket.emit('game-error', 'Game ID is required.');
             return;
        }

        const game = games[gameId];
        if (!game) {
            socket.emit('game-error', `Game not found: ${gameId}`);
            return;
        }

        // Check if socket is already in game (player or spectator)
        if (players[socket.id]?.gameId === gameId) {
             socket.emit('game-error', 'You are already in this game.');
             return;
        }

        // Join as Spectator if game is full or already started
        if (game.playerCount >= 2 || game.gameState) {
            if (!game.spectators.has(socket.id)) {
                game.spectators.add(socket.id);
                players[socket.id].gameId = gameId;
                players[socket.id].player = 'Spectator';
                socket.join(gameId);
                socket.emit('game-joined', { gameId, player: 'Spectator', gameState: game.gameState ? game.gameState.serialize() : null });
                console.log(`Spectator ${playerName} (${socket.id}) joined ${gameId}`);
                if (game.gameState) {
                    socket.emit('update-state', game.gameState.serialize());
                }
            } else {
                 socket.emit('game-error', 'Already spectating this game.'); // Should be caught above, but safeguard
            }
            return; // Stop further execution for spectators or late joiners
        }

        // Join as P2 if slot available and game not started
        if (game.playerCount === 1 && !Object.values(game.players).some(p => p.player === 'P2')) {
            game.players[socket.id] = { name: playerName, player: 'P2' };
            game.playerCount = 2;
            players[socket.id].gameId = gameId;
            players[socket.id].player = 'P2';
            socket.join(gameId);
            const capturedTiles = captureOpponentTiles(gameState.board, data.q, data.r, player, gameState.players); // Ensure only one semicolon

            // Check if any tiles were captured
            if (capturedTiles && capturedTiles.length > 0) { // Added check for capturedTiles existence
                console.log(`Player ${player} captured ${capturedTiles.length} tiles.`);
                // Potentially update score or other game state based on captures
                // Example: gameState.scores[player] += capturedTiles.length;
            }
        } // Ensure this brace correctly closes the placement success block

        // Update turn
            game.P2 = playerName;
            game.status = 'active'; // Set game status to active
            // Notify P2 (joining player)
            socket.emit('game-start', { gameId, player: 'P2', playerNames: playerNames, initialState: initialState });

            // Notify P1
            const p1SocketId = Object.keys(game.players).find(id => game.players[id].player === 'P1');
            if (p1SocketId && io.sockets.sockets.get(p1SocketId)) {
                io.sockets.sockets.get(p1SocketId).emit('game-start', { gameId, player: 'P1', playerNames: playerNames, initialState: initialState });
                console.log(`Sent game-start to P1 (${p1SocketId})`);
            } else {
                console.error(`Could not find P1 socket (${p1SocketId}) for game ${gameId} to send game-start`);
                // Handle potential error - maybe P1 disconnected right before P2 joined?
                 socket.emit('game-error', 'Could not notify Player 1. They may have disconnected.');
                 // Clean up P2's join attempt? Or let disconnect handle it?
                 // For now, P2 is technically in, but P1 won't get the message.
            }
        } else {
            socket.emit('game-error', 'Cannot join game. It might be full or in an invalid state.');
            console.warn(`Join attempt failed for ${gameId} by ${socket.id}. Player count: ${game.playerCount}, Game state exists: ${!!game.gameState}`);
        }
    } catch (error) {
         console.error(`[join-game] Error for ${socket.id} joining ${gameId}:`, error);
         socket.emit('game-error', 'Server error joining game.');
    }
});

// --- Tile Placement ---
socket.on('place-tile', ({ gameId, q, r, color }) => {
    try {
        const game = games[gameId];
        const playerInfo = players[socket.id];

        // Basic validation
        if (!game || !playerInfo || playerInfo.gameId !== gameId) {
             console.error(`[place-tile] Invalid game/player state for ${socket.id} in game ${gameId}`);
             socket.emit('game-error', 'Invalid game or player state.');
             return;
        }
        if (!game.gameState) {
             console.error(`[place-tile] Game state not initialized for ${gameId}`);
             socket.emit('game-error', 'Game state not initialized yet.');
             return;
        }
         if (playerInfo.player !== 'P1' && playerInfo.player !== 'P2') {
              socket.emit('game-error', 'Spectators cannot place tiles.');
              return;
         }

        const playerRole = playerInfo.player;
        const currentPlayerTurn = game.gameState.currentPlayer;

        if (playerRole !== currentPlayerTurn) {
            socket.emit('game-error', `Not your turn. It's ${currentPlayerTurn}'s turn.`);
            return;
        }
        if (playerRole !== color) {
            socket.emit('game-error', `Invalid color selection. You are ${playerRole}, tried to place ${color}.`);
            return;
        }

        // Attempt to place tile using GameState logic
        const result = game.gameState.placeTile(q, r, color);

        if (result.success) {
            console.log(`[${gameId}] Tile placed at (${q}, ${r}) by ${playerRole}. Turn: ${game.gameState.currentPlayer}`);
            const newState = game.gameState.serialize();
            io.to(gameId).emit('update-state', newState); // Broadcast updated state

            if (result.winner) {
                console.log(`[${gameId}] Game Over. Winner: ${result.winner}`);
                io.to(gameId).emit('game-over', { winner: result.winner, winningPath: result.winningPath });
                // Optional: Clean up finished games after a delay?
                // setTimeout(() => { delete games[gameId]; }, 60000); // Example: remove after 1 min
            }
        } else {
            socket.emit('game-error', result.error || 'Invalid move.');
            console.log(`[${gameId}] Invalid move by ${playerRole} at (${q}, ${r}): ${result.error}`);
        }
    } catch (error) {
        console.error(`[place-tile] Error processing move in ${gameId} by ${socket.id}:`, error);
        socket.emit('game-error', 'An server error occurred processing the move.');
    }
});

// --- Chat Messages ---
socket.on('send-message', ({ gameId, message }) => {
    try {
        const playerInfo = players[socket.id];
        const game = games[gameId];

        if (!playerInfo || playerInfo.gameId !== gameId || !game) {
             console.warn(`[send-message] Unauthorized attempt by ${socket.id} for game ${gameId}`);
            socket.emit('game-error', 'You are not in this game.');
            return;
        }
         if (!message || typeof message !== 'string' || message.trim().length === 0) {
             socket.emit('game-error', 'Message cannot be empty.');
             return;
         }

        let senderName = 'Spectator'; // Default
        if (playerInfo.player === 'P1' || playerInfo.player === 'P2') {
            senderName = game.players[socket.id]?.name || `Player (${playerInfo.player})`;
        }

        const messageData = {
            sender: senderName,
            text: message.substring(0, 200) // Sanitize/limit length
        };

        io.to(gameId).emit('chat-message', messageData);
         console.log(`[${gameId}] Chat from ${senderName}: ${messageData.text}`);

    } catch (error) {
         console.error(`[send-message] Error processing message in ${gameId} from ${socket.id}:`, error);
         socket.emit('game-error', 'Server error sending message.');
    }
});


// --- Disconnection ---
socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id}, Reason: ${reason}`);
    const playerInfo = players[socket.id];

    if (playerInfo && playerInfo.gameId) {
        const gameId = playerInfo.gameId;
        const game = games[gameId];

        if (game) {
            const playerName = game.players[socket.id]?.name || playerInfo.player; // Get name before deleting

            // If a player (P1 or P2) disconnected
            if (playerInfo.player === 'P1' || playerInfo.player === 'P2') {
                console.log(`Player ${playerName} (${playerInfo.player}) disconnected from game ${gameId}`);
                io.to(gameId).emit('player-disconnected', { player: playerInfo.player, playerName: playerName });

                // Forfeit game if not already over
                if (game.gameState && !game.gameState.winner) {
                     const winner = playerInfo.player === 'P1' ? 'P2' : 'P1';
                     game.gameState.winner = winner; // Mark winner in state
                     console.log(`Game ${gameId} ended. Winner: ${winner} due to disconnect.`);
                     io.to(gameId).emit('game-over', { winner: winner, reason: 'Opponent disconnected' });
                }

                // Clean up player entry
                delete game.players[socket.id];
                game.playerCount = Object.keys(game.players).length;

                // If player count drops to zero, consider cleaning up spectators too? Or let them stay?
                // if (game.playerCount === 0 && game.spectators.size === 0) {
                //     delete games[gameId];
                //     console.log(`Game ${gameId} removed (no players or spectators).`);
                // }

            }
            // If a spectator disconnected
            else if (playerInfo.player === 'Spectator') {
                game.spectators.delete(socket.id);
                console.log(`Spectator ${socket.id} left game ${gameId}`);
                // if (game.playerCount === 0 && game.spectators.size === 0) {
                //    delete games[gameId];
                //    console.log(`Game ${gameId} removed (no players or spectators).`);
                // }
            }
        } else {
             console.log(`User ${socket.id} disconnected, but their game ${gameId} was not found.`);
        }
    } else {
        console.log(`User ${socket.id} disconnected, was not in any tracked game.`);
    }
    // Clean up player tracking map entry regardless
    delete players[socket.id];
});

}); // End of io.on('connection', ...)

// Start the server
server.listen(port, () => {
console.log(`Server listening on port ${port}`);
// Verify static path - adjust if root directory is different relative to server.js
const staticPath = path.join(__dirname, '..');
console.log(`Attempting to serve static files from: ${staticPath}`);
// Log CORS config (ensure '*' is intended or replace with specific origin)
console.log(`Allowing CORS from origin: *`);
});
                tile.color = expectedColor;
                changed = true;
            }
            stillRecovering.push(tileInfo); // Keep in list
        }
    });

    game.explodedTiles = stillRecovering;
    // Note: 'changed' flag isn't used here, but could be for optimization if needed.
}

// Switch Player Turn (Server Side)
function switchPlayerTurnServer(game) {
    game.currentPlayer = 3 - game.currentPlayer; // Toggle 1 and 2
    console.log(`Game ${game.id}: Switched turn. Now Player ${game.currentPlayer}'s turn.`);
}

// Check Game Over (Server Side) - Call *after* switching turn
function checkForGameOverServer(game) {
    const currentPlayer = game.currentPlayer;
    const playerTiles = currentPlayer === 1 ? game.player1Tiles : game.player2Tiles;
    const playerColor = currentPlayer === 1 ? game.player1Color : game.player2Color;
    const opponentColor = currentPlayer === 1 ? game.player2Color : game.player1Color;

    // Check if any available color leads to a capture
    const availableColors = COLORS.filter(c => c !== playerColor && c !== opponentColor);
    for (const color of availableColors) {
        if (getCaptureableTilesServer(game, currentPlayer, color).size > 0) {
            return false; // Found a valid move
        }
    }
    // No valid moves found
    return true;
}

// Handle Game Over State (Server Side)
function handleGameOverServer(game) {
    game.gameOver = true;
    game.gameStarted = false; // Mark as not actively playing

    const p1Score = game.player1Tiles.length;
    const p2Score = game.player2Tiles.length;

    if (p1Score > p2Score) game.winner = 1;
    else if (p2Score > p1Score) game.winner = 2;
    else game.winner = 0; // Tie

    const winnerName = game.winner === 1 ? (game.players.find(p=>p.number===1)?.name || 'P1')
                     : game.winner === 2 ? (game.players.find(p=>p.number===2)?.name || 'P2')
                     : 'Tie';
    const message = game.winner === 0 ? `Game Over! It's a tie (${p1Score} - ${p2Score})` : `Game Over! ${winnerName} wins! (${p1Score} - ${p2Score})`;
    console.log(`Game ${game.id}: ${message}`);

    // Emit a specific 'game-over' event
    io.to(game.id).emit('game-over', {
        message: message,
        winner: game.winner, // 0 for tie, 1 or 2
        scores: { 1: p1Score, 2: p2Score },
        // Optionally send final gameState if needed for display
        gameState: {
             board: game.board, // Send final board state
             currentPlayer: game.currentPlayer, // Player who couldn't move
             player1Tiles: game.player1Tiles,
             player2Tiles: game.player2Tiles,
             gameOver: true,
             winner: game.winner
             // Include other relevant final state fields
        }
    });
}

// Get Neighbors (Server Side)
function getNeighborsServer(row, col) {
    const neighbors = [];
    const directions = row % 2 === 0 ?
        [ [-1, 0], [-1, -1], [0, -1], [+1, -1], [+1, 0], [0, +1] ] // Even rows
      : [ [-1, +1], [-1, 0], [0, -1], [+1, 0], [+1, +1], [0, +1] ]; // Odd rows

    for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            neighbors.push({ row: nr, col: nc });
        }
    }
    return neighbors;
}

// Get Tile (Server Side Utility)
function getTileServer(board, row, col) {
    return board?.[row]?.[col];
}

// Get Owner (Server Side Utility: 0, 1, or 2)
function getOwnerServer(game, row, col) {
    const key = `${row},${col}`;
    if (game.player1Tiles.includes(key)) return 1;
    if (game.player2Tiles.includes(key)) return 2;
    return 0;
}


// Find Captureable Tiles (Server Side BFS) - Returns Set of keys 'r,c'
function getCaptureableTilesServer(game, playerNumber, targetColor) {
    const capturable = new Set();
    const queue = [];
    const visited = new Set();
    const playerTiles = playerNumber === 1 ? game.player1Tiles : game.player2Tiles;

    // 1. Find initial candidates adjacent to player's territory
    for (const tileKey of playerTiles) {
        const [row, col] = tileKey.split(',').map(Number);
        const neighbors = getNeighborsServer(row, col);

        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.row},${neighbor.col}`;
            const neighborTile = getTileServer(game.board, neighbor.row, neighbor.col);

            // Check: exists, is unowned, matches target color, not visited/queued
            if (neighborTile &&
                getOwnerServer(game, neighbor.row, neighbor.col) === 0 &&
                neighborTile.color === targetColor &&
                !visited.has(neighborKey))
            {
                visited.add(neighborKey);
                queue.push(neighbor);
            }
        }
    }

    // 2. BFS from candidates
    while (queue.length > 0) {
        const current = queue.shift();
        const currentKey = `${current.row},${current.col}`;
        capturable.add(currentKey);

        const neighbors = getNeighborsServer(current.row, current.col);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.row},${neighbor.col}`;
            const neighborTile = getTileServer(game.board, neighbor.row, neighbor.col);

            // Expand if: exists, is unowned, matches target, not visited
             if (neighborTile &&
                 getOwnerServer(game, neighbor.row, neighbor.col) === 0 &&
                 neighborTile.color === targetColor &&
                 !visited.has(neighborKey))
             {
                 visited.add(neighborKey);
                 queue.push(neighbor);
             }
        }
    }
    return capturable;
}


// --- Utility Functions ---

// Generate a unique-ish game code
function generateGameCode() {
  // Simple 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Handle player disconnection/leaving
function handleDisconnect(socket, reason) {
     console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
     if (players.has(socket.id)) {
         const gameId = players.get(socket.id);
         players.delete(socket.id); // Remove from player map

         if (activeGames.has(gameId)) {
             const game = activeGames.get(gameId);
             const playerIndex = game.players.findIndex(p => p.id === socket.id);

             if (playerIndex !== -1) {
                 const playerNumber = game.players[playerIndex].number;
                 const playerName = game.players[playerIndex].name;
                 game.players.splice(playerIndex, 1); // Remove player from game

                 console.log(`Player ${playerName} (P${playerNumber}) removed from game ${gameId}.`);

                 // If game was active, notify remaining player and end game
                 if (game.gameStarted && !game.gameOver) {
                     handleGameOverServer(game); // Mark game as over
                     game.winner = game.players[0]?.number || 0; // Remaining player wins (or tie if 0 left?)
                      io.to(gameId).emit('player-disconnected', {
                          playerNumber,
                          playerName,
                          message: `${playerName} disconnected. Game over.`
                      });
                     // Send final state update *before* marking game over maybe? Or just rely on client handling the disconnect message.
                     // Let's send the final update.
                     broadcastGameState(gameId, game); // Send the final state
                 } else {
                     // If game hadn't started, just notify if anyone is left
                      io.to(gameId).emit('player-disconnected', {
                          playerNumber,
                          playerName,
                          message: `${playerName} left before game started.`
                      });
                 }


                 // If no players left, delete the game
                 if (game.players.length === 0) {
                     activeGames.delete(gameId);
                     console.log(`Game ${gameId} removed (no players left).`);
                 }
             }
         }
     }
}


// Cleanup inactive games (e.g., every 30 minutes)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  const TIMEOUT = 30 * 60 * 1000; // 30 minutes

  activeGames.forEach((game, gameId) => {
    if (now - game.lastActivity > TIMEOUT) {
      console.log(`Cleaning up inactive game ${gameId}. Last activity: ${new Date(game.lastActivity).toISOString()}`);
      // Notify players in room?
      io.to(gameId).emit('game-error', { message: 'Game timed out due to inactivity.' });
      // Clean up
      game.players.forEach(p => {
          if (players.has(p.id)) {
              players.delete(p.id);
          }
          const playerSocket = io.sockets.sockets.get(p.id);
          if (playerSocket) {
              playerSocket.leave(gameId);
              // playerSocket.disconnect(true); // Force disconnect? Might be harsh.
          }
      });
      activeGames.delete(gameId);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} inactive games.`);
  console.log(`Socket ${socket.id} disconnected`);
    // Additional cleanup if needed
  });
});

// Optional: Explicitly handle the root path to ensure index.html is served
// This might be redundant if express.static works correctly, but can help debugging.
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '..', 'index.html'));
// });

  });

    console.log(\`Server listening on port \${PORT}\`);
}); // Corrected: Removed the potentially extra parenthesis if it was nested incorrectly. Ensure brace matching.
});