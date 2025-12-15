# Emotions Challenge Specification

## Purpose

The Emotions Challenge is a visual pattern recognition challenge that tests users' ability to identify specific emotional expressions within a grid of mixed emotional sprites. Users must identify and select sprites displaying a target emotion from a 4x4 grid containing various emotional expressions.

## Requirement Levels

This specification uses the following requirement levels:
- **MUST**: Mandatory requirement. The implementation must include this feature.
- **SHOULD**: Recommended requirement. The implementation should include this feature unless there is a compelling reason not to.
- **MAY**: Optional requirement. The implementation may include this feature.

## Core Requirements

### 1. Sprite Sheet Loading

#### 1.1 Sprite Sheet Format

- The system MUST support loading sprite sheets from PNG image files
- Sprite sheets MUST be organized as a 4x4 grid (16 sprites total per sheet)
- Each sprite in the grid MUST be of equal size
- The system MUST extract individual sprites from the grid programmatically

#### 1.2 Sprite Sheet Sources

- The system MUST load sprites from `emotion_male_sprites.png`
- The system MUST load sprites from `emotion_female_sprites.png`
- Both sprite sheets MUST use the same 4x4 grid format
- The system SHOULD handle sprite sheet loading asynchronously
- The system MAY cache loaded sprite sheets to improve performance

#### 1.3 Sprite Extraction

- The system MUST extract each sprite as an individual image element or canvas
- The system MUST preserve the original sprite dimensions and image quality
- The system MUST correctly calculate sprite positions within the 4x4 grid
- Sprite extraction MUST occur entirely client-side using browser APIs (Canvas API)

#### 1.4 Emotion Mapping

- The system MUST map each sprite position to a specific emotion name
- The emotion mapping MUST correspond to the following 16 emotions in order:
  1. Ennui
  2. Lassitude
  3. Torpor
  4. Languor
  5. Bemused
  6. Nonplussed
  7. Discombobulated
  8. Incredulous
  9. Wistful
  10. Melancholy
  11. Maudlin
  12. Inconsolable
  13. Indefatigable
  14. Stoic
  15. Obstinate
  16. Obdurate
- The mapping MUST be consistent across both male and female sprite sheets
- Each sprite position (0-15) MUST correspond to the same emotion in both sheets

### 2. Challenge Generation

#### 2.1 Target Emotion Selection

- The system MUST randomly select one emotion from the 16 available emotions
- The selected emotion MUST be the target that users must identify
- Emotion selection MUST use randomization to prevent predictable patterns
- The system MUST track which emotion is the correct answer for the challenge

#### 2.2 Grid Population

- The system MUST create a 4x4 grid (16 squares total)
- The system MUST fill exactly 1 square with the correct emotion sprite
- The system MUST fill the remaining 15 squares with random emotion sprites
- Random emotion selection MUST exclude the target emotion
- Random emotion selection MUST allow the same emotion to appear multiple times in the grid
- The system MUST randomly determine which square contains the correct emotion
- The system MUST shuffle the grid positions to prevent predictable placement

#### 2.3 Sprite Gender Selection

- For each square in the grid, the system MUST randomly select either the male or female version of the emotion sprite
- Gender selection MUST be independent for each square
- The correct answer square MAY use either male or female sprite version
- Gender selection MUST use randomization to prevent predictable patterns

#### 2.4 Challenge Configuration

- Each challenge MUST present exactly 16 sprites in a 4x4 grid
- The challenge MUST maintain tracking of which square contains the target emotion
- The challenge MUST maintain tracking of all sprite positions and their corresponding emotions
- The system SHOULD assign unique identifiers to each square in the grid
- The system MAY vary the number of correct answer squares in future implementations

### 3. Display Requirements

#### 3.1 Visual Layout

- The system MUST display all 16 sprites in a 4x4 grid layout
- The system SHOULD use a responsive grid that adapts to screen size
- The system SHOULD display sprites at a consistent size (recommended: 100x100 pixels)
- Sprites MUST be clearly visible and distinguishable from each other
- The grid layout SHOULD use appropriate spacing between sprites
- The grid MUST maintain a 4x4 structure regardless of screen size

#### 3.2 Instructions

- The system MUST display the instruction: "Select all the squares that display <emotion>"
- The instruction MUST include the name of the target emotion
- Instructions MUST be clear and unambiguous
- Instructions SHOULD be displayed prominently near the sprite grid
- The emotion name in the instruction MUST match the selected target emotion exactly

#### 3.3 Visual Feedback

- The system MUST provide visual feedback when a square is selected
- Selected squares SHOULD be visually distinguished (e.g., border highlighting, background color change)
- The system SHOULD provide hover feedback to indicate clickable squares
- Visual feedback MUST use smooth transitions or animations
- The system MAY provide additional visual cues for selected squares

### 4. User Interaction

#### 4.1 Selection Mechanism

- Users MUST be able to click on squares to select them
- Users MUST be able to click on selected squares to deselect them
- The system MUST support multiple square selection (users can select multiple squares)
- The system MUST track which squares are currently selected
- Click interactions SHOULD be intuitive and responsive

#### 4.2 Selection Validation

- The system MUST allow users to select any combination of squares
- The system SHOULD validate the final selection when the challenge is submitted
- The system MUST not prevent users from selecting incorrect squares (selection should be permissive, validation occurs on submit)

### 5. Answer Format and Validation

#### 5.1 Answer Representation

- The correct answer MUST be represented as a comma-separated list of square indices
- Indices MUST be zero-based and refer to the position in the grid (0-15)
- The answer MUST contain exactly 1 index (the position of the square with the target emotion)
- The index in the answer MUST be a single numeric value
- The system MUST normalize user selections to match this format for comparison

