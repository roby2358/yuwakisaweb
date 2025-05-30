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
let missedLetters = []; // Track missed letters

// DOM elements
const greekLetterElement = document.getElementById('greek-letter');
const optionsElement = document.getElementById('options');
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
    missedLetters = []; // Reset missed letters
    
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
    
    // If the option already has "Next" in it, this is a next question click
    if (options[index].textContent.includes('Next')) {
        nextQuestion();
        return;
    }
    
    // Disable all options except the correct one
    Array.from(options).forEach((option, i) => {
        if (i !== question.correct) {
            option.style.pointerEvents = 'none';
        }
    });
    
    // Check if the answer is correct
    if (index === question.correct) {
        options[index].style.backgroundColor = '#4CAF50';
        options[index].textContent = `${options[index].textContent} | Next`;
        // Remove old click listener and add new one
        const newOption = options[index].cloneNode(true);
        options[index].parentNode.replaceChild(newOption, options[index]);
        newOption.addEventListener('click', () => selectOption(index));
        score++;
    } else {
        options[index].style.backgroundColor = '#f44336';
        options[question.correct].style.backgroundColor = '#4CAF50';
        options[question.correct].textContent = `${options[question.correct].textContent} | Next`;
        // Remove old click listener and add new one
        const newOption = options[question.correct].cloneNode(true);
        options[question.correct].parentNode.replaceChild(newOption, options[question.correct]);
        newOption.addEventListener('click', () => selectOption(question.correct));
        
        // Add to missed letters if not already there
        const correctLetter = greekLetters.find(letter => 
            letter[QUIZ_TYPES[question.type][1]] === question.options[question.correct]
        );
        if (correctLetter && !missedLetters.some(missed => 
            missed[0] === correctLetter[0] && 
            missed[1] === correctLetter[1] && 
            missed[2] === correctLetter[2]
        )) {
            missedLetters.push(correctLetter);
        }
    }
    
    scoreElement.textContent = `Score: ${score}`;
}

// Move to the next question
function nextQuestion() {
    currentQuestion++;
    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        // Quiz completed
        greekLetterElement.parentNode.style.display = 'none'; // Hide the greek letter panel
        
        let reviewHTML = '<div style="max-width: 800px; margin: 0 auto; padding: 2rem; display: flex; justify-content: center;">';
        
        // Create a grid with two columns
        reviewHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; width: 100%;">';
        
        // Left column - Score and Play Again
        reviewHTML += `
            <div>
                <div class="option" style="background-color: #e2e3e5; color: #383d41; font-weight: bold;">Final Score: ${score}/10</div>
                <button id="play-again" class="btn" style="margin-top: 1rem;">Play Again</button>
            </div>
        `;
        
        // Right column - Review letters
        reviewHTML += '<div>';
        if (missedLetters.length > 0) {
            reviewHTML += '<div class="option" style="background-color: #fff3cd; color: #856404; font-weight: bold;">Review these:</div>';
            missedLetters.forEach(letter => {
                reviewHTML += `
                    <div class="option" style="background-color: #fff3cd; color: #856404;">
                        ${letter[2]} (${letter[0]}, ${letter[1]})
                    </div>
                `;
            });
        } else {
            reviewHTML += '<div class="option" style="background-color: #d4edda; color: #155724;">Perfect score! No review needed.</div>';
        }
        reviewHTML += '</div>';
        
        reviewHTML += '</div></div>';
        optionsElement.innerHTML = reviewHTML;
        
        // Add event listener to Play Again button
        document.getElementById('play-again').addEventListener('click', () => {
            greekLetterElement.parentNode.style.display = 'flex'; // Show the greek letter panel again
            startQuiz();
        });
    }
}

// Start the quiz
startQuiz(); 