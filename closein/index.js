const PLAYERS = ['👤 Player', '😂 Jenny LOL!', '🦄 Unicorn', '🧚 Fairy'];
let scores = [0, 0, 0, 0];
const MAX = 12;
const WIN_SCORE = 11;

let currentRoundOrder = [];
let roundResults = []; // Stores { total, isDone }
let currentPlayerIndexInOrder = 0;
let playerTotal = 0;
let activePlayersCount = 0;

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
const diceRollsContainer = document.getElementById('dice-rolls');
const gameLog = document.getElementById('game-log');
const turnStats = document.getElementById('turn-stats');
const progressContainer = document.getElementById('progress-container');

const startBtn = document.getElementById('start-btn');
const rollBtn = document.getElementById('roll-btn');
const stopBtn = document.getElementById('stop-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const introModal = document.getElementById('intro-modal');

function init() {
    renderScores();
    startBtn.addEventListener('click', startNewRound);
    rollBtn.addEventListener('click', rollForPlayer);
    stopBtn.addEventListener('click', stopPlayerTurn);
    closeModalBtn.addEventListener('click', () => {
        introModal.classList.add('hidden');
    });
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
    if (Math.max(...scores) >= WIN_SCORE) {
        log("Game Over! Refresh to play again.", "info");
        return;
    }

    startBtn.classList.add('hidden');
    // Initialize results for all players
    roundResults = PLAYERS.map(() => ({ total: 0, isDone: false }));
    activePlayersCount = PLAYERS.length;
    
    currentRoundOrder = [...Array(PLAYERS.length).keys()];
    
    // Shuffle order
    for (let i = currentRoundOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentRoundOrder[i], currentRoundOrder[j]] = [currentRoundOrder[j], currentRoundOrder[i]];
    }

    log(`--- Interleaved Round! Order: ${currentRoundOrder.map(i => PLAYERS[i].split(' ')[1]).join(', ')} ---`, 'info');
    renderTurnOrder();
    currentPlayerIndexInOrder = 0;
    processNextPlayerInRound();
}

function renderTurnOrder() {
    progressContainer.innerHTML = '';
    // We'll display them in the randomized round order
    currentRoundOrder.forEach((playerIdx) => {
        const row = document.createElement('div');
        row.className = 'progress-row';
        row.id = `progress-row-${playerIdx}`;
        
        row.innerHTML = `
            <div class="progress-label">${PLAYERS[playerIdx]}</div>
            <div class="progress-bar-outer">
                <div class="progress-bar-inner" id="bar-inner-${playerIdx}"></div>
            </div>
            <div class="progress-score-text" id="score-text-${playerIdx}">(0)</div>
        `;
        
        progressContainer.appendChild(row);
    });
}

function updateTurnHighlight() {
    PLAYERS.forEach((_, playerIdx) => {
        const row = document.getElementById(`progress-row-${playerIdx}`);
        const bar = document.getElementById(`bar-inner-${playerIdx}`);
        const text = document.getElementById(`score-text-${playerIdx}`);
        
        if (!row || !bar || !text) return;

        const total = roundResults[playerIdx].total;
        const isDone = roundResults[playerIdx].isDone;
        const isCurrent = (currentRoundOrder[currentPlayerIndexInOrder] === playerIdx && activePlayersCount > 0);

        // Update active state
        row.classList.remove('active');
        if (isCurrent) row.classList.add('active');
        
        row.classList.toggle('done', isDone);

        // Update Bar Width and Color
        const percentage = Math.min((Math.max(0, total) / MAX) * 100, 100);
        bar.style.width = `${percentage}%`;
        
        bar.classList.remove('gold', 'bust');
        if (total === MAX) bar.classList.add('gold');
        if (total === -1) {
            bar.style.width = '100%';
            bar.classList.add('bust');
        }

        // Update Text
        const displayResult = total === -1 ? 'Over' : total;
        text.textContent = `(${displayResult})`;
    });
}

async function processNextPlayerInRound() {
    // Check if anyone is still playing
    if (activePlayersCount <= 0) {
        evaluateRound();
        return;
    }

    const playerIdx = currentRoundOrder[currentPlayerIndexInOrder];
    
    // If this player is already finished, skip to the next one
    if (roundResults[playerIdx].isDone) {
        currentPlayerIndexInOrder = (currentPlayerIndexInOrder + 1) % currentRoundOrder.length;
        processNextPlayerInRound();
        return;
    }

    updateTurnHighlight();
    currentPlayerDisplay.textContent = `It is ${PLAYERS[playerIdx]}'s turn!`;
    
    if (playerIdx === 0) { // Player
        setupPlayerTurn();
    } else {
        await playCharacterTurn(playerIdx);
    }
}

