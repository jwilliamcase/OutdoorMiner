const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // Allow all origins for easier debugging
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false  // Changed to false to avoid preflight issues
  }
});

// Middleware
app.use(cors({
  origin: "*",  // Allow all origins for easier debugging
  methods: ["GET", "POST", "OPTIONS"],
  credentials: false  // Changed to false to avoid preflight issues
}));
app.use(express.json());

// Store active games
const activeGames = new Map();
// Store players (socketId -> gameId)
const players = new Map();

// Routes
app.get('/', (req, res) => {
  res.send('Outdoor Miner Game Server Running');
});

// Debug route for checking CORS
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    clientOrigin: req.headers.origin || 'unknown',
    serverTime: new Date().toISOString(),
    message: 'Server is running and CORS is properly configured'
  });
});

// Socket.io handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  
  // Create a new game
  socket.on('create-game', (data) => {
    const gameId = generateGameCode();
    const playerName = data?.playerName || 'Player 1';
    
    // Create game object
    const gameState = {
      id: gameId,
      players: [
        { id: socket.id, socketId: socket.id, number: 1, ready: false, name: playerName }
      ],
      player1Name: playerName, // Store player 1's name directly
      player2Name: null,       // Initialize player 2's name as null
      board: null,
      currentPlayer: 1,
      player1Color: null,
      player2Color: null,
      player1Tiles: [],
      player2Tiles: [],
      player1PowerUps: [],
      player2PowerUps: [],
      landmines: [],
      started: false,
      lastActivity: Date.now()
    };
    
    // Store the game
    activeGames.set(gameId, gameState);
    players.set(socket.id, gameId);
    
    console.log(`Game created: ${gameId} by player ${socket.id} (${playerName})`);
    
    // Join the socket to a room with the game ID
    socket.join(gameId);
    
    // Send the game code to the client
    socket.emit('game-created', { gameId, playerNumber: 1, playerName: playerName });
  });
  
  // Join an existing game
  socket.on('join-game', (data) => {
    const { gameId, playerName } = data;
    
    // Check if the game exists
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Check if the game is full
    if (game.players.length >= 2) {
      socket.emit('game-error', { message: 'Game is full' });
      return;
    }
    
    // Add player to the game
    const name = playerName || 'Player 2';
    game.players.push({ id: socket.id, socketId: socket.id, number: 2, ready: false, name: name });
    players.set(socket.id, gameId);
    game.player2Name = name; // Store player 2's name

    // Join the socket to the game room
    socket.join(gameId);

    console.log(`Player ${socket.id} (${name}) joined game ${gameId}`);

    // Notify joining player and room about player join, include names in game-joined response
    socket.emit('game-joined', { gameId, playerNumber: 2, player1Name: game.player1Name, player2Name: game.player2Name });
    io.to(gameId).emit('player-joined', { playerNumber: 2, playerName: name, player1Name: game.player1Name, player2Name: game.player2Name });
  });
  
  // Initialize game with board state
  socket.on('initialize-game', (data) => {
    const { gameId, gameData } = data;
    
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Update game state with initial board data
    game.board = gameData.board;
    game.player1Color = gameData.player1Color;
    game.player2Color = gameData.player2Color;
    game.player1Tiles = gameData.player1Tiles;
    game.player2Tiles = gameData.player2Tiles;
    game.landmines = gameData.landmines;
    game.started = true;
    game.lastActivity = Date.now();
    
    // Mark the player as ready
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      game.players[playerIndex].ready = true;
    }
    
    // Check if both players are ready
    const allReady = game.players.every(p => p.ready);
    
    if (allReady) {
      // Log state before sending
      console.log(`Game ${gameId} starting with board state:`, {
        player1Tiles: game.player1Tiles.length,
        player2Tiles: game.player2Tiles.length,
        p1Name: game.player1Name,
        p2Name: game.player2Name
      });

      // Broadcast game state to all players, using names directly from gameState
      io.to(gameId).emit('game-started', { gameState: {
        board: game.board,
        currentPlayer: game.currentPlayer,
        player1Color: game.player1Color,
        player2Color: game.player2Color,
        player1Tiles: game.player1Tiles,
        player2Tiles: game.player2Tiles,
        player1PowerUps: game.player1PowerUps,
        player2PowerUps: game.player2PowerUps,
        landmines: game.landmines,
        player1Name: game.player1Name, // Use names from gameState
        player2Name: game.player2Name  // Use names from gameState
      }});
    }
  });
  
  // Handle game moves
  socket.on('make-move', (data) => {
    const { gameId, playerNumber, playerName, move } = data;
    
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Special case for restart-game which doesn't require turn validation
    if (move.type === 'restart-game') {
      console.log(`Game ${gameId} restarted by player ${playerNumber}`);
      
      // Reset game state but keep the players
      game.board = null;
      game.currentPlayer = 1; // Player 1 always starts in a new game
      game.player1Color = null;
      game.player2Color = null;
      game.player1Tiles = [];
      game.player2Tiles = [];
      game.player1PowerUps = [];
      game.player2PowerUps = [];
      game.landmines = [];
      game.started = false;
      game.lastActivity = Date.now();
      
      // Notify all players about restart
      io.to(gameId).emit('game-restarted', {});
      return;
    }
    
    // Validate it's the player's turn for normal moves
    if (game.currentPlayer !== playerNumber) {
      socket.emit('game-error', { message: 'Not your turn' });
      return;
    }
    
    // Update game state based on the move
    // Move data should include color selection and any power-up usage
    
    // Example of updating color
    if (move.type === 'color-selection') {
      console.log(`- - - - - - - - - - - - - - - - - - - -`);
      console.log(`make-move: color-selection received from Player ${playerNumber}`);
      console.log(`Move data:`, move); // Log the entire move object

      if (playerNumber === 1) {
        game.player1Color = move.color;
      } else {
        game.player2Color = move.color;
      }
      
      // Always update both players' tiles to ensure consistency
      if (move.player1Tiles) {
        game.player1Tiles = move.player1Tiles;
      }

      if (move.player2Tiles) {
        game.player2Tiles = move.player2Tiles;
      }

      // Update colors if explicitly provided
      if (move.player1Color) {
        game.player1Color = move.player1Color;
      }

      if (move.player2Color) {
        game.player2Color = move.player2Color;
      }

      // Log the state after update for debugging
      console.log(`After move from Player ${playerNumber}:`);
      console.log(`- Player 1 tiles BEFORE move: ${game.player1Tiles.length}`);
      console.log(`- Player 2 tiles BEFORE move: ${game.player2Tiles.length}`);


      // Log state before tile updates
      console.log(`- - - - - - - - - - - - - - - - - - - -`);
      console.log(`- Player ${playerNumber} Tiles BEFORE move processing - P1 Tiles: ${game.player1Tiles.length}, P2 Tiles: ${game.player2Tiles.length}`);
      console.log(`- Move P1 Tiles Data:`, move.player1Tiles);
      console.log(`- Move P2 Tiles Data:`, move.player2Tiles);

      // Update tiles based on player number - CORRECTED LOGIC HERE
      if (playerNumber === 1) {
          if (move.player1Tiles) {
              game.player1Tiles = move.player1Tiles;
              console.log(`  Player 1: Updated P1 tiles based on move: count = ${game.player1Tiles.length}`);
          } else {
              console.log(`  Player 1: move.player1Tiles is empty or undefined`);
          }
          if (move.player2Tiles) {
              console.log(`  WARNING: Player 1 move included player2Tiles data, which is unusual and ignored.`);
          }
      } else if (playerNumber === 2) {
          if (move.player2Tiles) {
              game.player2Tiles = move.player2Tiles;
              console.log(`  Player 2: Updated P2 tiles based on move: count = ${game.player2Tiles.length}`);
          } else {
              console.log(`  Player 2: move.player2Tiles is empty or undefined`);
          }
          if (move.player1Tiles) {
              console.log(`  WARNING: Player 2 move included player1Tiles data, which is unusual and ignored.`);
          }
      }

      // Log state after tile updates
      console.log(`- Player ${playerNumber} Tiles AFTER move processing - P1 Tiles: ${game.player1Tiles.length}, P2 Tiles: ${game.player2Tiles.length}`);
      console.log(`- Game State P1 Tiles:`, game.player1Tiles);
      console.log(`- Game State P2 Tiles:`, game.player2Tiles);
      console.log(`- Player 1 color: ${game.player1Color}`);
      console.log(`- Player 2 color: ${game.player2Color}`);
      console.log(`- - - - - - - - - - - - - - - - - - - -`);

      // Switch turns
      game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
      console.log(`Game ${gameId}: Turn switched to Player ${game.currentPlayer}`); // Log turn switch
    
    // Example of power-up usage
    if (move.type === 'power-up') {
      // Update power-ups
      if (playerNumber === 1) {
        game.player1PowerUps = move.player1PowerUps;
      } else {
        game.player2PowerUps = move.player2PowerUps;
      }
      
      // Update tiles after power-up (if applicable)
      if (move.player1Tiles) game.player1Tiles = move.player1Tiles;
      if (move.player2Tiles) game.player2Tiles = move.player2Tiles;
      
      // Switch turns
      game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
    }
    
    // Example of landmine explosion
    if (move.type === 'landmine') {
      // Update tiles
      game.player1Tiles = move.player1Tiles;
      game.player2Tiles = move.player2Tiles;
      
      // Update landmines
      game.landmines = move.landmines;
      
      // Update board state (for explosion effects)
      if (move.updatedBoard) {
        game.board = JSON.parse(JSON.stringify(move.updatedBoard)); // Deep copy to avoid reference issues
      }
      
      // Switch turns
      game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
    }
    
    // Update last activity
    game.lastActivity = Date.now();
    
    // Log game state changes
    console.log(`Move by Player ${playerNumber}: ${move.type}. Now Player ${game.currentPlayer}'s turn.`);
    console.log(`Player 1 tiles: ${game.player1Tiles.length}, Player 2 tiles: ${game.player2Tiles.length}`);
    console.log(`Game ${gameId}: Emitting game-update event. Current Player: ${game.currentPlayer}`); // Log before emit

    // Broadcast the updated game state to all players, using names directly from gameState
    io.to(gameId).emit('game-update', { 
      type: move.type,
      gameState: {
        board: game.board,
        currentPlayer: game.currentPlayer,
        player1Color: game.player1Color,
        player2Color: game.player2Color,
        player1Tiles: game.player1Tiles,
        player2Tiles: game.player2Tiles,
        player1PowerUps: game.player1PowerUps,
        player2PowerUps: game.player2PowerUps,
        landmines: game.landmines,
        player1Name: game.player1Name, // Use names from gameState
        player2Name: game.player2Name, // Use names from gameState
        moveDetails: move
      } 
    });
  });
  
  // Chat and taunts system
  socket.on('send-message', (data) => {
    const { gameId, playerNumber, playerName, message, isTaunt } = data;
    
    if (!activeGames.has(gameId)) {
      return;
    }
    
    // Get player name from game state if available
    let name = playerName;
    if (!name && activeGames.has(gameId)) {
      const game = activeGames.get(gameId);
      const player = game.players.find(p => p.number === playerNumber);
      if (player) {
        name = player.name;
      }
    }
    
    // Broadcast the message to all players in the game
    io.to(gameId).emit('receive-message', {
      playerNumber,
      playerName: name || `Player ${playerNumber}`,
      message,
      isTaunt,
      timestamp: Date.now()
    });
  });
  
  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Check if player was in a game
    if (players.has(socket.id)) {
      const gameId = players.get(socket.id);
      
      if (activeGames.has(gameId)) {
        const game = activeGames.get(gameId);
        
        // Remove player from the game
        const playerIndex = game.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const playerNumber = game.players[playerIndex].number;
          game.players.splice(playerIndex, 1);
          
          // Notify remaining players
          io.to(gameId).emit('player-disconnected', { playerNumber });
          
          // If no players left, clean up the game
          if (game.players.length === 0) {
            activeGames.delete(gameId);
            console.log(`Game ${gameId} removed - no players left`);
          }
        }
      }
      
      // Remove player from players map
      players.delete(socket.id);
    }
  });
});

// Game code generator
function generateGameCode() {
  const codeLength = 6;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < codeLength; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Clean up inactive games periodically (every 15 minutes)
setInterval(function() {
    const now = Date.now();
    let cleanedCount = 0;

    activeGames.forEach(function(game, gameId) {
        if (now - game.lastActivity > 30 * 60 * 1000) {
            activeGames.delete(gameId);
            cleanedCount++;

            // Clean up players associated with the deleted game
            players.forEach(function(playerGameId, socketId) {
                if (playerGameId === gameId) {
                    players.delete(socketId);
                }
            });
            console.log(`Game ${gameId} removed due to inactivity.`);
        }
    });

    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive games in this interval.`);
    }
}, 15 * 60 * 1000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});