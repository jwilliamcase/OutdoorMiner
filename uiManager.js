import { CONFIG } from './config.js';
import { eventManager, EventTypes } from './eventManager.js';
import { GameEvents, UIEvents } from './eventTypes.js';  // Add this import

class UIManager {
    constructor() {
        this.elements = {};
        this.initialized = false;
        this.colorButtonsInitialized = false;
        this.eventListeners = new Map();
    }

    initialize() {
        try {
            if (this.initialized) {
                console.warn("UIManager already initialized");
                return true;
            }

            console.log("Initializing UI Manager...");
            
            // Cache DOM elements
            this.cacheElements();
            
            // Validate required elements
            this.validateRequiredElements();
            
            // Setup event listeners
            if (!this.setupEventListeners()) {
                throw new Error("Failed to setup event listeners");
            }

            this.initialized = true;
            console.log("UI Manager initialized successfully");
            return true;
        } catch (error) {
            console.error("UI initialization failed:", error.message);
            this.cleanup(); // Clean up any partial initialization
            return false;
        }
    }

    cacheElements() {
        this.elements = {
            setup: {
                container: document.getElementById('setup-container'),
                playerNameInput: document.getElementById('player-name-input'),
                roomCodeInput: document.getElementById('room-code-input'),
                createButton: document.getElementById('create-challenge-button'),
                joinButton: document.getElementById('join-challenge-button')
            },
            game: {
                container: document.getElementById('game-container'),
                canvas: document.getElementById('gameCanvas'),
                area: document.getElementById('game-area'),
                colorOptions: document.querySelector('.color-options'),
                turnIndicator: document.getElementById('turn-indicator'),
                scoreContainer: document.getElementById('score-container'),
                gameCodeDisplay: document.getElementById('current-game-code')
            },
            status: {
                container: document.getElementById('connection-status'),
                indicator: document.getElementById('connection-indicator'),
                text: document.getElementById('status-text'),
                message: document.getElementById('message-area')
            }
        };
    }

    validateRequiredElements() {
        const required = [
            'setup.container',
            'game.container',
            'game.canvas',
            'status.container',
            'status.indicator'
        ];

        const missing = required.filter(path => {
            const value = path.split('.').reduce((obj, key) => obj?.[key], this.elements);
            return !value;
        });

        if (missing.length > 0) {
            throw new Error(`Missing required elements: ${missing.join(', ')}`);
        }
    }

