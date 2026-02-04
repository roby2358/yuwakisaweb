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
    halloween_fun: halloweenFunTheme,
    tescreal: tescreal,
    wirehead_poaster: wireheadPoaster,
    secular_religionist: secularReligionist
};

let state = {
    theme: null,
    questions: [],
    answers: [],
    currentIndex: 0
};

function init() {
    const params = new URLSearchParams(window.location.search);
    const themeParam = params.get('theme');

    if (themeParam && THEMES[themeParam]) {
        startSurvey(themeParam);
    } else {
        showThemeSelection();
    }
}

function showThemeSelection() {
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
    state.questions = selectQuestions(theme);
    state.answers = new Array(state.questions.length).fill(null);
    state.currentIndex = 0;

    document.getElementById('header-title').textContent = theme.name;
    renderIntro();
}

function renderIntro() {
    const content = document.getElementById('content');

    content.innerHTML = `
        <div class="intro">
            <p>${state.theme.intro}</p>
            <button class="btn btn-primary btn-lg" onclick="beginQuestions()">Begin</button>
        </div>
    `;
}

function beginQuestions() {
    renderQuestion();
}

function selectQuestions(theme) {
    const selected = [];

    for (const category of theme.categories) {
        const categoryQuestions = category.questions.map(q => ({
            text: q.text,
            positive: q.positive,
            categoryPositive: category.positive,
            categoryName: category.name
        }));

        const shuffled = shuffle([...categoryQuestions]);
        const picked = shuffled.slice(0, theme.questionsPerCategory);
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
    const content = document.getElementById('content');
    const question = state.questions[state.currentIndex];
    const answer = state.answers[state.currentIndex];
    const total = state.questions.length;
    const current = state.currentIndex + 1;

    content.innerHTML = `
        <div class="progress">Question ${current} of ${total}</div>
        <div class="question-text">"${question.text}"</div>
        <div class="answer-buttons">
            <button class="agree ${answer === true ? 'selected' : ''}" onclick="answer(true)">Agree</button>
            <button class="disagree ${answer === false ? 'selected' : ''}" onclick="answer(false)">Disagree</button>
        </div>
        <div class="navigation">
            <button class="nav-back" onclick="goBack()" ${state.currentIndex === 0 ? 'disabled' : ''}>Back</button>
            <button class="nav-next" onclick="goNext()" ${answer === null ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

function answer(agree) {
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

function calculateCategoryScores() {
    const categoryResults = {};

    for (let i = 0; i < state.questions.length; i++) {
        const q = state.questions[i];
        const agreed = state.answers[i];
        const categoryName = q.categoryName;

        if (!categoryResults[categoryName]) {
            categoryResults[categoryName] = { positive: 0, total: 0 };
        }

        categoryResults[categoryName].total++;

        // Positive for category when answer matches question polarity
        const positiveForCategory = agreed === q.positive;
        if (positiveForCategory) {
            categoryResults[categoryName].positive++;
        }
    }

    const ratings = {};
    for (const [name, data] of Object.entries(categoryResults)) {
        ratings[name] = data.positive > data.total / 2 ? 'HIGH' : 'LOW';
    }

    return ratings;
}

function showResults() {
    const content = document.getElementById('content');
    const score = calculateScore();
    const ratings = calculateCategoryScores();

    const categoryOrder = state.theme.categories.map(c => c.name);
    const ratingsHtml = categoryOrder
        .filter(name => ratings[name])
        .map(name => `
            <div class="category-rating">
                <span class="category-name">${name}</span>
                <span class="rating ${ratings[name].toLowerCase()}">${ratings[name]}</span>
            </div>
        `).join('');

    content.innerHTML = `
        <div class="results">
            <h2>Your Score:</h2>
            <div class="score">${score}%</div>
            <div class="category-ratings">
                ${ratingsHtml}
            </div>
            <button class="btn btn-primary" onclick="window.location.href='?'">Take Another Survey</button>
        </div>
    `;
}

init();
