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

// Generate a random 6-character game code
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
      moveDetails: null,
      lastActivity: Date.now()
    };
    
    // Store the game
    activeGames.set(gameId, gameState);
    
    // Associate player with game
    players.set(socket.id, gameId);
    
    // Join the socket room for this game
    socket.join(gameId);
    
    // Send the game ID back to the client
    socket.emit('game-created', {
      gameId: gameId,
      playerNumber: 1,
      playerName: playerName
    });
    
    console.log(`Game created: ${gameId} by player ${socket.id} (${playerName})`);
  });
  
  // Join an existing game
  socket.on('join-game', (data) => {
    const { gameId, playerName } = data;
    const joinName = playerName || 'Player 2';
    
    // Check if the game exists
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Check if the game is already full
    if (game.players.length >= 2) {
      socket.emit('game-error', { message: 'Game is full' });
      return;
    }
    
    // Update player 2's name in the game state
    game.player2Name = joinName;
    
    // Add the player to the game
    game.players.push({
      id: socket.id,
      socketId: socket.id,
      number: 2,
      ready: false,
      name: joinName
    });
    
    // Associate player with game
    players.set(socket.id, gameId);
    
    // Join the socket room for this game
    socket.join(gameId);
    
    // Notify player they've joined
    socket.emit('game-joined', {
      gameId: gameId,
      playerNumber: 2,
      player1Name: game.player1Name,
      player2Name: joinName
    });
    
    // Notify other player that someone joined
    socket.to(gameId).emit('player-joined', {
      playerNumber: 2,
      playerName: joinName
    });
    
    console.log(`Player ${socket.id} (${joinName}) joined game ${gameId}`);
  });
  
  // Initialize a game
  socket.on('initialize-game', (gameData) => {
    const gameId = gameData.gameId;
    
    // Check if the game exists
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Update game state with data from client
    game.board = gameData.board;
    game.currentPlayer = gameData.currentPlayer;
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
      
      // Send game started event to all players
      io.to(gameId).emit('game-started', {
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
          player1Name: game.player1Name,
          player2Name: game.player2Name
        }
      });
    }
  });
  
  // Handle a move
  socket.on('make-move', (data) => {
    const { gameId, move } = data;
    let playerNumber = 0;
    
    // Check if the game exists
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Find the player's number
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      playerNumber = game.players[playerIndex].number;
    } else {
      socket.emit('game-error', { message: 'Player not found in game' });
      return;
    }
    
    // Verify it's this player's turn
    if (game.currentPlayer !== playerNumber) {
      socket.emit('game-error', { message: 'Not your turn' });
      return;
    }
    
    console.log(`- - - - - - - - - - - - - - - - - - - -`);
    console.log(`make-move: ${move.type} received from Player ${playerNumber}`);
    console.log(`Move data:`, move);
    
    // Update the game state based on the move
    if (move.type === 'color-selection') {
      // Log details about the color selection move
      let player1TilesCount = game.player1Tiles ? game.player1Tiles.length : 0;
      let player2TilesCount = game.player2Tiles ? game.player2Tiles.length : 0;
      
      console.log(`After move from Player ${playerNumber}:`);
      console.log(`- Player 1 tiles BEFORE move: ${player1TilesCount}`);
      console.log(`- Player 2 tiles BEFORE move: ${player2TilesCount}`);
      
      // Update player color
      if (playerNumber === 1) {
        game.player1Color = move.color;
      } else {
        game.player2Color = move.color;
      }
      
      // Update tiles
      if (playerNumber === 1) {
        if (move.player1Tiles) {
          console.log(`- Player 1 Tiles BEFORE move processing - P1 Tiles: ${move.player1Tiles.length}, P2 Tiles: ${move.player2Tiles ? move.player2Tiles.length : 0}`);
          game.player1Tiles = move.player1Tiles;
          console.log(`  Updated P1 tiles based on move: count = ${game.player1Tiles.length}`);
        }
      } else if (playerNumber === 2) {
        if (move.player2Tiles) {
          console.log(`- Player 2 Tiles BEFORE move processing - P1 Tiles: ${move.player1Tiles ? move.player1Tiles.length : 0}, P2 Tiles: ${move.player2Tiles.length}`);
          game.player2Tiles = move.player2Tiles;
          console.log(`  Updated P2 tiles based on move: count = ${game.player2Tiles.length}`);
        }
      }
      
      // Log details after the move is processed
      console.log(`- Player 1 tiles AFTER move: ${game.player1Tiles.length}`);
      console.log(`- Player 2 tiles AFTER move: ${game.player2Tiles.length}`);
      console.log(`- Player 1 color: ${game.player1Color}`);
      console.log(`- Player 2 color: ${game.player2Color}`);
    }
    else if (move.type === 'power-up') {
      // Handle power-up activation
      if (playerNumber === 1) {
        game.player1PowerUps = move.player1PowerUps || game.player1PowerUps;
      } else {
        game.player2PowerUps = move.player2PowerUps || game.player2PowerUps;
      }
      
      // Update tiles if the power-up affected them
      if (move.player1Tiles) game.player1Tiles = move.player1Tiles;
      if (move.player2Tiles) game.player2Tiles = move.player2Tiles;
    }
    else if (move.type === 'landmine') {
      // Update landmine status in game state
      if (game.landmines) {
        game.landmines = game.landmines.filter(mine =>
          !(mine.row === move.row && mine.col === move.col)
        );
      }
      
      // Update tiles after landmine explosion
      if (move.player1Tiles) game.player1Tiles = move.player1Tiles;
      if (move.player2Tiles) game.player2Tiles = move.player2Tiles;
      
      // Update board state if needed for explosions
      if (move.updatedBoard) {
        game.board = move.updatedBoard;
      }
    }
    
    // Switch turns
    game.currentPlayer = playerNumber === 1 ? 2 : 1;
    game.moveDetails = move;
    game.lastActivity = Date.now();
    
    // Log turn switch
    console.log(`Game ${gameId}: Turn switched to Player ${game.currentPlayer}`);
    console.log(`Move by Player ${playerNumber}: ${move.type}. Now Player ${game.currentPlayer}'s turn.`);
    console.log(`Player 1 tiles: ${game.player1Tiles.length}, Player 2 tiles: ${game.player2Tiles.length}`);
    console.log(`- - - - - - - - - - - - - - - - - - - -`);
    
    // Broadcast the updated game state to both players
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
        player1Name: game.player1Name,
        player2Name: game.player2Name,
        moveDetails: move
      } 
    });
  });
  
  // Restart the game
  socket.on('restart-game', (data) => {
    const { gameId } = data;
    
    // Check if the game exists
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Reset game state
    game.board = null;
    game.currentPlayer = 1;
    game.player1Color = null;
    game.player2Color = null;
    game.player1Tiles = [];
    game.player2Tiles = [];
    game.player1PowerUps = [];
    game.player2PowerUps = [];
    game.landmines = [];
    game.started = false;
    game.lastActivity = Date.now();
    
    // Mark all players as not ready
    game.players.forEach(player => {
      player.ready = false;
    });
    
    console.log(`Game ${gameId} restarted`);
    
    // Notify both players
    io.to(gameId).emit('game-restarted', {});
  });
  
  // Handle chat messages
  socket.on('send-message', (data) => {
    const { gameId, message, isTaunt } = data;
    
    // Check if the game exists
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Find player number
    let playerNumber = 0;
    let playerName = "Unknown";
    
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      playerNumber = game.players[playerIndex].number;
      playerName = game.players[playerIndex].name;
    }
    
    const timestamp = Date.now();
    
    // Broadcast message to all players in the game
    io.to(gameId).emit('message-received', {
      playerNumber,
      playerName,
      message,
      isTaunt,
      timestamp
    });
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Find the game this player was in
    const gameId = players.get(socket.id);
    
    if (gameId && activeGames.has(gameId)) {
      const game = activeGames.get(gameId);
      
      // Find the player's number
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const playerNumber = game.players[playerIndex].number;
        
        // Notify other players in the game
        socket.to(gameId).emit('player-disconnected', {
          playerNumber: playerNumber
        });
        
        console.log(`Player ${playerNumber} disconnected from game ${gameId}`);
      }
    }
    
    // Remove from players map
    players.delete(socket.id);
  });
});

// Clean up inactive games periodically
setInterval(() => {
  const currentTime = Date.now();
  const inactiveThreshold = 60 * 60 * 1000; // 1 hour
  
  // Check each game for inactivity
  for (const [gameId, game] of activeGames.entries()) {
    if (currentTime - game.lastActivity > inactiveThreshold) {
      console.log(`Game ${gameId} is inactive for more than 1 hour. Removing...`);
      activeGames.delete(gameId);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});