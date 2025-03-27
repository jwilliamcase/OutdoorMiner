# Outdoor Miner: Hex Territory Game

## Core Game Mechanics
- 16x16 hexagonal grid
- 5 colors: Red (#F76C6C), Blue (#374785), Yellow (#F8E9A1), Green (#50C878), Purple (#9B59B6)
- Players claim territory by selecting colors
- All owned hexes update to selected color
- Can't reuse opponent's last color
- Game ends when board is filled

## Current Sprint

### Recent Fixes ✅
1. Board Display
   - ✅ Centralized constants in constants.js
   - ✅ Fixed HORIZONTAL_SPACING reference
   - ✅ Added board rotation for Player 2
   - ✅ Added consistent player view

2. Architecture
   - ✅ Created central constants file
   - ✅ Updated geometry calculations
   - ✅ Fixed import/export structure
   - ✅ Cleaned up UI manager

### Current Issues 🔄
1. DOM Elements
   - [ ] Missing setupContainer
   - [ ] Connection status not found
   - [ ] Element initialization timing
   - [ ] Event binding sequence

2. Game Flow
   - [ ] Player start position unclear
   - [ ] Turn transition feedback
   - [ ] Move validation feedback
   - [ ] Score display updates

### Current Sprint Status

1. DOM Structure ⏳
   - ✅ Added missing containers
   - ✅ Fixed element hierarchy
   - ✅ Added connection status
   - ⏳ Validating element initialization

2. UI Updates ⏳
   - ✅ Game container structure
   - ✅ Setup screen layout
   - ✅ Status indicators
   - ⏳ Element caching

3. Next Tasks
   - [ ] Test element validation
   - [ ] Add error boundaries
   - [ ] Implement UI feedback
   - [ ] Add loading states

### Next Steps ⏭️
1. DOM Structure
   - Add missing containers
   - Fix element hierarchy
   - Add status elements
   - Implement feedback UI

2. Game State
   - Initialize board correctly
   - Handle player positions
   - Implement turn flow
   - Add move validation

## Technical Notes
1. Constants
   - Now using BOARD object for geometry
   - COLORS object for game colors
   - EVENTS for system events
   - Consistent spacing calculations

2. View Management
   - Player always sees from bottom-left
   - Board rotates 180° for Player 2
   - Coordinates transform automatically
   - Click handling adjusted for rotation

3. Testing Needs
   - Board initialization
   - Color distribution
   - Player positioning
   - View transformations
