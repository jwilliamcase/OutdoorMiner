# Outdoor Miner: Hex Territory Game

## Core Game Mechanics
- 16x16 hexagonal grid
- 5 colors: Red (#F76C6C), Blue (#374785), Yellow (#F8E9A1), Green (#50C878), Purple (#9B59B6)
- Players claim territory by selecting colors
- All owned hexes update to selected color
- Can't reuse opponent's last color
- Game ends when board is filled

## Current Status 🚦

### Active Issues 🔴
1. Canvas/Board
   - Canvas size not adapting to board dimensions
   - Board positioning off-center, clipping at edges
   - View not centering correctly on game start
   - Game area container needs responsive sizing

2. UI Elements
   - Double score container (one visible, one hidden)
   - Multiple message-area elements causing conflicts
   - Connection status display unreliable

3. Event System
   - eventManager reference missing in UIManager
   - Missing EventTypes definitions
   - Event binding sequence unclear

### Orphaned Code 🗑️
1. Duplicate Elements
   - Two separate score-container divs
   - Multiple message-area elements
   - Redundant game status displays

2. Dead Code
   - Unused powerup styles (can be removed)
   - Local game mode remnants
   - Unused audio elements
   - Stale chat system code

### Next Steps ⏭️
1. Immediate Fixes
   - [ ] Fix canvas sizing logic
   - [ ] Center board in viewport
   - [ ] Remove duplicate score containers
   - [ ] Clean up message area implementations
   - [ ] Add eventManager imports

2. Technical Debt
   - [ ] Remove powerup-related CSS
   - [ ] Clean up unused audio elements
   - [ ] Consolidate message displays
   - [ ] Fix event system dependencies

3. DOM Cleanup
   - [ ] Remove duplicate IDs
   - [ ] Consolidate status displays
   - [ ] Fix container hierarchy
   - [ ] Clean up unused elements

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
