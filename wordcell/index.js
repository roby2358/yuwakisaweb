// Copyright (c) 2025 Rob Young
// ============================================================================
// CONSTANTS
// ============================================================================
const BOARD_SIZE = 12;
const TRAY_SIZE = 5;
const CELL_SIZE = 30; // Matches CSS
const GAP_SIZE = 1;
const WIN_SCORE = 500;

// ============================================================================
// GAME STATE
// ============================================================================
let board = []; // 12x12 grid, stores tile objects or null
let tray = []; // Array of tile objects
let score = 0;
let redrawCount = 3; // Number of redraws remaining
let draggingTile = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragStartParent = null; // 'board' or 'tray'
let dragStartIdx = -1; // index in tray or {r, c} for board
let pieceCumulativeFrequencies = []; // Array of {piece, cumulativeFreq} for random selection
let vowelPieces = []; // Array of pieces that are vowels (A, E, I, O, U)
let wordTilesMap = new Map(); // Map of tile ID to array of word info objects {word, points, tiles}

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const boardEl = document.getElementById('board');
const trayEl = document.getElementById('tray');
const scoreEl = document.getElementById('score');
const overlayEl = document.getElementById('overlay');
const readyPanel = document.getElementById('ready-panel');
const winPanel = document.getElementById('win-panel');
const losePanel = document.getElementById('lose-panel');
const finalScoreWin = document.getElementById('final-score-win');
const finalScoreLose = document.getElementById('final-score-lose');
const redrawBtn = document.getElementById('redraw-btn');
const redrawCountEl = document.getElementById('redraw-count');
const endGameBtn = document.getElementById('end-game-btn');
const wordListEl = document.getElementById('word-list');

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
    if (!validateDictionaryLoaded()) return;

    initializePieceFrequencies();
    createGrid();
    setupEventListeners();
    showReadyScreen();
}

function validateDictionaryLoaded() {
    if (typeof PIECES === 'undefined' || typeof WORDS === 'undefined') {
        console.error("WORDS or PIECES not loaded!");
        alert("Error: Dictionary not loaded.");
        return false;
    }
    return true;
}

function initializePieceFrequencies() {
    const pieces = Object.entries(PIECES);
    const vowels = new Set(['A', 'E', 'I', 'O', 'U']);
    
    // Separate vowel pieces from all pieces
    vowelPieces = pieces
        .filter(([piece, frequency]) => vowels.has(piece))
        .map(([piece, frequency]) => piece);
    
    // Calculate cumulative frequencies for all pieces
    let cumulative = 0;
    pieceCumulativeFrequencies = pieces.map(([piece, frequency]) => {
        cumulative += frequency;
        return { piece, cumulativeFreq: cumulative };
    });
}

function setupEventListeners() {
    // Button events
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('play-again-win-btn').addEventListener('click', resetGame);
    document.getElementById('play-again-lose-btn').addEventListener('click', resetGame);
    redrawBtn.addEventListener('click', handleRedraw);
    endGameBtn.addEventListener('click', handleEndGame);
}

function showReadyScreen() {
    overlayEl.classList.remove('hidden');
    readyPanel.classList.remove('hidden');
}

// ============================================================================
// GRID MANAGEMENT
// ============================================================================
function createGrid() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = createGridCell(r, c);
            boardEl.appendChild(cell);
        }
    }
}

function createGridCell(row, col) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    cell.dataset.row = row;
    cell.dataset.col = col;
    return cell;
}

function getGridCellElement(row, col) {
    return boardEl.children[row * BOARD_SIZE + col];
}

// ============================================================================
// GAME CONTROL
// ============================================================================
function startGame() {
    hideOverlay();
    resetGame();
}

function resetGame() {
    resetGameState();
    clearBoardUI();
    placeInitialTiles();
    fillTray();
    hideAllPanels();
}

function resetGameState() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    tray = [];
    score = 0;
    redrawCount = 3;
    updateScore(0);
    updateRedrawCount();
    wordListEl.innerHTML = '';
}

function clearBoardUI() {
    document.querySelectorAll('.tile').forEach(el => el.remove());
}

