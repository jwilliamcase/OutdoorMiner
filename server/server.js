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
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
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

// Socket.io handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  
  // Create a new game
  socket.on('create-game', () => {
    const gameId = generateGameCode();
    
    // Create game object
    const gameState = {
      id: gameId,
      players: [
        { id: socket.id, number: 1, ready: false }
      ],
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
    
    console.log(`Game created: ${gameId} by player ${socket.id}`);
    
    // Join the socket to a room with the game ID
    socket.join(gameId);
    
    // Send the game code to the client
    socket.emit('game-created', { gameId, playerNumber: 1 });
  });
  
  // Join an existing game
  socket.on('join-game', (data) => {
    const { gameId } = data;
    
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
    game.players.push({ id: socket.id, number: 2, ready: false });
    players.set(socket.id, gameId);
    
    // Join the socket to the game room
    socket.join(gameId);
    
    console.log(`Player ${socket.id} joined game ${gameId}`);
    
    // Notify all players in the room
    socket.emit('game-joined', { gameId, playerNumber: 2 });
    io.to(gameId).emit('player-joined', { playerNumber: 2 });
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
      // Broadcast game state to all players
      io.to(gameId).emit('game-started', { gameState: {
        board: game.board,
        currentPlayer: game.currentPlayer,
        player1Color: game.player1Color,
        player2Color: game.player2Color,
        player1Tiles: game.player1Tiles,
        player2Tiles: game.player2Tiles,
        player1PowerUps: game.player1PowerUps,
        player2PowerUps: game.player2PowerUps,
        landmines: game.landmines
      }});
    }
  });
  
  // Handle game moves
  socket.on('make-move', (data) => {
    const { gameId, playerNumber, move } = data;
    
    if (!activeGames.has(gameId)) {
      socket.emit('game-error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames.get(gameId);
    
    // Validate it's the player's turn
    if (game.currentPlayer !== playerNumber) {
      socket.emit('game-error', { message: 'Not your turn' });
      return;
    }
    
    // Update game state based on the move
    // Move data should include color selection and any power-up usage
    
    // Example of updating color
    if (move.type === 'color-selection') {
      if (playerNumber === 1) {
        game.player1Color = move.color;
      } else {
        game.player2Color = move.color;
      }
      
      // Update tiles captured (if any)
      if (move.tilesCaptures) {
        if (playerNumber === 1) {
          game.player1Tiles = move.player1Tiles;
        } else {
          game.player2Tiles = move.player2Tiles;
        }
      }
      
      // Switch turns
      game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
    }
    
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
        game.board = move.updatedBoard;
      }
      
      // Switch turns
      game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
    }
    
    // Update last activity
    game.lastActivity = Date.now();
    
    // Broadcast the updated game state to all players
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
        moveDetails: move
      } 
    });
  });
  
  // Chat and taunts system
  socket.on('send-message', (data) => {
    const { gameId, playerNumber, message, isTaunt } = data;
    
    if (!activeGames.has(gameId)) {
      return;
    }
    
    // Broadcast the message to all players in the game
    io.to(gameId).emit('receive-message', {
      playerNumber,
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
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up inactive games periodically (every 15 minutes)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  activeGames.forEach((game, gameId) => {
    // If the game has been inactive for more than 30 minutes, remove it
    if (now - game.lastActivity > 30 * 60 * 1000) {
      activeGames.delete(gameId);
      cleanedCount++;
      
      // Remove any players still associated with this game
      players.forEach((playerGameId, playerId) => {
        if (playerGameId === gameId) {
          players.delete(playerId);
        }
      });
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} inactive games`);
  }
}, 15 * 60 * 1000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});