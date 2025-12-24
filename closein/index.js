const PLAYERS = ['👤 Player', '😂 Jenny LOL!', '🦄 Unicorn', '🧚 Fairy'];
let scores = [0, 0, 0, 0];
const MAX = 12;
const WIN_SCORE = 6;

let currentRoundOrder = [];
let roundResults = []; // Stores { total, isDone }
let currentPlayerIndexInOrder = 0;
let playerTotal = 0;
let activePlayersCount = 0;
let turnDelayResolver = null;

// Celebration colors
const COLORS = ['#ffb7b2', '#b2e2f2', '#b2f2bb', '#f2e2b2', '#ff9aa2'];

function celebrate(isBig = false) {
    if (isBig) {
        // Big confetti for game win
        const duration = 3 * 1000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: COLORS
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: COLORS
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    } else {
        // Small burst for hitting 12
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: COLORS
        });
    }
}

// DOM Elements
const scoresContainer = document.getElementById('scores-container');
const currentPlayerDisplay = document.getElementById('current-player-display');
const currentTotalDisplay = document.getElementById('current-total');
const rollsDisplay = document.getElementById('rolls-display');
const gameLog = document.getElementById('game-log');
const turnStats = document.getElementById('turn-stats');
const progressContainer = document.getElementById('progress-container');

const startBtn = document.getElementById('start-btn');
const rollBtn = document.getElementById('roll-btn');
const stopBtn = document.getElementById('stop-btn');
const rollMessage = document.getElementById('roll-message');
const closeModalBtn = document.getElementById('close-modal-btn');
const introModal = document.getElementById('intro-modal');

// --- Helper Functions ---

function hide(el) {
    if (el) el.classList.add('hidden');
}

function show(el) {
    if (el) el.classList.remove('hidden');
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function isGameOver() {
    return Math.max(...scores) >= WIN_SCORE;
}

function updateTurnDisplay(playerIdx) {
    const result = roundResults[playerIdx];
    currentTotalDisplay.textContent = result.total;
    rollsDisplay.textContent = result.rolls.join(',');
}

function getPlayerName(index) {
    return PLAYERS[index].split(' ').slice(1).join(' ');
}

function getPlayerIcon(index) {
    return PLAYERS[index].split(' ')[0];
}

function updatePlayerRoll(playerIdx, roll) {
    roundResults[playerIdx].total += roll;
    roundResults[playerIdx].rolls.push(roll);
    updateTurnDisplay(playerIdx);
    updateTurnHighlight();
    log(`${PLAYERS[playerIdx]} rolled a ${roll}. Total: ${roundResults[playerIdx].total}`);
}

function handleBust(playerIdx) {
    log(`${PLAYERS[playerIdx]} went over! Lose a point.`, 'lose');
    scores[playerIdx] -= 1;
    roundResults[playerIdx].total = -1;
    roundResults[playerIdx].isDone = true;
    activePlayersCount--;
    updateTurnHighlight();
}

function handleExactMax(playerIdx) {
    log(`${PLAYERS[playerIdx]} hit exactly ${MAX}! Sudden Victory!`, 'win');
    celebrate();
    scores[playerIdx] += 5;
    activePlayersCount = 0;
    updateTurnHighlight();
}

function advanceTurn() {
    currentPlayerIndexInOrder = (currentPlayerIndexInOrder + 1) % currentRoundOrder.length;
    processNextPlayerInRound();
}

// --- Core Functions ---

function init() {
    renderScores();
    startBtn.addEventListener('click', startNewRound);
    rollBtn.addEventListener('click', rollForPlayer);
    stopBtn.addEventListener('click', stopPlayerTurn);
    rollMessage.addEventListener('click', () => {
        if (turnDelayResolver) {
            turnDelayResolver();
            turnDelayResolver = null;
        }
    });
    closeModalBtn.addEventListener('click', () => hide(introModal));
}

function renderScores() {
    scoresContainer.innerHTML = '';
    PLAYERS.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'score-item';
        if (scores[index] >= WIN_SCORE) div.classList.add('winner');
        div.innerHTML = `<span>${player}</span> <strong>${scores[index]}</strong>`;
        scoresContainer.appendChild(div);
    });
}

