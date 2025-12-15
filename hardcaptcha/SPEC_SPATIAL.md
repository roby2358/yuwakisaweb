# Spatial Challenge Specification

## Purpose

The Spatial Challenge tests users' ability to recognize and reason about geometric orientation by selecting a target shape rendered at a specific rotation from a set of similar options.

## Requirement Levels

This specification uses the following requirement levels:
- **MUST**: Mandatory requirement. The implementation must include this feature.
- **SHOULD**: Recommended requirement. The implementation should include this feature unless there is a compelling reason not to.
- **MAY**: Optional requirement. The implementation may include this feature.

## Core Requirements

### 1. Shape and Rotation Set

- The system MUST support four shape families, each with four oriented glyphs covering the cardinal directions:
  - Triangles: ▲, ▶, ▼, ◀
  - Corner brackets: ┌, ┐, ┘, └
  - Wedges: ◤, ◥, ◢, ◣
  - Thin arrows: ↥, ↦, ↧, ↤
- The system MAY also use rotationally symmetric shapes: circle (●) and square (■), which appear identical at all rotations.
- The system MUST use exactly four rotation values: 0°, 90°, 180°, 270°.
- The system MUST randomly select rotation direction: 50% chance clockwise, 50% chance counter-clockwise.
- Shapes and rotations MUST be combined to form candidate options.
- Shape characters MUST remain consistent across all challenges.
- Normal shape families MUST be chosen to avoid rotational symmetry so orientation always changes with rotation.
- Normal shape families MUST not rotate into any other shape in the set; families provide four distinct oriented glyphs.

### 2. Challenge Generation

- The system MUST randomly select one target rotation from the available rotations (shared across all options).
- The system MUST use one of two generation modes:
  - **Normal mode (90% chance)**: Randomly select one shape family, randomly select one target shape from that family, and generate exactly four options using all four shapes from the chosen family.
  - **Symmetric mode (10% chance)**: Randomly select either circle (●) or square (■) as the target shape, and generate exactly four options: the target shape plus three randomly selected shapes from any of the other families (duplicates allowed).
- Exactly one option MUST match the target shape (with the shared rotation).
- Option ordering MUST be randomized before display.
- The challenge object MUST include:
  - `id`: Unique identifier (format: `spatial-{timestamp}`).
  - `type`: Must be `'spatial'`.
  - `targetShape`: The chosen shape character.
  - `targetRotation`: The chosen rotation in degrees (0, 90, 180, or 270).
  - `isClockwise`: Boolean indicating rotation direction (true for clockwise, false for counter-clockwise).
  - `options`: Array of four option objects with `shape`, `rotation`, and `correct` boolean.
  - `correctIndex`: Zero-based index of the correct option within the shuffled options.
  - `answer`: String representation of `correctIndex`.
  - `instructions`: Text instructing the user to select the target shape and rotation direction.
  - `timeLimit`: Numeric value in seconds (60).

### 3. Display Requirements

- The system MUST render all four options visibly.
- Each option MUST display the shape character rotated according to its `rotation` value and the `isClockwise` direction.
- For clockwise rotations, the rotation value MUST be applied directly (e.g., `rotate(90deg)`).
- For counter-clockwise rotations, the rotation value MUST be negated (e.g., `rotate(-90deg)`).
- The display MUST use a container styled for spatial options (e.g., `.spatial-container`).
- Shapes MUST be large enough for easy selection (recommended 120px square).
- Visual hover feedback SHOULD be provided to indicate interactivity.
- The instruction text MUST reference the target shape, rotation value, and direction (clockwise or counter-clockwise).

### 4. User Interaction

- Users MUST be able to click exactly one option to select it.
- Clicking an option MUST clear any previous selection and mark the new one.
- Selection state MUST be visually apparent (e.g., border and background change).
- Only one selection MAY exist at any time.

### 5. Answer Format and Validation

- The correct answer MUST be a string containing the zero-based option index.
- Validation MUST succeed only when the selected option index equals `correctIndex`.
- If no option is selected, validation MUST treat the answer as incorrect.
- Answer retrieval MUST read the selected option’s dataset index from the DOM.

### 6. Challenge Lifecycle Integration

- The spatial challenge MUST be registered under the `'spatial'` challenge type.
- The challenge MUST be eligible for random selection in the core CAPTCHA flow.
- The challenge MUST respect the standard lifecycle: generate → render → validate → reveal.
- The challenge MUST integrate with global anti-automation timing and state management.

### 7. Answer Revelation

- When revealing answers (timeout or give-up), the system MUST highlight the correct option.
- Highlighting SHOULD use the success color scheme consistent with other challenges.
- Revelation MUST override any previous selection styling.

### 8. Technical Implementation

- The system MUST implement a `SpatialChallenge` class with static methods:
  - `generate()` returning the challenge object.
  - `render(challenge, container)` to draw options and wire selection.
  - `getAnswer(challenge)` to read the current selection from the DOM.
  - `revealAnswer(challenge, challengeEl)` to highlight the correct option.
- Random selection MUST rely on client-side JavaScript only.
- DOM operations MUST guard against missing containers or challenge roots.
- The implementation SHOULD expose the class for unit testing when running outside the browser environment.

### 9. Randomization Requirements

- Shape selection MUST be uniformly random across the four shapes.
- Rotation selection MUST be uniformly random across the four rotations.
- Option order MUST be uniformly randomized.
- Non-target options MUST be unique with respect to the shape+rotation pair within a challenge.

## Security Considerations

- Challenge generation MUST occur entirely on the client.
- The mapping between option order and correctness SHOULD not be trivially predictable.
- Randomization SHOULD use the best available browser randomness (Math.random is acceptable).

## Future Enhancements

- Additional shapes or rotations MAY be added in future versions with corresponding styling.
- Difficulty scaling MAY vary the number of options or introduce mirrored shapes.
- Accessibility improvements (keyboard navigation, ARIA labels) MAY be added later.

