// HardCAPTCHA Implementation
// All logic runs entirely in the browser

class HardCAPTCHA {
    constructor() {
        this.state = {
            currentRound: 0,
            totalRounds: 5,
            challenges: [],
            attempts: 0,
            startTime: null,
            mouseMovements: [],
            keyboardEvents: [],
            focusChanges: 0,
            lastFocusTime: null
        };
        
        this.challengeTypes = [
            'pattern',
            'math',
            'sequence',
            'spatial',
            'memory'
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
        document.getElementById('startModal').classList.remove('active');
        document.getElementById('challengeArea').classList.remove('hidden');
        this.state.startTime = Date.now();
        this.state.currentRound = 0;
        this.state.attempts = 0;
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
        this.state.attempts = 0;
        this.state.mouseMovements = [];
        this.state.keyboardEvents = [];
        this.state.focusChanges = 0;
        this.showStartModal();
    }
    
    generateRound() {
        this.state.currentRound++;
        this.updateProgress();
        
        // Clear previous challenges
        const container = document.getElementById('challengesContainer');
        container.innerHTML = '';
        
        // Generate challenges - always show 3
        const numChallenges = 3;
        this.state.challenges = [];
        
        for (let i = 0; i < numChallenges; i++) {
            const challenge = this.generateChallenge(i);
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
    
    generateChallenge(index) {
        const round = this.state.currentRound;
        
        // Determine if this should be a blended challenge
        const shouldBlend = round >= 2 && Math.random() > 0.4;
        
        if (shouldBlend && index === 0) {
            return this.generateBlendedChallenge();
        }
        
        const type = this.challengeTypes[this.randn(0, this.challengeTypes.length)];
        
        switch (type) {
            case 'pattern':
                return this.generatePatternChallenge();
            case 'math':
                return this.generateMathChallenge();
            case 'sequence':
                return this.generateSequenceChallenge();
            case 'spatial':
                return this.generateSpatialChallenge();
            case 'memory':
                return this.generateMemoryChallenge();
            default:
                return this.generatePatternChallenge();
        }
    }
    
    generateBlendedChallenge() {
        // Math + Spatial blended challenge
        const mathPart = this.generateMathChallenge();
        const spatialPart = this.generateSpatialChallenge();
        
        // Use math answer to determine spatial rotation
        const rotationCount = (mathPart.answer % 4);
        
        return {
            id: `blended-${Date.now()}`,
            type: 'blended',
            subtype: 'math-spatial',
            mathChallenge: mathPart,
            spatialChallenge: spatialPart,
            rotationCount: rotationCount,
            answer: `${mathPart.answer}-${spatialPart.answer}-${rotationCount}`,
            instructions: `First, solve the math problem. Then rotate the shape ${rotationCount} times clockwise, and select the correct orientation.`,
            timeLimit: 110
        };
    }
    
    generatePatternChallenge() {
        const gridSize = 4;
        const totalSquares = gridSize * gridSize; // 16 squares
        const pattern = [];
        
        // Pick which component (R, G, or B) will be consistent
        const consistentComponent = this.randn(0, 3); // 0=R, 1=G, 2=B
        const consistentValue = this.randn(0x80, 0xD1); // 128-208 in decimal
        
        // Pick which square will be the odd one out
        const oddIndex = this.randn(0, totalSquares);
        
        // Generate all 16 squares
        for (let i = 0; i < totalSquares; i++) {
            if (i === oddIndex) {
                // The odd one out: all 3 components are random
                pattern.push({
                    r: this.randn(0x80, 0xD1),
                    g: this.randn(0x80, 0xD1),
                    b: this.randn(0x80, 0xD1)
                });
            } else {
                // 15 squares with one consistent component
                const r = consistentComponent === 0 ? consistentValue : this.randn(0x80, 0xD1);
                const g = consistentComponent === 1 ? consistentValue : this.randn(0x80, 0xD1);
                const b = consistentComponent === 2 ? consistentValue : this.randn(0x80, 0xD1);
                pattern.push({ r, g, b });
            }
        }
        
        return {
            id: `pattern-${Date.now()}`,
            type: 'pattern',
            pattern: pattern,
            correctIndex: oddIndex,
            answer: oddIndex.toString(),
            instructions: 'Click on the one square that is different from all the others in the grid.',
            gridSize: gridSize,
            timeLimit: 70
        };
    }
    
    generateMathChallenge() {
        let question, answer;
        
        // Always use the hardest math challenge
        const a = this.randn(5, 20);
        const b = this.randn(3, 13);
        const c = this.randn(5, 25);
        const d = this.randn(2, 12);
        question = `((${a} × ${b}) - ${c}) ÷ ${d}`;
        answer = Math.floor(((a * b) - c) / d);
        
        return {
            id: `math-${Date.now()}`,
            type: 'math',
            question: question,
            answer: answer.toString(),
            instructions: 'Solve the following mathematical expression:',
            timeLimit: 55
        };
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
    
    generateSpatialChallenge() {
        const shapes = ['▲', '●', '■', '◆'];
        const rotations = [0, 90, 180, 270];
        const correctShape = shapes[this.randn(0, shapes.length)];
        const correctRotation = rotations[this.randn(0, rotations.length)];
        
        const options = [];
        // Add correct option
        options.push({ shape: correctShape, rotation: correctRotation, correct: true });
        
        // Add incorrect options
        for (let i = 0; i < 3; i++) {
            const shape = shapes[this.randn(0, shapes.length)];
            const rotation = rotations[this.randn(0, rotations.length)];
            if (shape !== correctShape || rotation !== correctRotation) {
                options.push({ shape, rotation, correct: false });
            }
        }
        
        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
            const j = this.randn(0, i + 1);
            [options[i], options[j]] = [options[j], options[i]];
        }
        
        const correctIndex = options.findIndex(opt => opt.correct);
        
        return {
            id: `spatial-${Date.now()}`,
            type: 'spatial',
            targetShape: correctShape,
            targetRotation: correctRotation,
            options: options,
            correctIndex: correctIndex,
            answer: correctIndex.toString(),
            instructions: `Select the shape ${correctShape} rotated ${correctRotation} degrees clockwise:`,
            timeLimit: 60
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
        
        if (challenge.type === 'blended') {
            this.renderBlendedChallenge(challenge, content);
        } else {
            this.renderChallengeContent(challenge, content);
        }
        
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
    
    renderBlendedChallenge(challenge, content) {
        // Render math part
        const mathDiv = document.createElement('div');
        mathDiv.className = 'math-puzzle';
        mathDiv.innerHTML = `
            <p><strong>Step 1: Solve this</strong></p>
            <p>${challenge.mathChallenge.question} = ?</p>
            <input type="number" id="math-${challenge.id}" placeholder="Answer" />
        `;
        content.appendChild(mathDiv);
        
        // Render spatial part
        const spatialDiv = document.createElement('div');
        spatialDiv.className = 'spatial-container';
        spatialDiv.innerHTML = '<p><strong>Step 2: Select the correct shape</strong></p>';
        
        challenge.spatialChallenge.options.forEach((option, index) => {
            const shapeDiv = document.createElement('div');
            shapeDiv.className = 'shape';
            shapeDiv.dataset.index = index;
            shapeDiv.style.transform = `rotate(${option.rotation}deg)`;
            shapeDiv.textContent = option.shape;
            shapeDiv.addEventListener('click', () => {
                document.querySelectorAll(`#${challenge.id} .shape`).forEach(s => s.classList.remove('selected'));
                shapeDiv.classList.add('selected');
            });
            spatialDiv.appendChild(shapeDiv);
        });
        
        content.appendChild(spatialDiv);
    }
    
    renderChallengeContent(challenge, content) {
        switch (challenge.type) {
            case 'pattern':
                this.renderPatternChallenge(challenge, content);
                break;
            case 'math':
                this.renderMathChallenge(challenge, content);
                break;
            case 'sequence':
                this.renderSequenceChallenge(challenge, content);
                break;
            case 'spatial':
                this.renderSpatialChallenge(challenge, content);
                break;
        }
    }
    
    renderPatternChallenge(challenge, content) {
        const grid = document.createElement('div');
        grid.className = 'pattern-grid';
        grid.style.gridTemplateColumns = `repeat(${challenge.gridSize}, 1fr)`;
        
        challenge.pattern.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            const r = color.r.toString(16).padStart(2, '0').toUpperCase();
            const g = color.g.toString(16).padStart(2, '0').toUpperCase();
            const b = color.b.toString(16).padStart(2, '0').toUpperCase();
            item.style.backgroundColor = `#${r}${g}${b}`;
            item.dataset.index = index;
            item.addEventListener('click', () => {
                document.querySelectorAll(`#${challenge.id} .pattern-item`).forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
            grid.appendChild(item);
        });
        
        content.appendChild(grid);
    }
    
    renderMathChallenge(challenge, content) {
        const mathDiv = document.createElement('div');
        mathDiv.className = 'math-puzzle';
        mathDiv.innerHTML = `
            <p>${challenge.question} = ?</p>
            <input type="number" id="math-${challenge.id}" placeholder="Answer" />
        `;
        content.appendChild(mathDiv);
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
    
    renderSpatialChallenge(challenge, content) {
        const spatialDiv = document.createElement('div');
        spatialDiv.className = 'spatial-container';
        
        challenge.options.forEach((option, index) => {
            const shapeDiv = document.createElement('div');
            shapeDiv.className = 'shape';
            shapeDiv.dataset.index = index;
            shapeDiv.style.transform = `rotate(${option.rotation}deg)`;
            shapeDiv.textContent = option.shape;
            shapeDiv.addEventListener('click', () => {
                document.querySelectorAll(`#${challenge.id} .shape`).forEach(s => s.classList.remove('selected'));
                shapeDiv.classList.add('selected');
            });
            spatialDiv.appendChild(shapeDiv);
        });
        
        content.appendChild(spatialDiv);
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
            setTimeout(() => this.handleFailure(), 3000);
        }, actualTimeLimit);
        
        challenge.timerInterval = displayInterval;
        challenge.timerTimeout = actualTimeout;
    }
    
    getChallengeAnswer(challenge) {
        if (challenge.type === 'blended') {
            const mathAnswer = document.getElementById(`math-${challenge.id}`)?.value;
            const selectedShape = document.querySelector(`#${challenge.id} .shape.selected`);
            const shapeIndex = selectedShape?.dataset.index;
            return `${mathAnswer}-${shapeIndex}`;
        }
        
        switch (challenge.type) {
            case 'pattern':
                const selected = document.querySelector(`#${challenge.id} .pattern-item.selected`);
                return selected?.dataset.index || '';
            case 'math':
                return document.getElementById(`math-${challenge.id}`)?.value || '';
            case 'sequence':
                const input = document.getElementById(`seq-${challenge.id}-${challenge.missingIndex}`);
                return input?.value || '';
            case 'spatial':
                const selectedShape = document.querySelector(`#${challenge.id} .shape.selected`);
                return selectedShape?.dataset.index || '';
            case 'memory':
                return document.getElementById(`memory-${challenge.id}`)?.value || '';
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
            
            if (challenge.type === 'blended') {
                const parts = userAnswer.split('-');
                const mathAnswer = parts[0];
                const shapeIndex = parts[1];
                
                if (mathAnswer !== challenge.mathChallenge.answer) {
                    return false;
                }
                
                if (shapeIndex !== challenge.spatialChallenge.answer) {
                    return false;
                }
            } else {
                if (challenge.type === 'memory') {
                    const normalized = userAnswer.toLowerCase().replace(/\s/g, '').split(',').join('-');
                    if (normalized !== challenge.answer.toLowerCase()) {
                        return false;
                    }
                } else if (userAnswer !== challenge.answer) {
                    return false;
                }
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
        if (this.state.focusChanges > 5) {
            return false;
        }
        
        // Check keyboard events
        if (this.state.keyboardEvents.length === 0 && this.state.currentRound > 1) {
            return false;
        }
        
        return true;
    }
    
    submitRound() {
        document.getElementById('submitButton').disabled = true;
        
        if (this.validateRound()) {
            this.state.attempts = 0;
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
            this.state.attempts++;
            this.showFeedback('Incorrect answer. Please try again.', 'error');
            
            if (this.state.attempts >= 3) {
                setTimeout(() => this.handleFailure(), 2000);
            } else {
                setTimeout(() => {
                    document.getElementById('submitButton').disabled = false;
                }, 1000);
            }
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
            
            if (challenge.type === 'blended') {
                // Reveal math answer
                const mathInput = document.getElementById(`math-${challenge.id}`);
                if (mathInput) {
                    mathInput.value = challenge.mathChallenge.answer;
                    mathInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                    mathInput.style.borderColor = 'var(--success-color)';
                }
                
                // Reveal spatial answer
                const shapes = challengeEl.querySelectorAll('.shape');
                shapes.forEach((shape, index) => {
                    if (index === challenge.spatialChallenge.correctIndex) {
                        shape.classList.add('selected');
                        shape.style.borderColor = 'var(--success-color)';
                        shape.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                    }
                });
            } else {
                switch (challenge.type) {
                    case 'pattern':
                        const patternItems = challengeEl.querySelectorAll('.pattern-item');
                        patternItems.forEach((item, index) => {
                            if (index === challenge.correctIndex) {
                                item.classList.add('selected');
                                item.style.borderColor = 'var(--success-color)';
                                item.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                            }
                        });
                        break;
                        
                    case 'math':
                        const mathInput = document.getElementById(`math-${challenge.id}`);
                        if (mathInput) {
                            mathInput.value = challenge.answer;
                            mathInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                            mathInput.style.borderColor = 'var(--success-color)';
                        }
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
                        const spatialShapes = challengeEl.querySelectorAll('.shape');
                        spatialShapes.forEach((shape, index) => {
                            if (index === challenge.correctIndex) {
                                shape.classList.add('selected');
                                shape.style.borderColor = 'var(--success-color)';
                                shape.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                            }
                        });
                        break;
                        
                    case 'memory':
                        const memoryInput = document.getElementById(`memory-${challenge.id}`);
                        if (memoryInput) {
                            memoryInput.value = challenge.sequence.join(', ');
                            memoryInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                            memoryInput.style.borderColor = 'var(--success-color)';
                        }
                        break;
                }
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
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 12; i++) {
            code += chars.charAt(this.randn(0, chars.length));
        }
        return code;
    }
    
    updateProgress() {
        const progress = (this.state.currentRound / this.state.totalRounds) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `Challenge ${this.state.currentRound} of ${this.state.totalRounds}`;
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new HardCAPTCHA());
} else {
    new HardCAPTCHA();
}

