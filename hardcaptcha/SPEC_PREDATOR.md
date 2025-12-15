# Predator Challenge Specification

## Purpose

The Predator Challenge is a visual pattern recognition challenge that tests users' ability to distinguish between different sprite types within a mixed set. Users must identify and select sprites from one category (safe sprites) while ignoring sprites from another category (predator sprites).

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

- The system MUST load sprites from `predator_sprites.png`
- The system MUST load sprites from `safe_sprites.png`
- Both sprite sheets MUST use the same 4x4 grid format
- The system SHOULD handle sprite sheet loading asynchronously
- The system MAY cache loaded sprite sheets to improve performance

#### 1.3 Sprite Extraction

- The system MUST extract each sprite as an individual image element or canvas
- The system MUST preserve the original sprite dimensions and image quality
- The system MUST correctly calculate sprite positions within the 4x4 grid
- Sprite extraction MUST occur entirely client-side using browser APIs (Canvas API)

### 2. Challenge Generation

#### 2.1 Sprite Selection

- The system MUST randomly select 7 sprites from `predator_sprites.png`
- The system MUST randomly select 3 sprites from `safe_sprites.png`
- The system MUST combine all 10 selected sprites into a single challenge set
- The system MUST shuffle the combined sprites before presentation
- Sprite selection MUST use randomization to prevent predictable patterns

#### 2.2 Challenge Configuration

- Each challenge MUST present exactly 10 sprites to the user
- The challenge MUST maintain tracking of which sprites are "safe" (the 3 from `safe_sprites.png`)
- The challenge MUST maintain tracking of which sprites are "predators" (the 7 from `predator_sprites.png`)
- The system SHOULD assign unique identifiers to each sprite in the challenge set
- The system MAY vary the number of predator and safe sprites in future implementations

### 3. Display Requirements

#### 3.1 Visual Layout

- The system MUST display all 10 sprites in a grid layout
- The system SHOULD use a responsive grid that adapts to screen size
- The system SHOULD display sprites at a consistent size (recommended: 100x100 pixels)
- Sprites MUST be clearly visible and distinguishable from each other
- The grid layout SHOULD use appropriate spacing between sprites

#### 3.2 Instructions

- The system MUST display the instruction: "Click on the predators that are safe to approach."
- Instructions MUST be clear and unambiguous
- Instructions SHOULD be displayed prominently near the sprite grid

#### 3.3 Visual Feedback

- The system MUST provide visual feedback when a sprite is selected
- Selected sprites SHOULD be visually distinguished (e.g., border highlighting, background color change)
- The system SHOULD provide hover feedback to indicate clickable sprites
- Visual feedback MUST use smooth transitions or animations
- The system MAY provide additional visual cues for selected sprites

### 4. User Interaction

#### 4.1 Selection Mechanism

- Users MUST be able to click on sprites to select them
- Users MUST be able to click on selected sprites to deselect them
- The system MUST support multiple sprite selection (users can select multiple sprites)
- The system MUST track which sprites are currently selected
- Click interactions SHOULD be intuitive and responsive

#### 4.2 Selection Validation

- The system MUST allow users to select any combination of sprites
- The system SHOULD validate the final selection when the challenge is submitted
- The system MUST not prevent users from selecting incorrect sprites (selection should be permissive, validation occurs on submit)

### 5. Answer Format and Validation

#### 5.1 Answer Representation

- The correct answer MUST be represented as a comma-separated list of sprite indices
- Indices MUST be zero-based and refer to the position in the shuffled challenge array
- The answer MUST contain exactly 3 indices (the positions of the safe sprites)
- Indices in the answer MUST be sorted in ascending order
- The system MUST normalize user selections to match this format for comparison

#### 5.2 Validation Logic

- The system MUST validate that the user selected exactly 3 sprites
- The system MUST validate that all selected sprites are the safe sprites (from `safe_sprites.png`)
- Validation MUST be order-independent (user can select in any order)
- The system MUST treat the answer as incorrect if:
  - Too many sprites are selected
  - Too few sprites are selected
  - Any selected sprite is not a safe sprite
  - Any safe sprite is not selected

#### 5.3 Answer Normalization

