# Outdoor Miner: Hex Territory Game

## Core Game Mechanics
- 16x16 hexagonal grid
- 5 colors: Red (#F76C6C), Blue (#374785), Yellow (#F8E9A1), Green (#50C878), Purple (#9B59B6)
- Players claim territory by selecting colors
- All owned hexes update to selected color
- Can't reuse opponent's last color
- Game ends when board is filled

## Current Sprint

### Immediate Fixes (Critical)
1. Board Display
   - [ ] Fix missing HORIZONTAL_SPACING constant
   - [ ] Add missing DOM elements
   - [ ] Fix board initialization
   - [ ] Center view on player start

2. UI Elements
   - [ ] Add setupContainer to index.html
   - [ ] Add connection status elements
   - [ ] Fix element initialization order
   - [ ] Add error boundaries

### Player View Requirements
- Always show player in bottom-left
- Rotate board 180° for player 2
- Transform coordinates for server communication
- Maintain consistent color display

## Project Health

### Known Bugs
1. Critical
   - HORIZONTAL_SPACING undefined in rendering
   - setupContainer not found
   - Connection status elements missing
   - centerOnPlayerStart not defined

2. Non-Critical
   - Multiple click handlers on color buttons
   - Canvas event cleanup needed
   - Network recovery incomplete

### Code Cleanup
1. Remove
   - Powerup code from style.css
   - Unused UI elements
   - Duplicate event listeners

2. Consolidate
   - Move constants to central location
   - Streamline initialization sequence
   - Unify error handling

## Testing Status
- Unit Tests: Not started
- Integration Tests: Not started
- Core Game Logic: Needs validation
- Network Protocol: Needs testing

## Next Steps
1. Priority Tasks
   - Fix rendering constants
   - Add missing DOM elements
   - Implement proper initialization

2. Future Tasks
   - Add proper error recovery
   - Implement move history
   - Add state rollback

## Architecture Notes
- Game state managed in gameLogic.js
- UI handling in uiManager.js
- Network communication in network.js
- Event system handles state updates
