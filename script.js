document.addEventListener('DOMContentLoaded', () => {
    // Canvas setup
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    const player1ScoreElement = document.getElementById('your-score');
    const player2ScoreElement = document.getElementById('opponent-score-value');
    const messageElement = document.getElementById('message');
    const startGameButton = document.getElementById('start-game');
    const createChallengeButton = document.getElementById('create-challenge');
    const challengeCodeInput = document.getElementById('challenge-code');
    const connectChallengeButton = document.getElementById('connect-challenge');

    // Game constants
    const BOARD_SIZE = 11; // 11x11 grid for better centering
    const HEX_SIZE = 25; // Radius of hexagon
    const HEX_HEIGHT = HEX_SIZE * 2;
    const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
    const BOARD_PADDING = 5; // Slight padding
    
    // Colors for the game
    const COLORS = [
        '#4CAF50', // Green
        '#E91E63', // Pink/Magenta (replacing Red)
        '#2196F3', // Blue
        '#9C27B0', // Purple
        '#FFEB3B', // Bright Yellow
        '#FF9800'  // Orange (more distinct)
    ];
    
    // Game state
    let gameBoard = [];
    let player1Tiles = new Set(); // Set of coordinates owned by player 1 (format: "row,col")
    let player2Tiles = new Set(); // Set of coordinates owned by player 2
    let currentPlayer = 1;
    let player1Color = '';
    let player2Color = '';
    let availableColors = [...COLORS];
    let hoverTile = null; // Track which tile the mouse is hovering over
    
    // Online multiplayer variables
    let gameId = null; // Unique identifier for this game
    let isOnlineGame = false; // Whether this is an online multiplayer game
    let playerNumber = 1; // Which player this client represents (1 or 2)
    
    // Initialize the game
    function initializeGame() {
        createGameBoard();
        setupInitialTiles();
        resetAvailableColors();
        renderGameBoard();
        updateScoreDisplay();
        setupColorButtons();
        messageElement.textContent = "Welcome to Outdoor Miner! Your turn.";
    }
    
    // Create the game board with random colors
    function createGameBoard() {
        gameBoard = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            gameBoard[row] = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                gameBoard[row][col] = {
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    row: row,
                    col: col
                };
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
        
        // Players can select their current color if they'd like
        // But they can't select the opponent's current color
        if (currentPlayer === 1) {
            // Can't select opponent's current color
            availableColors = availableColors.filter(c => c !== player2Color);
        } else {
            // Can't select opponent's current color
            availableColors = availableColors.filter(c => c !== player1Color);
        }
    }
    
    // Draw a single hexagon
    function drawHexagon(x, y, size, color, isOwned = false, ownedBy = 0) {
        const sides = 6;
        const angle = (2 * Math.PI) / sides;
        
        // Save current context state
        ctx.save();
        
        // Drop shadow for all hexagons
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 5;
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
            ctx.strokeStyle = ownedBy === 1 ? '#3498db' : '#e74c3c';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw a glowing circle to indicate ownership
            ctx.beginPath();
            ctx.arc(x, y, size / 3, 0, 2 * Math.PI);
            const ownerColor = ownedBy === 1 ? '#3498db' : '#e74c3c';
            
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
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
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
                    isPlayer1Owned ? 1 : (isPlayer2Owned ? 2 : 0)
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
    
    // Switch to the next player's turn
    function switchPlayerTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        resetAvailableColors();
        setupColorButtons();
        
        // Check for game over
        if (isGameOver()) {
            endGame();
        }
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
    
    // Handle canvas click events
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        const closestHex = findHexAtPosition(clickX, clickY);
        
        // Debug: Show info about the clicked tile
        if (closestHex) {
            const { row, col } = closestHex;
            const tile = gameBoard[row][col];
            const isPlayer1 = player1Tiles.has(`${row},${col}`);
            const isPlayer2 = player2Tiles.has(`${row},${col}`);
            
            console.log(`Clicked tile: (${row}, ${col})`);
            console.log(`Color: ${tile.color}`);
            console.log(`Owner: ${isPlayer1 ? 'Player 1' : isPlayer2 ? 'Player 2' : 'None'}`);
        }
    });
    
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