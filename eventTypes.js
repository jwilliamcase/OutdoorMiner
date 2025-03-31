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
    CONNECTED: 'network:connected',      // Match with what network.js uses
    DISCONNECTED: 'network:disconnected',
    ERROR: 'network:error',
    SYNC_START: 'network:sync_start',
    SYNC_COMPLETE: 'network:sync_complete',
    SYNC_ERROR: 'network:sync_error',
    STATE_RECEIVED: 'network:state_received',
    STATE_SENT: 'network:state_sent',
    STATE_VALIDATION_ERROR: 'network:state_validation_error',
    STATE_VERSION_MISMATCH: 'network:state_version_mismatch',
    PLAYER_ID_CHANGED: 'network:player_id_changed'
};

export const UIEvents = {
    CREATE_CLICK: 'ui:create_click',
    JOIN_CLICK: 'ui:join_click',
    ERROR: 'ui:error',
    CREATE_GAME_REQUEST: 'ui:create_game_request',
    CREATE_GAME_SUCCESS: 'ui:create_game_success',
    CREATE_GAME_FAILURE: 'ui:create_game_failure',
    SHOW_GAME_SCREEN: 'ui:show_game_screen',
    GAME_CREATED: 'ui:game_created',
    GAME_JOINED: 'ui:game_joined',
    INIT: 'ui:init',
    STATE_UPDATE: 'ui:state_update',
    BOARD_RENDER: 'ui:board_render',
    COLOR_SELECTED: 'ui:color_selected',
    CONNECT_STATUS: 'ui:connect_status',
    DISPLAY_MESSAGE: 'ui:display_message',
    SETUP_SCREEN: 'ui:setup_screen',
    GAME_SCREEN: 'ui:game_screen',
    UPDATE_GAME_CODE: 'ui:update_game_code',
    COLOR_BUTTON_INIT: 'ui:color_button_init',
    PLAYER_NAME_UPDATE: 'ui:player_name_update',
    JOIN_GAME_SUCCESS: 'ui:join_game_success',
    JOIN_GAME_FAILURE: 'ui:join_game_failure'
};
