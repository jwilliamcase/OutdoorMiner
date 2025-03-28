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

### Recent Fixes 🔧
1. Board Rendering
   - Fixed duplicate canvas resize handlers
   - Stabilized scaling calculations
   - Removed duplicate color button initialization
   - Added consistent padding for board layout

### Current Issues 🔴
1. Canvas/Board
   - Single black tile rendering instead of full board
   - Color buttons showing duplicates
   - Board scaling needs optimization

### Next Steps ⏭️
1. Critical Fixes
   - [ ] Debug board rendering in renderGameBoard()
   - [ ] Clean up event listener initialization
   - [ ] Implement proper board state management

2. UI Cleanup
   - [ ] Consolidate color button handling
   - [ ] Improve scale calculations
   - [ ] Add loading states

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