function hideAllPanels() {
    overlayEl.classList.add('hidden');
    winPanel.classList.add('hidden');
    losePanel.classList.add('hidden');
}

function hideOverlay() {
    overlayEl.classList.add('hidden');
    readyPanel.classList.add('hidden');
}

function updateScore(newScore) {
    score = newScore;
    scoreEl.textContent = score;
}

function winGame() {
    finalScoreWin.textContent = score;
    overlayEl.classList.remove('hidden');
    winPanel.classList.remove('hidden');
}

function updateRedrawCount() {
    redrawCountEl.textContent = redrawCount;
    if (redrawCount === 0) {
        redrawBtn.disabled = true;
    } else {
        redrawBtn.disabled = false;
    }
}

function handleRedraw() {
    if (redrawCount <= 0) return;

    redrawCount--;
    updateRedrawCount();
    tray = []; // Clear existing tiles
    fillTray();
}

function handleEndGame() {
    winGame();
}

function restartGame() {
    resetGameState();
    clearBoardUI();
    fillTray();
    hideAllPanels();
    showReadyScreen();
}

// ============================================================================
// TILE GENERATION & MANAGEMENT
// ============================================================================
function generateTile() {
    const letters = selectRandomPieceByFrequency();
    return createTileObject(letters);
}

function selectRandomPieceByFrequency() {
    if (pieceCumulativeFrequencies.length === 0) return "A";
    
    // 20% chance to select a vowel
    if (Math.random() < 0.2 && vowelPieces.length > 0) {
        return vowelPieces[Math.floor(Math.random() * vowelPieces.length)];
    }
    
    // Otherwise, use frequency-based selection
    const maxFreq = pieceCumulativeFrequencies[pieceCumulativeFrequencies.length - 1].cumulativeFreq;
    const rand = Math.random() * maxFreq;
    
    // Iterate through to find the frequency score that corresponds to the random number
    for (const entry of pieceCumulativeFrequencies) {
        if (rand <= entry.cumulativeFreq) {
            return entry.piece;
        }
    }
    
    // Fallback to last piece if somehow we didn't find one
    return pieceCumulativeFrequencies[pieceCumulativeFrequencies.length - 1].piece;
}

function createTileObject(letters) {
    return {
        id: generateUniqueId(),
        letters: letters,
        type: 'tray'
    };
}

function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// TRAY MANAGEMENT
// ============================================================================
function fillTray() {
    while (tray.length < TRAY_SIZE) {
        tray.push(generateTile());
    }
    renderTray();
}

function renderTray() {
    trayEl.innerHTML = '';
    tray.forEach((tile, index) => {
        const el = createTileElement(tile);
        configureTrayTileElement(el, index);
        trayEl.appendChild(el);
    });
}

function configureTrayTileElement(element, index) {
    element.dataset.index = index;
    element.style.position = 'relative';
    element.style.left = 'auto';
    element.style.top = 'auto';
}

// ============================================================================
// TILE ELEMENT CREATION
// ============================================================================
function createTileElement(tile) {
    const el = document.createElement('div');
    el.classList.add('tile');

    setTileElementSize(el, tile);
    appendLetterElements(el, tile);

    el.dataset.id = tile.id;
    el.addEventListener('mousedown', (e) => onDragStart(e, tile));

    return el;
}

function setTileElementSize(element, tile) {
    const len = tile.letters.length;
    const totalSize = len * CELL_SIZE;

    // Horizontal only
    element.style.width = `${totalSize}px`;
    element.style.height = `${CELL_SIZE}px`;
}

function appendLetterElements(element, tile) {
    for (let i = 0; i < tile.letters.length; i++) {
        const letterEl = createLetterElement(tile.letters[i]);
        element.appendChild(letterEl);
    }
}

function createLetterElement(letter) {
    const letterSpan = document.createElement('div');
    letterSpan.classList.add('tile-letter');
    letterSpan.textContent = letter;
    return letterSpan;
}

// ============================================================================
// BOARD RENDERING
// ============================================================================
function renderBoard() {
    clearBoardTiles();

    const renderedIds = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const tile = board[r][c];
            if (tile && !renderedIds.has(tile.id)) {
                renderBoardTile(tile);
                renderedIds.add(tile.id);
            }
        }
    }
}