function setupPlayerTurn() {
    currentTotalDisplay.textContent = roundResults[0].total;
    diceRollsContainer.innerHTML = '';
    turnStats.classList.remove('hidden');
    rollBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
}

function rollForPlayer() {
    const r = getRandomInt(1, 6);
    roundResults[0].total += r;
    
    const die = document.createElement('div');
    die.className = 'die';
    die.textContent = r;
    diceRollsContainer.appendChild(die);
    
    currentTotalDisplay.textContent = roundResults[0].total;
    log(`${PLAYERS[0]} rolled a ${r}. Total: ${roundResults[0].total}`);

    if (roundResults[0].total === MAX) {
        log(`${PLAYERS[0]} hit exactly ${MAX}! Sudden Victory!`, 'win');
        celebrate();
        scores[0] += 5;
        activePlayersCount = 0; 
        endPlayerTurn(true);
    } else if (roundResults[0].total > MAX) {
        log(`${PLAYERS[0]} went over! Lose a point.`, 'lose');
        scores[0] -= 1;
        roundResults[0].total = -1;
        roundResults[0].isDone = true;
        activePlayersCount--;
        endPlayerTurn(false);
    } else {
        // In interleaved, we take 1 roll then pass the die
        endPlayerTurn(false);
    }
}

function stopPlayerTurn() {
    log(`${PLAYERS[0]} stopped at ${roundResults[0].total}.`);
    roundResults[0].isDone = true;
    activePlayersCount--;
    endPlayerTurn(false);
}

function endPlayerTurn(hitMax) {
    rollBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    turnStats.classList.add('hidden');
    renderScores();

    if (hitMax) {
        evaluateRound();
    } else {
        currentPlayerIndexInOrder = (currentPlayerIndexInOrder + 1) % currentRoundOrder.length;
        processNextPlayerInRound();
    }
}

async function playCharacterTurn(playerIdx) {
    await new Promise(r => setTimeout(r, 1000));

    // AI Logic: If they are below 8, they always roll. 
    if (roundResults[playerIdx].total < MAX - 4) {
        const r = getRandomInt(1, 6);
        roundResults[playerIdx].total += r;
        log(`${PLAYERS[playerIdx]} rolled a ${r}. Total: ${roundResults[playerIdx].total}`);

        if (roundResults[playerIdx].total === MAX) {
            log(`${PLAYERS[playerIdx]} hit exactly ${MAX}! Sudden Victory!`, 'win');
            celebrate();
            scores[playerIdx] += 5;
            activePlayersCount = 0;
            renderScores();
            evaluateRound();
            return;
        } else if (roundResults[playerIdx].total > MAX) {
            log(`${PLAYERS[playerIdx]} went over! Lose a point.`, 'lose');
            scores[playerIdx] -= 1;
            roundResults[playerIdx].total = -1;
            roundResults[playerIdx].isDone = true;
            activePlayersCount--;
        }
    } else {
        log(`${PLAYERS[playerIdx]} stopped at ${roundResults[playerIdx].total}.`);
        roundResults[playerIdx].isDone = true;
        activePlayersCount--;
    }
    
    renderScores();
    currentPlayerIndexInOrder = (currentPlayerIndexInOrder + 1) % currentRoundOrder.length;
    processNextPlayerInRound();
}

function evaluateRound() {
    // Final UI update
    updateTurnHighlight();

    // Determine winner among those who didn't go over
    const counts = roundResults.map(r => r.total);
    let hitMaxIdx = counts.indexOf(MAX);

    if (hitMaxIdx !== -1) {
        log(`${PLAYERS[hitMaxIdx]} won the round with PERFECT ${MAX}!`, 'win');
    } else {
        const best = Math.max(...counts);
        if (best > 0) {
            // Tie-break: First person in currentRoundOrder who achieved 'best'
            for (let i = 0; i < currentRoundOrder.length; i++) {
                const pIdx = currentRoundOrder[i];
                if (roundResults[pIdx].total === best) {
                    log(`${PLAYERS[pIdx]} won the round with ${best}! +1 Point`, 'win');
                    scores[pIdx] += 1;
                    break;
                }
            }
        } else {
            log("No one won this round.", "neutral");
        }
    }

    renderScores();
    currentPlayerDisplay.textContent = "Round Finished!";
    startBtn.classList.remove('hidden');

    if (Math.max(...scores) >= WIN_SCORE) {
        const winnerIdx = scores.indexOf(Math.max(...scores));
        currentPlayerDisplay.textContent = `🏆 ${PLAYERS[winnerIdx]} WINS THE GAME! 🏆`;
        startBtn.classList.add('hidden');
        log(`🏆 GAME OVER! ${PLAYERS[winnerIdx]} IS THE CHAMPION! 🏆`, 'win');
        celebrate(true);
    }
}

init();
