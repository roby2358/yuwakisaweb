# Kerning Challenge Specification

## Purpose

The Kerning Challenge is a typography-based visual discrimination challenge that tests users' ability to identify correct letter spacing (kerning) within a word. Users must identify the single letter that has proper spacing on both sides while all other letters have intentionally incorrect spacing.

## Requirement Levels

This specification uses the following requirement levels:
- **MUST**: Mandatory requirement. The implementation must include this feature.
- **SHOULD**: Recommended requirement. The implementation should include this feature unless there is a compelling reason not to.
- **MAY**: Optional requirement. The implementation may include this feature.

## Core Requirements

### 1. Word Selection

#### 1.1 Word List

- The system MUST maintain a predefined list of words for use in challenges
- The word list MUST contain at least 16 words
- All words in the list MUST be uppercase
- Words SHOULD be between 5 and 8 characters in length
- Words SHOULD be common, recognizable terms
- The system MAY expand the word list in future implementations

#### 1.2 Word Selection Process

- The system MUST randomly select one word from the word list for each challenge
- Word selection MUST use randomization to prevent predictable patterns
- Each word selection MUST be independent (no guarantee of uniqueness across challenges)
- The system SHOULD ensure fair distribution of words over multiple challenges

### 2. Letter Processing

#### 2.1 Word Decomposition

- The system MUST split the selected word into individual letters
- Each letter MUST be treated as a separate, selectable element
- Letter order MUST be preserved from the original word
- The system MUST maintain the original word structure for display

#### 2.2 Correct Letter Selection

- The system MUST randomly select exactly one letter to have correct kerning
- The correct letter selection MUST be random across all letter positions
- The system MUST track which letter index is the correct answer
- Correct letter selection MUST occur independently for each challenge

### 3. Kerning Application

#### 3.1 Correct Kerning Definition

- The correct letter MUST have zero offset on both left and right sides
- Correct kerning is defined as `{ left: 0, right: 0 }`
- The correct letter MUST appear with natural, unmodified spacing
- No margin adjustments MUST be applied to the correct letter

#### 3.2 Incorrect Kerning Generation

- All letters except the correct one MUST have incorrect kerning applied
- Incorrect kerning MUST involve offset values on either the left side, right side, or both
- Offset values MUST be integers in the range [-2, -1, 1, 2] pixels
- The system MUST NOT use 0 as an offset value for incorrect letters
- Each incorrect letter MUST have at least one non-zero offset (left or right)
- Offset values MUST be randomly selected for each incorrect letter
- The system SHOULD vary offset directions (positive and negative) to create visual variety

#### 3.3 Kerning Offset Rules

- Left offset MUST be applied as `marginLeft` CSS property
- Right offset MUST be applied as `marginRight` CSS property
- Offset values MUST be specified in pixels
- The system MUST ensure offsets are subtle enough to require careful observation but noticeable enough to be detectable
- Offset values SHOULD be consistent in magnitude (1-2 pixels) to maintain challenge difficulty

### 4. Display Requirements

#### 4.1 Word Display

- The word MUST be displayed as a horizontal sequence of letters
- Letters MUST be displayed in their original order
- The word display MUST be centered horizontally
- The system SHOULD use a monospace font family for consistent letter width
- The font size SHOULD be large enough for clear visibility (recommended: 3rem)
- The font weight SHOULD be bold for better visibility
- The base letter-spacing MUST be set to 0 to allow precise kerning control

#### 4.2 Letter Styling

- Each letter MUST be rendered as an individual, clickable element
- Letters MUST have appropriate padding for click target size
- Letters SHOULD have rounded corners for visual polish
- The system MUST apply kerning offsets via CSS margin properties
- Visual transitions SHOULD be applied for smooth interaction feedback

#### 4.3 Visual Feedback

- The system MUST provide visual feedback when a letter is selected
- Selected letters MUST be visually distinguished (e.g., background color, border)
- The system SHOULD provide hover feedback to indicate clickable letters
- Visual feedback MUST use smooth transitions or animations
- Hover states SHOULD be distinct from selection states
- The system MAY provide additional visual cues for selected letters