function log(message, type = 'neutral') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    gameLog.prepend(entry);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startNewRound() {
    if (isGameOver()) {
        log("Game Over! Refresh to play again.", "info");
        return;
    }

    hide(startBtn);
    roundResults = PLAYERS.map(() => ({ total: 0, isDone: false, rolls: [] }));
    activePlayersCount = PLAYERS.length;
    currentRoundOrder = shuffle([...Array(PLAYERS.length).keys()]);

    log(`--- Interleaved Round! Order: ${currentRoundOrder.map(getPlayerName).join(', ')} ---`, 'info');
    renderTurnOrder();
    currentPlayerIndexInOrder = 0;
    processNextPlayerInRound();
}

function createProgressRow(playerIdx) {
    const row = document.createElement('div');
    row.className = 'progress-row';
    row.id = `progress-row-${playerIdx}`;
    
    row.innerHTML = `
        <div class="progress-label">${getPlayerName(playerIdx)}</div>
        <div class="progress-bar-outer">
            <div class="progress-bar-inner" id="bar-inner-${playerIdx}"></div>
            <div class="progress-icon" id="icon-${playerIdx}">${getPlayerIcon(playerIdx)}</div>
        </div>
        <div class="progress-score-text" id="score-text-${playerIdx}"><strong>0</strong></div>
    `;
    return row;
}

function renderTurnOrder() {
    progressContainer.innerHTML = '';
    currentRoundOrder.forEach((playerIdx) => {
        progressContainer.appendChild(createProgressRow(playerIdx));
    });
}

function updateTurnHighlight() {
    const counts = roundResults.map(r => r.total);
    const best = Math.max(...counts);
    
    // Find the first player in the current round order who has the best score
    let firstLeaderIdx = -1;
    if (best > 0) {
        for (let i = 0; i < currentRoundOrder.length; i++) {
            const pIdx = currentRoundOrder[i];
            if (roundResults[pIdx].total === best) {
                firstLeaderIdx = pIdx;
                break;
            }
        }
    }

    PLAYERS.forEach((_, playerIdx) => {
        const row = document.getElementById(`progress-row-${playerIdx}`);
        const bar = document.getElementById(`bar-inner-${playerIdx}`);
        const icon = document.getElementById(`icon-${playerIdx}`);
        const text = document.getElementById(`score-text-${playerIdx}`);
        
        if (!row || !bar || !text || !icon) return;

        const { total, isDone } = roundResults[playerIdx];
        const isCurrent = (currentRoundOrder[currentPlayerIndexInOrder] === playerIdx && activePlayersCount > 0);
        const isLeader = (playerIdx === firstLeaderIdx);

        row.classList.toggle('active', isCurrent);
        row.classList.toggle('done', isDone);
        row.classList.toggle('leader', isLeader);

        const percentage = Math.min((Math.max(0, total) / MAX) * 100, 100);
        bar.style.width = `${percentage}%`;
        icon.style.left = `${percentage}%`;
        
        bar.classList.remove('gold', 'bust');
        if (total === MAX) bar.classList.add('gold');
        if (total === -1) {
            bar.style.width = '100%';
            icon.style.left = '100%';
            bar.classList.add('bust');
        }

        const displayResult = total === -1 ? 'Over' : total;
        text.innerHTML = `<strong>${displayResult}</strong>`;
    });
}

async function processNextPlayerInRound() {
    if (activePlayersCount <= 0) {
        evaluateRound();
        return;
    }

    const playerIdx = currentRoundOrder[currentPlayerIndexInOrder];
    
    if (roundResults[playerIdx].isDone) {
        advanceTurn();
        return;
    }

    updateTurnHighlight();
    currentPlayerDisplay.textContent = `It is ${PLAYERS[playerIdx]}'s turn!`;
    hide(rollMessage);

    if (playerIdx === 0) { // Player
        updateTurnDisplay(playerIdx);
        show(turnStats);
        show(rollBtn);
        show(stopBtn);
    } else {
        hide(turnStats);
        hide(rollBtn);
        hide(stopBtn);
        await playCharacterTurn(playerIdx);
    }
}

