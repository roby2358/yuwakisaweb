# Human Challenge Specification

## Purpose

The Human Challenge is a visual pattern recognition challenge that tests users' ability to identify a human sprite within a large grid of item sprites. Users must identify and select the single human sprite from a 10x10 grid containing 99 item sprites and 1 human sprite.

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
- The system MUST load sprites from `item_sprites.png`
- All sprite sheets MUST use the same 4x4 grid format
- The system SHOULD handle sprite sheet loading asynchronously
- The system MAY cache loaded sprite sheets to improve performance

#### 1.3 Sprite Extraction

- The system MUST extract each sprite as an individual image element or canvas
- The system MUST preserve the original sprite dimensions and image quality
- The system MUST correctly calculate sprite positions within the 4x4 grid
- Sprite extraction MUST occur entirely client-side using browser APIs (Canvas API)

### 2. Challenge Generation

#### 2.1 Grid Configuration

- The system MUST create a 10x10 grid (100 squares total)
- The system MUST place exactly 1 human sprite in the grid
- The system MUST fill the remaining 99 squares with item sprites
- The human sprite position MUST be randomly determined
- The system MUST shuffle the grid positions to prevent predictable placement

#### 2.2 Human Sprite Selection

- The system MUST randomly select one sprite from either `emotion_male_sprites.png` or `emotion_female_sprites.png`
- The selection of male or female sprite sheet MUST use a weighted random distribution: 55% probability for female sprites and 45% probability for male sprites
- The specific sprite within the selected sheet MUST be randomly chosen from all 16 available sprites
- The system MUST track which sprite is the human sprite for validation

#### 2.3 Item Sprite Selection

- The system MUST randomly select 99 sprites from `item_sprites.png`
- Item sprite selection MUST allow the same sprite to appear multiple times in the grid
- Item sprite selection MUST use randomization to prevent predictable patterns
- The system MUST ensure no human sprites are included in the item sprite selection

#### 2.4 Challenge Configuration

- Each challenge MUST present exactly 100 sprites in a 10x10 grid
- The challenge MUST maintain tracking of which square contains the human sprite
- The challenge MUST maintain tracking of all sprite positions and their types (human vs item)
- The system SHOULD assign unique identifiers to each square in the grid
- The system MAY vary the number of human sprites in future implementations

### 3. Display Requirements

#### 3.1 Visual Layout

- The system MUST display all 100 sprites in a 10x10 grid layout
- The system SHOULD use a responsive grid that adapts to screen size
- The system SHOULD display sprites at a consistent size (recommended: 80x80 pixels for 10x10 grid)
- Sprites MUST be clearly visible and distinguishable from each other
- The grid layout SHOULD use appropriate spacing between sprites
- The grid MUST maintain a 10x10 structure regardless of screen size

#### 3.2 Instructions

- The system MUST display the instruction: "Select the human"
- Instructions MUST be clear and unambiguous
- Instructions SHOULD be displayed prominently near the sprite grid

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
- The system MUST support single square selection (users can select only one square at a time)
- The system MUST track which square is currently selected
- Click interactions SHOULD be intuitive and responsive

#### 4.2 Selection Validation

- The system MUST allow users to select any square in the grid
- The system SHOULD validate the final selection when the challenge is submitted
- The system MUST not prevent users from selecting incorrect squares (selection should be permissive, validation occurs on submit)

### 5. Answer Format and Validation

#### 5.1 Answer Representation

- The correct answer MUST be represented as a single square index
- The index MUST be zero-based and refer to the position in the grid (0-99)
- The answer MUST contain exactly 1 index (the position of the square with the human sprite)
- The index in the answer MUST be a single numeric value
- The system MUST normalize user selections to match this format for comparison

#### 5.2 Validation Logic

- The system MUST validate that the user selected exactly 1 square
- The system MUST validate that the selected square contains the human sprite
- Validation MUST be order-independent (user can select in any order)
- The system MUST treat the answer as incorrect if:
  - Too many squares are selected
  - No squares are selected
  - The selected square does not contain the human sprite

#### 5.3 Answer Normalization

