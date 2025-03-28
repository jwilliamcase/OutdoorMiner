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
