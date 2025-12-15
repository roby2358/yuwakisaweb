// HardCAPTCHA Implementation
// All logic runs entirely in the browser

// Global cheat code variable
let cheatChallengeType = null;

// Cheat code function - call xyzzy('challengeType') from console to force a specific challenge type
function xyzzy(str) {
    if (typeof str !== 'string') {
        console.log('No');
        return;
    }
    cheatChallengeType = str;
    console.log('Nothing happens.');
}

class HardCAPTCHA {
    constructor() {
        const possibleRounds = [7, 11, 13, 17];
        const totalRounds = possibleRounds[Math.floor(Math.random() * possibleRounds.length)];
        
        this.state = {
            currentRound: 0,
            totalRounds: totalRounds,
            challenges: [],
            startTime: null,
            mouseMovements: [],
            keyboardEvents: [],
            focusChanges: 0,
            lastFocusTime: null
        };
        
        this.challengeTypes = [
            'pattern',
            'sequence',
            'spatial',
            'memory',
            'kerning',
            'predator',
            'emotions',
            'human'
        ];
        
        this.init();
    }
    
    // Generate random integer in [a, b)
    randn(a, b) {
        return Math.floor(Math.random() * (b - a)) + a;
    }
    
    init() {
        this.setupEventListeners();
        this.setupAntiAutomation();
        this.showStartModal();
    }
    
    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('restartButton').addEventListener('click', () => this.restart());
        document.getElementById('resultRestartButton').addEventListener('click', () => this.restart());
        document.getElementById('submitButton').addEventListener('click', () => this.submitRound());
        document.getElementById('giveUpButton').addEventListener('click', () => this.handleGiveUp());
    }
    
    setupAntiAutomation() {
        // Mouse movement tracking
        document.addEventListener('mousemove', (e) => {
            this.state.mouseMovements.push({
                x: e.clientX,
                y: e.clientY,
                time: Date.now()
            });
            // Keep only last 100 movements
            if (this.state.mouseMovements.length > 100) {
                this.state.mouseMovements.shift();
            }
        });
        
        // Keyboard event monitoring
        document.addEventListener('keydown', (e) => {
            this.state.keyboardEvents.push({
                key: e.key,
                time: Date.now(),
                code: e.code
            });
            // Keep only last 50 events
            if (this.state.keyboardEvents.length > 50) {
                this.state.keyboardEvents.shift();
            }
        });
        
        // Focus/blur detection
        window.addEventListener('focus', () => {
            this.state.focusChanges++;
            this.state.lastFocusTime = Date.now();
        });
        
        window.addEventListener('blur', () => {
            this.state.focusChanges++;
        });
    }
    
    showStartModal() {
        document.getElementById('startModal').classList.add('active');
        document.getElementById('challengeArea').classList.add('hidden');
    }
    
    start() {
        console.log('Ha ha! Looking at the console log. How very human of you! But it won\'t help you now!');
        document.getElementById('startModal').classList.remove('active');
        document.getElementById('challengeArea').classList.remove('hidden');
        this.state.startTime = Date.now();
        this.state.currentRound = 0;
        this.generateRound();
    }
    
    restart() {
        document.getElementById('endModal').classList.remove('active');
        
        // Reset result display
        document.getElementById('resultDisplay').classList.add('hidden');
        document.getElementById('resultCodeDisplay').classList.remove('hidden');
        document.getElementById('buttonGroup').classList.remove('hidden');
        document.getElementById('feedback').classList.remove('hidden');
        
        this.state.currentRound = 0;
        this.state.mouseMovements = [];
        this.state.keyboardEvents = [];
        this.state.focusChanges = 0;
        this.showStartModal();
    }
    
    async generateRound() {
        this.state.currentRound++;
        this.updateProgress();
        
        // Reset focus changes counter for this round
        this.state.focusChanges = 0;
        
        // Clear timers from previous challenges
        this.state.challenges.forEach(challenge => {
            if (challenge.timerInterval) {
                clearInterval(challenge.timerInterval);
            }
            if (challenge.timerTimeout) {
                clearTimeout(challenge.timerTimeout);
            }
        });
        
        // Clear previous challenges
        const container = document.getElementById('challengesContainer');
        container.innerHTML = '';
        
        // Generate challenges - always show 1
        const numChallenges = 1;
        this.state.challenges = [];
        
        for (let i = 0; i < numChallenges; i++) {
            const challenge = await this.generateChallenge(i);
            this.state.challenges.push(challenge);
            this.renderChallenge(challenge, container);
        }
        
        // Enable submit button after a delay (anti-automation)
        setTimeout(() => {
            document.getElementById('submitButton').disabled = false;
        }, this.randn(1000, 2000));
        
        // Reset give up button
        const giveUpButton = document.getElementById('giveUpButton');
        giveUpButton.textContent = 'I give up';
        giveUpButton.disabled = false;
        
        this.clearFeedback();
    }
    
    async generateChallenge(index) {
        // Use cheat code if set, otherwise select randomly
        const type = cheatChallengeType || this.challengeTypes[this.randn(0, this.challengeTypes.length)];
        
        switch (type) {
            case 'pattern':
                return PatternChallenge.generate();
            case 'sequence':
                return this.generateSequenceChallenge();
            case 'spatial':
                return SpatialChallenge.generate();
            case 'memory':
                return this.generateMemoryChallenge();
            case 'kerning':
                return KerningChallenge.generate();
            case 'predator':
                return await PredatorChallenge.generate();
            case 'emotions':
                return await EmotionsChallenge.generate();
            case 'human':
                return await HumanChallenge.generate();
            default:
                return PatternChallenge.generate();
        }
    }
    
    generateSequenceChallenge() {
        const sequenceLength = 10;
        const sequence = [];
        let start = this.randn(1, 11);
        const a = this.randn(2, 7);
        const b = this.randn(2, 5);
        
        // Generate sequence using formula: (previous + a) * b
        let current = start;
        for (let i = 0; i < sequenceLength; i++) {
            sequence.push(current);
            current = (current + a) * b;
        }
        
        const missingIndex = Math.floor(sequenceLength / 2);
        const correctAnswer = sequence[missingIndex];
        sequence[missingIndex] = null;
        
        return {
            id: `sequence-${Date.now()}`,
            type: 'sequence',
            sequence: sequence,
            missingIndex: missingIndex,
            answer: correctAnswer.toString(),
            instructions: 'Find the missing number in the sequence:',
            timeLimit: 90,
            formula: { a: a, b: b }
        };
    }
    
    generateMemoryChallenge() {
        const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        const sequenceLength = 8;
        const sequence = [];
        
        for (let i = 0; i < sequenceLength; i++) {
            sequence.push(colors[this.randn(0, colors.length)]);
        }
        
        return {
            id: `memory-${Date.now()}`,
            type: 'memory',
            sequence: sequence,
            answer: sequence.join('-'),
            instructions: 'Watch the sequence carefully, then recreate it:',
            timeLimit: 60,
            showTime: 6000
        };
    }
    
    renderChallenge(challenge, container) {
        const challengeDiv = document.createElement('div');
        challengeDiv.className = 'challenge active';
        challengeDiv.id = challenge.id;
        
        const header = document.createElement('div');
        header.className = 'challenge-header';
        header.innerHTML = `
            <span class="challenge-title">Challenge ${container.children.length + 1}</span>
            ${challenge.timeLimit ? `<span class="challenge-timer" id="timer-${challenge.id}">${challenge.timeLimit}s</span>` : ''}
        `;
        challengeDiv.appendChild(header);
        
        const instructions = document.createElement('div');
        instructions.className = 'challenge-instructions';
        instructions.textContent = challenge.instructions;
        challengeDiv.appendChild(instructions);
        
        const content = document.createElement('div');
        content.className = 'challenge-content';
        
        this.renderChallengeContent(challenge, content);
        
        challengeDiv.appendChild(content);
        container.appendChild(challengeDiv);
        
        // Start timer if applicable
        if (challenge.timeLimit) {
            this.startTimer(challenge);
        }
        
        // Handle memory challenge display
        if (challenge.type === 'memory') {
            this.handleMemoryChallenge(challenge, content);
        }
    }
    
    renderChallengeContent(challenge, content) {
        switch (challenge.type) {
            case 'pattern':
                PatternChallenge.render(challenge, content);
                break;
            case 'sequence':
                this.renderSequenceChallenge(challenge, content);
                break;
            case 'spatial':
                SpatialChallenge.render(challenge, content);
                break;
            case 'kerning':
                KerningChallenge.render(challenge, content);
                break;
            case 'predator':
                PredatorChallenge.render(challenge, content);
                break;
            case 'emotions':
                EmotionsChallenge.render(challenge, content);
                break;
            case 'human':
                HumanChallenge.render(challenge, content);
                break;
        }
    }
    
    renderSequenceChallenge(challenge, content) {
        const seqDiv = document.createElement('div');
        seqDiv.className = 'sequence-container';
        
        challenge.sequence.forEach((num, index) => {
            const item = document.createElement('div');
            item.className = 'sequence-item';
            if (num === null) {
                item.classList.add('missing');
                const input = document.createElement('input');
                input.type = 'number';
                input.id = `seq-${challenge.id}-${index}`;
                input.style.width = '100%';
                input.style.height = '100%';
                input.style.border = 'none';
                input.style.textAlign = 'center';
                input.style.fontSize = '1.5rem';
                item.appendChild(input);
            } else {
                item.textContent = num;
            }
            seqDiv.appendChild(item);
        });
        
        content.appendChild(seqDiv);
    }
    
    handleMemoryChallenge(challenge, content) {
        const displayDiv = document.createElement('div');
        displayDiv.className = 'sequence-container';
        displayDiv.id = `memory-display-${challenge.id}`;
        
        challenge.sequence.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'sequence-item';
            item.style.backgroundColor = color;
            item.style.borderColor = color;
            displayDiv.appendChild(item);
        });
        
        content.appendChild(displayDiv);
        
        // Show input immediately
        const inputDiv = document.createElement('div');
        inputDiv.className = 'input-group';
        inputDiv.innerHTML = `
            <label>Recreate the sequence (comma-separated colors):</label>
            <input type="text" id="memory-${challenge.id}" placeholder="red, blue, green" />
        `;
        content.appendChild(inputDiv);
        
        // Hide colors when user starts typing
        const input = document.getElementById(`memory-${challenge.id}`);
        let hasTyped = false;
        input.addEventListener('input', () => {
            if (!hasTyped && input.value.length > 0) {
                hasTyped = true;
                displayDiv.style.display = 'none';
            }
        });
    }
    
    startTimer(challenge) {
        let displayTime = challenge.timeLimit;
        const timerEl = document.getElementById(`timer-${challenge.id}`);
        const actualTimeLimit = challenge.timeLimit * 3 * 1000; // 3x actual time in milliseconds
        const startTime = Date.now();
        
        // Display timer ticks down at 1/3 speed (every 3 seconds real time = 1 second display time)
        const displayInterval = setInterval(() => {
            displayTime--;
            if (timerEl) {
                timerEl.textContent = `${displayTime}s`;
                if (displayTime <= 10) {
                    timerEl.style.color = 'var(--error-color)';
                }
            }
            
            if (displayTime <= 0) {
                clearInterval(displayInterval);
            }
        }, 3000); // Update display every 3 seconds (1/3 speed)
        
        // Actual timeout happens after 3x the displayed time
        const actualTimeout = setTimeout(() => {
            clearInterval(displayInterval);
            this.revealCorrectAnswers();
            this.showFeedback('Time\'s up! Challenge failed.', 'error');
            setTimeout(() => this.handleFailure(), 2000);
        }, actualTimeLimit);
        
        challenge.timerInterval = displayInterval;
        challenge.timerTimeout = actualTimeout;
    }
    
    getChallengeAnswer(challenge) {
        switch (challenge.type) {
            case 'pattern':
                return PatternChallenge.getAnswer(challenge);
            case 'sequence':
                const input = document.getElementById(`seq-${challenge.id}-${challenge.missingIndex}`);
                return input?.value || '';
            case 'spatial':
                return SpatialChallenge.getAnswer(challenge);
            case 'memory':
                return document.getElementById(`memory-${challenge.id}`)?.value || '';
            case 'kerning':
                return KerningChallenge.getAnswer(challenge);
            case 'predator':
                return PredatorChallenge.getAnswer(challenge);
            case 'emotions':
                return EmotionsChallenge.getAnswer(challenge);
            case 'human':
                return HumanChallenge.getAnswer(challenge);
            default:
                return '';
        }
    }
    
    validateRound() {
        // Check anti-automation measures
        if (!this.checkAntiAutomation()) {
            return false;
        }
        
        // Validate each challenge
        for (const challenge of this.state.challenges) {
            const userAnswer = this.getChallengeAnswer(challenge);
            
            if (challenge.type === 'memory') {
                const normalized = userAnswer.toLowerCase().replace(/\s/g, '').split(',').join('-');
                if (normalized !== challenge.answer.toLowerCase()) {
                    return false;
                }
            } else if (challenge.type === 'predator') {
                const userIndices = userAnswer.split(',').map(s => s.trim()).filter(s => s !== '').sort((a, b) => parseInt(a) - parseInt(b)).join(',');
                if (userIndices !== challenge.answer) {
                    return false;
                }
            } else if (challenge.type === 'emotions') {
                const userIndex = userAnswer.trim();
                const correctIndex = challenge.answer.trim();
                if (userIndex !== correctIndex) {
                    return false;
                }
            } else if (challenge.type === 'human') {
                const userIndex = userAnswer.trim();
                const correctIndex = challenge.answer.trim();
                if (userIndex !== correctIndex) {
                    return false;
                }
            } else if (challenge.type === 'sequence') {
                const userValue = userAnswer.trim();
                const correctValue = challenge.answer.trim();
                if (userValue !== correctValue) {
                    return false;
                }
            } else if (userAnswer !== challenge.answer) {
                return false;
            }
        }
        
        return true;
    }
    
    checkAntiAutomation() {
        const elapsed = Date.now() - this.state.startTime;
        const roundTime = elapsed / this.state.currentRound;
        
        // Check for suspiciously fast completion
        if (roundTime < 2000) {
            return false;
        }
        
        // Check mouse movements
        if (this.state.mouseMovements.length < 10) {
            return false;
        }
        
        // Check focus changes (too many = suspicious)
        // Increased threshold to 10 to allow for normal tab/window switching
        if (this.state.focusChanges > 10) {
            return false;
        }
        
        // Check keyboard events (only for challenges that require typing)
        // Note: Some challenges (emotions, pattern, predator) are click-only and don't require keyboard
        // So we only check this if there are keyboard events recorded (meaning user typed something)
        // This prevents false positives for click-only challenges
        
        return true;
    }
    
    submitRound() {
        document.getElementById('submitButton').disabled = true;
        
        if (this.validateRound()) {
            this.showFeedback('Correct! Moving to next round...', 'success');
            
            // Clear timers
            this.state.challenges.forEach(challenge => {
                if (challenge.timerInterval) {
                    clearInterval(challenge.timerInterval);
                }
                if (challenge.timerTimeout) {
                    clearTimeout(challenge.timerTimeout);
                }
            });
            
            if (this.state.currentRound >= this.state.totalRounds) {
                setTimeout(() => this.handleSuccess(), 1500);
            } else {
                setTimeout(() => this.generateRound(), 1500);
            }
        } else {
            this.showFeedback('Incorrect answer.', 'error');
            this.revealCorrectAnswers();
            setTimeout(() => {
                this.handleFailure();
            }, 2000);
        }
    }
    
    handleSuccess() {
        const code = this.generateRandomCode();
        
        // Hide buttons
        document.getElementById('buttonGroup').classList.add('hidden');
        document.getElementById('feedback').classList.add('hidden');
        
        // Show result display
        const resultDisplay = document.getElementById('resultDisplay');
        const codeDisplay = document.getElementById('resultCodeDisplay');
        document.getElementById('resultTitle').textContent = 'Congratulations!';
        document.getElementById('resultMessage').textContent = 'You have successfully completed the HardCAPTCHA!';
        codeDisplay.textContent = code;
        codeDisplay.classList.remove('hidden');
        resultDisplay.classList.remove('hidden');
    }
    
    revealCorrectAnswers() {
        this.state.challenges.forEach(challenge => {
            const challengeEl = document.getElementById(challenge.id);
            if (!challengeEl) return;
            
            switch (challenge.type) {
                case 'pattern':
                    PatternChallenge.revealAnswer(challenge, challengeEl);
                    break;
                    
                case 'sequence':
                    const seqInput = document.getElementById(`seq-${challenge.id}-${challenge.missingIndex}`);
                    if (seqInput) {
                        seqInput.value = challenge.answer;
                        seqInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                        seqInput.style.borderColor = 'var(--success-color)';
                    }
                    break;
                    
                case 'spatial':
                    SpatialChallenge.revealAnswer(challenge, challengeEl);
                    break;
                    
                case 'memory':
                    const memoryInput = document.getElementById(`memory-${challenge.id}`);
                    if (memoryInput) {
                        memoryInput.value = challenge.sequence.join(', ');
                        memoryInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                        memoryInput.style.borderColor = 'var(--success-color)';
                    }
                    break;
                case 'kerning':
                    KerningChallenge.revealAnswer(challenge, challengeEl);
                    break;
                case 'predator':
                    PredatorChallenge.revealAnswer(challenge, challengeEl);
                    break;
                case 'emotions':
                    EmotionsChallenge.revealAnswer(challenge, challengeEl);
                    break;
                case 'human':
                    HumanChallenge.revealAnswer(challenge, challengeEl);
                    break;
            }
            
        });
    }
    
    handleGiveUp() {
        const giveUpButton = document.getElementById('giveUpButton');
        giveUpButton.textContent = 'Done';
        giveUpButton.disabled = true;
        this.revealCorrectAnswers();
        setTimeout(() => {
            this.handleFailure();
        }, 1000);
    }
    
    handleFailure() {
        console.log('Yes you can pass this challenge. If you couldn\'t, it wouldn\'t be any fun watching you try.');
        
        // Hide buttons
        document.getElementById('buttonGroup').classList.add('hidden');
        document.getElementById('feedback').classList.add('hidden');
        
        // Show result display
        const resultDisplay = document.getElementById('resultDisplay');
        const codeDisplay = document.getElementById('resultCodeDisplay');
        document.getElementById('resultTitle').textContent = 'Verification Failed';
        document.getElementById('resultMessage').textContent = 'I don\'t think you are who you say you are';
        codeDisplay.textContent = '';
        codeDisplay.classList.add('hidden');
        resultDisplay.classList.remove('hidden');
    }
    
    generateRandomCode() {
        // Generate 10 capital hexadecimal digits (0-F)
        const hexChars = '0123456789ABCDEF';
        let code = '';
        for (let i = 0; i < 10; i++) {
            code += hexChars.charAt(this.randn(0, hexChars.length));
        }
        
        // Group into 5 pairs and XOR each pair
        let xorResult = 0;
        for (let i = 0; i < 10; i += 2) {
            const pair1 = parseInt(code[i], 16);
            const pair2 = parseInt(code[i + 1], 16);
            xorResult ^= (pair1 << 4) | pair2;
        }
        
        // XOR with FF to get checksum
        const checksum = xorResult ^ 0xFF;
        
        // Format checksum as 2 capital hex digits
        const checksumStr = checksum.toString(16).toUpperCase().padStart(2, '0');
        
        // Return 10 original digits + 2 checksum digits
        return code + checksumStr;
    }
    
    updateProgress() {
        document.getElementById('progressText').textContent = `Round ${this.state.currentRound}`;
    }
    
    showFeedback(message, type) {
        const feedback = document.getElementById('feedback');
        feedback.textContent = message;
        feedback.className = `feedback ${type}`;
    }
    
    clearFeedback() {
        const feedback = document.getElementById('feedback');
        feedback.textContent = '';
        feedback.className = 'feedback';
    }
}

