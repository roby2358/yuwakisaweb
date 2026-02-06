/*
MIT License

Copyright (c) 2026 Rob Young

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const THEMES = {
    claude_v_gpt: claudeVsGpt,
    dune_brained: duneBrained,
    halloween_fun: halloweenFunTheme,
    halloween_vs_christmas: halloweenVsChristmas,
    human_supremacist: humanSupremacist,
    lotr_brained: lotrBrained,
    secular_religionist: secularReligionist,
    tescreal: tescreal,
    wirehead_poaster: wireheadPoaster
};

let state = {
    theme: null,
    questions: [],
    answers: [],
    currentIndex: 0,
    surveyLength: 'short',
    currentView: 'theme-selection'
};

function init() {
    const params = new URLSearchParams(window.location.search);
    const themeParam = params.get('theme');

    if (themeParam && THEMES[themeParam]) {
        startSurvey(themeParam);
    } else {
        showThemeSelection();
    }

    // Setup global keyboard listener
    document.addEventListener('keydown', handleGlobalKeyPress);
}

function showThemeSelection() {
    state.currentView = 'theme-selection';
    document.getElementById('header-title').textContent = 'Attitude Surveys';
    const content = document.getElementById('content');

    const themeNames = Object.keys(THEMES).map(key => ({
        key,
        name: THEMES[key].name
    }));

    content.innerHTML = `
        <div class="theme-list">
            <h2>Choose a survey:</h2>
            ${themeNames.map(t => `<a href="?theme=${t.key}">${t.name}</a>`).join('')}
        </div>
    `;
}

function startSurvey(themeKey) {
    const theme = THEMES[themeKey];
    state.theme = theme;
    state.surveyLength = 'short';

    document.getElementById('header-title').textContent = theme.name;
    renderIntro();
}

function renderIntro() {
    state.currentView = 'intro';
    const content = document.getElementById('content');
    const shortCount = state.theme.questionsPerCategory * state.theme.categories.length;
    const longCount = (state.theme.questionsPerCategory + 2) * state.theme.categories.length;
    const comprehensiveCount = state.theme.categories.reduce((sum, cat) => sum + cat.questions.length, 0);

    content.innerHTML = `
        <div class="intro">
            <p>${state.theme.intro}</p>
            <div class="survey-length-options">
                <label class="length-option">
                    <input type="radio" name="surveyLength" value="short" ${state.surveyLength === 'short' ? 'checked' : ''} onchange="setSurveyLength('short')">
                    <span>Short (${shortCount} questions)</span>
                </label>
                <label class="length-option">
                    <input type="radio" name="surveyLength" value="long" ${state.surveyLength === 'long' ? 'checked' : ''} onchange="setSurveyLength('long')">
                    <span>Long (${longCount} questions)</span>
                </label>
                <label class="length-option">
                    <input type="radio" name="surveyLength" value="comprehensive" ${state.surveyLength === 'comprehensive' ? 'checked' : ''} onchange="setSurveyLength('comprehensive')">
                    <span>Comprehensive Assessment (${comprehensiveCount} questions)</span>
                </label>
            </div>
            <button class="btn btn-primary btn-lg" onclick="beginQuestions()">Begin</button>
            <p class="keyboard-hint">
                <strong>Keyboard:</strong> <kbd>←</kbd> Disagree, <kbd>→</kbd> Agree (double-tap to confirm)
            </p>
        </div>
    `;
}

function setSurveyLength(length) {
    state.surveyLength = length;
}

function beginQuestions() {
    state.questions = selectQuestions(state.theme);
    state.answers = new Array(state.questions.length).fill(null);
    state.currentIndex = 0;
    renderQuestion();
}

function selectQuestions(theme) {
    const selected = [];
    const isComprehensive = state.surveyLength === 'comprehensive';
    const questionsPerCategory = state.surveyLength === 'long'
        ? theme.questionsPerCategory + 2
        : theme.questionsPerCategory;

    for (const category of theme.categories) {
        const categoryQuestions = category.questions.map(q => ({
            text: q.text,
            positive: q.positive,
            categoryPositive: category.positive,
            categoryName: category.name
        }));

        const shuffled = shuffle([...categoryQuestions]);
        const picked = isComprehensive ? shuffled : shuffled.slice(0, questionsPerCategory);
        selected.push(...picked);
    }

    return shuffle(selected);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderQuestion() {
    state.currentView = 'question';
    const content = document.getElementById('content');
    const question = state.questions[state.currentIndex];
    const currentAnswer = state.answers[state.currentIndex];
    const total = state.questions.length;
    const current = state.currentIndex + 1;

    content.innerHTML = `
        <div class="progress">Question ${current} of ${total}</div>
        <div class="question-text">"${question.text}"</div>
        <div class="answer-buttons">
            <button class="disagree ${currentAnswer === false ? 'selected' : ''}" onclick="selectAnswer(false)" title="Press ← (left arrow)">Disagree</button>
            <button class="agree ${currentAnswer === true ? 'selected' : ''}" onclick="selectAnswer(true)" title="Press → (right arrow)">Agree</button>
        </div>
        <div class="navigation">
            <button class="nav-back" onclick="goBack()" ${state.currentIndex === 0 ? 'disabled' : ''} title="Press Backspace">Back</button>
            <button class="nav-next" onclick="goNext()" ${currentAnswer === null ? 'disabled' : ''} title="Press Space or Enter">Next</button>
        </div>
        <div class="keyboard-hints">
            <small>
                <kbd>←</kbd> Disagree • <kbd>→</kbd> Agree • Double-tap to confirm
            </small>
        </div>
    `;
}

function selectAnswer(agree) {
    state.answers[state.currentIndex] = agree;
    renderQuestion();
}

function goBack() {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        renderQuestion();
    }
}

function goNext() {
    if (state.answers[state.currentIndex] === null) return;

    if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

function handleGlobalKeyPress(event) {
    // Don't interfere with input elements
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    const key = event.key;

    // Theme selection view
    if (state.currentView === 'theme-selection') {
        return;
    }

    // Intro view
    if (state.currentView === 'intro') {
        if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            beginQuestions();
        }
        return;
    }

    // Question view
    if (state.currentView === 'question') {
        const currentAnswer = state.answers[state.currentIndex];

        // Left arrow: select Disagree, or confirm if already selected
        if (key === 'ArrowLeft') {
            event.preventDefault();
            if (currentAnswer === false) {
                goNext();
            } else {
                selectAnswer(false);
            }
            return;
        }

        // Right arrow: select Agree, or confirm if already selected
        if (key === 'ArrowRight') {
            event.preventDefault();
            if (currentAnswer === true) {
                goNext();
            } else {
                selectAnswer(true);
            }
            return;
        }

        // Spacebar: confirm current selection and move to next question
        if (key === ' ') {
            event.preventDefault();
            if (currentAnswer !== null) {
                goNext();
            }
            return;
        }

        // Enter: also confirms and moves to next
        if (key === 'Enter') {
            event.preventDefault();
            if (currentAnswer !== null) {
                goNext();
            }
            return;
        }

        // Backspace: go back to previous question
        if (key === 'Backspace') {
            event.preventDefault();
            goBack();
            return;
        }
    }

    // Results view
    if (state.currentView === 'results') {
        if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            window.location.href = '?';
        }
        return;
    }
}

function isOrMode(theme) {
    return theme.options !== undefined;
}

function answersAlignWithQuestion(agreed, questionPositive) {
    return agreed === questionPositive;
}

function calculateScore() {
    let points = 0;

    for (let i = 0; i < state.questions.length; i++) {
        const q = state.questions[i];
        const agreed = state.answers[i];

        const questionPolarity = q.positive === q.categoryPositive;
        const contributesPositively = agreed === questionPolarity;

        if (contributesPositively) {
            points++;
        }
    }

    return Math.round((points / state.questions.length) * 100);
}

function calculateOrScore() {
    let optionACount = 0;
    let optionBCount = 0;

    for (let i = 0; i < state.questions.length; i++) {
        const q = state.questions[i];
        const agreed = state.answers[i];

        // Positive question + agree = Option A
        // Positive question + disagree = Option B
        // Negative question + agree = Option B
        // Negative question + disagree = Option A
        if (answersAlignWithQuestion(agreed, q.positive)) {
            optionACount++;
        } else {
            optionBCount++;
        }
    }

    const total = state.questions.length;

    // Determine winner from raw counts (not rounded percentages)
    // A tie only occurs when counts are exactly equal
    let winner = null;
    if (optionACount > optionBCount) {
        winner = 'a';
    } else if (optionBCount > optionACount) {
        winner = 'b';
    }
    // If optionACount === optionBCount, winner remains null (true tie)

    // Calculate display percentages (integers)
    const percentA = Math.round((optionACount / total) * 100);
    const percentB = 100 - percentA;

    return {
        winner,  // 'a', 'b', or null (tie)
        percentA,
        percentB
    };
}

function accumulateCategoryResults() {
    const categoryResults = {};

    for (let i = 0; i < state.questions.length; i++) {
        const q = state.questions[i];
        const agreed = state.answers[i];
        const categoryName = q.categoryName;

        if (!categoryResults[categoryName]) {
            categoryResults[categoryName] = { aligned: 0, total: 0 };
        }

        categoryResults[categoryName].total++;

        if (answersAlignWithQuestion(agreed, q.positive)) {
            categoryResults[categoryName].aligned++;
        }
    }

    return categoryResults;
}

function calculateOrCategoryScores() {
    const categoryResults = accumulateCategoryResults();
    const winners = {};

    for (const [name, data] of Object.entries(categoryResults)) {
        winners[name] = data.aligned >= data.total / 2 ? 'a' : 'b';
    }

    return winners;
}

function calculateCategoryScores() {
    const categoryResults = accumulateCategoryResults();
    const ratings = {};

    for (const [name, data] of Object.entries(categoryResults)) {
        ratings[name] = data.aligned > data.total / 2 ? 'HIGH' : 'LOW';
    }

    return ratings;
}

function renderCategoryRatings(categoryScores, formatLabel) {
    const categoryOrder = state.theme.categories.map(c => c.name);
    return categoryOrder
        .filter(name => categoryScores[name])
        .map(name => {
            const label = formatLabel(categoryScores[name]);
            return `
                <div class="category-rating">
                    <span class="category-name">${name}</span>
                    <span class="rating ${label.cssClass || ''}">${label.text}</span>
                </div>
            `;
        }).join('');
}

function showResults() {
    state.currentView = 'results';
    const content = document.getElementById('content');

    if (isOrMode(state.theme)) {
        renderOrResults(content);
    } else {
        renderStandardResults(content);
    }
}

function renderOrResults(content) {
    const result = calculateOrScore();
    const categoryWinners = calculateOrCategoryScores();
    const options = state.theme.options;

    const ratingsHtml = renderCategoryRatings(categoryWinners, (winner) => {
        const optionName = winner === 'a' ? options.a : options.b;
        return { text: optionName };
    });

    // Handle tie vs winner display
    let headlineHtml;
    let percentHtml;

    if (result.winner === null) {
        // Exact 50/50 tie
        headlineHtml = `<div class="score cannot-decide">You cannot decide</div>`;
        percentHtml = `<div class="score-detail">50%</div>`;
    } else {
        // Winner exists
        const winnerName = result.winner === 'a' ? options.a : options.b;
        const winnerPercent = result.winner === 'a' ? result.percentA : result.percentB;
        headlineHtml = `
            <h2>You lean toward:</h2>
            <div class="score">${winnerName}</div>
        `;
        percentHtml = `<div class="score-detail">${winnerPercent}%</div>`;
    }

    content.innerHTML = `
        <div class="results">
            ${headlineHtml}
            ${percentHtml}
            <div class="category-ratings">
                ${ratingsHtml}
            </div>
            <button class="btn btn-primary" onclick="window.location.href='?'">Take Another Survey</button>
            <p class="keyboard-hint">
                Press <kbd>Enter</kbd> or <kbd>Space</kbd> to take another survey
            </p>
        </div>
    `;
}

function renderStandardResults(content) {
    const score = calculateScore();
    const ratings = calculateCategoryScores();

    const ratingsHtml = renderCategoryRatings(ratings, (rating) => ({
        text: rating,
        cssClass: rating.toLowerCase()
    }));

    content.innerHTML = `
        <div class="results">
            <h2>Your Score:</h2>
            <div class="score">${score}%</div>
            <div class="category-ratings">
                ${ratingsHtml}
            </div>
            <button class="btn btn-primary" onclick="window.location.href='?'">Take Another Survey</button>
            <p class="keyboard-hint">
                Press <kbd>Enter</kbd> or <kbd>Space</kbd> to take another survey
            </p>
        </div>
    `;
}

init();