- The system MUST normalize user selections by extracting the single index
- The system MUST handle empty selections gracefully
- The system SHOULD trim whitespace from index values
- The system MUST handle index strings correctly

### 6. Challenge Integration

#### 6.1 Challenge Type Registration

- The human challenge MUST be registered as a valid challenge type in the main CAPTCHA system
- The challenge type identifier MUST be `'human'`
- The challenge MUST be selectable during random challenge generation

#### 6.2 Time Limits

- The challenge SHOULD have a time limit (recommended: 90 seconds)
- The time limit MUST be displayed to the user
- The system MUST handle timeout scenarios appropriately

#### 6.3 Challenge Lifecycle

- The challenge MUST integrate with the main challenge generation system
- The challenge MUST support the standard challenge lifecycle (generate, render, validate, reveal)
- The challenge MUST work with the anti-automation measures in the main system

### 7. Answer Revelation

#### 7.1 Correct Answer Display

- When time expires or the user gives up, the system MUST reveal the correct answer
- The correct square (containing the human sprite) MUST be visually highlighted
- The highlighting SHOULD use a distinct visual style (e.g., green border, success color)
- The system MUST clearly indicate which square was the correct answer

#### 7.2 Visual Distinction

- Revealed correct answers SHOULD use a color scheme distinct from selection highlighting
- The system SHOULD make it obvious which square should have been selected
- Visual revelation MUST be consistent with other challenge types' revelation mechanisms
- The system MUST use the same highlighting style as predator and emotions challenges

### 8. Technical Implementation

#### 8.1 Sprite Loader Implementation

- The system MUST use the existing `SpriteLoader` class or equivalent functionality
- The loader MUST use the Canvas API for sprite extraction
- The loader MUST handle image loading asynchronously (Promises or async/await)
- The loader SHOULD cache loaded sprite sheets to avoid redundant loading
- Error handling MUST be implemented for failed image loads
- The loader MUST support loading male, female, and item sprite sheets

#### 8.2 Challenge Class Implementation

- The system MUST implement a `HumanChallenge` class or equivalent
- The class MUST provide a static `generate()` method that returns a challenge object
- The class MUST provide a static `render()` method for displaying the challenge
- The class MUST provide a static `getAnswer()` method for retrieving user selections
- The class MUST provide a static `revealAnswer()` method for displaying correct answers

#### 8.3 Challenge Object Structure

The challenge object MUST contain the following fields:
- `id`: Unique identifier for the challenge
- `type`: Must be `'human'`
- `grid`: Array of 100 square data objects, each containing:
  - `sprite`: Canvas element or image data for the sprite
  - `isHuman`: Boolean indicating if this square contains the human sprite
  - `spriteSource`: String indicating the source ('male', 'female', or 'item')
  - `spriteIndex`: Numeric index of the sprite in the source sheet (0-15)
- `correctIndex`: Numeric index of the square containing the human sprite (0-99)
- `answer`: String representation of the correct square index
- `instructions`: Text instruction for the user ("Select the human")
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
- Grid generation SHOULD be fast and synchronous (no async operations required after sprites are loaded)

## Security Considerations

- Challenge generation MUST use randomization to prevent predictable patterns
- The mapping between grid positions and correct answers MUST not be easily extractable from client-side code
- Human sprite selection and grid shuffling MUST use cryptographically secure random number generation when available
- The challenge SHOULD integrate with the main CAPTCHA system's anti-automation measures
- Sprite source selection (male/female) MUST be randomized to prevent pattern recognition

## Future Enhancements

The following features are explicitly excluded from the current implementation but MAY be considered for future versions:

- Variable numbers of human sprites (currently fixed at 1)
- Variable grid sizes (currently fixed at 10x10)
- Additional sprite sheet categories beyond human and item sprites
- Animated sprites or sprite variations
- Difficulty scaling based on sprite similarity
- Sprite rotation or transformation variations
- Sound effects or audio cues for selections
- Hint system for difficult challenges
- Sprite zoom or detailed view on hover
- Time-based sprite changes (dynamic challenges)

