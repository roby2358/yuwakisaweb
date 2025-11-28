/**
 * Brickout Game Logic
 */

const CONFIG = {
    gridSize: 12,
    cellSize: 50, // px
    gapChance: 0.3, // 30% chance for a gap initially
    colors: [
        { name: 'white', score: 0, weight: 50 },
        { name: 'black', score: 0, weight: 5 }, // Immovable obstacle
        { name: 'purple', score: 1, weight: 23 },
        { name: 'blue', score: 2, weight: 12 },
        { name: 'green', score: 3, weight: 8 },
        { name: 'yellow', score: 5, weight: 5 },
        { name: 'red', score: 10, weight: 2 }
    ]
};

const STATE = {
    score: 0,
    grid: [], // 2D array: null or brick object
    bricks: [], // List of active brick objects
    isPlaying: false
};

// DOM Elements
const boardEl = document.getElementById('game-board');
const scoreEl = document.getElementById('score-value');
const restartBtn = document.getElementById('restart-btn');
const timerBarEl = document.getElementById('timer-bar');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlay-title');
const overlayScoreEl = document.getElementById('overlay-score');
const overlayBtn = document.getElementById('overlay-btn');

// Timer State
let timerValue = 12; // seconds
let timerInterval = null;
let spawnInterval = null;

// Overlay Logic
function showOverlay(title, btnText, callback, score = null, bonusText = null) {
    overlayTitleEl.textContent = title;
    overlayBtn.textContent = btnText;
    overlayBtn.onclick = () => {
        callback();
    };
    
    // Display score if provided
    if (score !== null) {
        let scoreText = '';
        if (bonusText) {
            scoreText = `${bonusText}\nScore: ${score}`;
        } else {
            scoreText = `Score: ${score}`;
        }
        overlayScoreEl.textContent = scoreText;
        overlayScoreEl.style.display = 'block';
    } else {
        overlayScoreEl.textContent = '';
        overlayScoreEl.style.display = 'none';
    }
    
    overlayEl.classList.remove('hidden');
}

function hideOverlay() {
    overlayEl.classList.add('hidden');
}

function startGame() {
    hideOverlay();
    STATE.isPlaying = true;
    startTimer();
    startSpawningLoop();
}

