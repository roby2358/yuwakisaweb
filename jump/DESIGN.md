## Game Board

The playing area is an 800x800 pixel canvas with 30 circles packed into it. Each circle has a random radius between 20-200 pixels. Circles are placed randomly but must not overlap (minimum 5px gap between edges). The center of each circle is a spot that pieces can move to.

### Graph Structure

Circles are connected via edges based on distance (maximum edge distance of 300 pixels). Edges are sorted by length and added greedily, avoiding intersections - if a new edge would intersect an existing edge, only the shorter edge is kept. This creates a bidirectional graph where circles may have varying numbers of connections.

### Start Positions

- **Player 1 (Blue)**: Start circle is the one closest to the upper-left corner (0, 0)
- **Player 2 (Red)**: Start circle is the one closest to the lower-right corner (800, 800)

Start circles are marked with `isStart1` and `isStart2` flags and rendered in blue and red respectively.

### Pip Count System

Each circle has a pip count value for each player, calculated as the shortest path distance from that circle to the opponent's start circle. This is used for:
- Scoring: Pieces in holding count as 10 pips each. Pieces on the board use their circle's pip count. Pieces on the opponent's start circle count as -100 pips.
- AI decision-making: The AI evaluates moves based on pip count differences to make strategic choices.

## Players

- **Player 1 (Blue)**: Human-controlled
- **Player 2 (Red)**: AI-controlled

## Pieces

Each player has 3 pieces that start in a holding area. Pieces are represented as smaller circles (20px radius) colored to match their player. Pieces can be:
- **In holding**: Waiting to be placed on the board
- **On board**: Occupying a circle
- **Removed**: Captured and sent back to holding (not currently used, but tracked)

## Movement Rules

### Bearing In (From Holding Area)

- Pieces in holding can be placed on any circle that is directly connected (a neighbor) to their player's start circle
- Pieces cannot be placed directly on their start circle
- Pieces cannot capture their own pieces when placing from holding
- Click your start circle to highlight it, then click a valid neighbor circle to place a piece

### On Board Movement

Pieces on the board can make the following moves:

1. **Move to a neighbor** (1-space move)
   - Move to any directly connected neighbor circle that is empty
   - Cannot move to your own start circle

2. **Move to a neighbor's neighbor** (2-space leapfrog move)
   - Jump over any piece (your own or opponent's) to land on an empty circle
   - Must jump over exactly one piece to reach the destination
   - Cannot capture pieces with a 2-space move (must land on empty circle)

3. **Capture opponent piece** (1-space move)
   - Move to a neighbor circle occupied by an opponent's piece
   - The opponent's piece is captured and returned to their holding area
   - Cannot capture your own pieces

### Restrictions

- Pieces cannot move to circles occupied by their own pieces
- Pieces cannot move to their own start circle
- 2-space moves must land on an empty circle (no capture via leapfrog)

### Move Validation

- Valid move destinations are highlighted in yellow when a piece is selected
- All neighbor spots (1-space) and all valid 2-space destinations are highlighted
- Click a piece to select it, then click a valid destination to move
- Clicking an empty area or invalid destination clears the selection

## Win Condition

A player wins by moving a piece to the opponent's start circle. When this happens, the game ends and a victory message is displayed.

## Turn Flow

Players alternate turns. After Player 1 makes a move, Player 2 (AI) automatically makes a move after a 500ms delay. The AI evaluates all valid moves and selects probabilistically based on pip count differences - moves that improve the AI's position (lower pip count difference) are more likely to be selected, but some randomness is maintained to avoid predictable play.
