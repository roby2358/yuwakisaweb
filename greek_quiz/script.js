// Greek letters data: [lowercase, uppercase, English name]
const greekLetters = [
    ['α', 'Α', 'alpha'],
    ['β', 'Β', 'beta'],
    ['γ', 'Γ', 'gamma'],
    ['δ', 'Δ', 'delta'],
    ['ε', 'Ε', 'epsilon'],
    ['ζ', 'Ζ', 'zeta'],
    ['η', 'Η', 'eta'],
    ['θ', 'Θ', 'theta'],
    ['ι', 'Ι', 'iota'],
    ['κ', 'Κ', 'kappa'],
    ['λ', 'Λ', 'lambda'],
    ['μ', 'Μ', 'mu'],
    ['ν', 'Ν', 'nu'],
    ['ξ', 'Ξ', 'xi'],
    ['ο', 'Ο', 'omicron'],
    ['π', 'Π', 'pi'],
    ['ρ', 'Ρ', 'rho'],
    ['σ', 'Σ', 'sigma'],
    ['τ', 'Τ', 'tau'],
    ['υ', 'Υ', 'upsilon'],
    ['φ', 'Φ', 'phi'],
    ['χ', 'Χ', 'chi'],
    ['ψ', 'Ψ', 'psi'],
    ['ω', 'Ω', 'omega']
];

// Quiz types: [quiz index, correct index]
// quiz index: 0=lowercase, 1=uppercase, 2=English
// correct index: 0=lowercase, 1=uppercase, 2=English
const QUIZ_TYPES = [
    [0, 2], // lowercase -> English
    [2, 0], // English -> lowercase
    [1, 2], // uppercase -> English
    [2, 1], // English -> uppercase
    [0, 1], // lowercase -> uppercase
    [1, 0]  // uppercase -> lowercase
];

let currentQuestion = 0;
let score = 0;
let questions = [];

// DOM elements
const greekLetterElement = document.getElementById('greek-letter');
const optionsElement = document.getElementById('options');
const nextButton = document.getElementById('next-btn');
const scoreElement = document.getElementById('score');

// Get a random letter from the greekLetters array
function getRandomLetter() {
    return greekLetters[Math.floor(Math.random() * greekLetters.length)];
}

// Shuffle an array using Fisher-Yates algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Get random options for a specific type
function getRandomOptions(correctLetter, type) {
    const options = [];
    const correctIndex = QUIZ_TYPES[type][1]; // Get the correct index from the quiz type
    
    options.push(correctLetter[correctIndex]);

    while (options.length < 5) {
        const randomLetter = getRandomLetter();
        const randomOption = randomLetter[correctIndex];
        if (!options.includes(randomOption)) {
            options.push(randomOption);
        }
    }

    return shuffleArray(options);
}

// Generate a random question
function generateQuestion() {
    const correctLetter = getRandomLetter();
    const type = Math.floor(Math.random() * QUIZ_TYPES.length);
    const [quizIndex, correctIndex] = QUIZ_TYPES[type];
    const options = getRandomOptions(correctLetter, type);
    
    return {
        prompt: correctLetter[quizIndex],
        options: options,
        correct: options.indexOf(correctLetter[correctIndex]),
        type
    };
}

// Initialize the quiz
function startQuiz() {
    currentQuestion = 0;
    score = 0;
    questions = [];
    
    // Generate 10 questions
    for (let i = 0; i < 10; i++) {
        questions.push(generateQuestion());
    }
    
    showQuestion();
}

// Display the current question
function showQuestion() {
    const question = questions[currentQuestion];
    greekLetterElement.textContent = question.prompt;
    
    optionsElement.innerHTML = '';
    question.options.forEach((option, index) => {
        const button = document.createElement('div');
        button.className = 'option';
        button.textContent = option;
        button.addEventListener('click', () => selectOption(index));
        optionsElement.appendChild(button);
    });
}

// Handle option selection
function selectOption(index) {
    const question = questions[currentQuestion];
    const options = optionsElement.children;
    
    // Disable all options
    Array.from(options).forEach(option => {
        option.style.pointerEvents = 'none';
    });
    
    // Check if the answer is correct
    if (index === question.correct) {
        options[index].style.backgroundColor = '#4CAF50';
        score++;
    } else {
        options[index].style.backgroundColor = '#f44336';
        options[question.correct].style.backgroundColor = '#4CAF50';
    }
    
    scoreElement.textContent = `Score: ${score}`;
    nextButton.style.display = 'block';
}

// Move to the next question
function nextQuestion() {
    currentQuestion++;
    if (currentQuestion < questions.length) {
        showQuestion();
        nextButton.style.display = 'none';
    } else {
        // Quiz completed
        greekLetterElement.textContent = '✓';
        optionsElement.innerHTML = `
            <div class="option">Quiz completed! Final score: ${score}/10</div>
            <button id="play-again" class="btn">Play Again</button>
        `;
        nextButton.style.display = 'none';
        
        // Add event listener to Play Again button
        document.getElementById('play-again').addEventListener('click', startQuiz);
    }
}

// Event listeners
nextButton.addEventListener('click', nextQuestion);
nextButton.style.display = 'none';

// Start the quiz
startQuiz(); 