async function rollForPlayer() {
    const r = getRandomInt(1, 6);
    updatePlayerRoll(0, r);
    
    // Replace buttons with roll message button
    rollMessage.textContent = `You rolled a ${r}!`;
    show(rollMessage);
    hide(rollBtn);
    hide(stopBtn);

    if (roundResults[0].total === MAX) {
        handleExactMax(0);
        await endPlayerTurn(true);
    } else if (roundResults[0].total > MAX) {
        handleBust(0);
        await endPlayerTurn(false, 6000);
    } else {
        await endPlayerTurn(false, 6000);
    }
}

function stopPlayerTurn() {
    log(`${PLAYERS[0]} stopped at ${roundResults[0].total}.`);
    roundResults[0].isDone = true;
    activePlayersCount--;
    updateTurnHighlight();
    endPlayerTurn(false, 0);
}

async function endPlayerTurn(hitMax, delay = 0) {
    // Buttons are already hidden in rollForPlayer if there's a roll
    // But we hide them here too for safety/completeness (e.g. from Stop)
    hide(rollBtn);
    hide(stopBtn);

    if (delay > 0) {
        await new Promise(resolve => {
            turnDelayResolver = resolve;
            setTimeout(() => {
                if (turnDelayResolver === resolve) {
                    resolve();
                    turnDelayResolver = null;
                }
            }, delay);
        });
    }

    hide(rollMessage);
    hide(turnStats);
    renderScores();

    if (hitMax) {
        evaluateRound();
    } else {
        advanceTurn();
    }
}

async function playCharacterTurn(playerIdx) {
    await new Promise(r => setTimeout(r, 1000));

    // AI Logic: If they are below 8, they always roll. 
    if (roundResults[playerIdx].total < MAX - 4) {
        const r = getRandomInt(1, 6);
        updatePlayerRoll(playerIdx, r);

        if (roundResults[playerIdx].total === MAX) {
            handleExactMax(playerIdx);
            renderScores();
            evaluateRound();
            return;
        } else if (roundResults[playerIdx].total > MAX) {
            handleBust(playerIdx);
        }
    } else {
        log(`${PLAYERS[playerIdx]} stopped at ${roundResults[playerIdx].total}.`);
        roundResults[playerIdx].isDone = true;
        activePlayersCount--;
        updateTurnHighlight();
    }
    
    renderScores();
    advanceTurn();
}

function evaluateRound() {
    updateTurnHighlight();

    const counts = roundResults.map(r => r.total);
    const hitMaxIdx = counts.indexOf(MAX);
    let roundWinnerIdx = -1;

    if (hitMaxIdx !== -1) {
        roundWinnerIdx = hitMaxIdx;
        log(`${PLAYERS[roundWinnerIdx]} won the round with PERFECT ${MAX}!`, 'win');
    } else {
        const best = Math.max(...counts);
        if (best > 0) {
            for (let i = 0; i < currentRoundOrder.length; i++) {
                const pIdx = currentRoundOrder[i];
                if (roundResults[pIdx].total === best) {
                    roundWinnerIdx = pIdx;
                    log(`${PLAYERS[roundWinnerIdx]} won the round with ${best}! +1 Point`, 'win');
                    scores[roundWinnerIdx] += 1;
                    break;
                }
            }
        } else {
            log("No one won this round.", "neutral");
        }
    }

    renderScores();
    
    if (roundWinnerIdx !== -1) {
        currentPlayerDisplay.textContent = `${PLAYERS[roundWinnerIdx]} wins the round!`;
    } else {
        currentPlayerDisplay.textContent = "No one won this round!";
    }

    show(startBtn);

    if (isGameOver()) {
        const winnerIdx = scores.indexOf(Math.max(...scores));
        currentPlayerDisplay.textContent = `🏆 ${PLAYERS[winnerIdx]} WINS THE GAME! 🏆`;
        hide(startBtn);
        log(`🏆 GAME OVER! ${PLAYERS[winnerIdx]} IS THE CHAMPION! 🏆`, 'win');
        celebrate(true);
    }
}

init();
