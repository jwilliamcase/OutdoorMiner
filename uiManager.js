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
            this.elements = {
                game: {
                    canvas: document.getElementById('gameCanvas'),
                    container: document.getElementById('game-container'),
                    area: document.getElementById('game-area'),
                    colorOptions: document.querySelector('.color-options'),
                    turnIndicator: document.getElementById('turn-indicator')
                },
                status: {
                    connection: document.getElementById('connection-indicator'),
                    statusText: document.getElementById('status-text'),
                    messages: document.getElementById('message-area')
                },
                players: {
                    player1: document.getElementById('player1-info'),
                    player2: document.getElementById('player2-info')
                },
                setup: {
                    container: document.getElementById('setup-container')
                }
            };

            this.validateElements();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error("UI initialization failed:", error);
            return false;
        }
    }

    validateElements() {
        // Check critical elements
        const required = ['game.canvas', 'game.container', 'game.colorOptions'];
        required.forEach(path => {
            const value = path.split('.').reduce((obj, key) => obj?.[key], this.elements);
            if (!value) throw new Error(`Missing required element: ${path}`);
        });
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
