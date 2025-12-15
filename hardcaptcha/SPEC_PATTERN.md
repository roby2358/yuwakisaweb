# Pattern Challenge Specification

## Purpose

The Pattern Challenge is a visual pattern recognition challenge that tests users' ability to identify the single square that differs from all others in a 4x4 color grid. The challenge requires careful observation to detect subtle color pattern differences.

## Requirement Levels

This specification uses the following requirement levels:
- **MUST**: Mandatory requirement. The implementation must include this feature.
- **SHOULD**: Recommended requirement. The implementation should include this feature unless there is a compelling reason not to.
- **MAY**: Optional requirement. The implementation may include this feature.

## Core Requirements

### 1. Grid Structure

#### 1.1 Grid Configuration

- The system MUST create a 4x4 grid (16 squares total)
- The grid MUST be displayed as a square layout
- The grid SHOULD be responsive and adapt to screen size
- The grid MUST maintain consistent spacing between squares

#### 1.2 Square Generation

- The system MUST generate exactly 16 color squares
- Each square MUST be represented as an RGB color value
- Color values MUST be in the range 0x80 to 0xD0 (128 to 208 in decimal)
- The system MUST ensure all squares are visually distinguishable

### 2. Pattern Generation

#### 2.1 Consistent Component Selection

- The system MUST randomly select one RGB component (Red, Green, or Blue) to be consistent
- The consistent component MUST be the same across 15 squares
- The consistent component value MUST be randomly selected from the valid range (0x80 to 0xD0)
- Component selection MUST use randomization to prevent predictable patterns

#### 2.2 Odd Square Generation

- The system MUST randomly select one square to be the "odd one out"
- The odd square MUST have all three RGB components randomly generated
- The odd square MUST NOT share the consistent component pattern with the other 15 squares
- The odd square's position MUST be randomly determined

#### 2.3 Pattern Squares Generation

- The 15 non-odd squares MUST share one consistent RGB component
- The other two components for these squares MUST be randomly generated
- Each of the 15 pattern squares MUST have unique color combinations (though they share the consistent component)
- Random component generation MUST use the valid color range (0x80 to 0xD0)

### 3. Display Requirements

#### 3.1 Visual Layout

- The system MUST display all 16 squares in a 4x4 grid layout
- The system SHOULD use a responsive grid that adapts to screen size
- Squares MUST be clearly visible and distinguishable from each other
- The grid layout SHOULD use appropriate spacing between squares
- Squares SHOULD be displayed at a consistent size (recommended: minimum 35px per square)

#### 3.2 Color Display

- Colors MUST be displayed using CSS background-color property
- Color values MUST be converted from RGB components to hexadecimal format
- The system MUST ensure proper color contrast for visibility
- Color conversion MUST preserve the exact RGB values generated

#### 3.3 Instructions

- The system MUST display the instruction: "Click on the one square that is different from all the others in the grid."
- Instructions MUST be clear and unambiguous
- Instructions SHOULD be displayed prominently near the grid

#### 3.4 Visual Feedback

- The system MUST provide visual feedback when a square is selected
- Selected squares SHOULD be visually distinguished (e.g., border highlighting, background color change)
- The system SHOULD provide hover feedback to indicate clickable squares
- Visual feedback MUST use smooth transitions or animations
- The system MAY provide additional visual cues for selected squares

### 4. User Interaction

#### 4.1 Selection Mechanism

- Users MUST be able to click on squares to select them
- Users MUST be able to click on a selected square to deselect it
- Only one square MAY be selected at a time
- When a new square is selected, the previously selected square MUST be deselected
- The system MUST track which square is currently selected
- Click interactions SHOULD be intuitive and responsive

#### 4.2 Selection State Management

- The system MUST maintain only one selected square at any time
- Selection state MUST be visually clear to the user
- The system SHOULD prevent confusion about which square is selected

### 5. Answer Format and Validation

#### 5.1 Answer Representation

