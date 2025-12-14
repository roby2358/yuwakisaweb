# Technical Specification

## Game Board

### Circle Generation
- MUST generate exactly 30 circles within an 800x800 pixel playing area
- MUST assign each circle a random radius between 20 and 200 pixels
- MUST ensure circles do not overlap (minimum gap of 5 pixels between circle edges)
- MUST place circles such that their entire area fits within the playing area
- SHOULD distribute circles reasonably across the available space

### Graph Structure
- MUST connect circles to form a bidirectional graph where pieces can move between connected circles
- MUST create connections based on proximity (within a reasonable maximum distance)
- MUST avoid creating intersecting connections when possible (prefer shorter connections over longer intersecting ones)
- MUST ensure all circles are reachable from each other through the connection network
- Circles may have varying numbers of connections

### Start Positions
- MUST identify Player 1's start circle as the circle closest to the upper-left corner
- MUST identify Player 2's start circle as the circle closest to the lower-right corner
- MUST render Player 1's start circle in blue
- MUST render Player 2's start circle in red
- MUST render circles connected to start circles (bear-in spots) in light blue for Player 1 and light pink for Player 2
- MUST render other non-start circles in gray

### Scoring System
- MUST calculate shortest path distance from each circle to each player's opponent start circle
- MUST use these distances for scoring: pieces in holding count as 10 points each, pieces on board use their circle's distance value, pieces on opponent's start circle count as -100 points
- MUST use scoring for AI decision-making (prefer moves that improve position)

## Game Pieces

### Piece Initialization
- MUST create exactly 3 pieces per player (6 total pieces)
- MUST assign each piece a unique identifier within its player's set
- MUST initialize all pieces in holding state
- MUST track which player owns each piece

### Piece State
- MUST track whether a piece is in holding area or on the board
- MUST track which circle a piece occupies when on the board
- MUST ensure each circle can be occupied by at most one piece
- MUST maintain consistency between piece location and circle occupancy

## Movement Rules

### Valid Moves from Holding
- MUST allow pieces in holding to move to circles that are directly connected to their player's start circle
- MUST NOT allow pieces to be placed directly on the start circle itself
- MUST prevent placement on circles already occupied by another piece
- MUST validate moves before executing them
- MUST highlight valid move destinations when a start circle is highlighted

### Valid Moves on Board
- MUST allow pieces to move to directly connected neighbor circles (1-space move)
- MUST allow pieces to move to a neighbor's neighbor (2-space leapfrog move) if jumping over exactly one piece
- MUST allow 2-space moves to jump over pieces of either player
- MUST require 2-space moves to land on empty circles (cannot capture via leapfrog)
- MUST allow 1-space moves to capture opponent pieces (move to occupied circle)
- MUST prevent movement to circles occupied by own pieces
- MUST prevent movement to own start circle
- MUST validate moves before executing them
- MUST highlight valid move destinations when a piece is selected (both 1-space and 2-space moves)

### Movement Execution
- MUST update piece location when a piece moves
- MUST update circle occupancy when a piece moves
- MUST capture opponent pieces by returning them to holding when moving onto them
- MUST update the holding area display after each move
- MUST switch to the next player after a valid move is executed
- MUST check for win condition (piece on opponent's start circle) after each move

## User Interface

### Canvas Rendering
- MUST render all circles with their assigned colors (start circles, bear-in spots, regular circles)
- MUST render connections between circles as gray lines
- MUST render circles with black borders
- MUST render pieces on circles as smaller circles proportional to the circle size
- MUST render Player 1 pieces in blue
- MUST render Player 2 pieces in red
- MUST render selected pieces with yellow highlight
- MUST highlight valid move destinations with semi-transparent yellow overlay
- MUST highlight selected piece's current circle with yellow border
- MUST clear and redraw the entire canvas on each render cycle

### Holding Areas
- MUST display Player 1's holding area with blue pieces
- MUST display Player 2's holding area with red pieces
- MUST show only pieces currently in holding state
- MUST update holding areas immediately after any piece state change
- MUST render holding pieces as appropriately sized circles with borders

### Player Indicator
- MUST display the current player's turn
- MUST highlight Player 1 indicator in blue
- MUST highlight Player 2 indicator in red
- MUST update immediately when player switches
- MUST display victory message when game is won

## Interaction

### Piece Selection
- MUST allow clicking on a piece to select it
- MUST allow clicking on a start circle when holding pieces to highlight it
- MUST allow clicking a highlighted start circle's valid neighbor to place a holding piece
- MUST allow clicking on an empty circle to deselect
- MUST prevent selecting opponent pieces
- MUST prevent selecting pieces when it's not the player's turn

### Move Validation Feedback
- MUST highlight the selected piece's current circle with yellow border
- MUST highlight all valid move destinations when a piece is selected (1-space and 2-space moves)
- MUST highlight the start circle and its valid neighbors when a holding piece is ready to be placed
- MUST clear all highlights when selection is cleared

### Click Handling
- MUST convert mouse coordinates to canvas coordinates accounting for canvas position
- MUST detect which circle (if any) was clicked
- MUST handle clicks outside any circle by clearing selection
- MUST ignore clicks when it's not Player 1's turn (Player 2 is AI-controlled)
- MUST ignore clicks when game is won

## AI Player

### AI Behavior
- MUST automatically make moves for Player 2 after Player 1's turn
- MUST wait a short delay before executing AI move (for visual feedback)
- MUST select moves probabilistically based on position evaluation (not purely random)
- MUST prefer moves that improve the AI's position (lower score is better)
- MUST switch back to Player 1 after AI move completes
- MUST skip turn if no valid moves are available

### Valid Move Calculation
- MUST enumerate all valid moves for the current player
- MUST include moves from holding area to neighbors of start circle
- MUST include 1-space moves from board pieces to connected neighbors
- MUST include 2-space leapfrog moves from board pieces
- MUST exclude moves to occupied circles (except for captures)
- MUST evaluate position after each potential move for AI decision-making

## Game State Management

### Initialization
- MUST generate circles before building connections
- MUST build connections after circles are generated
- MUST identify start circles after connections are built
- MUST calculate scoring distances after start circles are identified
- MUST initialize pieces after start circles are identified
- MUST render initial state after all initialization completes
- MUST start with Player 1's turn

### State Consistency
- MUST maintain consistent state between pieces and circles
- MUST ensure circle occupancy always matches piece locations
- MUST update UI immediately after any state change

## Technical Requirements

### Performance
- SHOULD render efficiently
- SHOULD minimize unnecessary re-renders
- MUST complete circle generation within reasonable time
- MUST complete scoring calculation efficiently

### Browser Compatibility
- MUST work in modern browsers supporting HTML5 Canvas
- MUST use standard web APIs
- MUST not require any external dependencies
