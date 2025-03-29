export const GameEvents = {
    MOVE: 'game:move',
    STATE_UPDATE: 'game:state_update',
    TURN_CHANGE: 'game:turn_change',
    CAPTURE: 'game:capture',
    SCORE_UPDATE: 'game:score_update',
    GAME_OVER: 'game:game_over',
    JOIN_ATTEMPT: 'game:join_attempt',
    JOIN_SUCCESS: 'game:join_success',
    JOIN_FAILURE: 'game:join_failure'
};

export const NetworkEvents = {
    SYNC_START: 'network:sync_start',
    SYNC_COMPLETE: 'network:sync_complete',
    SYNC_ERROR: 'network:sync_error',
    STATE_RECEIVED: 'network:state_received',
    STATE_SENT: 'network:state_sent'
};

export const UIEvents = {
    BUTTON_CLICK: 'ui:button_click',
    COLOR_SELECT: 'ui:color_select',
    RESIZE: 'ui:resize',
    STATE_CHANGE: 'ui:state_change',
    ERROR: 'ui:error',
    JOIN_GAME: 'ui:join_game',
    CREATE_GAME: 'ui:create_game',
    INIT: 'ui:init',
    JOIN_START: 'ui:join_start',
    JOIN_COMPLETE: 'ui:join_complete'
};