- The correct answer MUST be represented as a string containing the square index
- The index MUST be zero-based (first square is 0, second is 1, etc.)
- The answer MUST be a single numeric string (e.g., "7" for the eighth square)
- The system MUST convert the answer to a string format for consistency

#### 5.2 Validation Logic

- The system MUST validate that exactly one square is selected
- The system MUST validate that the selected square index matches the correct index
- The system MUST treat the answer as incorrect if:
  - No square is selected
  - The selected square index does not match the correct index
- Validation MUST be exact match (no partial credit)

#### 5.3 Answer Retrieval

- The system MUST retrieve the selected square's index from the DOM
- Answer retrieval MUST handle cases where no square is selected (return empty string)
- The system MUST use the square's dataset index attribute for answer retrieval
- Answer retrieval SHOULD be robust against DOM structure changes

### 6. Challenge Integration

#### 6.1 Challenge Type Registration

- The pattern challenge MUST be registered as a valid challenge type in the main CAPTCHA system
- The challenge type identifier MUST be `'pattern'`
- The challenge MUST be selectable during random challenge generation

#### 6.2 Time Limits

- The challenge MUST have a time limit (70 seconds)
- The time limit MUST be displayed to the user
- The system MUST handle timeout scenarios appropriately

#### 6.3 Challenge Lifecycle

- The challenge MUST integrate with the main challenge generation system
- The challenge MUST support the standard challenge lifecycle (generate, render, validate, reveal)
- The challenge MUST work with the anti-automation measures in the main system

### 7. Challenge Object Structure

The challenge object MUST contain the following fields:
- `id`: Unique identifier for the challenge (format: `'pattern-{timestamp}'`)
- `type`: Must be `'pattern'`
- `pattern`: Array of 16 color objects, each with `r`, `g`, and `b` properties (RGB values)
- `correctIndex`: Numeric index of the odd square (0-15)
- `answer`: String representation of the correct index
- `instructions`: Text instruction for the user ("Click on the one square that is different from all the others in the grid.")
- `gridSize`: Numeric value representing the grid size (4)
- `timeLimit`: Numeric value representing the time limit in seconds (70)

### 8. Answer Revelation

#### 8.1 Correct Answer Display

- When time expires or the user gives up, the system MUST reveal the correct answer
- The correct square MUST be visually highlighted
- The highlighting SHOULD use a distinct visual style (e.g., green border, success color)
- The system MUST clearly indicate which square was the correct answer

#### 8.2 Visual Distinction

- Revealed correct answers SHOULD use a color scheme distinct from selection highlighting
- The system SHOULD make it obvious which square should have been selected
- Visual revelation MUST be consistent with other challenge types' revelation mechanisms
- The correct square's highlighting MUST override any existing selection highlighting

### 9. Technical Implementation

#### 9.1 Challenge Class Implementation

- The system MUST implement a `PatternChallenge` class or equivalent
- The class MUST provide a static `generate()` method that returns a challenge object
- The class MUST provide a static `render()` method for displaying the challenge
- The class MUST provide a static `getAnswer()` method for retrieving user selections
- The class MUST provide a static `revealAnswer()` method for displaying correct answers

#### 9.2 Color Generation

- Color component values MUST be generated using randomization
- The random number generator MUST produce values in the range [0x80, 0xD0) (128 to 207 inclusive)
- Color generation MUST use integer values only
- The system MUST ensure sufficient color variation for challenge difficulty

#### 9.3 DOM Manipulation

- The system MUST create DOM elements dynamically for each challenge
- Square elements MUST be created as `<div>` elements
- The system MUST apply colors via inline CSS styles (backgroundColor)
- Event listeners MUST be attached to each square element
- The system MUST use data attributes to store square indices

#### 9.4 Color Conversion

- RGB component values MUST be converted to hexadecimal format for CSS
- Each component MUST be converted to a 2-digit hexadecimal string
- Hexadecimal values MUST be uppercase
- The system MUST pad single-digit hex values with leading zeros
- Color strings MUST be formatted as `#RRGGBB`

