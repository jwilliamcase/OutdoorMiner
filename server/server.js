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

// --- Server Setup ---
const server = http.createServer(app);
const io = socketIo(server, {
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
        socket.emit('game-error', { message: 'Internal server error processing move.' });
    }
  });

    // Handle game restart request
    socket.on('request-restart', (data) => {
        try {
            const { gameId } = data;
            if (!activeGames.has(gameId)) return;
            const game = activeGames.get(gameId);

            // Simple implementation: Just notify players, let P1 re-trigger initialize-game
            console.log(`Restart requested for game ${gameId} by ${socket.id}`);

            // Reset server state partially (keep players)
            game.initialStateProvided = false;
            game.board = null;
            game.gameStarted = false;
            game.gameOver = false;
            game.winner = null;
            game.currentPlayer = 1; // Reset to P1 turn for init
            // Mark players as not ready? Or just wait for P1 init
            game.players.forEach(p => p.isReady = false);

            // Notify all players in the room to reset their local state and wait
            io.to(gameId).emit('game-restarted', { message: "Game restarting. Waiting for Player 1 to set up..." });

        } catch (error) {
            console.error(`Error restarting game ${data?.gameId} by ${socket.id}:`, error);
            socket.emit('game-error', { message: 'Internal server error restarting game.' });
        }
    });

    // Handle chat messages
    socket.on('send-message', (data) => {
        try {
            const { gameId, playerNumber, playerName, message, isTaunt } = data;
            if (!activeGames.has(gameId)) return;
            const game = activeGames.get(gameId);

            // Find sender's current name from game state for consistency
            const sender = game.players.find(p => p.number === playerNumber);
            const name = sender?.name || playerName || `Player ${playerNumber}`;

            // Use 'chat-message' to match the client listener added in the rewrite
            io.to(gameId).emit('chat-message', {
                playerNumber, // Keep playerNumber to determine if 'isMine' client-side
                playerName: name,
                message,
                isTaunt: isTaunt || false,
                timestamp: Date.now()
            });
        } catch (error) {
             console.error(`Error handling chat message for ${socket.id} in game ${data?.gameId}:`, error);
             // Don't necessarily need to emit error to client for chat issues
        }
    });

    // Handle player leaving notification (optional, supplements disconnect)
    socket.on('leave-game', (data) => {
         handleDisconnect(socket, "Player explicitly left game.");
    });


  // Disconnect handling
  socket.on('disconnect', (reason) => {
      handleDisconnect(socket, reason);
  });
}); // End io.on('connection')


// --- Server Game Logic Functions ---

// Starts the game once both players are ready and P1 has provided state
function startGame(gameId) {
  if (!activeGames.has(gameId)) return;
  const game = activeGames.get(gameId);

  if (game.gameStarted) {
      console.warn(`Attempted to start already started game: ${gameId}`);
      return;
  }
   if (game.players.length < 2) {
       console.warn(`Attempted to start game ${gameId} with only ${game.players.length} player(s).`);
       return;
   }
   if (!game.initialStateProvided) {
       console.warn(`Attempted to start game ${gameId} before Player 1 provided initial state.`);
       return;
   }


  game.gameStarted = true;
  game.gameOver = false;
  game.winner = null;
  game.lastActivity = Date.now();
  console.log(`Game ${gameId} started! Player 1: ${game.players[0]?.name}, Player 2: ${game.players[1]?.name}. P1 starts.`);

  // Emit 'game-setup' with the necessary initial state for both players
  const player1 = game.players.find(p => p.number === 1);
  const player2 = game.players.find(p => p.number === 2);

  // Prepare the initial state payload common to both players
  const commonInitialState = {
        board: game.board,
        currentPlayer: game.currentPlayer,
        player1Color: game.player1Color,
        player2Color: game.player2Color,
        player1Tiles: game.player1Tiles,
        player2Tiles: game.player2Tiles,
        player1PowerUps: game.player1PowerUps,
        player2PowerUps: game.player2PowerUps,
        landmines: game.landmines,
        explodedTiles: game.explodedTiles,
        gameStarted: true,
        gameOver: false,
        winner: null
  };

  // Send to Player 1
   if (player1) {
       io.to(player1.id).emit('game-setup', {
           gameId: game.id,
           playerNumber: 1,
           playerNames: { 1: player1.name, 2: player2?.name || 'Player 2' }, // Send both names
           playerColors: { 1: game.player1Color, 2: game.player2Color }, // Send both starting colors
           initialGameState: commonInitialState
       });
   }
  // Send to Player 2
  if (player2) {
       io.to(player2.id).emit('game-setup', {
           gameId: game.id,
           playerNumber: 2,
           playerNames: { 1: player1?.name || 'Player 1', 2: player2.name }, // Send both names
           playerColors: { 1: game.player1Color, 2: game.player2Color }, // Send both starting colors
           initialGameState: commonInitialState
       });
   }
}