function clearBoardTiles() {
    boardEl.querySelectorAll('.tile').forEach(t => t.remove());
}

function renderBoardTile(tile) {
    const el = createTileElement(tile);
    positionBoardTile(el, tile);
    boardEl.appendChild(el);
}

function positionBoardTile(element, tile) {
    element.style.left = `${tile.col * CELL_SIZE}px`;
    element.style.top = `${tile.row * CELL_SIZE}px`;
}

// ============================================================================
// DRAG AND DROP
// ============================================================================
let isDragging = false;
let dragGhost = null;
let originalTileElement = null;

function onDragStart(e, tile) {
    if (e.button !== 0 || isDragging) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    dragStartTime = Date.now();
    dragStartPosition = { x: e.clientX, y: e.clientY };
    
    isDragging = true;
    draggingTile = tile;
    originalTileElement = e.currentTarget;
    
    const rect = originalTileElement.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    
    dragStartParent = tile.type === 'tray' ? 'tray' : 'board';
    
    if (dragStartParent === 'tray') {
        dragStartIdx = tray.findIndex(t => t.id === tile.id);
    } else {
        dragStartIdx = { r: tile.row, c: tile.col };
        removeTileFromBoard(tile);
        renderBoard();
    }
    
    createDragGhost(tile);
    originalTileElement.style.opacity = '0.4';
    
    const mouseMoveHandler = (e) => {
        e.preventDefault();
        handleDragMove(e);
    };
    
    const mouseUpHandler = (e) => {
        e.preventDefault();
        handleDragEnd(e);
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
}


function createDragGhost(tile) {
    dragGhost = createTileElement(tile);
    dragGhost.id = 'dragging-ghost';
    dragGhost.style.position = 'fixed';
    dragGhost.style.zIndex = '10000';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.opacity = '0.95';
    dragGhost.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
    document.body.appendChild(dragGhost);
}

function handleDragMove(e) {
    if (!isDragging || !dragGhost || !draggingTile) return;
    
    const moved = Math.abs(e.clientX - dragStartPosition.x) > 3 || 
                  Math.abs(e.clientY - dragStartPosition.y) > 3;
    
    if (moved) {
        dragGhost.style.left = `${e.clientX - dragOffsetX}px`;
        dragGhost.style.top = `${e.clientY - dragOffsetY}px`;
        updateGridHighlights(e.clientX, e.clientY);
    }
}

function updateGridHighlights(mouseX, mouseY) {
    clearGridHighlights();
    
    if (!draggingTile) return;
    
    const boardRect = boardEl.getBoundingClientRect();
    
    if (mouseX < boardRect.left || mouseX > boardRect.right ||
        mouseY < boardRect.top || mouseY > boardRect.bottom) {
        return;
    }
    
    const relativeX = mouseX - boardRect.left;
    const relativeY = mouseY - boardRect.top;
    
    let gridCol = Math.floor(relativeX / CELL_SIZE);
    let gridRow = Math.floor(relativeY / CELL_SIZE);
    
    if (gridRow < 0 || gridRow >= BOARD_SIZE) return;
    if (gridCol < 0) return;
    
    const tileLength = draggingTile.letters.length;
    
    if (gridCol + tileLength > BOARD_SIZE) {
        gridCol = BOARD_SIZE - tileLength;
    }
    
    if (gridCol < 0) return;
    
    if (canPlaceTile(gridRow, gridCol, tileLength)) {
        for (let i = 0; i < tileLength; i++) {
            const cell = getGridCellElement(gridRow, gridCol + i);
            if (cell) {
                cell.classList.add('hovered');
            }
        }
    }
}

function clearGridHighlights() {
    document.querySelectorAll('.grid-cell.hovered').forEach(cell => {
        cell.classList.remove('hovered');
    });
}

function handleDragEnd(e) {
    if (!isDragging || !draggingTile) return;
    
    const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPosition.x, 2) + 
        Math.pow(e.clientY - dragStartPosition.y, 2)
    );
    
    clearGridHighlights();
    
    // If we didn't move much, treat as a click (to claim word if claimable)
    if (dragDistance < 5 && dragStartParent === 'board') {
        if (wordTilesMap.has(draggingTile.id)) {
            if (dragGhost) {
                dragGhost.remove();
                dragGhost = null;
            }
            revertDrag();
            claimWord(draggingTile.id);
            if (originalTileElement) {
                originalTileElement.style.opacity = '1';
                originalTileElement = null;
            }
            draggingTile = null;
            isDragging = false;
            return;
        }
    }
    
    let dropped = false;
    
    if (dragGhost) {
        dropped = attemptDrop(e.clientX, e.clientY);
        dragGhost.remove();
        dragGhost = null;
    }
    
    if (!dropped) {
        revertDrag();
    }
    
    if (originalTileElement) {
        originalTileElement.style.opacity = '1';
        originalTileElement = null;
    }
    
    refreshUI();
    draggingTile = null;
    isDragging = false;
}

