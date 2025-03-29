![1743202449728](image/README/1743202449728.png)

# Outdoor Miner: Hex Territory Game

## Game Overview

A multiplayer territory capture game played on a hexagonal grid. Players compete to control territory by strategically selecting colors and expanding their influence.

### Core Mechanics

- **Board**: 16x16 hexagonal grid
- **Players**: 2 players (online multiplayer)
- **Colors**: 5 unique colors
  - Red (#F76C6C)
  - Blue (#374785)
  - Yellow (#F8E9A1)
  - Green (#50C878)
  - Purple (#9B59B6)
- **Gameplay Loop**:
  1. Players start from opposite corners
  2. Each turn: select a color to capture adjacent matching tiles
  3. Captured tiles + owned territory change to selected color
  4. Cannot use opponent's last-used color
  5. Game ends when board is filled
  6. Winner: Player with most territory

### Technical Implementation

- **Canvas-based rendering** with dynamic scaling
- **WebSocket communication** for real-time gameplay
- **Event-driven architecture** for game state management
- **Responsive design** adapting to various screen sizes

## Current Status 🚦

### Active Issues 🔴

1. Player 2 Connection Flow

   - Room code not being sent to player 1
   - Join process not completing
   - Connection status unclear
2. Board Rendering

   - Board showing as single black tile
   - Color buttons duplicating

### Debug Notes 🔧

1. Player 1 (Host) Flow:
   ✓ Creates game
   ✓ Gets connected to server
   ⨯ Never receives room code to share
   ✓ Board initializes (but renders incorrectly)
2. Player 2 Flow:
   ✓ Enters name
   ⨯ No room code to enter
   ⨯ Join button sends empty room code
   ⨯ Cannot connect to existing game

### Immediate Fixes Needed 🚀

1. Room Code Generation & Display

   ```javascript
   // In network.js - emitCreateChallenge
   socketInstance.emit('create-challenge', playerName, (response) => {
       if (response.success) {
           currentRoomId = response.challengeCode;
           // Add this line to show code to player 1
           document.getElementById('game-id-display').textContent = response.challengeCode;
           document.getElementById('challenge-info').style.display = 'block';
       }
   });
   ```
2. Join Flow Update

   - Validate room code before sending
   - Show clear error if code missing
   - Display connection status during join

### Next Steps ⏭️

1. Fix Player Connection (Priority)

   - [ ] Implement room code display
   - [ ] Add room code validation
   - [ ] Fix join game flow
   - [ ] Add connection status feedback
2. Board Rendering

   - [ ] Fix hex grid initialization
   - [ ] Resolve color button duplication
   - [ ] Implement proper scaling
3. UI Polish

   - [ ] Add loading states
   - [ ] Improve error messages
   - [ ] Show player status clearly

## Architecture Notes 📝

### Component Structure

- game-container
  - game-header (scores + status)
  - game-area (canvas)
  - color-selection
  - message-area

### Event Flow

1. User Input → UIManager
2. UIManager → EventManager
3. EventManager → Game Logic
4. Game Logic → Network
5. Network → State Update

### Critical Paths

1. Canvas Rendering

   - Calculate size from board dimensions
   - Center in viewport
   - Apply proper scaling
   - Handle window resize
2. UI State Management

   - Single source of truth for status
   - Consolidated message system
   - Proper event propagation
3. Event System

   - Proper initialization order
   - Clear event type definitions
   - Consistent error handling

## Code Audit 🔍

### Orphaned Code Identified

1. Multiple Game State Management:

   - Both `gameLogic.js` and `GameState` class have initialization methods
   - Duplicate board creation logic across files
   - Unclear ownership of game state between network and local
2. Duplicate Event Systems:

   - `eventManager.js` and `eventTypes.js` have overlapping definitions
   - Some events defined but never dispatched
   - Network events not consistently handled
3. Dead Code:

   - `powerup` related CSS classes (already commented out)
   - Unused audio elements in HTML
   - `handleMouseDown/Up/Move` defined but never bound

### Open Questions ❓

1. Game Flow

   - Should player 2 be able to see the board before game starts?
   - How should disconnections be handled mid-game?
   - What happens if player 1 leaves before player 2 joins?
2. State Management

   - Where should the source of truth for game state live?
   - How should we handle state sync between players?
   - Should we implement move validation on client side?
3. UI/UX

   - Should we show a loading state during connection?
   - How to handle window resize during active game?
   - Should we add visual feedback for invalid moves?

### Connection Flow Issues 🔌

1. Player 1 (Host):

   ```javascript
   // Current Flow
   Create Game Button Click
   -> connectToServer()
   -> socket.emit('create-challenge')
   -> Never shows room code
   ```
2. Player 2 (Joining):

   ```javascript
   // Current Flow
   Join Game Button Click
   -> Disabled until both fields filled
   -> connectToServer()
   -> No feedback during connection
   -> No error handling for invalid codes
   ```

### Next Steps (Prioritized) ⚡

1. Fix Connection Flow

   - [ ] Add room code display after game creation
   - [ ] Implement proper event handling for join attempts
   - [ ] Add connection status feedback
   - [ ] Handle invalid room codes
2. Clean Up Code

   - [ ] Consolidate event systems
   - [ ] Remove unused audio/powerup code
   - [ ] Fix event listener bindings
   - [ ] Implement proper error handling
3. Improve Game State Management

   - [ ] Define single source of truth
   - [ ] Implement proper state sync
   - [ ] Add validation layer
   - [ ] Handle disconnections gracefully

## Current Development Status 🚧

### Active Issues (Feb 2024)

1. Join Flow Problems
   - Player 2 connection errors with socket ID
   - Race condition in connection handling
   - Multiple connection attempts on rapid clicks
   - Message persistence issues

2. UI/UX Issues
   - Duplicate displayMessage function in ui.js
   - Score container positioning and spacing
   - Excessive whitespace around hexboard
   - Player name "(you)" suffix unnecessary

### Technical Debt

1. Event System
   - Duplicate event definitions between eventManager.js and eventTypes.js
   - Inconsistent event naming conventions
   - Missing event validation in some dispatches
   - Event listeners not properly cleaned up

2. State Management
   - Multiple sources of truth for game state
   - Unclear ownership between network and local state
   - No proper state reconciliation after disconnects
   - Missing validation layer for moves

3. Code Organization
   - Duplicate message display logic
   - Orphaned event listeners
   - Unused audio and powerup code
   - Missing TypeScript definitions

### Open Questions

1. Architecture
   - Should we implement a proper state machine?
   - Do we need a middleware layer for network calls?
   - How to handle state rollback on connection issues?
   - Should we add client-side move validation?

2. UX Decisions
   - How to handle disconnections mid-game?
   - Should spectator mode be added?
   - What's the best way to show game history?
   - How to improve feedback for invalid moves?

3. Testing
   - Need unit tests for game logic
   - Integration tests for network flow
   - UI component testing strategy
   - Performance testing for large boards

### Next Steps

1. Immediate Fixes
   - [ ] Fix connection race conditions
   - [ ] Implement proper socket ID handling
   - [ ] Add connection status feedback
   - [ ] Fix message display system

2. Technical Improvements
   - [ ] Consolidate event systems
   - [ ] Implement proper state management
   - [ ] Add error recovery system
   - [ ] Clean up unused code

3. Feature Additions
   - [ ] Add game history
   - [ ] Implement spectator mode
   - [ ] Add move validation
   - [ ] Improve disconnection handling

### Known Limitations

1. Network
   - No reconnection handling
   - Limited error feedback
   - Socket ID validation issues
   - Connection state management needs work

2. UI
   - No mobile optimization
   - Limited accessibility
   - No dark mode support
   - Missing loading states

3. Game Logic
   - No move validation
   - Missing win condition checks
   - No game history
   - Limited error handling
