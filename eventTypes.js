export const GameEvents = {
    MOVE: 'game:move',
    STATE_UPDATE: 'game:state_update',
    TURN_CHANGE: 'game:turn_change',
    CAPTURE: 'game:capture',
    SCORE_UPDATE: 'game:score_update',
    GAME_OVER: 'game:game_over'
};

export const NetworkEvents = {
    SYNC_START: 'network:sync_start',
    SYNC_COMPLETE: 'network:sync_complete',
    SYNC_ERROR: 'network:sync_error',
    STATE_RECEIVED: 'network:state_received',
    STATE_SENT: 'network:state_sent'
};