function attemptDrop(mouseX, mouseY) {
    if (!draggingTile) return false;
    
    const boardRect = boardEl.getBoundingClientRect();
    
    if (mouseX < boardRect.left || mouseX > boardRect.right ||
        mouseY < boardRect.top || mouseY > boardRect.bottom) {
        return false;
    }
    
    const relativeX = mouseX - boardRect.left;
    const relativeY = mouseY - boardRect.top;
    
    let gridCol = Math.floor(relativeX / CELL_SIZE);
    let gridRow = Math.floor(relativeY / CELL_SIZE);
    
    if (gridRow < 0 || gridRow >= BOARD_SIZE) return false;
    if (gridCol < 0) return false;
    
    const tileLength = draggingTile.letters.length;
    
    if (gridCol + tileLength > BOARD_SIZE) {
        gridCol = BOARD_SIZE - tileLength;
    }
    
    if (gridCol < 0) return false;
    
    if (canPlaceTile(gridRow, gridCol, tileLength)) {
        placeTile(draggingTile, gridRow, gridCol);
        
        if (dragStartParent === 'tray') {
            tray.splice(dragStartIdx, 1);
            fillTray();
        }
        
        checkAndHighlightWords();
        return true;
    }
    
    return false;
}

function canPlaceTile(row, col, length) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col + length > BOARD_SIZE) {
        return false;
    }
    
    for (let i = 0; i < length; i++) {
        if (board[row][col + i] !== null) {
            return false;
        }
    }
    
    return true;
}

function revertDrag() {
    if (dragStartParent === 'board' && draggingTile) {
        placeTile(draggingTile, dragStartIdx.r, dragStartIdx.c, true);
    }
}

function refreshUI() {
    renderTray();
    renderBoard();
    checkAndHighlightWords();
}

// ============================================================================
// TILE PLACEMENT
// ============================================================================
function placeTile(tile, r, c, skipRender = false) {
    tile.row = r;
    tile.col = c;
    tile.type = 'board';

    const len = tile.letters.length;

    // Horizontal only: dr=0, dc=1
    for (let i = 0; i < len; i++) {
        board[r][c + i] = tile;
    }

    if (!skipRender) {
        renderBoard();
    }
}

function removeTileFromBoard(tile) {
    const len = tile.letters.length;

    // Horizontal only: dr=0, dc=1
    for (let i = 0; i < len; i++) {
        const r = tile.row;
        const c = tile.col + i;
        if (r < BOARD_SIZE && c < BOARD_SIZE) {
            board[r][c] = null;
        }
    }
}

// ============================================================================
// INITIAL TILE PLACEMENT
// ============================================================================
function placeInitialTiles() {
    const INITIAL_TILE_COUNT = 10;
    const MAX_ATTEMPTS = 1000;

    for (let i = 0; i < INITIAL_TILE_COUNT; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < MAX_ATTEMPTS) {
            attempts++;
            const tile = generateTile();
            const position = findRandomNonAdjacentPosition(tile);

            if (position) {
                placeTile(tile, position.r, position.c, true);
                placed = true;
            }
        }
    }

    renderBoard();
}

