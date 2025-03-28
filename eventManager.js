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
        SYNC_COMPLETE: 'network:sync_complete'
    },
    UI: {
        COLOR_SELECTED: 'ui:color_selected',
        CANVAS_CLICK: 'ui:canvas_click',
        CAMERA_MOVE: 'ui:camera_move'
    }
};

class EventManager {
    constructor() {
        this.listeners = new Map();
        this.eventLog = [];
        this.MAX_LOG_SIZE = 1000;
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
        // Early validation of event type
        if (!type || typeof type !== 'string') {
            console.error("Invalid event type:", type);
            console.debug("Event data:", data);
            return;
        }

        // Get all valid event types
        const validTypes = Object.values(EventTypes)
            .reduce((acc, group) => ([
                ...acc,
                ...Object.values(group)
            ]), []);

        // Validate event type
        if (!validTypes.includes(type)) {
            console.warn(`Unknown event type: ${type}`);
            console.debug("Valid types:", validTypes);
            return;
        }

        this.logEvent(type, data);
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