    setupEventListeners() {
        try {
            const setupElements = this.elements.setup;
            
            if (setupElements.createButton) {
                setupElements.createButton.addEventListener('click', () => {
                    const playerName = setupElements.playerNameInput?.value?.trim();
                    if (!playerName) {
                        this.displayMessage('Please enter your name', true);
                        return;
                    }
                    
                    eventManager.dispatchEvent(UIEvents.CREATE_CLICK, {
                        type: 'create',
                        playerName: playerName // Ensure playerName is passed correctly
                    });
                });
            }

            // Update CREATE_GAME_SUCCESS handler
            eventManager.addEventListener(UIEvents.CREATE_GAME_SUCCESS, (data) => {
                console.log('Received CREATE_GAME_SUCCESS:', data);
                if (!data?.code) {
                    console.error('Missing game code in CREATE_GAME_SUCCESS event', data);
                    return;
                }
                
                // Show game screen with the received code
                this.showGameScreen(data.code);
                
                // Initialize game elements
                this.initializeColorButtons();
                
                // Update player name if provided
                if (data.playerName) {
                    this.updatePlayerName(data.playerName);
                }
            });

            // Add handlers for new events
            eventManager.addEventListener(UIEvents.CREATE_GAME_SUCCESS, (data) => {
                if (data.code) {
                    this.showGameScreen(data.code);
                }
            });

            // Update join button handler to prevent multiple clicks
            if (setupElements.joinButton) {
                setupElements.joinButton.addEventListener('click', () => {
                    // Disable button to prevent double-clicks
                    setupElements.joinButton.disabled = true;
                    
                    const playerName = setupElements.playerNameInput?.value?.trim();
                    const roomCode = setupElements.roomCodeInput?.value?.trim();
                    
                    console.log("Join button clicked:", { playerName, roomCode });

                    if (!playerName || !roomCode) {
                        this.displayMessage("Please enter both name and room code", true);
                        setupElements.joinButton.disabled = false;
                        return;
                    }

                    // Single dispatch of join event
                    eventManager.dispatchEvent(UIEvents.JOIN_CLICK, {
                        type: 'join',
                        playerName,
                        roomCode: roomCode.toUpperCase()
                    });
                });
            }

            // Add proper join game success handling
            eventManager.addEventListener(UIEvents.JOIN_GAME_SUCCESS, (data) => {
                console.log('Join game success:', data);
                
                if (!data?.gameState) {
                    console.error('Invalid game state received');
                    return;
                }

                // Show game screen
                this.showGameScreen();
                
                // Update player names first
                if (data.players) {
                    this.updatePlayerInfo(data.players);
                }
                
                // Then update game state
                this.updateGameState(data.gameState);
                
                // Initialize UI elements
                this.initializeColorButtons();
            });

            // Add input validation listeners
            if (setupElements.playerNameInput && setupElements.roomCodeInput) {
                const validateInputs = () => {
                    const hasName = setupElements.playerNameInput.value.trim().length > 0;
                    const hasCode = setupElements.roomCodeInput.value.trim().length > 0;
                    if (setupElements.joinButton) {
                        setupElements.joinButton.disabled = !(hasName && hasCode);
                    }
                };

                setupElements.playerNameInput.addEventListener('input', validateInputs);
                setupElements.roomCodeInput.addEventListener('input', validateInputs);
                
                // Run initial validation
                validateInputs();
            }

            // Add window resize handler
            window.addEventListener('resize', () => {
                if (this.elements.game.canvas) {
                    eventManager.dispatchEvent(EventTypes.UI.RESIZE);
                }
            });

            // Update event handler to properly handle game start
            eventManager.addEventListener(GameEvents.GAME_START, (data) => {
                console.log('Game start received:', data);
                
                if (!data?.gameState || !data?.players) {
                    console.error('Invalid game start data');
                    return;
                }

                // Show game screen
                this.showGameScreen(data.roomCode);
                
                // Update player info
                this.updatePlayerInfo(data.players);
                
                // Update game state
                this.updateGameState(data.gameState);
            });

            return true;
        } catch (error) {
            console.error("Failed to setup event listeners:", error);
            return false;
        }
    }

    initializeColorButtons() {
        if (this.colorButtonsInitialized) return;
        
        const colorOptions = this.elements.game.colorOptions;
        if (!colorOptions) return false;

        colorOptions.innerHTML = ''; // Clear existing buttons
        
        CONFIG.GAME_COLORS.forEach(color => {
            const button = document.createElement('button');
            button.className = 'color-button';
            button.style.backgroundColor = color;
            button.dataset.color = color;
            button.id = `color-button-${color.substring(1)}`;
            
            // Update click handler to use network send
            button.addEventListener('click', (event) => {
                const color = event.target.dataset.color;
                if (sendColorSelection(color)) {
                    eventManager.dispatchEvent(UIEvents.COLOR_SELECTED, {
                        color: color
                    });
                }
            });
            
            colorOptions.appendChild(button);
        });

        this.colorButtonsInitialized = true;
        return true;
    }

