# Outdoor Miner: Hex Territory Game

## Game Overview

A strategic two-player territory capture game played on a hexagonal grid, inspired by the classic Filler game mechanics.

### Core Game Rules

1. Game Setup

   - Board: 16x16 hexagonal grid - make sure canvas. is large enough to accomodate
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

### Recently Completed

1. Event System

   - ✅ Added move validation system
   - ✅ Implemented state synchronization
   - ✅ Added atomic state updates
2. Architecture

   - ✅ Centralized event types
   - ✅ Added validation pipeline
   - ✅ Improved error handling
3. Error Recovery System

   - ✅ Added move history tracking
   - ✅ Implemented state restoration
   - ✅ Added recovery from storage
4. New Features

   - ✅ Move history management
   - ✅ State rollback system
   - ✅ Recovery UI feedback

### Currently In Progress

1. Core Functionality

   - ⏳ State recovery system
   - ⏳ Move replay implementation
   - ⏳ Conflict resolution
2. Testing

   - ⏳ Recovery scenarios
   - ⏳ Move history validation
   - ⏳ Network sync verification
3. Documentation

   - ⏳ Recovery process docs
   - ⏳ Error handling guide
   - ⏳ Debug procedures
4. Next Tasks

   - [ ] Add error recovery UI
   - [ ] Implement move history
   - [ ] Add state rollback

### Technical Updates

1. New Components

   - EventManager: Centralized event handling
   - Event logging system
   - Network state tracking
2. Architecture Changes

   - Moved to event-driven updates
   - Added state synchronization
   - Improved error handling

### Error Recovery System

1. Components

   - State History Manager
   - Error Recovery Manager
   - Network Recovery Handler
2. Recovery Strategies

   - Move Validation Errors: Rollback to last valid state
   - State Sync Errors: Request full state refresh
   - Network Disconnection: Save to session storage, restore on reconnect
3. Implementation Status

   - ⏳ State history tracking
   - ⏳ Recovery strategies
   - ⏳ Error logging system
4. Next Steps

   - [ ] Add state compression for history
   - [ ] Implement move replay after recovery
   - [ ] Add UI feedback during recovery

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

## Testing Status

### Test Coverage

1. Unit Tests

   - [ ] Game Logic (0%)
   - [ ] Network Protocol (0%)
   - [ ] Error Recovery (0%)
   - [ ] Event System (0%)
2. Integration Tests

   - [ ] State Synchronization
   - [ ] Move Validation
   - [ ] Error Recovery Flow
3. Priority Test Cases

   - Game State Management
   - Move History Tracking
   - Network Recovery
   - Event Processing

### Test Implementation Plan

1. Immediate Focus

   - Basic game mechanics
   - Move validation
   - State management
2. Next Phase

   - Network synchronization
   - Error recovery
   - Event system
3. Final Phase

   - Integration scenarios
   - Edge cases
   - Performance testing

### Development Environment

1. Setup Required

   - Install Jest
   - Configure JSDOM
   - Add test scripts to package.json
2. CI/CD Planning

   - Setup GitHub Actions
   - Define test workflow
   - Add coverage reporting

## Gameplay Requirements Update

### Board Initialization

1. Initial State

   - Every hex tile must be randomly assigned one of the 5 game colors
   - No empty or uncolored tiles allowed
   - Colors: Red (#F76C6C), Blue (#374785), Yellow (#F8E9A1), Green (#50C878), Purple (#9B59B6)
2. Player Starting Positions

   - Player 1 (creator) starts in bottom-left corner
   - Player 2 (joiner) starts in top-right corner
   - Starting tile's color is randomly selected from game colors
   - Starting tile's ownership is visually indicated
3. Game Joining Flow

   - When game is created, server generates unique game URL
   - Creator can share URL directly with opponent
   - Alternative: Display both URL and game code
   - Clicking URL automatically joins the correct game

### Implementation Tasks

1. Game Creation

   - [ ] Update board initialization with random colors
   - [ ] Implement URL-based game joining
   - [ ] Add game URL generation on server
   - [ ] Create shareable link component
2. UI Updates

   - [ ] Add "Share Game" button
   - [ ] Display game URL prominently
   - [ ] Add copy-to-clipboard functionality
   - [ ] Show QR code for mobile joining
3. Server Changes

   - [ ] Generate unique game URLs
   - [ ] Handle URL-based game joining
   - [ ] Validate game existence
   - [ ] Support both URL and code joining

### Current Issues

1. Board Generation

   - Currently has uncolored tiles
   - Starting positions not clearly indicated
   - Color distribution needs randomization
2. Game Joining

   - Current code-based system is cumbersome
   - No easy way to share game link
   - Manual code entry prone to errors

### Player Perspective
1. View Consistency
   - Each player always sees themselves in bottom-left corner
   - Board automatically rotates 180° for player 2
   - Colors and positions are transformed to maintain consistency
   - All moves are translated to match server coordinates

2. UI Implementation
   - Canvas rotation for player 2
   - Click coordinate transformation
   - Consistent territory coloring
   - Automatic view centering