function findRandomNonAdjacentPosition(tile) {
    const len = tile.letters.length;
    const validPositions = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c <= BOARD_SIZE - len; c++) {
            if (isValidInitialPlacement(tile, r, c)) {
                validPositions.push({ r, c });
            }
        }
    }

    if (validPositions.length === 0) {
        return null;
    }

    return validPositions[Math.floor(Math.random() * validPositions.length)];
}

function isValidInitialPlacement(tile, r, c) {
    if (!isPlacementInBounds(tile, r, c)) return false;
    if (hasOverlap(tile, r, c)) return false;
    if (isAdjacentToExistingTiles(tile, r, c)) return false;

    return true;
}

function isAdjacentToExistingTiles(tile, r, c) {
    const len = tile.letters.length;

    for (let i = 0; i < len; i++) {
        const tileR = r;
        const tileC = c + i;

        if (isCellAdjacentToAnyTile(tileR, tileC)) {
            return true;
        }
    }

    return false;
}

function isCellAdjacentToAnyTile(r, c) {
    const adjacentOffsets = [
        [-1, 0],  // up
        [1, 0],   // down
        [0, -1],  // left
        [0, 1]    // right
    ];

    for (const [dr, dc] of adjacentOffsets) {
        const checkR = r + dr;
        const checkC = c + dc;

        if (checkR >= 0 && checkR < BOARD_SIZE && 
            checkC >= 0 && checkC < BOARD_SIZE && 
            board[checkR][checkC] !== null) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// VALIDATION
// ============================================================================
function isValidPlacement(tile, r, c) {
    if (!isPlacementInBounds(tile, r, c)) return false;
    if (hasOverlap(tile, r, c)) return false;
    return true;
}

function isPlacementInBounds(tile, r, c) {
    if (r < 0 || c < 0) return false;

    const len = tile.letters.length;
    // Horizontal only
    return c + len <= BOARD_SIZE && r < BOARD_SIZE;
}

function hasOverlap(tile, r, c) {
    const len = tile.letters.length;

    // Horizontal only: dr=0, dc=1
    for (let i = 0; i < len; i++) {
        if (board[r][c + i] !== null) {
            return true;
        }
    }

    return false;
}

function areAllWordsValid(tile, r, c) {
    const getLetter = createLetterGetter(tile, r, c);
    const linesToCheck = getLinesToCheck(tile, r, c);

    for (const line of linesToCheck) {
        const word = extractWord(line, getLetter);
        if (word.length > 1 && !isPrefix(word)) {
            return false;
        }
    }

    return true;
}

function createLetterGetter(tile, r, c) {
    const len = tile.letters.length;

    return (rr, cc) => {
        // Check if it's part of the new tile (horizontal only)
        if (rr === r && cc >= c && cc < c + len) {
            return tile.letters[cc - c];
        }

        // Check existing board
        if (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc]) {
            const t = board[rr][cc];
            // All tiles are horizontal
            return t.letters[cc - t.col];
        }

        return null;
    };
}

function getLinesToCheck(tile, r, c) {
    const len = tile.letters.length;
    const lines = [];

    // Horizontal tile: check the horizontal line and all vertical intersections
    lines.push({ type: 'H', r: r, cStart: c, cEnd: c + len - 1 });
    for (let i = 0; i < len; i++) {
        lines.push({ type: 'V', c: c + i, rStart: r, rEnd: r });
    }

    return lines;
}

function extractWord(line, getLetter) {
    if (line.type === 'H') {
        return extractHorizontalWord(line, getLetter);
    } else {
        return extractVerticalWord(line, getLetter);
    }
}

function extractHorizontalWord(line, getLetter) {
    let cc = line.cStart;
    while (cc > 0 && getLetter(line.r, cc - 1)) cc--;

    let word = "";
    while (cc < BOARD_SIZE) {
        const letter = getLetter(line.r, cc);
        if (!letter) break;
        word += letter;
        cc++;
    }

    return word;
}

function extractVerticalWord(line, getLetter) {
    let rr = line.rStart;
    while (rr > 0 && getLetter(rr - 1, line.c)) rr--;

    let word = "";
    while (rr < BOARD_SIZE) {
        const letter = getLetter(rr, line.c);
        if (!letter) break;
        word += letter;
        rr++;
    }

    return word;
}

// ============================================================================
// DICTIONARY LOOKUP
// ============================================================================
function isPrefix(str) {
    let low = 0, high = WORDS.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const word = WORDS[mid];

        if (word.startsWith(str)) return true;
        if (word < str) low = mid + 1;
        else high = mid - 1;
    }

    return false;
}