- The system MUST normalize user selections by sorting indices before comparison
- The system MUST handle empty selections gracefully
- The system SHOULD trim whitespace from index values
- The system MUST handle comma-separated index strings correctly

### 6. Challenge Integration

#### 6.1 Challenge Type Registration

- The predator challenge MUST be registered as a valid challenge type in the main CAPTCHA system
- The challenge type identifier MUST be `'predator'`
- The challenge MUST be selectable during random challenge generation

#### 6.2 Time Limits

- The challenge SHOULD have a time limit (recommended: 75 seconds)
- The time limit MUST be displayed to the user
- The system MUST handle timeout scenarios appropriately

#### 6.3 Challenge Lifecycle

- The challenge MUST integrate with the main challenge generation system
- The challenge MUST support the standard challenge lifecycle (generate, render, validate, reveal)
- The challenge MUST work with the anti-automation measures in the main system

### 7. Answer Revelation

#### 7.1 Correct Answer Display

- When time expires or the user gives up, the system MUST reveal the correct answer
- Correct sprites (safe sprites) MUST be visually highlighted
- The highlighting SHOULD use a distinct visual style (e.g., green border, success color)
- The system MUST clearly indicate which sprites were the correct answers

#### 7.2 Visual Distinction

- Revealed correct answers SHOULD use a color scheme distinct from selection highlighting
- The system SHOULD make it obvious which sprites should have been selected
- Visual revelation MUST be consistent with other challenge types' revelation mechanisms

### 8. Technical Implementation

#### 8.1 Sprite Loader Implementation

- The system MUST implement a `SpriteLoader` class or equivalent functionality
- The loader MUST use the Canvas API for sprite extraction
- The loader MUST handle image loading asynchronously (Promises or async/await)
- The loader SHOULD cache loaded sprite sheets to avoid redundant loading
- Error handling MUST be implemented for failed image loads

#### 8.2 Challenge Class Implementation

- The system MUST implement a `PredatorChallenge` class or equivalent
- The class MUST provide a static `generate()` method that returns a challenge object
- The class MUST provide a static `render()` method for displaying the challenge
- The class MUST provide a static `getAnswer()` method for retrieving user selections
- The class MUST provide a static `revealAnswer()` method for displaying correct answers

#### 8.3 Challenge Object Structure

The challenge object MUST contain the following fields:
- `id`: Unique identifier for the challenge
- `type`: Must be `'predator'`
- `sprites`: Array of sprite data objects with selection state
- `correctIndices`: Array of indices representing the correct answers
- `answer`: Comma-separated string of correct indices (normalized format)
- `instructions`: Text instruction for the user
- `timeLimit`: Numeric value representing the time limit in seconds

#### 8.4 Browser Compatibility

- The implementation MUST use standard browser APIs (Canvas API, Image API)
- The implementation SHOULD work in all modern browsers
- The implementation MUST not require any external libraries or dependencies
- All functionality MUST be client-side only

### 9. Error Handling

- The system MUST handle cases where sprite sheet images fail to load
- The system SHOULD provide user feedback if sprite loading fails
- The system MUST gracefully degrade if sprite extraction fails
- Error handling MUST not expose sensitive implementation details to users

### 10. Performance Considerations

- Sprite loading SHOULD occur asynchronously to avoid blocking the UI
- The system SHOULD preload or cache sprite sheets when possible
- Sprite extraction SHOULD be efficient and not cause noticeable performance issues
- The system MAY optimize sprite rendering for better performance

## Security Considerations

- Challenge generation MUST use randomization to prevent predictable patterns
- The mapping between sprite indices and correct answers MUST not be easily extractable from client-side code
- Sprite selection and shuffling MUST use cryptographically secure random number generation when available
- The challenge SHOULD integrate with the main CAPTCHA system's anti-automation measures

## Future Enhancements

The following features are explicitly excluded from the current implementation but MAY be considered for future versions:

- Variable numbers of predator and safe sprites (currently fixed at 7 and 3)
- Additional sprite sheet categories beyond predators and safe sprites
- Animated sprites or sprite variations
- Difficulty scaling based on sprite similarity
- Sprite rotation or transformation variations
- Sound effects or audio cues for selections
- Hint system for difficult challenges
- Sprite zoom or detailed view on hover