// Broadcasts the current game state to all players in the room
function broadcastGameState(gameId, game) {
    if (!game || !game.gameStarted || game.gameOver) return; // Only send updates for active games

    const player1 = game.players.find(p => p.number === 1);
    const player2 = game.players.find(p => p.number === 2);

    const stateToSend = {
        // Core state
        board: game.board, // Could be optimized to send only changes? Large state.
        currentPlayer: game.currentPlayer,
        player1Color: game.player1Color,
        player2Color: game.player2Color,
        player1Tiles: game.player1Tiles,
        player2Tiles: game.player2Tiles,
        player1PowerUps: game.player1PowerUps,
        player2PowerUps: game.player2PowerUps,
        landmines: game.landmines,
        explodedTiles: game.explodedTiles, // Send recovery state
        // Meta state
        gameStarted: game.gameStarted,
        gameOver: game.gameOver,
        winner: game.winner,
        // Player info
        player1Name: player1?.name || 'Player 1',
        player2Name: player2?.name || 'Player 2'
        // Removed context fields updateType, moveDetails as they weren't used
    };

    // console.log(`Broadcasting game state for ${gameId}. CurrentPlayer: P${game.currentPlayer}`);
    // Emit 'game-state' for regular updates
    io.to(gameId).emit('game-state', stateToSend);
}


// Handle Color Selection Move (Server Side)
// Returns true if a mine was triggered, false otherwise
function handleColorSelectionServer(game, playerNumber, selectedColor) {
    const playerTiles = playerNumber === 1 ? game.player1Tiles : game.player2Tiles;
    const opponentTiles = playerNumber === 1 ? game.player2Tiles : game.player1Tiles;
    const playerColorProp = playerNumber === 1 ? 'player1Color' : 'player2Color';
    const opponentColorProp = playerNumber === 1 ? 'player2Color' : 'player1Color';

    // Basic validation: Can't pick own or opponent's current color
    if (selectedColor === game[playerColorProp] || selectedColor === game[opponentColorProp]) {
        console.warn(`Game ${game.id}: Player ${playerNumber} tried invalid color ${selectedColor}.`);
        // Technically should have been caught client-side, but good to prevent server error.
        // How to handle? Ignore? Send error? For now, ignore & proceed (will capture 0).
        // Or maybe just switch turn? Let's switch turn to penalize slightly.
        // switchPlayerTurnServer(game); // Reconsider this, might be harsh. Let it capture 0 for now.
    }

    // Update player's color
    game[playerColorProp] = selectedColor;

    // Calculate capturable tiles based on *server* state
    const capturable = getCaptureableTilesServer(game, playerNumber, selectedColor);
    const capturedTileKeys = Array.from(capturable); // ['r,c', ...]

    console.log(`Game ${game.id}: Player ${playerNumber} selects ${selectedColor}, captures ${capturedTileKeys.length} tiles.`);

    let mineTriggered = null;
    capturedTileKeys.forEach(key => {
        // Add to player's tiles
        if (!playerTiles.includes(key)) { // Avoid duplicates if somehow possible
            playerTiles.push(key);
        }
        // Check for mine trigger
        const [row, col] = key.split(',').map(Number);
        if (game.landmines.some(mine => mine.row === row && mine.col === col)) {
            if (!mineTriggered) { // Only trigger first mine encountered in capture batch
                 mineTriggered = { row, col };
            }
        }
        // Ensure tile color matches player's new color on board
        const tile = getTileServer(game.board, row, col);
        if (tile) tile.color = selectedColor; // Update board color too
    });

    if (mineTriggered) {
        console.log(`Game ${game.id}: Player ${playerNumber} triggered mine at ${mineTriggered.row},${mineTriggered.col} via color selection.`);
        triggerLandmineExplosionServer(game, playerNumber, mineTriggered.row, mineTriggered.col);
        return true; // Mine was triggered
    }

    return false; // No mine triggered
}

