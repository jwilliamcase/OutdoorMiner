export const GameEvents = {
    MOVE: 'game:move',
    STATE_UPDATE: 'game:state_update',
    TURN_CHANGE: 'game:turn_change',
    CAPTURE: 'game:capture',
    SCORE_UPDATE: 'game:score_update',
    GAME_OVER: 'game:game_over',
    JOIN_ATTEMPT: 'game:join_attempt',
    JOIN_SUCCESS: 'game:join_success',
    JOIN_FAILURE: 'game:join_failure',
    GAME_START: 'game:start',
    PLAYER_TURN: 'game:player_turn',
    COLOR_SELECT: 'game:color_select',
    INVALID_MOVE: 'game:invalid_move',
    TURN_START: 'game:turn_start',
    MOVE_MADE: 'game:move_made',
    TILE_CAPTURE: 'game:tile_capture',
    STATE_CHANGE: 'game:state_change',
    CREATE_GAME: 'game:create_game',
    JOIN_GAME: 'game:join_game'
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
    JOIN_COMPLETE: 'ui:join_complete',
    CREATE_CLICK: 'ui:create_click',
    JOIN_CLICK: 'ui:join_click',
    DISCONNECT: 'ui:disconnect',
    OPPONENT_LEFT: 'ui:opponent_left',
    BOARD_RENDER: 'ui:board_render',
    TURN_CHANGE: 'ui:turn_change',
    STATE_UPDATE: 'ui:state_update',
    SCORE_UPDATE: 'ui:score_update',
    BOARD_UPDATE: 'ui:board_update'
};
