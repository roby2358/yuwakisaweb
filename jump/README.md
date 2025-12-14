# Circle Packing Game

A turn-based strategy game that runs entirely in your web browser. Move pieces across connected circles to reach your opponent's start circle and win.

## Overview

This is a browser-based game built with vanilla HTML, CSS, and JavaScript. It uses HTML5 Canvas for rendering and requires no build step or external dependencies. The game can be loaded directly in any modern web browser via HTTP or file protocol.

## Quick Start

### Option 1: Using a Local Web Server (Recommended)

For the best experience, serve the game over HTTP using a local web server:

**Python 3:**
```bash
python -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js (with http-server):**
```bash
npx http-server -p 8000
```

Then open your browser and navigate to `http://localhost:8000`

### Option 2: Direct File Access

You can also open `index.html` directly in your browser (double-click the file or use File → Open). Note that some browsers may have restrictions when loading files via the `file://` protocol, so using a local web server is recommended.

## How to Play

### Players

- **Player 1 (Blue)**: Human-controlled, starts near upper-left
- **Player 2 (Red)**: AI-controlled, starts near lower-right

### Setup

- Each player has 3 pieces that start in a holding area
- The game board consists of 30 randomly generated circles connected in a graph structure
- Player 1's start circle is near the upper-left corner (blue)
- Player 2's start circle is near the lower-right corner (red)

### Placing Pieces from Holding

- Click your **start circle** to highlight it
- Click a **connected neighbor circle** to place a piece from holding
- Pieces cannot be placed directly on the start circle itself

### Moving Pieces on the Board

1. **1-space move**: Click a piece, then click a directly connected empty neighbor circle
2. **2-space leapfrog**: Click a piece, then click a neighbor's neighbor (jumps over one piece, must land on empty circle)
3. **Capture**: Click a piece, then click a neighbor occupied by an opponent's piece to capture it (returns to their holding)

### Restrictions

- Cannot move to circles occupied by your own pieces
- Cannot move to your own start circle
- 2-space moves must land on empty circles (no capture via leapfrog)

### Winning

Win by moving any of your pieces to your opponent's start circle.

## Game Features

- **Visual Feedback**: Valid move destinations are highlighted in yellow when a piece is selected
- **AI Opponent**: Player 2 uses strategic AI that evaluates moves based on pip count (shortest path to opponent's start)
- **Turn-Based**: Players alternate turns automatically
- **Holding Areas**: Visual display of pieces waiting to be placed

## Technical Details

- **No Build Step**: Pure HTML/CSS/JavaScript, no compilation required
- **No Dependencies**: Uses only standard browser APIs (HTML5 Canvas, DOM)
- **Client-Side Only**: All game logic runs in the browser, no server required
- **Modern Browsers**: Requires HTML5 Canvas support

## File Structure

- `index.html` - Main HTML file
- `index.js` - Game logic and board generation
- `view.js` - Rendering and view management
- `index.css` - Styling
- `SPEC.md` - Technical specification
- `DESIGN.md` - Game design document

## Browser Compatibility

Works in any modern browser that supports:
- HTML5 Canvas
- ES6 JavaScript (classes, arrow functions, etc.)
- Standard DOM APIs

Tested in Chrome, Firefox, Edge, and Safari.