// Initialize Game
function init() {
    // Set board size
    const boardSize = CONFIG.gridSize * CONFIG.cellSize;
    boardEl.style.width = `${boardSize}px`;
    boardEl.style.height = `${boardSize}px`;

    // Set CSS variable for timer width to match board size
    document.documentElement.style.setProperty('--board-size', `${boardSize}px`);

    restartGame();

    // Event Listeners
    restartBtn.addEventListener('click', restartGame);

    // Global mouse up to handle dropping outside or ending drag
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('mousemove', handleDragMove);

    // Touch support
    document.addEventListener('touchend', handleDragEnd, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
}

function restartGame() {
    STATE.score = 0;
    STATE.isPlaying = false;
    updateScoreDisplay();
    
    // Clear any running intervals
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    
    generateGrid();
    renderBoard();

    // Reset Timer Visual (fill it and pause)
    resetTimer();

    // Show Start Overlay
    showOverlay('Ready?', 'Go', startGame);
}

function startSpawningLoop() {
    if (spawnInterval) clearInterval(spawnInterval);
    spawnInterval = setInterval(attemptSpawnBrick, 6000);
}

function updateScoreDisplay() {
    scoreEl.textContent = STATE.score;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerValue = 12;
    updateTimerVisual();
    timerInterval = setInterval(() => {
        timerValue -= 0.1;
        if (timerValue <= 0) {
            timerValue = 0;
            gameOver();
        }
        updateTimerVisual();
    }, 100);
}

function resetTimer() {
    timerValue = 12;
    updateTimerVisual();
}

function updateTimerVisual() {
    const percentage = (timerValue / 12) * 100;
    if (timerBarEl) {
        timerBarEl.style.width = `${percentage}%`;

        // Optional: Change color based on urgency
        if (percentage < 25) {
            timerBarEl.style.backgroundColor = '#f44336'; // Red
        } else {
            timerBarEl.style.backgroundColor = '#4CAF50'; // Green
        }
    }
}

function gameOver() {
    STATE.isPlaying = false;
    clearInterval(timerInterval);
    clearInterval(spawnInterval);
    showOverlay('Game Over', 'Try Again', restartGame, STATE.score);
}

function checkWinCondition() {
    // Check if any colored bricks remain (ignore white and black)
    const coloredBricks = STATE.bricks.filter(b => b.color.name !== 'white' && b.color.name !== 'black');
    if (coloredBricks.length === 0) {
        STATE.isPlaying = false;
        clearInterval(timerInterval);
        clearInterval(spawnInterval);
        STATE.score += 100;
        updateScoreDisplay();
        showOverlay('You Win!', 'Play Again', restartGame, STATE.score, 'Score +100');
    }
}

function getRandomColor() {
    const totalWeight = CONFIG.colors.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;

    for (const color of CONFIG.colors) {
        if (random < color.weight) return color;
        random -= color.weight;
    }
    return CONFIG.colors[0];
}

function generateGrid() {
    // Clear state
    STATE.grid = Array(CONFIG.gridSize).fill(null).map(() => Array(CONFIG.gridSize).fill(null));
    STATE.bricks = [];
    boardEl.innerHTML = ''; // Clear DOM

    // Create a list of all possible 1x2 slots (horizontal and vertical)
    // We will shuffle this list and try to place bricks to maximize density

    const coords = [];
    for (let y = 0; y < CONFIG.gridSize; y++) {
        for (let x = 0; x < CONFIG.gridSize; x++) {
            coords.push({ x, y });
        }
    }

    // Shuffle coordinates
    for (let i = coords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [coords[i], coords[j]] = [coords[j], coords[i]];
    }

    // Try to place bricks
    for (const { x, y } of coords) {
        if (STATE.grid[y][x]) continue; // Already filled

        // Randomize preference for H or V
        const preferVertical = Math.random() < 0.5;

        if (preferVertical) {
            if (canPlaceBrick(x, y, true)) {
                createBrick(x, y, true);
            } else if (canPlaceBrick(x, y, false)) {
                createBrick(x, y, false);
            }
        } else {
            if (canPlaceBrick(x, y, false)) {
                createBrick(x, y, false);
            } else if (canPlaceBrick(x, y, true)) {
                createBrick(x, y, true);
            }
        }
    }
}

function canPlaceBrick(x, y, isVertical) {
    if (isVertical) {
        if (y + 1 >= CONFIG.gridSize) return false;
        return !STATE.grid[y][x] && !STATE.grid[y + 1][x];
    } else {
        if (x + 1 >= CONFIG.gridSize) return false;
        return !STATE.grid[y][x] && !STATE.grid[y][x + 1];
    }
}

function createBrick(x, y, isVertical, colorData = null) {
    const color = colorData || getRandomColor();
    const brick = {
        id: Math.random().toString(36).substr(2, 9),
        x: x,
        y: y,
        w: isVertical ? 1 : 2,
        h: isVertical ? 2 : 1,
        color: color,
        el: null
    };

    // Update grid state
    STATE.grid[y][x] = brick;
    if (isVertical) {
        STATE.grid[y + 1][x] = brick;
    } else {
        STATE.grid[y][x + 1] = brick;
    }

    STATE.bricks.push(brick);
    renderBrick(brick);
    return brick;
}

function renderBrick(brick) {
    const el = document.createElement('div');
    el.className = `brick brick-${brick.color.name}`;
    el.style.width = `${brick.w * CONFIG.cellSize - 2}px`; // -2 for gap/border visual
    el.style.height = `${brick.h * CONFIG.cellSize - 2}px`;
    el.style.left = `${brick.x * CONFIG.cellSize + 1}px`;
    el.style.top = `${brick.y * CONFIG.cellSize + 1}px`;

    // Display score on brick for clarity (hide 0)
    el.textContent = brick.color.score > 0 ? brick.color.score : '';

    // Drag handling
    el.addEventListener('mousedown', (e) => handleDragStart(e, brick));
    el.addEventListener('touchstart', (e) => handleDragStart(e, brick), { passive: false });

    boardEl.appendChild(el);
    brick.el = el;
}

// --- Drag Logic ---

let dragData = null;

function handleDragStart(e, brick) {
    e.preventDefault(); // Prevent text selection etc.

    if (!STATE.isPlaying) return;

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    // Immovable Black Bricks
    if (brick.color.name === 'black') return;

    // Get initial offset within the element
    const rect = brick.el.getBoundingClientRect();

    dragData = {
        brick: brick,
        startX: clientX,
        startY: clientY,
        initialLeft: parseFloat(brick.el.style.left),
        initialTop: parseFloat(brick.el.style.top),
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        boardRect: boardEl.getBoundingClientRect(),
        direction: null, // Will be determined on first move
        lastX: clientX,
        lastY: clientY
    };

    brick.el.classList.add('dragging');
}

function handleDragMove(e) {
    if (!dragData) return;

    // Prevent scrolling on touch
    if (e.type === 'touchmove') e.preventDefault();

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    // Calculate movement from start
    const deltaX = clientX - dragData.startX;
    const deltaY = clientY - dragData.startY;

    // Determine direction on first significant movement
    if (dragData.direction === null) {
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // Need minimum threshold to determine direction
        if (absDeltaX > 10 || absDeltaY > 10) {
            dragData.direction = absDeltaX > absDeltaY ? 'horizontal' : 'vertical';
        } else {
            // Not enough movement yet, keep brick at original position
            return;
        }
    }

    // Calculate movement along the determined direction
    let slideDistance = 0;
    if (dragData.direction === 'horizontal') {
        slideDistance = deltaX;
    } else {
        slideDistance = deltaY;
    }

    // Convert slide distance to grid-aligned position
    const cellSize = CONFIG.cellSize;
    const gridOffset = Math.round(slideDistance / cellSize);
    
    // Calculate new grid-aligned position
    let newLeft = dragData.initialLeft;
    let newTop = dragData.initialTop;
    
    if (dragData.direction === 'horizontal') {
        newLeft = dragData.initialLeft + (gridOffset * cellSize);
    } else {
        newTop = dragData.initialTop + (gridOffset * cellSize);
    }

    // Visual update only (snap logic happens on end)
    dragData.brick.el.style.left = `${newLeft}px`;
    dragData.brick.el.style.top = `${newTop}px`;
    
    // Update last position for tracking
    dragData.lastX = clientX;
    dragData.lastY = clientY;
}

function handleDragEnd(e) {
    if (!dragData) return;

    const brick = dragData.brick;
    const el = brick.el;

    try {
        // Calculate center of the dropped brick
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate grid coordinates (can be outside)
        const boardRect = dragData.boardRect;
        let gridX = Math.round((centerX - boardRect.left - (brick.w * CONFIG.cellSize / 2)) / CONFIG.cellSize);
        let gridY = Math.round((centerY - boardRect.top - (brick.h * CONFIG.cellSize / 2)) / CONFIG.cellSize);

        // --- Smart Snapping Logic ---
        const dx = gridX - brick.x;
        const dy = gridY - brick.y;

        // Define potential targets
        let primaryTarget = { x: gridX, y: brick.y };   // Horizontal assumption
        let secondaryTarget = { x: brick.x, y: gridY }; // Vertical assumption

        // If vertical movement was larger, swap assumptions
        if (Math.abs(dy) > Math.abs(dx)) {
            primaryTarget = { x: brick.x, y: gridY };
            secondaryTarget = { x: gridX, y: brick.y };
        }

        // Attempt Primary Move
        if (attemptMove(brick, primaryTarget.x, primaryTarget.y)) {
            return; // Success
        }

        // Attempt Secondary Move (only if different and actually moving)
        if ((secondaryTarget.x !== brick.x || secondaryTarget.y !== brick.y) &&
            attemptMove(brick, secondaryTarget.x, secondaryTarget.y)) {
            return; // Success
        }

        // If both failed, reset
        resetBrickPosition(brick);

    } catch (err) {
        console.error("Drag error:", err);
        resetBrickPosition(brick);
    } finally {
        brick.el.classList.remove('dragging');
        dragData = null;
    }
}

function scoreBrick(brick) {
    // Remove from grid
    removeBrickFromGrid(brick);

    // Remove DOM
    brick.el.remove();

    // Remove from list
    STATE.bricks = STATE.bricks.filter(b => b !== brick);

    // Update Score
    STATE.score += brick.color.score;
    updateScoreDisplay();

    // Reset Timer
    resetTimer();

    // Check Win
    checkWinCondition();

    // NO immediate respawn
}

function removeBrickFromGrid(brick) {
    for (let y = brick.y; y < brick.y + brick.h; y++) {
        for (let x = brick.x; x < brick.x + brick.w; x++) {
            if (STATE.grid[y] && STATE.grid[y][x] === brick) {
                STATE.grid[y][x] = null;
            }
        }
    }
}

/**
 * Attempts to move or score a brick.
 * Returns true if successful, false otherwise.
 */
function attemptMove(brick, targetX, targetY) {
    // 1. Check if this is a scoring attempt (outside bounds)
    const isOutside = (
        targetX < 0 || targetY < 0 ||
        targetX + brick.w > CONFIG.gridSize ||
        targetY + brick.h > CONFIG.gridSize
    );

    // Constraint: White bricks cannot be born off
    if (isOutside && brick.color.name === 'white') {
        return false;
    }

    // 2. Validate Path
    if (!checkPath(brick, targetX, targetY, isOutside)) {
        return false;
    }

    // 3. Execute Move or Score
    if (isOutside) {
        scoreBrick(brick);
    } else {
        // Execute Move
        removeBrickFromGrid(brick); // Remove from old pos

        brick.x = targetX;
        brick.y = targetY;

        // Add to new pos
        for (let y = brick.y; y < brick.y + brick.h; y++) {
            for (let x = brick.x; x < brick.x + brick.w; x++) {
                STATE.grid[y][x] = brick;
            }
        }

        // Update DOM
        brick.el.style.left = `${brick.x * CONFIG.cellSize + 1}px`;
        brick.el.style.top = `${brick.y * CONFIG.cellSize + 1}px`;
    }

    return true;
}

/**
 * Checks if the path from brick.x/y to targetX/targetY is clear.
 * Handles both board moves and scoring (isOutside).
 */
function checkPath(brick, targetX, targetY, isOutside) {
    const dx = targetX - brick.x;
    const dy = targetY - brick.y;

    // Must be moving somewhere
    if (dx === 0 && dy === 0) return false;

    // Must be cardinal (Smart Snapping ensures this, but good to double check)
    if (dx !== 0 && dy !== 0) return false;

    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);

    // Temporarily remove self to check path
    removeBrickFromGrid(brick);

    let pathClear = true;

    for (let i = 1; i <= steps; i++) {
        const checkX = brick.x + (stepX * i);
        const checkY = brick.y + (stepY * i);

        // Check collision at this step
        for (let y = checkY; y < checkY + brick.h; y++) {
            for (let x = checkX; x < checkX + brick.w; x++) {
                // If we are checking a coordinate inside the board, it must be empty.
                if (y >= 0 && y < CONFIG.gridSize && x >= 0 && x < CONFIG.gridSize) {
                    if (STATE.grid[y][x] !== null) {
                        pathClear = false;
                        break;
                    }
                }
                // If we are checking outside, it's always clear (void).
            }
            if (!pathClear) break;
        }
        if (!pathClear) break;
    }

    // Restore brick (if we return false, or if we return true but haven't moved yet)
    // Actually, it's safer to always restore here. 
    // The caller (attemptMove) will remove it again if the move proceeds.
    for (let y = brick.y; y < brick.y + brick.h; y++) {
        for (let x = brick.x; x < brick.x + brick.w; x++) {
            STATE.grid[y][x] = brick;
        }
    }

    return pathClear;
}

function resetBrickPosition(brick) {
    brick.el.style.left = `${brick.x * CONFIG.cellSize + 1}px`;
    brick.el.style.top = `${brick.y * CONFIG.cellSize + 1}px`;
}

function attemptSpawnBrick() {
    // 1. Find ALL valid spots
    const validMoves = [];

    for (let y = 0; y < CONFIG.gridSize; y++) {
        for (let x = 0; x < CONFIG.gridSize; x++) {
            // Check Horizontal
            if (canPlaceBrick(x, y, false)) {
                validMoves.push({ x, y, isVertical: false });
            }
            // Check Vertical
            if (canPlaceBrick(x, y, true)) {
                validMoves.push({ x, y, isVertical: true });
            }
        }
    }

    // 2. If no spots, skip
    if (validMoves.length === 0) {
        console.log("No space to spawn new brick.");
        return;
    }

    // 3. Pick random spot
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    createBrick(move.x, move.y, move.isVertical);
}

function renderBoard() {
    // Bricks are rendered as they are created
}
