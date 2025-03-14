document.addEventListener('DOMContentLoaded', () => {
    // Add resize event listener to handle responsive canvas
    window.addEventListener('resize', function() {
        resizeGame();
        renderGameBoard();
    });
    // Canvas setup
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    const player1ScoreElement = document.getElementById('your-score');
    const player2ScoreElement = document.getElementById('opponent-score-value');
    const messageElement = document.getElementById('message');
    const turnIndicator = document.getElementById('turn-indicator');
    const currentPlayerElement = document.getElementById('current-player');
    const startGameButton = document.getElementById('start-game');
    const createChallengeButton = document.getElementById('create-challenge');
    const challengeCodeInput = document.getElementById('challenge-code');
    const connectChallengeButton = document.getElementById('connect-challenge');

    // Game constants
    const BOARD_SIZE = 12; // Increased from 11 to 12 for larger board
    const HEX_SIZE = 24; // Slightly smaller to fit larger board
    const HEX_HEIGHT = HEX_SIZE * 2;
    const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
    const BOARD_PADDING = 5; // Slight padding
    const LANDMINE_COUNT = 4; // One mine per quadrant
    
    // Colors for the game - adjusted color palette
    const COLORS = [
        '#F8E9A1', // Soft Yellow
        '#F76C6C', // Salmon Pink
        '#B8E0F6', // Lighter Blue (lightened)
        '#374785', // Medium Blue
        '#0F1A40'  // Navy Blue (darkened)
    ];
    
    // Explosion colors
    const EXPLOSION_COLOR = '#000000'; // Black
    const EXPLOSION_RECOVERY_TURNS = 3; // Number of turns before exploded tiles fully recover
    
    // Game state
    let gameBoard = [];
    let player1Tiles = new Set(); // Set of coordinates owned by player 1 (format: "row,col")
    let player2Tiles = new Set(); // Set of coordinates owned by player 2
    let currentPlayer = 1;
    let player1Color = '';
    let player2Color = '';
    let availableColors = [...COLORS];
    let hoverTile = null; // Track which tile the mouse is hovering over
    let landmines = []; // Array to store landmine positions
    let explodedTiles = []; // Array to track exploded tiles and their recovery status
    
    // Power-up system
    const COMBO_THRESHOLD = 4; // Minimum tiles to capture to possibly get a power-up
    const POWER_UPS = {
        SABOTAGE: 'sabotage',
        WILDCARD: 'wildcard',
        TELEPORT: 'teleport'
    };
    let player1PowerUps = []; // Array of power-ups player 1 has available
    let player2PowerUps = []; // Array of power-ups player 2 has available
    let selectedPowerUp = null; // Currently selected power-up
    
    // Online multiplayer variables
    let gameId = null; // Unique identifier for this game
    let isOnlineGame = false; // Whether this is an online multiplayer game
    let playerNumber = 1; // Which player this client represents (1 or 2)
    
    // Initialize the game
    function initializeGame() {
        createGameBoard();
        setupInitialTiles();
        resetAvailableColors();
        
        // Clear any exploded tiles from previous games
        explodedTiles = [];
        
        // Reset power-ups
        player1PowerUps = [];
        player2PowerUps = [];
        selectedPowerUp = null;
        updatePowerUpDisplay();
        
        // Handle responsive canvas sizing
        resizeGame();
        
        renderGameBoard();
        updateScoreDisplay();
        updateTurnIndicator();
        setupColorButtons();
        setupPowerUpListeners();
        messageElement.textContent = "Welcome to Outdoor Miner! Your turn. Watch out for hidden landmines!";
    }
    
    // Function to handle responsive canvas scaling
    function resizeGame() {
        const container = document.getElementById('game-container');
        const containerWidth = container.clientWidth - 30; // Account for padding
        
        // Only resize if the container is smaller than canvas size
        if (containerWidth < canvas.width) {
            const scaleFactor = containerWidth / canvas.width;
            canvas.style.width = containerWidth + 'px';
            canvas.style.height = (canvas.height * scaleFactor) + 'px';
        } else {
            canvas.style.width = '';
            canvas.style.height = '';
        }
    }
    
    // Create the game board with random colors
    function createGameBoard() {
        gameBoard = [];
        landmines = []; // Clear any existing landmines
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            gameBoard[row] = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                gameBoard[row][col] = {
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    row: row,
                    col: col,
                    hasMine: false
                };
            }
        }
        
        // Place landmines - one in each quadrant
        placeLandminesInQuadrants();
    }
    
    // Place landmines in each quadrant of the board
    function placeLandminesInQuadrants() {
        // Define the quadrants (avoid the very corners where players start)
        // Use Math.floor for consistent integer boundaries
        const halfBoard = Math.floor(BOARD_SIZE/2);
        
        const quadrants = [
            {minRow: 1, maxRow: halfBoard - 1, minCol: 1, maxCol: halfBoard - 1},                // bottom-left quadrant
            {minRow: 1, maxRow: halfBoard - 1, minCol: halfBoard + 1, maxCol: BOARD_SIZE - 2},   // bottom-right quadrant
            {minRow: halfBoard + 1, maxRow: BOARD_SIZE - 2, minCol: 1, maxCol: halfBoard - 1},   // top-left quadrant
            {minRow: halfBoard + 1, maxRow: BOARD_SIZE - 2, minCol: halfBoard + 1, maxCol: BOARD_SIZE - 2} // top-right quadrant
        ];
        
        // Place one mine in each quadrant
        for (const quadrant of quadrants) {
            let placed = false;
            let attempts = 0;
            const maxAttempts = 100; // Prevent infinite loop
            
            while (!placed && attempts < maxAttempts) {
                attempts++;
                
                // Random position within the quadrant
                const row = Math.floor(Math.random() * (quadrant.maxRow - quadrant.minRow + 1)) + quadrant.minRow;
                const col = Math.floor(Math.random() * (quadrant.maxCol - quadrant.minCol + 1)) + quadrant.minCol;
                
                // Make sure the position is valid
                if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
                    continue;
                }
                
                // Make sure this isn't a player's starting position
                if ((row === BOARD_SIZE - 1 && col === 0) || (row === 0 && col === BOARD_SIZE - 1)) {
                    continue;
                }
                
                // Place a mine
                try {
                    gameBoard[row][col].hasMine = true;
                    landmines.push({row, col});
                    placed = true;
                    console.log(`Placed mine at ${row},${col}`);
                } catch (e) {
                    console.error(`Error placing mine at ${row},${col}:`, e);
                }
            }
            
            if (!placed) {
                console.warn(`Failed to place mine in quadrant after ${maxAttempts} attempts`);
            }
        }
    }
    
    // Set up initial player territories
    function setupInitialTiles() {
        // Clear existing territories
        player1Tiles.clear();
        player2Tiles.clear();
        
        // Player 1 starts at bottom left
        const player1StartRow = BOARD_SIZE - 1;
        const player1StartCol = 0;
        player1Color = gameBoard[player1StartRow][player1StartCol].color;
        player1Tiles.add(`${player1StartRow},${player1StartCol}`);
        
        // Player 2 starts at top right
        const player2StartRow = 0;
        const player2StartCol = BOARD_SIZE - 1;
        player2Color = gameBoard[player2StartRow][player2StartCol].color;
        player2Tiles.add(`${player2StartRow},${player2StartCol}`);
        
        // Ensure the starting positions don't have the same color
        if (player1Color === player2Color) {
            // Change player 2's color to something different
            const differentColors = COLORS.filter(c => c !== player1Color);
            player2Color = differentColors[Math.floor(Math.random() * differentColors.length)];
            gameBoard[player2StartRow][player2StartCol].color = player2Color;
        }
        
        currentPlayer = 1; // Player 1 starts
    }
    
    // Reset available colors for the new turn
    function resetAvailableColors() {
        availableColors = [...COLORS];
        
        // Players can't select their own current color or opponent's current color
        if (currentPlayer === 1) {
            // Can't select own or opponent's current color
            availableColors = availableColors.filter(c => c !== player1Color && c !== player2Color);
        } else {
            // Can't select own or opponent's current color
            availableColors = availableColors.filter(c => c !== player1Color && c !== player2Color);
        }
    }
    
    // Draw a single hexagon
    function drawHexagon(x, y, size, color, isOwned = false, ownedBy = 0, hasMine = false) {
        const sides = 6;
        const angle = (2 * Math.PI) / sides;
        
        // Save current context state
        ctx.save();
        
        // Drop shadow for all hexagons
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Create hexagon path
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const pointX = x + size * Math.cos(angle * i - Math.PI / 6);
            const pointY = y + size * Math.sin(angle * i - Math.PI / 6);
            if (i === 0) {
                ctx.moveTo(pointX, pointY);
            } else {
                ctx.lineTo(pointX, pointY);
            }
        }
        ctx.closePath();
        
        // Fill the hexagon with 3D lighting effect
        const gradient = ctx.createRadialGradient(
            x - size/4, y - size/4, size/10,  // Inner circle position and radius
            x, y, size                         // Outer circle position and radius
        );
        
        // Create color variations for gradient
        const colorObj = hexToRgb(color);
        const lighterColor = `rgba(${Math.min(colorObj.r + 40, 255)}, ${Math.min(colorObj.g + 40, 255)}, ${Math.min(colorObj.b + 40, 255)}, 1.0)`;
        const darkerColor = `rgba(${Math.max(colorObj.r - 30, 0)}, ${Math.max(colorObj.g - 30, 0)}, ${Math.max(colorObj.b - 30, 0)}, 1.0)`;
        
        // Set gradient colors
        gradient.addColorStop(0, lighterColor);
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, darkerColor);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw border with no shadow
        ctx.shadowColor = 'transparent';
        
        if (isOwned) {
            // Owner highlight effect
            ctx.strokeStyle = ownedBy === 1 ? '#374785' : '#F76C6C';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw a glowing circle to indicate ownership
            ctx.beginPath();
            ctx.arc(x, y, size / 3, 0, 2 * Math.PI);
            const ownerColor = ownedBy === 1 ? '#374785' : '#F76C6C';
            
            // Create a radial gradient for the circle
            const circleGradient = ctx.createRadialGradient(
                x, y, 0,
                x, y, size / 3
            );
            circleGradient.addColorStop(0, '#fff');
            circleGradient.addColorStop(0.7, ownerColor);
            circleGradient.addColorStop(1, darkenColor(ownerColor, 0.3));
            
            ctx.fillStyle = circleGradient;
            ctx.fill();
        } else {
            // Add thick black outline for unjoined tiles
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // We don't visually show the landmines - they're hidden surprises
        // But we could add code here to make them visible for debugging
        
        // Restore context state
        ctx.restore();
    }
    
    // Helper function to convert hex color to RGB
    function hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');
        
        // Parse r, g, b values
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;
        
        return { r, g, b };
    }
    
    // Helper function to darken a color
    function darkenColor(color, amount) {
        // Convert hex to rgb
        let hex = color.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        
        // Darken
        r = Math.max(0, Math.floor(r * (1 - amount)));
        g = Math.max(0, Math.floor(g * (1 - amount)));
        b = Math.max(0, Math.floor(b * (1 - amount)));
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Draw the entire game board
    function renderGameBoard() {
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate the center position for the board
        const boardWidth = BOARD_SIZE * HEX_WIDTH;
        const boardHeight = BOARD_SIZE * HEX_HEIGHT * 0.75;
        const startX = (canvas.width - boardWidth) / 2;
        const startY = (canvas.height - boardHeight) / 2;
        
        // Draw each hexagon in the grid
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const tile = gameBoard[row][col];
                const isPlayer1Owned = player1Tiles.has(`${row},${col}`);
                const isPlayer2Owned = player2Tiles.has(`${row},${col}`);
                
                // Calculate hex position (using offset coordinates for hexagonal grid)
                // Add padding and adjust for odd rows
                const x = startX + col * HEX_WIDTH + (row % 2) * (HEX_WIDTH / 2) + BOARD_PADDING;
                const y = startY + row * (HEX_HEIGHT * 0.75) + BOARD_PADDING;
                
                // Determine the color to draw
                let displayColor = tile.color;
                if (isPlayer1Owned) {
                    displayColor = player1Color;
                } else if (isPlayer2Owned) {
                    displayColor = player2Color;
                }
                
                // Check if this tile is being hovered over
                const isHovered = hoverTile && hoverTile.row === row && hoverTile.col === col;
                
                // Calculate hex size with hover effect
                let hexSize = HEX_SIZE;
                if (isHovered) {
                    // Make hovered hexagons slightly larger
                    hexSize = HEX_SIZE * 1.1;
                }
                
                // Draw the hexagon
                drawHexagon(
                    x, 
                    y, 
                    hexSize, 
                    displayColor,
                    isPlayer1Owned || isPlayer2Owned,
                    isPlayer1Owned ? 1 : (isPlayer2Owned ? 2 : 0),
                    tile.hasMine
                );
            }
        }
    }
    
    // Get adjacent tiles (neighbors)
    function getNeighbors(row, col) {
        const neighbors = [];
        // Define the 6 possible directions for hex grid (depends on even/odd row)
        const directions = row % 2 === 0 ? 
            [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]] : // even row
            [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]];    // odd row
            
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            // Check if the neighbor is within the board boundaries
            if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }
        
        return neighbors;
    }
    
    // Get all neighboring tiles that can be captured
    function getCaptureableTiles(playerTiles, targetColor) {
        const capturable = new Set();
        const queue = [];
        const visited = new Set();
        
        // First, find all direct neighbors of owned tiles that match the target color
        for (const tileKey of playerTiles) {
            const [row, col] = tileKey.split(',').map(Number);
            const neighbors = getNeighbors(row, col);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;
                // If this tile is not already owned, not already visited, and matches the target color
                if (!player1Tiles.has(neighborKey) && 
                    !player2Tiles.has(neighborKey) && 
                    !visited.has(neighborKey) &&
                    gameBoard[neighbor.row][neighbor.col].color === targetColor) {
                    capturable.add(neighborKey);
                    queue.push(neighbor);
                    visited.add(neighborKey);
                }
            }
        }
        
        // Now expand to find connected tiles of the same color (flooding algorithm)
        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = getNeighbors(current.row, current.col);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;
                // If not already owned, not visited, and matches our target color
                if (!player1Tiles.has(neighborKey) && 
                    !player2Tiles.has(neighborKey) && 
                    !visited.has(neighborKey) &&
                    gameBoard[neighbor.row][neighbor.col].color === targetColor) {
                    capturable.add(neighborKey);
                    queue.push(neighbor);
                    visited.add(neighborKey);
                }
            }
        }
        
        return capturable;
    }
    
    // Handle explosion when a landmine is hit
    function triggerLandmineExplosion(row, col) {
        // Get all neighboring tiles including the mine tile itself
        const explosionTiles = [...getNeighbors(row, col), {row, col}];
        
        // Play explosion sound if available
        const explosionSound = document.getElementById('explosion-sound');
        if (explosionSound) {
            explosionSound.currentTime = 0;
            explosionSound.play().catch(error => console.log('Error playing sound:', error));
        }
        
        // Animation for explosion
        let explosionStep = 0;
        const totalSteps = 10; // Total animation steps
        
        function animateExplosion() {
            if (explosionStep <= totalSteps) {
                // Clear previous frame
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw the board 
                renderGameBoard();
                
                // Draw explosion effect
                const boardWidth = BOARD_SIZE * HEX_WIDTH;
                const boardHeight = BOARD_SIZE * HEX_HEIGHT * 0.75;
                const startX = (canvas.width - boardWidth) / 2;
                const startY = (canvas.height - boardHeight) / 2;
                
                // Calculate the explosion radius
                const progress = explosionStep / totalSteps;
                const maxRadius = HEX_SIZE * 3;
                const currentRadius = progress * maxRadius;
                
                // Draw explosion for each affected tile
                for (const tile of explosionTiles) {
                    const x = startX + tile.col * HEX_WIDTH + (tile.row % 2) * (HEX_WIDTH / 2) + BOARD_PADDING;
                    const y = startY + tile.row * (HEX_HEIGHT * 0.75) + BOARD_PADDING;
                    
                    // Create explosion gradient
                    const gradient = ctx.createRadialGradient(
                        x, y, 0,
                        x, y, currentRadius
                    );
                    gradient.addColorStop(0, 'rgba(255, 255, 150, ' + (1 - progress) + ')');
                    gradient.addColorStop(0.5, 'rgba(255, 100, 20, ' + (0.8 - progress) + ')');
                    gradient.addColorStop(1, 'rgba(255, 0, 0, ' + (0.4 - progress) + ')');
                    
                    ctx.beginPath();
                    ctx.fillStyle = gradient;
                    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                explosionStep++;
                requestAnimationFrame(animateExplosion);
            } else {
                // Explosion animation complete, apply the effects
                finishExplosion();
            }
        }
        
        function finishExplosion() {
            // For each affected tile, set to explosion color and remove ownership
            for (const tile of explosionTiles) {
                const tileKey = `${tile.row},${tile.col}`;
                
                // Change color to explosion color (black)
                gameBoard[tile.row][tile.col].color = EXPLOSION_COLOR;
                
                // Remove ownership
                player1Tiles.delete(tileKey);
                player2Tiles.delete(tileKey);
                
                // Add to exploded tiles with recovery countdown
                explodedTiles.push({
                    row: tile.row,
                    col: tile.col,
                    turnsLeft: EXPLOSION_RECOVERY_TURNS
                });
            }
            
            // Clear the mine
            gameBoard[row][col].hasMine = false;
            // Remove from landmines array
            landmines = landmines.filter(mine => !(mine.row === row && mine.col === col));
            
            // Check if any player territories have been split into disconnected segments
            handleDisconnectedTerritories();
            
            // Begin color shuffling animation for all unclaimed tiles
            shuffleUnclaimedTiles(() => {
                // Redraw the board with changes
                renderGameBoard();
                
                // Update score display
                updateScoreDisplay();
                
                // Show message about explosion
                messageElement.textContent = `💥 BOOM! A landmine was triggered! Unclaimed tiles have been shuffled!`;
                
                // Switch turns
                switchPlayerTurn();
            });
        }
        
        // Start explosion animation
        animateExplosion();
    }
    
    // Handle disconnected territories after an explosion
    function handleDisconnectedTerritories() {
        // First, check player 1's territories
        const player1Segments = findDisconnectedSegments(player1Tiles);
        
        // If player 1 has disconnected segments
        if (player1Segments.length > 1) {
            // Keep only the largest segment
            const largestSegment = player1Segments.reduce((largest, current) => 
                current.size > largest.size ? current : largest, player1Segments[0]);
            
            // Create new set with only the largest segment
            const newPlayer1Tiles = new Set();
            for (const tileKey of largestSegment) {
                newPlayer1Tiles.add(tileKey);
            }
            
            // Remove smaller segments (they become unclaimed)
            player1Tiles = newPlayer1Tiles;
        }
        
        // Then check player 2's territories
        const player2Segments = findDisconnectedSegments(player2Tiles);
        
        // If player 2 has disconnected segments
        if (player2Segments.length > 1) {
            // Keep only the largest segment
            const largestSegment = player2Segments.reduce((largest, current) => 
                current.size > largest.size ? current : largest, player2Segments[0]);
            
            // Create new set with only the largest segment
            const newPlayer2Tiles = new Set();
            for (const tileKey of largestSegment) {
                newPlayer2Tiles.add(tileKey);
            }
            
            // Remove smaller segments (they become unclaimed)
            player2Tiles = newPlayer2Tiles;
        }
    }
    
    // Find disconnected segments in a territory
    function findDisconnectedSegments(playerTiles) {
        const segments = [];
        const visited = new Set();
        
        // Iterate through all the player's tiles
        for (const tileKey of playerTiles) {
            // Skip tiles we've already assigned to a segment
            if (visited.has(tileKey)) continue;
            
            // Start a new segment with this tile
            const segment = new Set();
            const queue = [tileKey];
            segment.add(tileKey);
            visited.add(tileKey);
            
            // Use BFS to find all connected tiles
            while (queue.length > 0) {
                const currentTileKey = queue.shift();
                const [row, col] = currentTileKey.split(',').map(Number);
                
                // Get neighbors
                const neighbors = getNeighbors(row, col);
                
                // Check each neighbor
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.row},${neighbor.col}`;
                    
                    // If this neighbor is part of player's territory and not visited yet
                    if (playerTiles.has(neighborKey) && !visited.has(neighborKey)) {
                        queue.push(neighborKey);
                        segment.add(neighborKey);
                        visited.add(neighborKey);
                    }
                }
            }
            
            // Add this segment to our list
            segments.push(segment);
        }
        
        return segments;
    }
    
    // Shuffle colors of unclaimed tiles
    function shuffleUnclaimedTiles(callback) {
        let shuffleCount = 0;
        const shuffleTimes = 10; // Number of rapid shuffles
        const shuffleDelay = 80; // Time between shuffles (ms)
        
        function doShuffle() {
            // If we've completed all shuffles, end the animation
            if (shuffleCount >= shuffleTimes) {
                if (callback) callback();
                return;
            }
            
            // Shuffle colors of all unclaimed tiles
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const tileKey = `${row},${col}`;
                    
                    // Only shuffle unclaimed tiles
                    if (!player1Tiles.has(tileKey) && !player2Tiles.has(tileKey)) {
                        // Skip tiles that are currently exploded (black)
                        if (gameBoard[row][col].color !== EXPLOSION_COLOR) {
                            // Assign a random color from the palette
                            gameBoard[row][col].color = COLORS[Math.floor(Math.random() * COLORS.length)];
                        }
                    }
                }
            }
            
            // Draw the board with new colors
            renderGameBoard();
            
            // Increment counter and schedule next shuffle
            shuffleCount++;
            setTimeout(doShuffle, shuffleDelay);
        }
        
        // Start the shuffle animation
        doShuffle();
    }
    
    // Handle color selection and tile capture
    function handleColorSelection(selectedColor) {
        // In online mode, only allow moves on your turn
        if (isOnlineGame && currentPlayer !== playerNumber) {
            messageElement.textContent = "It's not your turn!";
            return;
        }
        
        // Make sure the color is available
        if (!availableColors.includes(selectedColor)) {
            messageElement.textContent = "This color is not available this turn!";
            return;
        }
        
        // Check if this is the same as current color
        const isCurrentColor = (currentPlayer === 1 && selectedColor === player1Color) ||
                               (currentPlayer === 2 && selectedColor === player2Color);
        
        // Update player's color
        if (currentPlayer === 1) {
            player1Color = selectedColor;
        } else {
            player2Color = selectedColor;
        }
        
        // Find tiles to capture
        const playerTiles = currentPlayer === 1 ? player1Tiles : player2Tiles;
        
        // Only check for new tiles if not re-selecting current color
        const capturable = isCurrentColor ? new Set() : getCaptureableTiles(playerTiles, selectedColor);
        
        if (capturable.size === 0 && !isCurrentColor) {
            messageElement.textContent = `No tiles can be captured with this color. Try another!`;
            return;
        }
        
        // In online mode, send the move to the server
        if (isOnlineGame) {
            sendMoveToServer(selectedColor);
        }
        
        // Check if any of the captured tiles has a landmine
        let mineTriggerInfo = null;
        
        for (const tileKey of capturable) {
            const [row, col] = tileKey.split(',').map(Number);
            if (gameBoard[row][col].hasMine) {
                mineTriggerInfo = {row, col};
                break;
            }
        }
        
        // If we triggered a mine, handle that first
        if (mineTriggerInfo) {
            // Capture a single tile to show what happened
            const [mineRow, mineCol] = [mineTriggerInfo.row, mineTriggerInfo.col];
            const mineKey = `${mineRow},${mineCol}`;
            
            if (currentPlayer === 1) {
                player1Tiles.add(mineKey);
            } else {
                player2Tiles.add(mineKey);
            }
            
            renderGameBoard();
            
            // Short delay before explosion
            setTimeout(() => {
                triggerLandmineExplosion(mineRow, mineCol);
            }, 500);
            
            return;
        }
        
        // No mine triggered, proceed with normal capture
        // Capture the tiles with animation
        let captureCount = 0;
        const tilesToCapture = Array.from(capturable);
        
        function animateCapture() {
            if (captureCount < tilesToCapture.length) {
                const tileKey = tilesToCapture[captureCount];
                
                if (currentPlayer === 1) {
                    player1Tiles.add(tileKey);
                } else {
                    player2Tiles.add(tileKey);
                }
                
                captureCount++;
                renderGameBoard();
                
                // Continue animation with slight delay
                setTimeout(animateCapture, 20); // 20ms delay between captures for animation
            } else {
                // Animation complete, finish turn
                // Show which color was selected
                messageElement.textContent = `${currentPlayer === 1 ? 'You' : 'Opponent'} selected ${selectedColor} and captured ${capturable.size} tiles.`;
                
                // Check for power-up eligibility (captured 4+ tiles)
                if (capturable.size >= COMBO_THRESHOLD) {
                    awardPowerUp();
                }
                
                updateScoreDisplay();
                
                // Switch turns
                switchPlayerTurn();
            }
        }
        
        // If re-selecting the same color, just switch turns
        if (isCurrentColor) {
            messageElement.textContent = `${currentPlayer === 1 ? 'You' : 'Opponent'} kept the same color.`;
            updateScoreDisplay();
            switchPlayerTurn();
        } else {
            // Start the animation for capturing new tiles
            animateCapture();
        }
    }
    
    // Award a random power-up to the current player
    function awardPowerUp() {
        // Choose a random power-up type
        const powerUpTypes = Object.values(POWER_UPS);
        const randomPowerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        
        // Add to the current player's power-ups
        if (currentPlayer === 1) {
            player1PowerUps.push(randomPowerUp);
        } else {
            player2PowerUps.push(randomPowerUp);
        }
        
        // Play power-up sound if available
        const powerUpSound = document.getElementById('power-up-sound');
        if (powerUpSound) {
            powerUpSound.currentTime = 0;
            powerUpSound.play().catch(error => console.log('Error playing sound:', error));
        }
        
        // Update the display
        updatePowerUpDisplay();
        
        // Show a message
        messageElement.textContent += ` You earned a ${randomPowerUp.charAt(0).toUpperCase() + randomPowerUp.slice(1)} power-up!`;
    }
    
    // Update the power-up display
    function updatePowerUpDisplay() {
        // Get the power-ups for the current player
        const playerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        
        // Update counts
        const sabotageCount = playerPowerUps.filter(p => p === POWER_UPS.SABOTAGE).length;
        const wildcardCount = playerPowerUps.filter(p => p === POWER_UPS.WILDCARD).length;
        const teleportCount = playerPowerUps.filter(p => p === POWER_UPS.TELEPORT).length;
        
        // Update the display
        document.getElementById('sabotage-count').textContent = sabotageCount;
        document.getElementById('wildcard-count').textContent = wildcardCount;
        document.getElementById('teleport-count').textContent = teleportCount;
        
        // Enable/disable slots based on availability
        const slots = document.querySelectorAll('.power-up-slot');
        slots.forEach(slot => {
            const type = slot.getAttribute('data-type');
            const count = playerPowerUps.filter(p => p === type).length;
            
            // Only enable if player has at least one of this power-up
            if (count > 0) {
                slot.classList.remove('disabled');
            } else {
                slot.classList.add('disabled');
            }
            
            // Remove active state if the selected power-up is no longer available
            if (selectedPowerUp === type && count === 0) {
                selectedPowerUp = null;
            }
            
            // Update active state
            if (selectedPowerUp === type) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }
    
    // Update the turn indicator UI
    function updateTurnIndicator() {
        // Update turn indicator text
        currentPlayerElement.textContent = currentPlayer === 1 ? 'You' : 'Opponent';
        
        // Update turn indicator styling
        turnIndicator.classList.remove('player1-turn', 'player2-turn');
        turnIndicator.classList.add(currentPlayer === 1 ? 'player1-turn' : 'player2-turn');
    }
    
    // Switch to the next player's turn
    function switchPlayerTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        resetAvailableColors();
        setupColorButtons();
        updateTurnIndicator();
        updatePowerUpDisplay(); // Update power-up display for the new current player
        
        // Process exploded tiles recovery
        processExplodedTilesRecovery();
        
        // Check for game over
        if (isGameOver()) {
            endGame();
        }
    }
    
    // Process the recovery of exploded tiles
    function processExplodedTilesRecovery() {
        // Create a new array for tiles that are still recovering
        const stillRecovering = [];
        
        // Process each exploded tile
        for (const tile of explodedTiles) {
            // Decrement turns left for recovery
            tile.turnsLeft--;
            
            // If fully recovered, assign a new random color
            if (tile.turnsLeft <= 0) {
                // Choose a random game color
                const newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                
                // Update the tile color
                gameBoard[tile.row][tile.col].color = newColor;
                
                // We don't add this tile to stillRecovering since it's fully recovered
            } 
            // If still in recovery phase, show partial recovery
            else {
                // Different recovery effects based on type
                if (tile.type === 'sabotage') {
                    // Sabotaged tiles gradually fade from dark red to neutral
                    const recoveryProgress = 1 - (tile.turnsLeft / 3); // 3 is the sabotage recovery turns
                    
                    // Mix dark red with random color based on recovery progress
                    const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                    const targetColorObj = hexToRgb(targetColor);
                    
                    // Start with dark red (139, 0, 0)
                    const r = Math.floor(139 + (targetColorObj.r - 139) * recoveryProgress);
                    const g = Math.floor(0 + (targetColorObj.g - 0) * recoveryProgress);
                    const b = Math.floor(0 + (targetColorObj.b - 0) * recoveryProgress);
                    
                    // Set the transitional color
                    const transitionColor = `rgb(${r}, ${g}, ${b})`;
                    gameBoard[tile.row][tile.col].color = transitionColor;
                } else {
                    // Standard explosion recovery (black to random color)
                    const recoveryProgress = 1 - (tile.turnsLeft / EXPLOSION_RECOVERY_TURNS);
                    
                    // Create a darker color based on recovery progress
                    // As recovery progresses, the tile gets less black and more colorful
                    if (recoveryProgress >= 0.5) {
                        // In the second half of recovery, start introducing a random color
                        const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                        const targetColorObj = hexToRgb(targetColor);
                        
                        // Mix black with the target color based on recovery progress
                        const r = Math.floor(targetColorObj.r * (recoveryProgress - 0.5) * 2);
                        const g = Math.floor(targetColorObj.g * (recoveryProgress - 0.5) * 2);
                        const b = Math.floor(targetColorObj.b * (recoveryProgress - 0.5) * 2);
                        
                        // Set the transitional color
                        const transitionColor = `rgb(${r}, ${g}, ${b})`;
                        gameBoard[tile.row][tile.col].color = transitionColor;
                    }
                }
                
                // Keep this tile in the recovery list
                stillRecovering.push(tile);
            }
        }
        
        // Update the exploded tiles array to only include tiles still recovering
        explodedTiles = stillRecovering;
        
        // Redraw the board to show the changes
        renderGameBoard();
    }
    
    // Check if the game is over (no more tiles to capture)
    function isGameOver() {
        // If either player has no moves, the game is over
        return (getCaptureableTiles(player1Tiles, player1Color).size === 0 &&
                COLORS.every(color => getCaptureableTiles(player1Tiles, color).size === 0)) ||
               (getCaptureableTiles(player2Tiles, player2Color).size === 0 &&
                COLORS.every(color => getCaptureableTiles(player2Tiles, color).size === 0));
    }
    
    // End the game and display results
    function endGame() {
        const player1Score = player1Tiles.size;
        const player2Score = player2Tiles.size;
        
        if (player1Score > player2Score) {
            messageElement.textContent = `Game over! You win ${player1Score} to ${player2Score}!`;
        } else if (player2Score > player1Score) {
            messageElement.textContent = `Game over! Opponent wins ${player2Score} to ${player1Score}.`;
        } else {
            messageElement.textContent = `Game over! It's a tie at ${player1Score} tiles each.`;
        }
        
        // Disable color selection
        document.querySelectorAll('.color-button').forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
        });
    }
    
    // Update score display
    function updateScoreDisplay() {
        player1ScoreElement.textContent = player1Tiles.size;
        player2ScoreElement.textContent = player2Tiles.size;
    }
    
    // Set up color buttons
    function setupColorButtons() {
        document.querySelectorAll('.color-button').forEach(button => {
            const color = button.getAttribute('data-color');
            const swatch = button.closest('.color-swatch');
            
            // Disable colors that aren't available
            if (availableColors.includes(color)) {
                button.disabled = false;
                button.classList.remove('disabled');
                swatch.classList.remove('disabled');
            } else {
                button.disabled = true;
                button.classList.add('disabled');
                swatch.classList.add('disabled');
            }
            
            // Highlight current player's turn
            swatch.classList.toggle('current-player', currentPlayer === 1 && !button.disabled);
            swatch.classList.toggle('opponent-player', currentPlayer === 2 && !button.disabled);
        });
    }
    
    // Find the hex tile at a specific canvas position
    function findHexAtPosition(x, y) {
        // Calculate board position
        const boardWidth = BOARD_SIZE * HEX_WIDTH;
        const boardHeight = BOARD_SIZE * HEX_HEIGHT * 0.75;
        const startX = (canvas.width - boardWidth) / 2;
        const startY = (canvas.height - boardHeight) / 2;
        
        // Find the closest hexagon to the click point
        let minDistance = Infinity;
        let closestHex = null;
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const hexX = startX + col * HEX_WIDTH + (row % 2) * (HEX_WIDTH / 2) + BOARD_PADDING;
                const hexY = startY + row * (HEX_HEIGHT * 0.75) + BOARD_PADDING;
                
                const distance = Math.sqrt(Math.pow(hexX - x, 2) + Math.pow(hexY - y, 2));
                if (distance < minDistance && distance < HEX_SIZE) {
                    minDistance = distance;
                    closestHex = { row, col };
                }
            }
        }
        
        return closestHex;
    }
    
    // Setup Power-Up listeners
    function setupPowerUpListeners() {
        const powerUpSlots = document.querySelectorAll('.power-up-slot');
        
        powerUpSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                const powerUpType = slot.getAttribute('data-type');
                const currentPlayerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
                
                // Make sure it's the player's turn
                if (isOnlineGame && currentPlayer !== playerNumber) {
                    messageElement.textContent = "It's not your turn!";
                    return;
                }
                
                // Check if player has this power-up
                if (!currentPlayerPowerUps.includes(powerUpType)) {
                    return; // No power-up available
                }
                
                // Toggle power-up selection
                if (selectedPowerUp === powerUpType) {
                    selectedPowerUp = null;
                    messageElement.textContent = "Power-up deselected.";
                } else {
                    selectedPowerUp = powerUpType;
                    messageElement.textContent = `${powerUpType.charAt(0).toUpperCase() + powerUpType.slice(1)} power-up selected. Click on a tile to use it.`;
                }
                
                // Update the display
                updatePowerUpDisplay();
            });
        });
    }
    
    // Handle canvas click events
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        const closestHex = findHexAtPosition(clickX, clickY);
        
        // If a power-up is selected, handle power-up usage
        if (selectedPowerUp && closestHex) {
            usePowerUp(selectedPowerUp, closestHex.row, closestHex.col);
            return;
        }
        
        // Debug: Show info about the clicked tile
        if (closestHex) {
            const { row, col } = closestHex;
            const tile = gameBoard[row][col];
            const isPlayer1 = player1Tiles.has(`${row},${col}`);
            const isPlayer2 = player2Tiles.has(`${row},${col}`);
            
            console.log(`Clicked tile: (${row}, ${col})`);
            console.log(`Color: ${tile.color}`);
            console.log(`Owner: ${isPlayer1 ? 'Player 1' : isPlayer2 ? 'Player 2' : 'None'}`);
            console.log(`Has mine: ${tile.hasMine ? 'Yes' : 'No'}`);
        }
    });
    
    // Use a power-up on a specific tile
    function usePowerUp(powerUpType, row, col) {
        const tileKey = `${row},${col}`;
        const isPlayer1Owned = player1Tiles.has(tileKey);
        const isPlayer2Owned = player2Tiles.has(tileKey);
        const isOwnedByCurrentPlayer = (currentPlayer === 1 && isPlayer1Owned) || (currentPlayer === 2 && isPlayer2Owned);
        const isOwnedByOpponent = (currentPlayer === 1 && isPlayer2Owned) || (currentPlayer === 2 && isPlayer1Owned);
        
        switch (powerUpType) {
            case POWER_UPS.SABOTAGE:
                // Can only use on opponent's territory
                if (!isOwnedByOpponent) {
                    messageElement.textContent = "Sabotage can only be used on opponent's territory!";
                    return;
                }
                
                applySabotage(row, col);
                break;
                
            case POWER_UPS.WILDCARD:
                // Can only use on unclaimed tiles adjacent to owned territory
                if (isPlayer1Owned || isPlayer2Owned) {
                    messageElement.textContent = "Wildcard can only be used on unclaimed tiles!";
                    return;
                }
                
                // Check if adjacent to current player's territory
                const neighbors = getNeighbors(row, col);
                let isAdjacentToOwn = false;
                
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.row},${neighbor.col}`;
                    if ((currentPlayer === 1 && player1Tiles.has(neighborKey)) || 
                        (currentPlayer === 2 && player2Tiles.has(neighborKey))) {
                        isAdjacentToOwn = true;
                        break;
                    }
                }
                
                if (!isAdjacentToOwn) {
                    messageElement.textContent = "Wildcard must be adjacent to your territory!";
                    return;
                }
                
                applyWildcard(row, col);
                break;
                
            case POWER_UPS.TELEPORT:
                // Can use on any unclaimed tile
                if (isPlayer1Owned || isPlayer2Owned) {
                    messageElement.textContent = "Teleport can only be used on unclaimed tiles!";
                    return;
                }
                
                applyTeleport(row, col);
                break;
        }
        
        // Reset selected power-up
        selectedPowerUp = null;
        updatePowerUpDisplay();
    }
    
    // Apply sabotage power-up (convert opponent territory to neutral over time)
    function applySabotage(row, col) {
        const tileKey = `${row},${col}`;
        const sabotagedColor = gameBoard[row][col].color;
        
        // Remove from opponent's territory
        if (currentPlayer === 1) {
            player2Tiles.delete(tileKey);
        } else {
            player1Tiles.delete(tileKey);
        }
        
        // Change the tile color to indicate sabotage (dark red)
        gameBoard[row][col].color = '#8B0000';
        
        // Remove this power-up from the player's inventory
        const playerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        const powerUpIndex = playerPowerUps.indexOf(POWER_UPS.SABOTAGE);
        if (powerUpIndex !== -1) {
            playerPowerUps.splice(powerUpIndex, 1);
        }
        
        // Add to exploded tiles with longer recovery time (sabotage lasts longer)
        explodedTiles.push({
            row: row,
            col: col,
            turnsLeft: 3, // 3 turns to recover
            type: 'sabotage'
        });
        
        messageElement.textContent = "Sabotage successful! Territory will return to neutral over time.";
        renderGameBoard();
        updateScoreDisplay();
        updatePowerUpDisplay();
        
        // Switch turns
        switchPlayerTurn();
    }
    
    // Apply wildcard power-up (place a tile that matches any color)
    function applyWildcard(row, col) {
        const tileKey = `${row},${col}`;
        
        // Add to player's territory
        if (currentPlayer === 1) {
            player1Tiles.add(tileKey);
        } else {
            player2Tiles.add(tileKey);
        }
        
        // Set tile to player's current color
        gameBoard[row][col].color = currentPlayer === 1 ? player1Color : player2Color;
        
        // Remove this power-up from the player's inventory
        const playerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        const powerUpIndex = playerPowerUps.indexOf(POWER_UPS.WILDCARD);
        if (powerUpIndex !== -1) {
            playerPowerUps.splice(powerUpIndex, 1);
        }
        
        messageElement.textContent = "Wildcard successfully played! Territory expanded.";
        renderGameBoard();
        updateScoreDisplay();
        updatePowerUpDisplay();
        
        // Switch turns
        switchPlayerTurn();
    }
    
    // Apply teleport power-up (claim a tile anywhere on the board)
    function applyTeleport(row, col) {
        const tileKey = `${row},${col}`;
        
        // Add to player's territory
        if (currentPlayer === 1) {
            player1Tiles.add(tileKey);
        } else {
            player2Tiles.add(tileKey);
        }
        
        // Set tile to player's current color
        gameBoard[row][col].color = currentPlayer === 1 ? player1Color : player2Color;
        
        // Remove this power-up from the player's inventory
        const playerPowerUps = currentPlayer === 1 ? player1PowerUps : player2PowerUps;
        const powerUpIndex = playerPowerUps.indexOf(POWER_UPS.TELEPORT);
        if (powerUpIndex !== -1) {
            playerPowerUps.splice(powerUpIndex, 1);
        }
        
        messageElement.textContent = "Teleport successful! New foothold established.";
        renderGameBoard();
        updateScoreDisplay();
        updatePowerUpDisplay();
        
        // Switch turns
        switchPlayerTurn();
    }
    
    // Handle mouse movement for hover effects
    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        const hoveredHex = findHexAtPosition(mouseX, mouseY);
        
        // If the hovered hex has changed, update and redraw
        if (JSON.stringify(hoveredHex) !== JSON.stringify(hoverTile)) {
            hoverTile = hoveredHex;
            renderGameBoard();
        }
    });
    
    // Reset hover state when mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        hoverTile = null;
        renderGameBoard();
    });
    
    // Set up color button click handlers
    document.querySelectorAll('.color-button').forEach(button => {
        button.addEventListener('click', () => {
            const selectedColor = button.getAttribute('data-color');
            handleColorSelection(selectedColor);
        });
    });
    
    // Game control event listeners
    startGameButton.addEventListener('click', () => {
        // Local game mode
        isOnlineGame = false;
        playerNumber = 1;
        gameId = null;
        initializeGame();
        messageElement.textContent = "Started Outdoor Miner in local mode. Both players use this screen.";
    });
    
    createChallengeButton.addEventListener('click', () => {
        // Create a new online game
        isOnlineGame = true;
        playerNumber = 1;
        gameId = generateGameCode();
        
        // Initialize a new game
        initializeGame();
        
        // In a real implementation, we would send the initial game state to the server here
        // For now, we'll just show the game code
        messageElement.textContent = `Created Outdoor Miner challenge! Your code is: ${gameId}`;
        messageElement.innerHTML += `<br><span class="online-note">Share this code with your opponent. Currently simulating online play.</span>`;
        
        // Show the URL that could be shared (would redirect to a page with the game code pre-filled)
        const shareUrl = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
        console.log(`Share this URL: ${shareUrl}`);
    });
    
    connectChallengeButton.addEventListener('click', () => {
        const enteredCode = challengeCodeInput.value.trim();
        if (enteredCode) {
            // Join an existing game
            isOnlineGame = true;
            playerNumber = 2;
            gameId = enteredCode;
            
            // In a real implementation, we would fetch the game state from the server here
            // For now, we'll simulate joining a game
            messageElement.textContent = `Connected to game with code: ${gameId}`;
            messageElement.innerHTML += `<br><span class="online-note">Currently simulating online play.</span>`;
            
            // Initialize a new game (in a real implementation, we'd use the state from the server)
            initializeGame();
            
            // Since we're player 2, switch to player 1's turn
            currentPlayer = 1;
            setupColorButtons();
        } else {
            messageElement.textContent = "Please enter a challenge code.";
        }
    });
    
    // Check if there's a game code in the URL params when the page loads
    function checkUrlForGameCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameCodeFromUrl = urlParams.get('game');
        
        if (gameCodeFromUrl) {
            challengeCodeInput.value = gameCodeFromUrl;
            messageElement.textContent = `Found game code in URL: ${gameCodeFromUrl}. Click Connect to join.`;
        }
    }
    
    // Helper function to generate a simple game code
    function generateGameCode() {
        // In a real implementation, this would generate a unique ID or get one from the server
        return Math.floor(100000 + Math.random() * 900000); // 6-digit code
    }
    
    // Simulate sending a move to the server
    function sendMoveToServer(selectedColor) {
        // In a real implementation, this would send the move to a server
        // For now, we'll just log it
        console.log(`NETWORK: Player ${playerNumber} selected color: ${selectedColor}`);
        console.log(`NETWORK: Game ID: ${gameId}`);
        
        // In a real game, we would handle receiving the opponent's move here
        // For simulation purposes, we'll continue with the local game logic
    }
    
    // Initialize the game when the page loads
    initializeGame();
    
    // Check for game code in URL
    checkUrlForGameCode();
});