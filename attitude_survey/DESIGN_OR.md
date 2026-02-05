# "Or" Survey Mode - Design Document

Implementation design for adding "or" survey mode to the attitude survey application.

## Overview

This document describes how to implement the "or" survey mode specified in SPEC_OR.md. The design prioritizes minimal changes to existing code while supporting the new survey type.

## Theme Data Structure

### Current Theme Structure

```javascript
const exampleTheme = {
    name: "Theme Name",
    intro: "Introductory text...",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Category Name",
            positive: true,
            questions: [
                { text: "Question text", positive: true },
                // ...
            ]
        }
    ]
};
```

### Extended Structure for "Or" Mode

Add an optional `options` property to distinguish "or" themes:

```javascript
const orTheme = {
    name: "Theme Name",
    intro: "Introductory text...",
    questionsPerCategory: 3,
    options: {
        a: "Option A Display Name",
        b: "Option B Display Name"
    },
    categories: [
        // Same structure as standard themes
    ]
};
```

The presence of `options` triggers "or" mode behavior.

## Mode Detection

Add a helper function to detect survey mode:

```javascript
function isOrMode(theme) {
    return theme.options !== undefined;
}
```

Use this throughout the codebase to branch behavior.

## Scoring Logic

### Current Scoring (index.js:185-201)

The existing `calculateScore()` function computes a percentage based on polarity alignment. This remains unchanged for standard surveys.

### New "Or" Mode Scoring

Add a new function `calculateOrScore()`:

```javascript
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
        const leansTowardA = agreed === q.positive;

        if (leansTowardA) {
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
```

### Category Scoring for "Or" Mode

Modify or add alongside `calculateCategoryScores()`:

```javascript
function calculateOrCategoryScores() {
    const categoryResults = {};

    for (let i = 0; i < state.questions.length; i++) {
        const q = state.questions[i];
        const agreed = state.answers[i];
        const categoryName = q.categoryName;

        if (!categoryResults[categoryName]) {
            categoryResults[categoryName] = { a: 0, b: 0 };
        }

        const leansTowardA = agreed === q.positive;
        if (leansTowardA) {
            categoryResults[categoryName].a++;
        } else {
            categoryResults[categoryName].b++;
        }
    }

    const winners = {};
    for (const [name, data] of Object.entries(categoryResults)) {
        winners[name] = data.a >= data.b ? 'a' : 'b';
    }

    return winners;
}
```

## Results Display

### Modify showResults() (index.js:232-257)

Branch the results rendering based on mode:

```javascript
function showResults() {
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

    // Build category breakdown HTML
    const categoryOrder = state.theme.categories.map(c => c.name);
    const ratingsHtml = categoryOrder
        .filter(name => categoryWinners[name])
        .map(name => {
            const winner = categoryWinners[name];
            const optionName = winner === 'a' ? options.a : options.b;
            return `
                <div class="category-rating">
                    <span class="category-name">${name}</span>
                    <span class="rating">${optionName}</span>
                </div>
            `;
        }).join('');

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
        </div>
    `;
}

function renderStandardResults(content) {
    // Move existing showResults() logic here
}
```

## CSS Additions

Add styles for the new results display elements:

```css
.score-detail {
    font-size: 1.5rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
}

/* "You cannot decide" tie state - bold text */
.score.cannot-decide {
    font-weight: 700;
}

/* Override rating colors for or-mode (neutral styling) */
.results .rating {
    background: var(--color-surface-alt);
    color: var(--color-text-dark);
}
```

## Files to Modify

1. **index.js**
   - Add `isOrMode()` helper function
   - Add `calculateOrScore()` function
   - Add `calculateOrCategoryScores()` function
   - Refactor `showResults()` into mode-specific renderers

2. **index.css**
   - Add `.score-detail` styling
   - Add neutral styling for or-mode category ratings

3. **New theme file(s)**
   - Create example "or" mode theme to test implementation

## Testing Approach

1. Create a test "or" theme with known question polarities
2. Verify mode detection works correctly
3. Answer all questions toward Option A, verify 100% A result
4. Answer all questions toward Option B, verify 100% B result
5. Answer mixed, verify percentage calculation (displayed as integers)
6. Answer exactly half toward each option, verify "You cannot decide" displays
7. Verify category breakdowns show correct option winners
8. Verify standard surveys still work unchanged

## Open Design Decisions

### Category Rating Styling

Current design: Uses neutral styling for both options.

Alternative: Could use distinct colors for Option A vs Option B to make the breakdown more visually distinct.

## Migration Path

No migration needed. Existing themes continue to work. New "or" themes simply include the `options` property.