### 10. Randomization Requirements

#### 10.1 Component Selection Randomization

- Consistent component selection (R, G, or B) MUST be random
- The random selection MUST be uniform across all three components
- The system MUST not bias selection toward any particular component

#### 10.2 Consistent Value Randomization

- The consistent component value MUST be randomly selected
- The random selection MUST be uniform across the valid range (0x80 to 0xD0)
- The system MUST not bias selection toward any particular value

#### 10.3 Odd Square Position Randomization

- Odd square position MUST be randomly selected
- The random selection MUST be uniform across all 16 positions
- The system MUST not bias selection toward any particular position

#### 10.4 Color Component Randomization

- Random color components for pattern squares and the odd square MUST be randomly selected
- Random selection MUST be uniform across the valid range
- The system SHOULD ensure variety in color combinations

### 11. Error Handling

- The system MUST handle cases where color generation fails
- The system SHOULD gracefully handle DOM manipulation failures
- Error handling MUST not expose sensitive implementation details to users
- The system MUST validate that challenge objects contain all required fields

### 12. Performance Considerations

- Challenge generation MUST be fast and synchronous (no async operations required)
- DOM rendering SHOULD be efficient and not cause noticeable performance issues
- Event listener attachment SHOULD be optimized to avoid memory leaks
- The system SHOULD minimize DOM queries during answer retrieval

### 13. Accessibility Considerations

- Squares SHOULD have sufficient click target size for accessibility
- Visual feedback SHOULD be clear enough for users with visual impairments
- The system MAY provide keyboard navigation support in future implementations
- The system MAY provide screen reader support in future implementations
- Color contrast SHOULD meet accessibility guidelines where possible

## Security Considerations

- Challenge generation MUST use randomization to prevent predictable patterns
- The mapping between grid positions and correct answers MUST not be easily extractable from client-side code
- Color generation and pattern creation MUST use randomization to prevent pattern recognition
- The challenge SHOULD integrate with the main CAPTCHA system's anti-automation measures
- Component selection, consistent value selection, and odd square position MUST use cryptographically secure random number generation when available

## Visual Design Requirements

#### 13.1 Grid Layout

- The grid MUST use CSS Grid or Flexbox for layout
- Grid columns MUST be set to repeat the grid size (4 columns)
- Grid gaps SHOULD provide adequate spacing (recommended: 0.25rem minimum)
- The grid SHOULD be centered or appropriately positioned

#### 13.2 Square Styling

- Squares MUST have a 1:1 aspect ratio
- Squares SHOULD have rounded corners for visual polish (recommended: 4px border-radius)
- Squares MUST have borders for visual definition
- Squares SHOULD have hover effects to indicate interactivity

#### 13.3 Interactive States

- Default state: Squares should display their assigned colors with subtle borders
- Hover state: Squares should provide visual feedback on mouse hover (e.g., scale transform, border color change)
- Selected state: Squares should be clearly distinguished with border and background color changes
- Correct answer state: Squares should use success color scheme (green) when revealed

#### 13.4 Spacing and Layout

- The grid MUST have appropriate margins for visual breathing room
- Squares MUST maintain consistent sizing
- The grid display SHOULD be responsive and adapt to different screen sizes

## Future Enhancements

The following features are explicitly excluded from the current implementation but MAY be considered for future versions:

- Variable grid sizes (currently fixed at 4x4)
- Multiple odd squares (more than one square that differs)
- Different pattern types (e.g., patterns based on brightness, saturation, or other color properties)
- Adjustable color ranges (currently fixed at 0x80 to 0xD0)
- Difficulty scaling based on color similarity or grid size
- Animated color transitions or effects
- Sound effects or audio cues for selections
- Hint system for difficult challenges
- Keyboard navigation support
- Screen reader support for accessibility
- Different color spaces (HSL, HSV, etc.)
- Time-based pattern changes (dynamic challenges)
- Multi-pattern challenges (multiple patterns in one grid)

