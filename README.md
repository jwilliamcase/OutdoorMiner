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

### Recent Progress ✅
1. Board Rendering
   - Added dynamic hex size calculation
   - Improved board centering logic
   - Implemented responsive scaling
   - Fixed canvas positioning

2. UI Improvements
   - Consolidated container structure
   - Enhanced score display
   - Added turn indicators
   - Improved game feedback

### Active Issues 🔴
1. Canvas/Board
   - Need better container scaling
   - Board clipping on small screens
   - Canvas resize handling needs work

2. UI Elements
   - Score container still floating left
   - Message area needs consolidation
   - Player info display improvements needed

### Next Steps ⏭️
1. High Priority
   - [ ] Fix container scaling
   - [ ] Implement proper board centering
   - [ ] Add dynamic hex size adjustments
   - [ ] Improve score container positioning

2. Code Quality
   - [ ] Consolidate duplicate elements
   - [ ] Clean up event handling
   - [ ] Remove unused styles
   - [ ] Add error boundaries

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