function isWord(str) {
    let low = 0, high = WORDS.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (WORDS[mid] === str) return true;
        if (WORDS[mid] < str) low = mid + 1;
        else high = mid - 1;
    }

    return false;
}

// ============================================================================
// WORD DETECTION AND CLAIMING
// ============================================================================
function checkAndHighlightWords() {
    // Clear previous word highlights
    clearWordHighlights();
    wordTilesMap.clear();
    
    // Find all valid words on the board
    const allWords = findAllWordsOnBoard();
    
    // Mark tiles as part of valid words
    allWords.forEach(wordInfo => {
        wordInfo.tiles.forEach(tile => {
            if (!wordTilesMap.has(tile.id)) {
                wordTilesMap.set(tile.id, []);
            }
            wordTilesMap.get(tile.id).push(wordInfo);
        });
    });
    
    // Highlight tiles that are part of valid words
    highlightWordTiles();
}

function findAllWordsOnBoard() {
    const foundWords = [];
    const processedWordKeys = new Set();
    const getTileAt = createTileGetter();
    
    // Check each row for horizontal words - only check starting positions
    for (let r = 0; r < BOARD_SIZE; r++) {
        let c = 0;
        while (c < BOARD_SIZE) {
            if (board[r][c]) {
                // Check if this is the start of a word (no tile to the left)
                if (c === 0 || !board[r][c - 1]) {
                    const wordResult = extractHorizontalWordWithTiles(
                        { type: 'H', r: r, cStart: c, cEnd: BOARD_SIZE - 1 },
                        getTileAt
                    );
                    if (wordResult.word.length >= 3 && isWord(wordResult.word)) {
                        const wordKey = `H-${r}-${wordResult.word}`;
                        if (!processedWordKeys.has(wordKey)) {
                            processedWordKeys.add(wordKey);
                            foundWords.push({
                                word: wordResult.word,
                                points: calculateWordScore(wordResult.word.length),
                                tiles: wordResult.tiles
                            });
                        }
                    }
                }
                // Move to next potential word start
                const tile = board[r][c];
                c += tile.letters.length;
            } else {
                c++;
            }
        }
    }
    
    // Check each column for vertical words - only check starting positions
    for (let c = 0; c < BOARD_SIZE; c++) {
        let r = 0;
        while (r < BOARD_SIZE) {
            if (board[r][c]) {
                // Check if this is the start of a word (no tile above)
                if (r === 0 || !board[r - 1][c]) {
                    const wordResult = extractVerticalWordWithTiles(
                        { type: 'V', c: c, rStart: r, rEnd: BOARD_SIZE - 1 },
                        getTileAt
                    );
                    if (wordResult.word.length >= 3 && isWord(wordResult.word)) {
                        const wordKey = `V-${c}-${wordResult.word}`;
                        if (!processedWordKeys.has(wordKey)) {
                            processedWordKeys.add(wordKey);
                            foundWords.push({
                                word: wordResult.word,
                                points: calculateWordScore(wordResult.word.length),
                                tiles: wordResult.tiles
                            });
                        }
                    }
                }
                // Move to next potential word start
                r++;
            } else {
                r++;
            }
        }
    }
    
    return foundWords;
}

function highlightWordTiles() {
    wordTilesMap.forEach((wordInfos, tileId) => {
        const tileElement = document.querySelector(`[data-id="${tileId}"]`);
        if (tileElement) {
            tileElement.classList.add('word-claimable');
            tileElement.style.cursor = 'pointer';
        }
    });
}

function clearWordHighlights() {
    document.querySelectorAll('.tile.word-claimable').forEach(tile => {
        tile.classList.remove('word-claimable');
        tile.style.cursor = 'grab';
    });
}

