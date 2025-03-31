import { eventManager } from '../eventManager.js';
import { EVENTS } from '../constants.js';

class NetworkManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.gameId = null;
        this.playerId = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    connect(options = {}) {
        if (this.socket?.connected) {
            console.warn('Already connected');
            return Promise.resolve(this.socket.id);
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket = io(CONFIG.SERVER_URL, {
                    transports: ['websocket'],
                    query: options,
                    reconnection: true,
                    timeout: 10000
                });

                this.setupEventHandlers();
                this.socket.on('connect', () => {
                    this.connected = true;
                    this.playerId = this.socket.id;
                    resolve(this.playerId);
                });

                this.socket.on('connect_error', (error) => {
                    this.handleConnectionError(error);
                    reject(error);
                });
            } catch (error) {
                this.handleConnectionError(error);
                reject(error);
            }
        });
    }

    // ... rest of implementation
}

export const networkManager = new NetworkManager();
