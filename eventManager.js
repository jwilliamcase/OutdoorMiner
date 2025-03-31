import { UIEvents, NetworkEvents, GameEvents } from './eventTypes.js';
import { CONFIG } from './config.js';  // Add CONFIG import

export const EventTypes = {
    GAME: {
        STATE_CHANGE: 'game:state_change',
        TURN_START: 'game:turn_start',
        MOVE_MADE: 'game:move_made',
        GAME_OVER: 'game:game_over'
    },
    NETWORK: {
        CONNECTED: 'network:connected',
        DISCONNECTED: 'network:disconnected',
        ERROR: 'network:error',
        SYNC_START: 'network:sync_start',
        SYNC_COMPLETE: 'network:sync_complete',
        CONNECTION_ERROR: 'network:connection_error'
    },
    UI: {
        COLOR_SELECTED: 'ui:color_selected',
        CANVAS_CLICK: 'ui:canvas_click',
        CAMERA_MOVE: 'ui:camera_move',
        CREATE_CLICK: 'ui:create_click',
        JOIN_CLICK: 'ui:join_click',
        ERROR: 'ui:error'
    }
};

class EventManager {
    constructor() {
        this.listeners = new Map();
        this.eventLog = [];
        this.MAX_LOG_SIZE = 1000;

        // Collect all event types after importing them
        const allEventTypes = [
            ...Object.values(EventTypes.UI || {}),
            ...Object.values(EventTypes.NETWORK || {}),
            ...Object.values(EventTypes.GAME || {}),
            ...Object.values(UIEvents || {}),
            ...Object.values(NetworkEvents || {}),
            ...Object.values(GameEvents || {})
        ].filter(Boolean);

        // Create Set from unique values
        this.validEventTypes = new Set(allEventTypes);

        // Only log if CONFIG exists and DEBUG is true
        if (CONFIG?.DEBUG) {
            console.debug('Registered event types:', Array.from(this.validEventTypes));
        }
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(handler);
        return () => this.removeEventListener(type, handler);
    }

    removeEventListener(type, handler) {
        const handlers = this.listeners.get(type);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    dispatchEvent(type, data) {
        if (!type) {
            console.error('Invalid event type:', type);
            return false;
        }

        // Log event before validation for debugging
        console.debug(`Attempting to dispatch event: ${type}`, data);

        if (!this.validEventTypes.has(type)) {
            console.error('Unknown event type:', type, 'Valid types:', Array.from(this.validEventTypes));
            return false;
        }

        const handlers = this.listeners.get(type);
        if (handlers?.size > 0) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${type}:`, error);
                }
            });
        }

        this.logEvent(type, data);
        return true;
    }

    logEvent(type, data) {
        const event = {
            timestamp: Date.now(),
            type,
            data
        };
        this.eventLog.push(event);
        if (this.eventLog.length > this.MAX_LOG_SIZE) {
            this.eventLog.shift();
        }
        console.debug(`Event: ${type}`, data);
    }

    getEventLog() {
        return [...this.eventLog];
    }

    clearEventLog() {
        this.eventLog = [];
    }
}

export const eventManager = new EventManager();