// Handle Power-Up Move (Server Side)
// Returns true if a mine was triggered (only via Teleport), false otherwise
function handlePowerUpServer(game, playerNumber, move) {
    const { powerUpType, row, col } = move;
    const playerPowerUps = playerNumber === 1 ? game.player1PowerUps : game.player2PowerUps;
    const playerTiles = playerNumber === 1 ? game.player1Tiles : game.player2Tiles;
    const playerColor = playerNumber === 1 ? game.player1Color : game.player2Color;

    // 1. Verify player has the power-up
    const powerUpIndex = playerPowerUps.indexOf(powerUpType);
    if (powerUpIndex === -1) {
        throw new Error(`Player ${playerNumber} does not have power-up ${powerUpType}.`);
    }

    // 2. Validate target based on power-up type and server state
    const targetTile = getTileServer(game.board, row, col);
    if (!targetTile) throw new Error(`Invalid target tile coordinates: ${row}, ${col}`);

    const targetKey = `${row},${col}`;
    const targetOwner = getOwnerServer(game, row, col); // 0 = unowned, 1, 2
    const isMyTile = targetOwner === playerNumber;
    const isOpponentTile = targetOwner !== 0 && targetOwner !== playerNumber;
    const isUnclaimed = targetOwner === 0;

    let mineTriggered = false;

    switch (powerUpType) {
        case POWER_UPS.SABOTAGE:
            if (!isOpponentTile) throw new Error("Sabotage must target an opponent's tile.");
            // Apply effect
            applySabotageServer(game, row, col);
            break;

        case POWER_UPS.WILDCARD:
            if (!isUnclaimed) throw new Error("Wildcard must target an unclaimed tile.");
            // Check adjacency
            const neighbors = getNeighborsServer(row, col);
            const isAdjacent = neighbors.some(n => playerTiles.includes(`${n.row},${n.col}`));
            if (!isAdjacent) throw new Error("Wildcard must target an unclaimed tile adjacent to yours.");
            // Apply effect
            applyWildcardServer(game, playerNumber, row, col);
            break;

        case POWER_UPS.TELEPORT:
            if (!isUnclaimed) throw new Error("Teleport must target an unclaimed tile.");
            // Apply effect
            mineTriggered = applyTeleportServer(game, playerNumber, row, col);
            break;

        default:
            throw new Error(`Unknown power-up type for validation: ${powerUpType}`);
    }

    // 3. Consume the power-up
    playerPowerUps.splice(powerUpIndex, 1);
    console.log(`Game ${game.id}: Player ${playerNumber} used ${powerUpType} on ${row},${col}. Remaining: ${playerPowerUps.length}`);

    return mineTriggered; // Return if teleport hit a mine
}


