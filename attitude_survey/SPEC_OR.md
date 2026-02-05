# "Or" Survey Mode - Technical Specification

An alternative survey mode where users choose between two options rather than agreeing/disagreeing with statements.

## Purpose

Extend the attitude survey system to support "or" / "which" style surveys. Instead of measuring agreement with statements, these surveys present questions that lean toward one of two opposing options (A or B). The final result shows which option the user leans toward and by what margin.

## UI Layout

### Results View (Or Mode) - Winner

```
+-----------------------------------------------+
|  [Theme Name]                                 |
+-----------------------------------------------+
|                                               |
|  You lean toward: [Option A]                  |
|  65%                                          |
|                                               |
|  +-------------------------------------------+|
|  | Category Name                  [Option A] ||
|  | Category Name                  [Option B] ||
|  +-------------------------------------------+|
|                                               |
|  [Take Another Survey]                        |
|                                               |
+-----------------------------------------------+
```

### Results View (Or Mode) - Tie

```
+-----------------------------------------------+
|  [Theme Name]                                 |
+-----------------------------------------------+
|                                               |
|  **You cannot decide**                        |
|  50%                                          |
|                                               |
|  +-------------------------------------------+|
|  | Category Name                  [Option A] ||
|  | Category Name                  [Option B] ||
|  +-------------------------------------------+|
|                                               |
|  [Take Another Survey]                        |
|                                               |
+-----------------------------------------------+
```

## Functional Requirements

### Theme Configuration

- An "or" theme MUST define two options (A and B) with display names
- The theme MUST specify which option is considered "positive" for scoring purposes
- Positive questions MUST lean toward Option A
- Negative questions MUST lean toward Option B
- All other theme requirements from the base SPEC.md MUST apply

### Question Presentation

- Questions MUST be presented identically to standard surveys
- The Agree/Disagree buttons MUST function the same as standard surveys
- The user experience during the survey MUST be indistinguishable from standard mode

### Scoring

- The application MUST calculate the percentage of answers that lean toward each option
- The winning option MUST be the one with more than 50% of answers leaning toward it
- If exactly 50% of answers lean toward each option, there is no winner (tie case)
- Percentages MUST be displayed as integers with no decimal places

### Results Display

- If one option has more than 50%, the results MUST show "You lean toward: [Option Name]"
- If exactly 50% each, the results MUST show "You cannot decide" in bold
- The results MUST show the winning percentage as an integer
- The results MUST NOT display the standard percentage score

### Category Results

- Each category MUST display which option won for that category
- Categories MUST show Option A or Option B instead of HIGH/LOW
- The category winner MUST be determined by majority of answers within that category

## Non-Functional Requirements

### Backward Compatibility

- Standard agree/disagree surveys MUST continue to work unchanged
- The application MUST automatically detect which mode to use based on theme configuration

### Theme Identification

- "Or" mode themes SHOULD be distinguishable from standard themes by the presence of option definitions

## Implementation Notes

### Mode Detection

The application should detect "or" mode by checking whether the theme defines options A and B. If present, use "or" mode scoring and results display; otherwise, use standard mode.

### Polarity Mapping

In "or" mode, question polarity maps to options:
- Positive question + Agree = leans toward Option A
- Positive question + Disagree = leans toward Option B
- Negative question + Agree = leans toward Option B
- Negative question + Disagree = leans toward Option A

### Margin Calculation

The margin represents how strongly the user leans toward the winning option. A 65% result means 65% of the user's answers favored the winning option, while 35% favored the other. Percentages are rounded to integers for display.

### Tie Detection

A tie occurs only when the raw count of answers is exactly equal for both options. Winner determination uses raw counts, not rounded percentages. This means a 51/49 split on 100 questions displays as "51%" with a winner, but a 51/50 split on 101 questions may display as "50%" while still correctly declaring a winner based on the raw count difference.
