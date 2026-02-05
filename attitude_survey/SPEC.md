# Attitude Survey - Technical Specification

Fun, humorous attitude surveys that score users on whimsical themes.

## Purpose

Present users with agree/disagree questions organized by categories. Questions are selected randomly from each category, shuffled, and presented one at a time. The final score is a simple percentage of positive answers.

## UI Layout

### Theme Selection (no query parameter)

```
+-----------------------------------------------+
|  Attitude Surveys                             |
+-----------------------------------------------+
|                                               |
|  Choose a survey:                             |
|                                               |
|  - Halloween Fun                              |
|  - Coffee Snob                                |
|  - Cat Person                                 |
|                                               |
+-----------------------------------------------+
```

### Intro View

```
+-----------------------------------------------+
|  [Theme Name]                                 |
+-----------------------------------------------+
|                                               |
|  [Introductory paragraph describing           |
|   the theme and what it measures]             |
|                                               |
|  ○ Short (X questions)                        |
|  ○ Long (X questions)                         |
|                                               |
|  [Begin]                                      |
|                                               |
+-----------------------------------------------+
```

### Question View

```
+-----------------------------------------------+
|  [Theme Name]                                 |
+-----------------------------------------------+
|                                               |
|  Question 5 of 12                             |
|                                               |
|  "I find spiders fascinating."                |
|                                               |
|  [Agree]    [Disagree]                        |
|                                               |
|  [< Back]                                     |
|                                               |
+-----------------------------------------------+
```

### Results View

```
+-----------------------------------------------+
|  [Theme Name]                                 |
+-----------------------------------------------+
|                                               |
|  Your Score: 75%                              |
|                                               |
|  [Take Another Survey]                        |
|                                               |
+-----------------------------------------------+
```

## Functional Requirements

### Theme Selection

- The application MUST accept a theme via query parameter
- The application MUST skip the theme selection page and proceed directly to the survey when a valid query parameter is present
- The application MUST display a clickable list of available themes when no query parameter is provided or the parameter is invalid
- Each theme link MUST include the appropriate query parameter

### Survey Structure

- Each theme MUST be defined in a separate JavaScript file
- A theme MUST include an introductory paragraph describing the survey
- A theme MUST contain a list of categories
- A theme MUST specify the number of questions to select per category
- The questions-per-category count MUST be the same for all categories within a theme
- Each category MUST have a polarity (positive or negative) relative to the theme
- Each category MUST contain a list of questions
- A category MAY contain more questions than the per-category selection count, allowing different questions to appear on each page load
- Each question MUST have a polarity (positive or negative) relative to its category

### Question Selection

- The application MUST select a subset of questions from each category (e.g., 3 out of 10)
- The application MUST shuffle all selected questions together after selection
- Question selection and shuffling MUST occur when the theme is selected
- A page reload MUST re-randomize the question selection and order

### Intro Presentation

- The application MUST display an intro page before the first question
- The intro page MUST display the theme's introductory paragraph
- The intro page MUST display survey length options (Short/Long)
- Short length MUST use the theme's default questionsPerCategory value
- Long length MUST add 2 additional questions per category
- The intro page MUST display the total number of questions for each length option
- Short length MUST be selected by default
- The intro page MUST include a button to begin the survey

### Question Presentation

- The application MUST display one question at a time
- The application MUST display a progress indicator showing current question number and total
- Each question MUST offer exactly two choices: Agree and Disagree

### Navigation

- The application MUST allow users to navigate back to previous questions
- The application MUST allow users to navigate forward to the current unanswered question
- Users MUST be able to change their answers when navigating back

### Scoring

- Answering positively to a positive question in a positive category MUST count as 1 point
- Answering positively to a negative question in a negative category MUST count as 1 point
- All other answer combinations MUST count as 0 points
- The final score MUST be calculated as (total points / total questions) * 100
- All questions MUST be weighted equally
- All categories MUST be weighted equally

### Results

- The application MUST display the final percentage after all questions are answered
- The application MUST provide a way to return to the theme selection

## Non-Functional Requirements

### Styling

- The visual design MUST be light and breezy
- Survey-specific themes MAY be added in the future

### State Management

- Survey state MUST be kept in JavaScript variables only
- Survey state MUST NOT persist across page reloads

### Browser Compatibility

- The application SHOULD work in modern browsers

## Dependencies

- None (vanilla JavaScript)

## Implementation Notes

### Polarity Calculation

A question contributes positively to the score when the user's agreement aligns with what the theme considers "positive." This requires evaluating both the question's polarity within its category and the category's polarity within the theme.

### Theme File Structure

Each theme file should export the theme name, introductory paragraph, categories with their polarities, and questions with their polarities. The exact structure is left to implementation.

## Future Considerations

- Text descriptions for score ranges (TBD)
- Per-survey visual themes (TBD)