#### 5.2 Validation Logic

- The system MUST validate that the user selected exactly 1 square
- The system MUST validate that the selected square contains the target emotion
- Validation MUST be order-independent (user can select in any order)
- The system MUST treat the answer as incorrect if:
  - Too many squares are selected
  - No squares are selected
  - The selected square does not contain the target emotion

#### 5.3 Answer Normalization

- The system MUST normalize user selections by sorting indices before comparison
- The system MUST handle empty selections gracefully
- The system SHOULD trim whitespace from index values
- The system MUST handle comma-separated index strings correctly

### 6. Challenge Integration

#### 6.1 Challenge Type Registration

- The emotions challenge MUST be registered as a valid challenge type in the main CAPTCHA system
- The challenge type identifier MUST be `'emotions'`
- The challenge MUST be selectable during random challenge generation

#### 6.2 Time Limits

- The challenge SHOULD have a time limit (recommended: 60 seconds)
- The time limit MUST be displayed to the user
- The system MUST handle timeout scenarios appropriately

#### 6.3 Challenge Lifecycle

- The challenge MUST integrate with the main challenge generation system
- The challenge MUST support the standard challenge lifecycle (generate, render, validate, reveal)
- The challenge MUST work with the anti-automation measures in the main system

### 7. Answer Revelation

#### 7.1 Correct Answer Display

- When time expires or the user gives up, the system MUST reveal the correct answer
- The correct square (containing the target emotion) MUST be visually highlighted
- The highlighting SHOULD use a distinct visual style (e.g., green border, success color)
- The system MUST clearly indicate which square was the correct answer

#### 7.2 Visual Distinction

- Revealed correct answers SHOULD use a color scheme distinct from selection highlighting
- The system SHOULD make it obvious which square should have been selected
- Visual revelation MUST be consistent with other challenge types' revelation mechanisms

### 8. Technical Implementation

#### 8.1 Sprite Loader Implementation

- The system MUST implement a `SpriteLoader` class or equivalent functionality
- The loader MUST use the Canvas API for sprite extraction
- The loader MUST handle image loading asynchronously (Promises or async/await)
- The loader SHOULD cache loaded sprite sheets to avoid redundant loading
- Error handling MUST be implemented for failed image loads
- The loader MUST support loading both male and female sprite sheets

#### 8.2 Challenge Class Implementation

- The system MUST implement an `EmotionsChallenge` class or equivalent
- The class MUST provide a static `generate()` method that returns a challenge object
- The class MUST provide a static `render()` method for displaying the challenge
- The class MUST provide a static `getAnswer()` method for retrieving user selections
- The class MUST provide a static `revealAnswer()` method for displaying correct answers

#### 8.3 Challenge Object Structure

The challenge object MUST contain the following fields:
- `id`: Unique identifier for the challenge
- `type`: Must be `'emotions'`
- `targetEmotion`: String name of the target emotion
- `grid`: Array of 16 square data objects, each containing:
  - `emotion`: String name of the emotion displayed
  - `gender`: String indicating 'male' or 'female' sprite version
  - `spriteIndex`: Numeric index of the sprite in the sprite sheet (0-15)
  - `isCorrect`: Boolean indicating if this square contains the target emotion
- `correctIndex`: Numeric index of the square containing the target emotion (0-15)
- `answer`: String representation of the correct square index
- `instructions`: Text instruction for the user ("Select all the squares that display <emotion>")
- `timeLimit`: Numeric value representing the time limit in seconds

#### 8.4 Emotion Name Mapping

- The system MUST maintain a static mapping between sprite indices (0-15) and emotion names
- The mapping MUST be defined as a constant array or object
- The mapping MUST match the order specified in section 1.4
- The mapping MUST be accessible during challenge generation and validation

#### 8.5 Browser Compatibility

- The implementation MUST use standard browser APIs (Canvas API, Image API)
- The implementation SHOULD work in all modern browsers
- The implementation MUST not require any external libraries or dependencies
- All functionality MUST be client-side only

### 9. Error Handling

- The system MUST handle cases where sprite sheet images fail to load
- The system SHOULD provide user feedback if sprite loading fails
- The system MUST gracefully degrade if sprite extraction fails
- The system MUST handle cases where emotion mapping is incomplete or invalid
- Error handling MUST not expose sensitive implementation details to users

### 10. Performance Considerations

- Sprite loading SHOULD occur asynchronously to avoid blocking the UI
- The system SHOULD preload or cache sprite sheets when possible
- Sprite extraction SHOULD be efficient and not cause noticeable performance issues
- The system MAY optimize sprite rendering for better performance
- Grid generation SHOULD be fast and synchronous (no async operations required after sprites are loaded)

## Security Considerations

- Challenge generation MUST use randomization to prevent predictable patterns
- The mapping between grid positions and correct answers MUST not be easily extractable from client-side code
- Emotion selection and grid shuffling MUST use cryptographically secure random number generation when available
- The challenge SHOULD integrate with the main CAPTCHA system's anti-automation measures
- Sprite gender selection MUST be randomized to prevent pattern recognition

## Future Enhancements

The following features are explicitly excluded from the current implementation but MAY be considered for future versions:

- Variable numbers of correct answer squares (currently fixed at 1)
- Multiple target emotions in a single challenge
- Additional sprite sheet categories beyond male and female
- Animated sprites or sprite variations
- Difficulty scaling based on emotion similarity
- Sprite rotation or transformation variations
- Sound effects or audio cues for selections
- Hint system for difficult challenges
- Sprite zoom or detailed view on hover
- Emotion name display on hover
- Variable grid sizes (currently fixed at 4x4)
- Time-based emotion changes (dynamic challenges)