    getElement(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.elements);
    }

    // Add event management methods
    addEventListener(element, type, handler, options = {}) {
        const key = `${element.id || 'anonymous'}_${type}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        
        element.addEventListener(type, handler, options);
        this.eventListeners.get(key).push({ handler, options });
        
        return () => this.removeEventListener(element, type, handler, options);
    }

    removeEventListener(element, type, handler, options = {}) {
        const key = `${element.id || 'anonymous'}_${type}`;
        const listeners = this.eventListeners.get(key);
        
        if (listeners) {
            element.removeEventListener(type, handler, options);
            this.eventListeners.set(key, 
                listeners.filter(l => l.handler !== handler)
            );
        }
    }

    clearEventListeners(elementId) {
        for (const [key, listeners] of this.eventListeners) {
            if (key.startsWith(elementId)) {
                const element = document.getElementById(elementId);
                if (element) {
                    listeners.forEach(({ handler, options }) => {
                        element.removeEventListener(key.split('_')[1], handler, options);
                    });
                }
                this.eventListeners.delete(key);
            }
        }
    }

    cleanup() {
        // Clean up all registered event listeners
        for (const [key, listeners] of this.eventListeners) {
            const [elementId, type] = key.split('_');
            const element = document.getElementById(elementId);
            if (element) {
                listeners.forEach(({ handler, options }) => {
                    element.removeEventListener(type, handler, options);
                });
            }
        }
        this.eventListeners.clear();
        this.colorButtonsInitialized = false;
    }

    handleConnectionStatus(connected, message) {
        const indicator = this.elements.status.indicator;
        const statusText = this.elements.status.text;
        
        if (indicator && statusText) {
            indicator.style.backgroundColor = connected ? '#4CAF50' : '#F44336';
            statusText.textContent = message || (connected ? 'Connected' : 'Disconnected');
        }
    }

    displayMessage(message, isError = false, autoClear = !isError) {
        const messageArea = this.elements.status.message;
        if (!messageArea) return;
        
        if (messageArea._timeoutId) {
            clearTimeout(messageArea._timeoutId);
            messageArea._timeoutId = null;
        }

        messageArea.textContent = message;
        messageArea.className = isError ? 'error-message' : 'info-message';

        if (autoClear) {
            messageArea._timeoutId = setTimeout(() => {
                if (messageArea.textContent === message) {
                    messageArea.textContent = '';
                    messageArea.className = '';
                }
            }, 5000);
        }
    }

    showSetupScreen() {
        const setupContainer = this.elements.setup.container;
        const gameContainer = this.elements.game.container;
        
        if (setupContainer) {
            setupContainer.style.display = 'flex';
        }
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        // Clear player info
        const player1Info = document.getElementById('player1-info');
        const player2Info = document.getElementById('player2-info');
        if (player1Info) player1Info.textContent = "Player 1: -";
        if (player2Info) player2Info.textContent = "Player 2: -";

        eventManager.dispatchEvent(UIEvents.SETUP_SCREEN);
    }

    showGameScreen(gameCode) {
        if (!this.elements.setup?.container || !this.elements.game?.container) {
            console.error("Required containers not found");
            return;
        }

        // Hide setup, show game
        this.elements.setup.container.style.display = 'none';
        this.elements.game.container.style.display = 'flex';

        // Initialize game elements
        this.initializeColorButtons();
        if (gameCode) {
            this.updateGameCode(gameCode);
        }

        // Ensure canvas is visible and properly sized
        const canvas = this.elements.game.canvas;
        if (canvas) {
            canvas.style.display = 'block';
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        // Dispatch game screen event with proper event type
        eventManager.dispatchEvent(UIEvents.GAME_SCREEN, {
            code: gameCode
        });
    }

    updateGameCode(code) {
        if (!code) return;
        
        const fullUrl = `${window.location.origin}${window.location.pathname}?code=${code}`;
        
        // Create or update share link
        let shareLink = document.querySelector('.share-link');
        if (!shareLink) {
            shareLink = document.createElement('div');
            shareLink.className = 'share-link';
            document.body.appendChild(shareLink);
        }

        shareLink.innerHTML = `
            <span>Share Code: ${code}</span>
            <input type="text" value="${fullUrl}" readonly onclick="this.select()">
            <button onclick="navigator.clipboard.writeText('${fullUrl}')">Copy URL</button>
        `;
        shareLink.style.display = 'flex';
    }

    updatePlayerName(name) {
        const player1Info = document.getElementById('player1-info');
        if (player1Info) {
            player1Info.textContent = `${name}: 0`;
        }
    }

    initializeColorButtons() {
        if (this.colorButtonsInitialized) return;
        
        const colorOptions = this.elements.game.colorOptions;
        if (!colorOptions) return false;

        colorOptions.innerHTML = ''; // Clear existing buttons
        
        CONFIG.GAME_COLORS.forEach(color => {
            const button = document.createElement('button');
            button.className = 'color-button';
            button.style.backgroundColor = color;
            button.dataset.color = color;
            button.id = `color-button-${color.substring(1)}`;
            
            // Update click handler to use network send
            button.addEventListener('click', (event) => {
                const color = event.target.dataset.color;
                if (sendColorSelection(color)) {
                    eventManager.dispatchEvent(UIEvents.COLOR_SELECTED, {
                        color: color
                    });
                }
            });
            
            colorOptions.appendChild(button);
        });

        this.colorButtonsInitialized = true;
        return true;
    }

    updateGameState(gameState) {
        if (!gameState) {
            console.error('Invalid game state received in updateGameState');
            return;
        }

        console.log('Updating game state:', gameState);

        try {
            // Ensure we have canvas context first
            const canvas = this.elements.game.canvas;
            const ctx = canvas.getContext('2d');
            
            if (!canvas || !ctx) {
                throw new Error('Canvas not available');
            }

            // Set proper canvas size
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            // Update player information first
            if (gameState.players) {
                this.updatePlayerInfo(gameState.players);
            }

            // Update turn indicator
            if (gameState.currentPlayer) {
                this.updateTurnIndicator(gameState.currentPlayer);
            }

            // Update board state
            if (gameState.boardState) {
                this.renderBoard(gameState.boardState);
            }

            // Update available colors last
            if (gameState.lastUsedColor) {
                this.updateAvailableColors(gameState.lastUsedColor);
            }

            // Dispatch state update event
            eventManager.dispatchEvent(UIEvents.STATE_UPDATE, { 
                state: gameState,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error in updateGameState:', error);
            this.displayMessage('Error updating game state', true);
        }
    }

    renderBoard(boardState) {
        if (!boardState) return;
        
        const canvas = this.elements.game.canvas;
        const ctx = canvas.getContext('2d');
        
        if (!canvas || !ctx) {
            console.error('Canvas not available for rendering');
            return;
        }

        // Clear canvas and set proper size
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw board state
        Object.entries(boardState).forEach(([coord, tile]) => {
            const [q, r] = coord.split(',').map(Number);
            this.drawHex(ctx, q, r, tile.color, tile.owner !== null);
        });
    }

    drawHex(ctx, q, r, color, isOwned) {
        const size = 25; // Base hex size
        const width = Math.sqrt(3) * size;
        const height = 2 * size;
        const { x, y } = this.hexToPixel(q, r, size);

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30;
            const angleRad = (Math.PI / 180) * angleDeg;
            const px = x + size * Math.cos(angleRad);
            const py = y + size * Math.sin(angleRad);
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();

        // Fill
        ctx.fillStyle = color;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = isOwned ? '#000' : '#666';
        ctx.lineWidth = isOwned ? 2 : 1;
        ctx.stroke();
    }

    hexToPixel(q, r, size) {
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = size * (3/2 * r);
        return { x, y };
    }

    updatePlayerInfo(players) {
        if (!players) return;
        
        const player1Info = document.getElementById('player1-info');
        const player2Info = document.getElementById('player2-info');
        
        if (player1Info && players.P1) {
            player1Info.textContent = `${players.P1.name}: ${players.P1.score || 0}`;
        }
        
        if (player2Info && players.P2) {
            player2Info.textContent = `${players.P2.name}: ${players.P2.score || 0}`;
        }
    }

    updateTurnIndicator(currentPlayer) {
        const turnIndicator = document.getElementById('turn-indicator');
        if (!turnIndicator) return;
        
        turnIndicator.textContent = `Current Turn: ${currentPlayer === 'P1' ? 'Player 1' : 'Player 2'}`;
        turnIndicator.className = `turn-indicator ${currentPlayer}-turn`;
    }

    // Add missing updateAvailableColors method
    updateAvailableColors(lastUsedColor) {
        const colorOptions = this.elements.game.colorOptions;
        if (!colorOptions) return;

        const buttons = colorOptions.querySelectorAll('.color-button');
        buttons.forEach(button => {
            const isLastUsed = button.dataset.color === lastUsedColor;
            button.disabled = isLastUsed;
            button.classList.toggle('disabled', isLastUsed);
        });
    }
}

// Export only the instance, no named exports
export const uiManager = new UIManager();
