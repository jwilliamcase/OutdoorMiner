# Outdoor Miner: Hex Territory Game

## Game Overview
A strategic two-player territory capture game played on a hexagonal grid, inspired by the classic Filler game mechanics.

### Core Game Rules
1. Game Setup
   - Board: 16x16 hexagonal grid
   - Colors: 5 distinct colors randomly distributed
   - Starting Positions: Players begin in opposite corners
   - Initial State: Each player owns their corner hex

2. Gameplay Flow
   - Players alternate turns
   - On their turn, a player selects one of the available colors
   - Cannot select the color just used by the opponent
   - Selected color captures all adjacent matching-color hexes
   - All player's territory changes to the selected color

3. Territory Mechanics
   - Territory expands through color matching
   - Capture occurs when selected color matches adjacent unclaimed hexes
   - Captured hexes become part of player's territory
   - All owned hexes update to the newly selected color
   - Territory must be connected (no isolated captures)

4. Winning Conditions
   - Game ends when all hexes are captured
   - Player with the most territory wins
   - Ties are possible but rare

### Strategic Elements
1. Color Selection
   - Plan moves ahead considering opponent's options
   - Block opponent's potential large captures
   - Create opportunities for future captures
   - Manage color availability (opponent restrictions)

2. Territory Control
   - Build connected territories
   - Cut off opponent's expansion paths
   - Secure central board position
   - Create capture opportunities

### Technical Implementation
1. Network Play
   - Real-time multiplayer
   - Game state synchronization
   - Automatic turn handling
   - Disconnect/reconnect support

2. User Interface
   - Clear territory ownership display
   - Color selection interface
   - Turn indication
   - Score tracking
   - Game status messages

## Development Status

### Recently Completed (2024-03-XX)
1. Event System
   - ✅ Added centralized event listener tracking
   - ✅ Implemented automatic cleanup system
   - ✅ Fixed memory leaks in event handlers

2. Core Systems
   - ✅ Consolidated game state logic
   - ✅ Territory change tracking
   - ✅ Score calculation logic

3. UI Improvements
   - ✅ Color button initialization
   - ✅ Element validation system
   - ✅ Turn transition handling

### Currently In Progress
1. Core Functionality
   - ⏳ Territory capture mechanics
   - ⏳ Score display updates
   - ⏳ Turn order validation

2. Network Features
   - ⏳ Move validation (server-side)
   - ⏳ State synchronization
   - ⏳ Disconnect handling

### Next Tasks (Prioritized)
1. Core Features
   - [ ] Complete capture animation system
   - [ ] Add proper error state handling
   - [ ] Implement game recovery logic

2. Code Organization
   - [ ] Move network events to separate manager
   - [ ] Create event constants file
   - [ ] Add event logging system

3. Documentation
   - [ ] Document network protocol
   - [ ] Add JSDoc comments to core methods
   - [ ] Create debugging guide

### Technical Debt
1. Code Cleanup
   - Remove unused event listeners
   - Clean up powerup-related code
   - Remove duplicate UI elements

2. Performance
   - Optimize territory calculations
   - Improve render efficiency
   - Add state caching

### Known Issues
1. Event Management
   - Multiple click handlers on color buttons
   - Canvas event management needs consolidation
   - Network event cleanup incomplete

2. Network
   - WebSocket reconnection handling
   - Game state recovery after disconnect
   - Move validation synchronization

### Orphaned Code
1. Files Needing Cleanup
   - style.css: Lines 800-950 (powerup styles)
   - index.html: Powerup UI elements
   - ui.js: Old coordinate-based click handlers

2. Deprecated Features
   - Local game mode
   - Sound system
   - Chat system

### Open Questions
1. Technical
   - Server vs client-side move validation?
   - How to handle simultaneous moves?
   - Need for move replay system?

2. Architecture
   - Separate UI/game state?
   - Add state management library?
   - Keep chat system for future?

### Project Structure
- /gameLogic.js - Core game mechanics
- /network.js - Network communication
- /ui.js - User interface handling
- /uiManager.js - UI state management
- /config.js - Game configuration
- /main.js - Application entry point

### Progress Tracking
- Current Phase: Core Mechanics
- Overall Progress: 65%
- Focus Area: Game State Management