// Server-side application functions
function applySabotageServer(game, row, col) {
    const tileKey = `${row},${col}`;
    const tile = getTileServer(game.board, row, col);
    if (!tile) return;

    // Remove from opponent's tiles
    game.player1Tiles = game.player1Tiles.filter(key => key !== tileKey);
    game.player2Tiles = game.player2Tiles.filter(key => key !== tileKey);

    // Change color and add to recovery list (avoid duplicates)
    tile.color = SABOTAGE_COLOR;
    if (!game.explodedTiles.some(et => et.row === row && et.col === col)) {
        game.explodedTiles.push({ row, col, turnsLeft: EXPLOSION_RECOVERY_TURNS, type: 'sabotage' });
    }
}

function applyWildcardServer(game, playerNumber, row, col) {
    const tileKey = `${row},${col}`;
    const tile = getTileServer(game.board, row, col);
    if (!tile) return;
    const playerTiles = playerNumber === 1 ? game.player1Tiles : game.player2Tiles;
    const playerColor = playerNumber === 1 ? game.player1Color : game.player2Color;

    // Add to player's territory (avoid duplicates)
    if (!playerTiles.includes(tileKey)) {
         playerTiles.push(tileKey);
    }
    // Update tile color
    tile.color = playerColor;
}

// Returns true if mine triggered, false otherwise
function applyTeleportServer(game, playerNumber, row, col) {
    const tileKey = `${row},${col}`;
    const tile = getTileServer(game.board, row, col);
    if (!tile) return false;
    const playerTiles = playerNumber === 1 ? game.player1Tiles : game.player2Tiles;
    const playerColor = playerNumber === 1 ? game.player1Color : game.player2Color;

    // Add to player's territory (avoid duplicates)
    if (!playerTiles.includes(tileKey)) {
         playerTiles.push(tileKey);
    }
    // Update tile color
    tile.color = playerColor;

    // Check for mine AFTER claiming
    if (game.landmines.some(mine => mine.row === row && mine.col === col)) {
        console.log(`Game ${game.id}: Player ${playerNumber} triggered mine at ${row},${col} via teleport.`);
        triggerLandmineExplosionServer(game, playerNumber, row, col);
        return true; // Mine triggered
    }
    return false; // No mine
}


// Trigger Landmine Explosion (Server Side)
function triggerLandmineExplosionServer(game, triggeringPlayer, row, col) {
    const explosionCenterKey = `${row},${col}`;
    const tile = getTileServer(game.board, row, col);
    if (!tile) return;

    // Remove the mine
    game.landmines = game.landmines.filter(mine => !(mine.row === row && mine.col === col));
    if (tile) tile.hasMine = false;

    // Identify affected tiles (center + neighbors)
    const affectedCoords = [...getNeighborsServer(row, col), { row, col }];

    // Apply effects
    affectedCoords.forEach(coord => {
        const currentTile = getTileServer(game.board, coord.row, coord.col);
        if (currentTile) {
            const key = `${coord.row},${coord.col}`;
            // Remove ownership
            game.player1Tiles = game.player1Tiles.filter(k => k !== key);
            game.player2Tiles = game.player2Tiles.filter(k => k !== key);
            // Change color
            currentTile.color = EXPLOSION_COLOR;
            // Add to recovery list (avoid duplicates)
             if (!game.explodedTiles.some(et => et.row === coord.row && et.col === coord.col)) {
                 game.explodedTiles.push({ row: coord.row, col: coord.col, turnsLeft: EXPLOSION_RECOVERY_TURNS, type: 'explosion' });
             }
        }
    });

    // Handle disconnected territories after removal
    handleDisconnectedTerritoriesServer(game, 1);
    handleDisconnectedTerritoriesServer(game, 2);

    // Shuffle unclaimed tiles immediately? Or rely on client visual? Server state doesn't *need* shuffle.
    // Let's skip server-side shuffle for now to keep state deterministic post-explosion.

    // Explosion counts as the player's turn ending. Switch turn.
    switchPlayerTurnServer(game);
}

