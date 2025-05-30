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

// DOM Elements
const greekLetterElement = document.getElementById('greek-letter');
const optionsElement = document.getElementById('options');
const scoreElement = document.getElementById('score');
const quizPanelsElement = document.querySelector('.quiz-panels');
const quizResultsElement = document.getElementById('quiz-results');
const finalScoreElement = document.getElementById('final-score');
const reviewMessageElement = document.getElementById('review-message');
const missedLettersElement = document.getElementById('missed-letters');
const playAgainButton = document.getElementById('play-again');

// Pure functions
const getRandomLetter = () => greekLetters[Math.floor(Math.random() * greekLetters.length)];

const shuffleArray = array => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const getRandomOptions = (correctLetter, type) => {
    const correctIndex = QUIZ_TYPES[type][1];
    const options = new Set([correctLetter[correctIndex]]);

    while (options.size < 5) {
        const randomLetter = getRandomLetter();
        const randomOption = randomLetter[correctIndex];
        options.add(randomOption);
    }

    return shuffleArray([...options]);
};

const generateQuestion = () => {
    const correctLetter = getRandomLetter();
    const type = Math.floor(Math.random() * QUIZ_TYPES.length);
    const [quizIndex, correctIndex] = QUIZ_TYPES[type];
    const options = getRandomOptions(correctLetter, type);
    
    return {
        prompt: correctLetter[quizIndex],
        options,
        correct: options.indexOf(correctLetter[correctIndex]),
        type,
        correctLetter
    };
};

// State management
const createQuizState = () => ({
    currentQuestion: 0,
    score: 0,
    questions: Array.from({ length: 10 }, generateQuestion),
    missedLetters: new Set()
});

// UI Components
const createOptionElement = (option, index, onClick) => {
    const button = document.createElement('div');
    button.className = 'option';
    button.textContent = option;
    button.addEventListener('click', () => onClick(index));
    return button;
};

const updateScoreDisplay = (score) => {
    scoreElement.textContent = `Score: ${score}`;
};

const showQuestion = (question, onOptionSelect) => {
    greekLetterElement.textContent = question.prompt;
    optionsElement.innerHTML = '';
    
    question.options.forEach((option, index) => {
        optionsElement.appendChild(createOptionElement(option, index, onOptionSelect));
    });
};

const handleOptionSelection = (index, question, state, onNextQuestion) => {
    const options = optionsElement.children;
    
    if (options[index].textContent.includes('Next')) {
        onNextQuestion();
        return;
    }

    const isCorrect = index === question.correct;
    const correctOption = options[question.correct];
    const correctLetter = question.correctLetter;
    
    // Disable all options except the correct one
    Array.from(options).forEach((option, i) => {
        if (i !== question.correct) {
            option.style.pointerEvents = 'none';
        }
    });

    if (isCorrect) {
        options[index].style.backgroundColor = '#4CAF50';
        options[index].textContent = `${correctLetter[0]} | ${correctLetter[1]} (${correctLetter[2]}) | Next`;
        state.score++;
    } else {
        options[index].style.backgroundColor = '#f44336';
        correctOption.style.backgroundColor = '#4CAF50';
        correctOption.textContent = `${correctLetter[0]} | ${correctLetter[1]} (${correctLetter[2]}) | Next`;
        state.missedLetters.add(question.correctLetter);
    }

    updateScoreDisplay(state.score);
};

const showResults = (state) => {
    // Hide quiz panels and show results
    quizPanelsElement.classList.add('hidden');
    quizResultsElement.classList.remove('hidden');
    
    // Update final score
    finalScoreElement.textContent = `Final Score: ${state.score}/10`;
    
    // Update review section
    if (state.missedLetters.size > 0) {
        reviewMessageElement.textContent = 'Review these:';
        reviewMessageElement.className = 'option review-message review';
        
        // Clear and populate missed letters
        missedLettersElement.innerHTML = '';
        Array.from(state.missedLetters).forEach(letter => {
            const letterDiv = document.createElement('div');
            letterDiv.className = 'option';
            letterDiv.textContent = `${letter[2]} (${letter[0]}, ${letter[1]})`;
            missedLettersElement.appendChild(letterDiv);
        });
    } else {
        reviewMessageElement.textContent = 'Perfect score! No review needed.';
        reviewMessageElement.className = 'option review-message perfect';
        missedLettersElement.innerHTML = '';
    }
    
    // Add event listener to Play Again button
    playAgainButton.addEventListener('click', () => {
        quizPanelsElement.classList.remove('hidden');
        quizResultsElement.classList.add('hidden');
        startQuiz();
    });
};

// Quiz flow
const startQuiz = () => {
    const state = createQuizState();
    
    const nextQuestion = () => {
        state.currentQuestion++;
        if (state.currentQuestion < state.questions.length) {
            showQuestion(state.questions[state.currentQuestion], 
                (index) => handleOptionSelection(index, state.questions[state.currentQuestion], state, nextQuestion));
        } else {
            showResults(state);
        }
    };
    
    showQuestion(state.questions[state.currentQuestion], 
        (index) => handleOptionSelection(index, state.questions[state.currentQuestion], state, nextQuestion));
};

// Initialize the quiz
startQuiz(); 