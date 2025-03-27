import { CONFIG } from './config.js';

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
            // Setup core UI element listeners
            const setupElements = this.elements.setup;
            if (setupElements.createButton) {
                this.addEventListener(setupElements.createButton, 'click', () => {
                    eventManager.dispatchEvent(EventTypes.UI.BUTTON_CLICK, { action: 'create' });
                });
            }

            if (setupElements.joinButton) {
                this.addEventListener(setupElements.joinButton, 'click', () => {
                    eventManager.dispatchEvent(EventTypes.UI.BUTTON_CLICK, { action: 'join' });
                });
            }

            // Add window resize handler
            window.addEventListener('resize', () => {
                if (this.elements.game.canvas) {
                    eventManager.dispatchEvent(EventTypes.UI.RESIZE);
                }
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
            button.id = `color-button-${color.substring(1)}`; // Create ID from color
            colorOptions.appendChild(button);
            
            // Add event listener through manager
            this.addEventListener(button, 'click', this.handleColorSelection);
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
}

export const uiManager = new UIManager();
