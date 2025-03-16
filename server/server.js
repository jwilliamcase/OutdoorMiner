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
        { id: socket.id, number: 1, ready: false, name: playerName }
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
      lastActivity: Date.now(),
      player1Name: playerName, // Add player 1 name here
      player2Name: '' // Initialize player 2 name
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
    game.players.push({ id: socket.id, number: 2, ready: false, name: name });
    game.player2Name = name; // Set Player 2 name
    players.set(socket.id, gameId);

    // Join the socket to the game room
    socket.join(gameId);
    
    console.log(`Player ${socket.id} (${name}) joined game ${gameId}`);
    
    // Notify all players in the room
    socket.emit('game-joined', { gameId, playerNumber: 2 });
    io.to(gameId).emit('player-joined', { playerNumber: 2, playerName: name });
      gameState[gameId].turn = 1;
    gameState[gameId].availablePowerUps = { "1": 3, "2": 3 };
    addStartingSquares(gameId); // Add this line back in

}

function addStartingSquares(gameId) {
    const board = gameState[gameId].board;
    const size = board.length;


    // Player 1
    board[size - 1][0].color = gameState[gameId].playerColors[1];
    board[size - 1][0].owner = 1;
    gameState[gameId].scores[1] = 1;


    // Player 2
    board[0][size - 1].color = gameState[gameId].playerColors[2];
    board[0][size - 1].owner = 2;
    gameState[gameId].scores[2] = 1;
}

socket.on('initialize-game', ({ gameId, playerName, singlePlayer }) => {
    if (!games[gameId]) {
        games[gameId] = { players: {}, playerCount: 0, singlePlayer: singlePlayer };
    }
    // Mark the player as ready
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      game.players[playerIndex].ready = true;
    }

      // Get player names (already available in game state)
      const player1 = game.players.find(p => p.number === 1);
      const player2 = game.players.find(p => p.number === 2);

      // Log state before sending
      console.log(`Game ${gameId} starting with board state:`, {
        player1Tiles: game.player1Tiles.length,
        player2Tiles: game.player2Tiles.length,
        p1Name: player1?.name,
        p2Name: player2?.name
      });

      // Broadcast game state to all players (always send, don't wait for 'ready')
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
        player1Name: game.player1Name,  // Use names from game state
        player2Name: game.player2Name
      }});
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
      
      // Reset game state but keep the players and switch starting player
      game.board = null;
      game.currentPlayer = game.currentPlayer === 1 ? 2 : 1; // Switch starting player
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
      console.log(`- Player 1 has ${game.player1Tiles.length} tiles`);
      console.log(`- Player 2 has ${game.player2Tiles.length} tiles`);
      console.log(`- Player 1 color: ${game.player1Color}`);
      console.log(`- Player 2 color: ${game.player2Color}`);
      
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
      
      let move = moves.shift();
if (move) {
if (gameState[move.gameId] && gameState[move.gameId].turn === move.player) {
    // Process the move
    gameState[move.gameId].turn = 3 - move.player; // Switch turns: 1 -> 2, 2 -> 1
    if (move.type === 'color') {
        floodFill(gameState[move.gameId].board, move.newColor, move.oldColor, move.r, move.c, move.player);
        updateScores(move.gameId, move.player, move.newColor);
        io.to(move.gameId).emit('update-board', { board: gameState[move.gameId].board, scores: gameState[move.gameId].scores, turn: gameState[move.gameId].turn, availablePowerUps: gameState[move.gameId].availablePowerUps });
    } else if (move.type === 'powerup') {
        gameState[move.gameId].availablePowerUps[move.player] -= 1;
        if (move.powerUpType === 'landmine') {
            //move.updatedBoard is correct and represents the changes, we just need to deep copy it.
            gameState[move.gameId].board = JSON.parse(JSON.stringify(move.updatedBoard));
            updateScores(move.gameId, move.player, move.color); //color here is the color of the clicked hexagon
            io.to(move.gameId).emit('update-board', { board: gameState[move.gameId].board, scores: gameState[move.gameId].scores, turn: gameState[move.gameId].turn, availablePowerUps: gameState[move.gameId].availablePowerUps }); //Send whole game state
        }
    }
} else {
    console.log(`[${move.timestamp}] Move rejected: Not player ${move.player}'s turn in game ${move.gameId} (or game undefined)`);
}
}
}, 100); // Process one move every 100ms
        player2Color: game.player2Color,
        player1Tiles: game.player1Tiles,
        player2Tiles: game.player2Tiles,
        player1PowerUps: game.player1PowerUps,
        player2PowerUps: game.player2PowerUps,
        landmines: game.landmines,
        player1Name: game.player1Name, // Use names from game state
        player2Name: game.player2Name,
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
          const playerNumber = game.players[playerIndex]?.number; //Optional Chaining
          game.players.splice(playerIndex, 1);

          // Notify remaining players
        if (playerNumber) { // Check if playerNumber is valid
            io.to(gameId).emit('player-disconnected', { playerNumber });
        }
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