### 5. User Interaction

#### 5.1 Selection Mechanism

- Users MUST be able to click on any letter to select it
- Clicking a selected letter MUST deselect it
- Only one letter MAY be selected at a time
- The system MUST track which letter is currently selected
- Click interactions SHOULD be intuitive and responsive

#### 5.2 Selection State Management

- When a new letter is selected, the previously selected letter MUST be deselected
- The system MUST maintain only one selected letter at any time
- Selection state MUST be visually clear to the user
- The system SHOULD prevent confusion about which letter is selected

### 6. Answer Format and Validation

#### 6.1 Answer Representation

- The correct answer MUST be represented as a string containing the letter index
- The index MUST be zero-based (first letter is 0, second is 1, etc.)
- The answer MUST be a single numeric string (e.g., "3" for the fourth letter)
- The system MUST convert the answer to a string format for consistency

#### 6.2 Validation Logic

- The system MUST validate that exactly one letter is selected
- The system MUST validate that the selected letter index matches the correct index
- The system MUST treat the answer as incorrect if:
  - No letter is selected
  - The selected letter index does not match the correct index
- Validation MUST be exact match (no partial credit)

#### 6.3 Answer Retrieval

- The system MUST retrieve the selected letter's index from the DOM
- Answer retrieval MUST handle cases where no letter is selected (return empty string)
- The system MUST use the letter's dataset index attribute for answer retrieval
- Answer retrieval SHOULD be robust against DOM structure changes

### 7. Challenge Integration

#### 7.1 Challenge Type Registration

- The kerning challenge MUST be registered as a valid challenge type in the main CAPTCHA system
- The challenge type identifier MUST be `'kerning'`
- The challenge MUST be selectable during random challenge generation

#### 7.2 Time Limits

- The challenge MUST have a time limit (60 seconds)
- The time limit MUST be displayed to the user
- The system MUST handle timeout scenarios appropriately

#### 7.3 Challenge Lifecycle

- The challenge MUST integrate with the main challenge generation system
- The challenge MUST support the standard challenge lifecycle (generate, render, validate, reveal)
- The challenge MUST work with the anti-automation measures in the main system

### 8. Challenge Object Structure

The challenge object MUST contain the following fields:
- `id`: Unique identifier for the challenge (format: `'kerning-{timestamp}'`)
- `type`: Must be `'kerning'`
- `word`: The selected word string
- `letters`: Array of individual letter characters
- `kerning`: Array of kerning objects, each with `left` and `right` offset values
- `correctIndex`: Numeric index of the letter with correct kerning
- `answer`: String representation of the correct index
- `instructions`: Text instruction for the user ("Click on the letter that has correct spacing on both sides.")
- `timeLimit`: Numeric value representing the time limit in seconds (60)

### 9. Answer Revelation

#### 9.1 Correct Answer Display

- When time expires or the user gives up, the system MUST reveal the correct answer
- The correct letter MUST be visually highlighted
- The highlighting SHOULD use a distinct visual style (e.g., green border, success color)
- The system MUST clearly indicate which letter was the correct answer

#### 9.2 Visual Distinction

- Revealed correct answers SHOULD use a color scheme distinct from selection highlighting
- The system SHOULD make it obvious which letter should have been selected
- Visual revelation MUST be consistent with other challenge types' revelation mechanisms
- The correct letter's highlighting MUST override any existing selection highlighting

### 10. Technical Implementation

#### 10.1 Challenge Class Implementation

- The system MUST implement a `KerningChallenge` class or equivalent
- The class MUST provide a static `generate()` method that returns a challenge object
- The class MUST provide a static `render()` method for displaying the challenge
- The class MUST provide a static `getAnswer()` method for retrieving user selections
- The class MUST provide a static `revealAnswer()` method for displaying correct answers

#### 10.2 Static Word List

- The word list MUST be defined as a static class property
- The word list SHOULD be easily maintainable and extensible
- Word list access MUST not require instantiation of the class

#### 10.3 DOM Manipulation

