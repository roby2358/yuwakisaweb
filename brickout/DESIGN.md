# Brickout Game Design

## Overview
Brickout is a puzzle-strategy game where players clear bricks from a dense grid to score points. The game combines spatial reasoning with dynamic resource management as new bricks continuously appear.

## Gameplay Mechanics

### The Board
- **Grid**: A 20x20 grid filled with rectangular (1x2) bricks.
- **Density**: The board starts densely packed, requiring players to clear paths to access high-value bricks.

### Movement
- **Dragging**: Players can drag bricks horizontally or vertically.
- **Multi-Space Moves**: Bricks can be dragged across multiple empty spaces in a single action, provided the path is clear.
- **Collision**: Bricks cannot move through other bricks.
- **Smart Snapping**: The game assists with diagonal movements by snapping to the primary axis of motion.

### Scoring & "Bearing Off"
- **Objective**: Drag bricks off the edge of the board to remove them and score points.
- **Constraint**: **White bricks cannot be removed.** If dragged off the board, they will snap back to their original position. They serve as obstacles that must be navigated around.

### Spawning
- **Regeneration**: The board never runs out of bricks.
- **Timer**: Every 6 seconds, the game scans for available space.
- **New Bricks**: If space is found, a new random brick is spawned in an empty slot.

## Scoring System
Bricks are color-coded by value. Higher value bricks are rarer.

| Color  | Score | Rarity |
| :--- | :--- | :--- |
| **White**  | 0 | Common (Obstacle) |
| **Purple** | 1 | Common |
| **Blue**   | 2 | Uncommon |
| **Green**  | 3 | Rare |
| **Yellow** | 5 | Very Rare |
| **Red**    | 10| Legendary |

## Visual Design
- **Theme**: Clean, light mode aesthetic.
- **Readability**: High-value bricks use distinct colors. Yellow bricks use black text for contrast.
- **Clarity**: White bricks (score 0) do not display a number, reducing visual clutter.