function claimWord(tileId) {
    const wordInfos = wordTilesMap.get(tileId);
    if (!wordInfos || wordInfos.length === 0) return;
    
    // Claim the first word this tile is part of
    const wordInfo = wordInfos[0];
    
    // Score the word
    updateScore(score + wordInfo.points);
    addWordToList(wordInfo.word, wordInfo.points);
    
    // Remove all tiles in the word
    const tilesToRemove = new Set(wordInfo.tiles);
    removeMatchedTiles(tilesToRemove);
    
    // Re-check for remaining words
    checkAndHighlightWords();
    renderBoard();
    
    checkWinCondition();
}

function addWordToList(word, points) {
    const wordEntry = document.createElement('div');
    wordEntry.classList.add('word-entry');
    wordEntry.textContent = `${word.toUpperCase()} (+${points})`;
    wordListEl.insertBefore(wordEntry, wordListEl.firstChild);
    wordListEl.scrollTop = 0;
}

function findAllWords(tile) {
    const tilesToRemove = new Set();
    let points = 0;
    let wordsFound = 0;
    const words = [];

    const getTileAt = createTileGetter();
    const linesToCheck = getLinesToCheck(tile, tile.row, tile.col);

    for (const line of linesToCheck) {
        const result = checkLineForWord(line, getTileAt);
        if (result.found) {
            points += result.points;
            result.tiles.forEach(t => tilesToRemove.add(t));
            wordsFound++;
            words.push({ word: result.word, points: result.points });
        }
    }

    return { tilesToRemove, points, wordsFound, words };
}

function createTileGetter() {
    return (rr, cc) => {
        if (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE) {
            return board[rr][cc];
        }
        return null;
    };
}

function checkLineForWord(line, getTileAt) {
    // Extract the FULL contiguous sequence of tiles in this line
    const { word, tiles } = extractWordWithTiles(line, getTileAt);

    // Validate that the complete sequence forms a valid word
    // Example: [CA][T][X] = "CATX" -> invalid, not claimable
    // Example: [CA][T][S] = "CATS" -> valid, claimable
    // Must be at least 3 letters and must be an exact match in dictionary
    if (word.length >= 3 && isWord(word)) {
        return {
            found: true,
            word: word,
            points: calculateWordScore(word.length),
            tiles: tiles
        };
    }

    return { found: false };
}

function extractWordWithTiles(line, getTileAt) {
    if (line.type === 'H') {
        return extractHorizontalWordWithTiles(line, getTileAt);
    } else {
        return extractVerticalWordWithTiles(line, getTileAt);
    }
}

function extractHorizontalWordWithTiles(line, getTileAt) {
    // Find the start of the contiguous tile sequence
    let cc = line.cStart;
    while (cc > 0 && getTileAt(line.r, cc - 1)) cc--;

    // Extract the FULL sequence of consecutive tiles
    let word = "";
    let tiles = [];

    while (cc < BOARD_SIZE) {
        const tile = getTileAt(line.r, cc);
        if (!tile) break; // Stop at first gap

        // All tiles are horizontal
        const letter = tile.letters[cc - tile.col];

        word += letter;
        tiles.push(tile);
        cc++;
    }

    // Returns the complete word formed by the full sequence of tiles
    return { word, tiles };
}

function extractVerticalWordWithTiles(line, getTileAt) {
    // Find the start of the contiguous tile sequence
    let rr = line.rStart;
    while (rr > 0 && getTileAt(rr - 1, line.c)) rr--;

    // Extract the FULL sequence of consecutive tiles
    let word = "";
    let tiles = [];

    while (rr < BOARD_SIZE) {
        const tile = getTileAt(rr, line.c);
        if (!tile) break; // Stop at first gap

        // All tiles are horizontal
        const letter = tile.letters[line.c - tile.col];

        word += letter;
        tiles.push(tile);
        rr++;
    }

    // Returns the complete word formed by the full sequence of tiles
    return { word, tiles };
}

function calculateWordScore(wordLength) {
    return Math.floor(Math.pow(wordLength, Math.E));
}

function removeMatchedTiles(tilesToRemove) {
    tilesToRemove.forEach(tile => {
        removeTileFromBoard(tile);
    });
}

function checkWinCondition() {
    if (score >= WIN_SCORE) {
        winGame();
    }
}

// ============================================================================
// START GAME
// ============================================================================
init();