// Find and remove disconnected territories for a player (Server Side)
function handleDisconnectedTerritoriesServer(game, playerNumber) {
    const playerTiles = playerNumber === 1 ? game.player1Tiles : game.player2Tiles;
    if (playerTiles.length <= 1) return; // Can't disconnect 0 or 1 tile

    const segments = findDisconnectedSegmentsServer(game, playerTiles);

    if (segments.length > 1) {
        console.log(`Game ${game.id}: Player ${playerNumber} territory split into ${segments.length} segments.`);
        // Find the largest segment
        let largestSegment = segments[0];
        for (let i = 1; i < segments.length; i++) {
            if (segments[i].length > largestSegment.length) {
                largestSegment = segments[i];
            }
        }
        console.log(`Keeping largest segment with ${largestSegment.length} tiles for Player ${playerNumber}.`);
        // Update the player's tile list to be only the largest segment
        if (playerNumber === 1) {
            game.player1Tiles = largestSegment;
        } else {
            game.player2Tiles = largestSegment;
        }
        // Tiles in other segments implicitly become unowned (board color might need updating later if necessary)
    }
}

// Find segments using BFS (Server Side) - returns array of arrays of keys
function findDisconnectedSegmentsServer(game, playerTileKeys) {
    const segments = [];
    const visited = new Set();

    for (const startTileKey of playerTileKeys) {
        if (visited.has(startTileKey)) continue;

        const currentSegmentKeys = [];
        const queue = [startTileKey];
        visited.add(startTileKey);
        currentSegmentKeys.push(startTileKey);

        while (queue.length > 0) {
            const tileKey = queue.shift();
            const [row, col] = tileKey.split(',').map(Number);

            const neighbors = getNeighborsServer(row, col);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;
                // Check if neighbor exists, is owned by player, and not visited
                const neighborTile = getTileServer(game.board, neighbor.row, neighbor.col);
                if (neighborTile && playerTileKeys.includes(neighborKey) && !visited.has(neighborKey)) {
                    visited.add(neighborKey);
                    currentSegmentKeys.push(neighborKey);
                    queue.push(neighborKey);
                }
            }
        }
        segments.push(currentSegmentKeys);
    }
    return segments;
}


// Award Power-Up (Server Side)
function checkForPowerUpAward(game, playerNumber) {
    // This needs access to the number of tiles *just captured*.
    // Modify handleColorSelectionServer to return capture count or calculate it here.
    // For now, let's assume handleColorSelectionServer calculated `lastCaptureCount`.
    // This logic needs refinement. Let's simplify: Award randomly after *any* successful color move.
    // Proper implementation would check capture count.

    const powerUpTypes = Object.values(POWER_UPS);
    const randomPowerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    const playerPowerUps = playerNumber === 1 ? game.player1PowerUps : game.player2PowerUps;
    playerPowerUps.push(randomPowerUp);
    console.log(`Game ${game.id}: Awarded ${randomPowerUp} to Player ${playerNumber}. Total: ${playerPowerUps.length}`);
    return true; // Indicate power-up was awarded
}

// Process Recovery of Exploded Tiles (Server Side)
function processExplodedTilesRecoveryServer(game) {
    const stillRecovering = [];
    let changed = false;

    game.explodedTiles.forEach(tileInfo => {
        tileInfo.turnsLeft--;
        const tile = getTileServer(game.board, tileInfo.row, tileInfo.col);
        if (!tile) return;

        if (tileInfo.turnsLeft <= 0) {
            // Fully recovered - assign random neutral color
            const availableColors = COLORS.filter(c => c !== game.player1Color && c !== game.player2Color);
            tile.color = availableColors.length > 0
                ? availableColors[Math.floor(Math.random() * availableColors.length)]
                : COLORS[0]; // Fallback
            changed = true;
        } else {
            // Still recovering - ensure color is correct (black/red)
            const expectedColor = tileInfo.type === 'sabotage' ? SABOTAGE_COLOR : EXPLOSION_COLOR;
            if (tile.color !== expectedColor) {
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


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});