- The system MUST create DOM elements dynamically for each challenge
- Letter elements MUST be created as `<span>` elements
- The system MUST apply kerning via inline CSS styles (marginLeft, marginRight)
- Event listeners MUST be attached to each letter element
- The system MUST use data attributes to store letter indices

#### 10.4 CSS Styling

- Kerning offsets MUST be applied via inline styles
- Base styling SHOULD use CSS classes for maintainability
- Interactive states (hover, selected) MUST be managed via inline styles or class toggles
- The system SHOULD use CSS transitions for smooth visual feedback
- Font styling MUST be applied to ensure consistent letter rendering

### 11. Randomization Requirements

#### 11.1 Word Selection Randomization

- Word selection MUST use a random number generator
- The random selection MUST be uniform across all words in the list
- The system SHOULD use `Math.random()` or equivalent for randomization

#### 11.2 Correct Letter Randomization

- Correct letter selection MUST be random across all positions in the word
- The random selection MUST be uniform across all letter positions
- The system MUST not bias selection toward any particular position

#### 11.3 Kerning Offset Randomization

- Offset values for incorrect letters MUST be randomly selected
- Offset direction (positive/negative) MUST be randomly determined
- The system SHOULD ensure variety in offset combinations
- Randomization MUST occur independently for each letter's left and right offsets

### 12. Error Handling

- The system MUST handle cases where the word list is empty
- The system MUST handle cases where word selection fails
- The system SHOULD gracefully handle DOM manipulation failures
- Error handling MUST not expose sensitive implementation details to users
- The system MUST validate that challenge objects contain all required fields

### 13. Performance Considerations

- Challenge generation MUST be fast and synchronous (no async operations required)
- DOM rendering SHOULD be efficient and not cause noticeable performance issues
- Event listener attachment SHOULD be optimized to avoid memory leaks
- The system SHOULD minimize DOM queries during answer retrieval

### 14. Accessibility Considerations

- Letters SHOULD have sufficient click target size for accessibility
- Visual feedback SHOULD be clear enough for users with visual impairments
- The system MAY provide keyboard navigation support in future implementations
- The system MAY provide screen reader support in future implementations

## Security Considerations

- Challenge generation MUST use randomization to prevent predictable patterns
- The mapping between word selection and correct answer MUST not be easily extractable from client-side code
- Kerning offset generation MUST use randomization to prevent pattern recognition
- The challenge SHOULD integrate with the main CAPTCHA system's anti-automation measures
- Word selection and correct letter selection MUST use cryptographically secure random number generation when available

## Visual Design Requirements

#### 14.1 Typography

- The system MUST use a monospace font to ensure consistent letter widths
- Font size MUST be large enough for clear visibility (minimum 2.5rem, recommended 3rem)
- Font weight SHOULD be bold for better letter distinction
- Letter spacing MUST be set to 0 to allow precise kerning control

#### 14.2 Interactive States

- Default state: Letters should be clearly visible with subtle background
- Hover state: Letters should provide visual feedback on mouse hover
- Selected state: Letters should be clearly distinguished with border and background color
- Correct answer state: Letters should use success color scheme (green)

#### 14.3 Spacing and Layout

- Letters MUST have appropriate padding for click targets (recommended: 0.5rem)
- The word display MUST be centered horizontally
- Vertical margins SHOULD provide adequate spacing (recommended: 2rem)
- Letter elements SHOULD have rounded corners for visual polish

## Future Enhancements

The following features are explicitly excluded from the current implementation but MAY be considered for future versions:

- Variable word lengths or custom word lists
- Multiple correct letters (more than one letter with correct kerning)
- Adjustable kerning offset ranges (currently fixed at -2 to +2 pixels)
- Difficulty scaling based on word length or offset magnitude
- Animated kerning adjustments or transitions
- Sound effects or audio cues for selections
- Hint system for difficult challenges
- Keyboard navigation support
- Screen reader support for accessibility
- Different font families or typography styles
- Letter color variations or visual effects
- Time-based kerning changes (dynamic challenges)
- Multi-word challenges

