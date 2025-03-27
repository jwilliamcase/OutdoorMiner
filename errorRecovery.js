import { eventManager } from './eventManager.js';
import { GameEvents, NetworkEvents } from './eventTypes.js';
import { moveHistory } from './moveHistory.js';

class ErrorRecoveryManager {
    constructor() {
        this.recoveryStrategies = new Map();
        this.errorLog = [];
        this.isRecovering = false;
    }

    initialize() {
        // Set up recovery strategies
        this.recoveryStrategies.set('move_validation_failed', this.handleMoveValidationError);
        this.recoveryStrategies.set('state_sync_failed', this.handleStateSyncError);
        this.recoveryStrategies.set('network_disconnect', this.handleNetworkDisconnect);

        // Listen for errors
        eventManager.addEventListener(NetworkEvents.SYNC_ERROR, this.handleError.bind(this));
        eventManager.addEventListener(GameEvents.MOVE, this.trackMove.bind(this));
    }

    handleError(error) {
        this.errorLog.push({
            timestamp: Date.now(),
            type: error.type,
            data: error
        });

        const strategy = this.recoveryStrategies.get(error.type);
        if (strategy && !this.isRecovering) {
            this.isRecovering = true;
            try {
                strategy.call(this, error);
            } finally {
                this.isRecovering = false;
            }
        }
    }

    async handleMoveValidationError(error) {
        // Find last valid move
        const lastValidMove = moveHistory.getCurrentMove();
        
        if (lastValidMove) {
            // Restore to last valid state
            window.gameState.restoreFromHistory(moveHistory.currentIndex);
            
            eventManager.dispatchEvent(GameEvents.STATE_UPDATE, {
                type: 'recovery',
                source: 'move_validation',
                restored: lastValidMove
            });
        } else {
            // Request full state from server if no history
            await this.handleStateSyncError(error);
        }
    }

    async handleStateSyncError(error) {
        // Request full state from server
        eventManager.dispatchEvent(NetworkEvents.STATE_RECEIVED, {
            type: 'request_full_state'
        });
        return this.waitForSync();
    }

    async handleNetworkDisconnect(error) {
        const recoveryData = {
            timestamp: Date.now(),
            gameState: window.gameState.serialize(),
            moveHistory: moveHistory.serialize(),
            lastValidMove: moveHistory.getCurrentMove()
        };
        
        sessionStorage.setItem('gameRecoveryState', JSON.stringify(recoveryData));
        return this.waitForSync();
    }

    async waitForSync() {
        return new Promise((resolve) => {
            eventManager.addEventListener(NetworkEvents.SYNC_COMPLETE, resolve, { once: true });
        });
    }

    async restoreFromStorage() {
        const savedData = sessionStorage.getItem('gameRecoveryState');
        if (!savedData) return false;

        try {
            const recoveryData = JSON.parse(savedData);
            moveHistory.deserialize(recoveryData.moveHistory);
            
            // Restore game state
            const success = window.gameState.restoreFromHistory(
                moveHistory.currentIndex
            );

            if (success) {
                eventManager.dispatchEvent(GameEvents.STATE_UPDATE, {
                    type: 'recovery',
                    source: 'storage',
                    timestamp: recoveryData.timestamp
                });
            }

            return success;
        } catch (error) {
            console.error('Recovery failed:', error);
            return false;
        }
    }

    getErrorLog() {
        return [...this.errorLog];
    }

    clearErrorLog() {
        this.errorLog = [];
    }
}

export const errorRecovery = new ErrorRecoveryManager();
