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

// Simple API status endpoint for health checks
app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      games: activeGames.size,
      clientOrigin: req.headers.origin || 'unknown',
      serverTime: new Date().toISOString(),
      message: 'Server is running and CORS is properly configured'
    });
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
// Create a new game
socket.on('create-game', (data) => {
    // Generate a random 6-character game ID
    const gameId = generateGameId();
    
    // Create the game
    games.set(gameId, {
        player1: socket.id,
        player1Name: data.playerName || 'Player 1',
        player2: null,
        player2Name: 'Player 2',
        gameState: null,
        lastActivity: Date.now()
    });
    
// Join an existing game
socket.on('join-game', (data) => {
    const { gameId } = data;
    
    // Return the game ID to the client
    if (!games.has(gameId)) {
        socket.emit('game-error', { message: 'Game not found' });
        return;
        playerName: data.playerName || 'Player 1'
    });
    // Get the game
    const game = games.get(gameId);
    
    // Check if the game is already full
    if (game.player2) {
        socket.emit('game-error', { message: 'Game is full' });
        return;
    }
    
    // Join the game as player 2
    game.player2 = socket.id;
    game.player2Name = data.playerName || 'Player 2';
    game.lastActivity = Date.now();
    
    // Join the socket room for this game
// Initialize a game
socket.on('initialize-game', (data) => {
    // Notify player 1 that someone joined
    if (game.player1) {
    // Check if the game exists
    if (!games.has(gameId)) {
        return;
        });
    }
    // Get the game
// Restart the game
socket.on('restart-game', (data) => {
    const { gameId } = data;
    game.gameState = gameData;
    // Check if the game exists
    if (!games.has(gameId)) {
        return;
    
    // Notify both players
    console.log(`Game ${gameId} restarted`);
        gameState: game.gameState
    // Notify both players
    io.to(gameId).emit('game-restarted', {});
});
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
// Handle a move
socket.on('make-move', (data) => {
  const { gameId, playerNumber, move } = data;
  
  // Check if the game exists
  if (!games.has(gameId)) {
      return;
  }
  
  // Get the game
  const game = games.get(gameId);
  
  // Verify it's this player's turn
  if (!game.gameState || game.gameState.currentPlayer !== playerNumber) {
      return;
  }
  
  // Update the game state based on the move
  if (move.type === 'color-selection') {
      // Log details about the color selection move
      console.log(`- - - - - - - - - - - - - - - - - - - -`);
      console.log(`make-move: ${move.type} received from Player ${playerNumber}`);
      console.log(`Move data:`, move);
      
      let player1TilesCount = 0;
      let player2TilesCount = 0;
      
      // Count tiles before move
      if (game.gameState.player1Tiles) {
          player1TilesCount = game.gameState.player1Tiles.length;
      }
      
      if (game.gameState.player2Tiles) {
          player2TilesCount = game.gameState.player2Tiles.length;
      }
      
      console.log(`After move from Player ${playerNumber}:`);
      console.log(`- Player 1 tiles BEFORE move: ${player1TilesCount}`);
      console.log(`- Player 2 tiles BEFORE move: ${player2TilesCount}`);
      
      // Update player color
      if (playerNumber === 1) {
          game.gameState.player1Color = move.color;
      } else {
          game.gameState.player2Color = move.color;
      }
      
      // Update tiles array
      if (move.player1Tiles) {
          console.log(`- Player 1 Tiles BEFORE move processing - P1 Tiles: ${move.player1Tiles.length}, P2 Tiles: ${move.player2Tiles ? move.player2Tiles.length : 0}`);
          game.gameState.player1Tiles = move.player1Tiles;
          console.log(`  Updated P1 tiles based on move: count = ${game.gameState.player1Tiles.length}`);
      }
      
      if (move.player2Tiles) {
          game.gameState.player2Tiles = move.player2Tiles;
          console.log(`  Updated P2 tiles based on move: count = ${game.gameState.player2Tiles.length}`);
      }
      
      // Log details after the move is processed
      console.log(`- Player 1 tiles AFTER move: ${game.gameState.player1Tiles.length}`);
      console.log(`- Player 2 tiles AFTER move: ${game.gameState.player2Tiles ? game.gameState.player2Tiles.length : 0}`);
      console.log(`- Player 1 color: ${game.gameState.player1Color}`);
      console.log(`- Player 2 color: ${game.gameState.player2Color}`);
      
      // Additional debugging log at the end
      console.log(`- Player ${playerNumber} Tiles AFTER move processing - P1 Tiles: ${game.gameState.player1Tiles.length}, P2 Tiles: ${game.gameState.player2Tiles ? game.gameState.player2Tiles.length : 0}`);
      console.log(`- - - - - - - - - - - - - - - - - - - -`);
      
  } else if (move.type === 'power-up') {
      // Handle power-up activation
      if (playerNumber === 1) {
          game.gameState.player1PowerUps = game.gameState.player1PowerUps.filter(p => p !== move.powerUp);
      } else {
          game.gameState.player2PowerUps = game.gameState.player2PowerUps.filter(p => p !== move.powerUp);
      }
      
      // Power-up specific logic here
  } else if (move.type === 'landmine') {
      // Update landmine status in game state
      if (game.gameState.landmines) {
          game.gameState.landmines = game.gameState.landmines.filter(mine =>
              !(mine.row === move.row && mine.col === move.col)
          );
      }
      
      // Add explosion effects or other logic here
  }
  
  // Switch turns
  game.gameState.currentPlayer = playerNumber === 1 ? 2 : 1;
  game.gameState.moveDetails = move;
  game.lastActivity = Date.now();
  
  // Log turn switch
  console.log(`Game ${gameId}: Turn switched to Player ${game.gameState.currentPlayer}`);
  console.log(`Move by Player ${playerNumber}: ${move.type}. Now Player ${game.gameState.currentPlayer}'s turn.`);
  console.log(`Player 1 tiles: ${game.gameState.player1Tiles.length}, Player 2 tiles: ${game.gameState.player2Tiles ? game.gameState.player2Tiles.length : 0}`);
  
  // Broadcast the updated game state to both players
  console.log(`Game ${gameId}: Emitting game-update event. Current Player: ${game.gameState.currentPlayer}`);
  io.to(gameId).emit('game-update', {
      type: move.type,
      gameState: game.gameState
  });
});
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
// Handle chat messages
socket.on('send-message', (data) => {
   const { gameId, playerNumber, message, isTaunt } = data;
   
   if (!games.has(gameId)) return;
   
   const game = games.get(gameId);
   const timestamp = Date.now();
   
   // Get player name
   let playerName = data.playerName || `Player ${playerNumber}`;
   
   // Add to messages array
   if (!game.messages) {
       game.messages = [];
   }
   
   game.messages.push({
       playerNumber,
       playerName,
       message,
       isTaunt,
       timestamp
   });
   
   // Limit messages stored
   if (game.messages.length > 50) {
       game.messages.shift();
   }
   
// Socket.io event handlers
io.on('connection', (socket) => {
console.log('New client connected:', socket.id);

// Handle disconnections
socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
       message,
    // Find the game this player was in
    let gameToUpdate = null;
    let playerNumber = 0;
    
    for (const [gameId, game] of games.entries()) {
        if (game.player1 === socket.id) {
            gameToUpdate = gameId;
            playerNumber = 1;
            break;
        } else if (game.player2 === socket.id) {
            gameToUpdate = gameId;
            playerNumber = 2;
            break;
        }
    }
    
    // If player was in a game, update it
    if (gameToUpdate) {
        const game = games.get(gameToUpdate);
        
        // Notify the other player
        if (playerNumber === 1 && game.player2) {
            io.to(game.player2).emit('player-disconnected', { playerNumber });
        } else if (playerNumber === 2 && game.player1) {
            io.to(game.player1).emit('player-disconnected', { playerNumber });
        }
        
        console.log(`Player ${playerNumber} disconnected from game ${gameToUpdate}`);
    }
});
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < codeLength; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  // Cleanup inactive games periodically
  setInterval(function() {
    const currentTime = Date.now();
    const inactiveThreshold = 60 * 60 * 1000; // 1 hour
    
    // Check each game
    Object.keys(games).forEach(function(gameId) {
      const game = games[gameId];
      
      // Skip games that don't have lastActivity timestamp
      if (!game.lastActivity) {
        game.lastActivity = currentTime;
        return;
      }
      
      // Check if the game is inactive
      if (currentTime - game.lastActivity > inactiveThreshold) {
        console.log(`Game ${gameId} is inactive for more than 1 hour. Removing...`);
        delete games[gameId];
      }
    });
    
    // Check for disconnected players
    Object.keys(players).forEach(function(playerId) {
      const player = players[playerId];
      
      // Remove player if inactive for too long
      if (currentTime - player.lastActivity > inactiveThreshold) {
        console.log(`Player ${playerId} is inactive for more than 1 hour. Removing...`);
        delete players[playerId];
      }
    });
  }, 30 * 60 * 1000); // Run every 30 minutes
});