// Verification function for console testing
// Usage: verifyCode('A1B2C3D4E5F6') or verifyCode('1.2-3.4-5.6.7!9    0...A,B')
function verifyCode(code) {
    if (!code) {
        console.log('Error: Code is required');
        return;
    }
    
    // Remove all non-hexadecimal characters (keep only 0-9, A-F, a-f)
    const hexOnly = code.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    
    if (hexOnly.length !== 12) {
        console.log(`Error: After filtering, code must have exactly 12 hexadecimal digits (found ${hexOnly.length})`);
        console.log(`Original input: ${code}`);
        console.log(`Filtered hex: ${hexOnly}`);
        return;
    }
    
    // Group into 6 pairs and XOR each pair
    let xorResult = 0;
    const pairs = [];
    
    for (let i = 0; i < 12; i += 2) {
        const pair = hexOnly.substring(i, i + 2);
        const pairValue = parseInt(pair, 16);
        pairs.push(pair);
        xorResult ^= pairValue;
    }
    
    const resultHex = xorResult.toString(16).toUpperCase().padStart(2, '0');
    console.log(`Original input: ${code}`);
    console.log(`Filtered hex: ${hexOnly}`);
    console.log(`Pairs: ${pairs.join(', ')}`);
    console.log(`XOR result: 0x${resultHex} (${xorResult})`);
    console.log(`Expected: 0xFF (255)`);
    console.log(`Valid: ${xorResult === 0xFF ? '✓ YES' : '✗ NO'}`);
    
    return xorResult === 0xFF;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new HardCAPTCHA());
} else {
    new HardCAPTCHA();
}

