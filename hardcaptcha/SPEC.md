# HardCAPTCHA Specification

## Purpose

Create a web-based CAPTCHA system that is intentionally difficult for both humans and bots, with multiple layers of challenge types and anti-automation measures.

## Requirement Levels

This specification uses the following requirement levels:
- **MUST**: Mandatory requirement. The implementation must include this feature.
- **SHOULD**: Recommended requirement. The implementation should include this feature unless there is a compelling reason not to.
- **MAY**: Optional requirement. The implementation may include this feature.

## Core Requirements

### 1. Challenge Types

The implementation MUST support multiple challenge types. The following challenge types SHOULD be implemented:

- **Pattern Recognition**: Complex visual patterns that require careful observation
- **Mathematical Puzzles**: Multi-step calculations or logic problems
- **Sequence Completion**: Identify missing elements in complex sequences
- **Spatial Reasoning**: Rotate, align, or manipulate visual elements
- **Multi-Step Tasks**: Challenges that require completing multiple actions in sequence
- **Time-Sensitive Elements**: Some challenges MAY have time constraints

The implementation MAY include additional challenge types beyond those listed above.

#### 1.1 Dynamic Challenge Blending

The implementation MUST support dynamic challenge blending and concurrent presentation. The following capabilities MUST be implemented:

- **Concurrent Challenges**: The system MUST be able to present multiple challenge types simultaneously, requiring users to solve them in parallel or in a specific interleaved sequence
- **Blended Mechanics**: The system MUST be able to combine challenge types into hybrid challenges (e.g., a mathematical puzzle embedded within a spatial reasoning task)
- **Dynamic Composition**: The system MUST dynamically compose new challenge combinations based on randomization
- **Layered Interactions**: The system SHOULD support challenges that require solving one layer to unlock or reveal another, creating nested challenge structures
- **Cross-Challenge Dependencies**: The system SHOULD support scenarios where solutions to one challenge provide inputs or constraints for another concurrent challenge
- **Resource Competition**: The system MAY implement scenarios where multiple concurrent challenges compete for the same user input methods (mouse, keyboard, attention), requiring strategic prioritization

### 2. Challenge Feedback

- The system MUST provide feedback on incorrect attempts
- The system SHOULD allow limited retries before presenting a new challenge

### 3. Anti-Automation Measures

The implementation MUST include anti-automation measures. The following measures SHOULD be implemented:

- **Timing Analysis**: The system SHOULD detect suspiciously fast completion times
- **Mouse Movement Tracking**: The system SHOULD require natural mouse movements on desktop platforms
- **Touch Movement Tracking**: The system SHOULD track touch movements on mobile platforms as an alternative to mouse movement tracking
- **Keyboard Event Monitoring**: The system SHOULD track typing patterns (where applicable, as some challenges may be touch-only)
- **Focus/Blur Detection**: The system SHOULD monitor window focus state
- **Random Delays**: The system MAY introduce unpredictable timing elements
- **Dynamic Challenge Generation**: The system MUST generate challenges using complex client-side algorithms (server-side generation is excluded from this implementation)
- **Platform-Aware Detection**: The system SHOULD adapt anti-automation checks based on the detected input method (mouse vs touch) to avoid false positives on mobile devices

### 4. User Experience

- The system MUST display a modal dialog at the start presenting the premise of the CAPTCHA with a "Start" button that initiates the challenge sequence
- The system MUST display a modal dialog at the end of the challenge sequence with one of two outcomes:
  - **Failure**: "I don't think you are who you say you are"
  - **Success**: "Congratulations! Here's your code <code>" where <code> is a randomly generated string
- The system MUST provide clear instructions for each challenge type
- The system MUST provide visual feedback for correct/incorrect attempts
- The system MUST display the correct answers for all challenges when time runs out
- The system SHOULD provide progress indicators
- The system MAY include accessibility considerations
- The system SHOULD use responsive design for various screen sizes
- The system MUST provide consistent interaction behavior across desktop and mobile platforms, ensuring touch interactions work as reliably as mouse interactions

#### 4.1 Round Structure

- The CAPTCHA MUST consist of exactly 7, 11, 13, or 17 rounds, randomly selected at the start of each session
- The system MUST display a visible "Round __" indicator showing the current round number
- The system MUST NOT display the total number of rounds required
- The system MUST NOT display progress indicators that reveal the total number of rounds (e.g., "Round X of Y" or progress bars that show completion percentage relative to total rounds)
- The purpose of hiding the total round count is to keep users guessing about how many challenges remain

### 5. Validation

- The system MUST perform client-side validation for immediate feedback
- All validation logic MUST run entirely in the browser (no server-side validation)
- The system MUST generate tokens upon successful completion (client-side only)
- The system SHOULD implement session management to prevent replay attacks (browser-based storage only)

## Technical Implementation

**CRITICAL CONSTRAINT**: The implementation MUST be entirely browser-based with no server-side support. All challenge generation, validation, state management, and anti-automation logic MUST execute entirely in client-side JavaScript. Server-side support is explicitly excluded from this implementation and will be considered as a future extension. The system MUST function completely standalone when opening `index.html` in a browser.

### HTML Structure (index.html)

The implementation MUST include:

- Semantic HTML5 structure
- Start modal dialog with premise text and "Start" button
- End modal dialog for displaying success or failure messages
- Container for challenge display
- Input areas for user responses
- Status/feedback areas
- Timer displays (where applicable)
- Submit/verify buttons

### JavaScript Logic (index.js)

The implementation MUST include:

- Challenge generation algorithms
- Dynamic challenge blending and composition logic
- Concurrent challenge state management
- Challenge dependency resolution
- User input validation
- Timing and interaction tracking
- Anti-bot detection logic
- State management for multiple simultaneous challenges
- Challenge type selection and rotation
- Success/failure handling
- Random code generation for successful completion
- Modal dialog management (start and end modals)

### Styling (index.css)

The implementation MUST include:

- Modern, clean interface
- Visual challenge elements
- Responsive layout
- Loading states and feedback indicators

The implementation SHOULD include:

- Animations and transitions
- Dark/light mode considerations

### Cross-Platform Compatibility

The implementation MUST support both desktop and mobile platforms. The following requirements MUST be met:

- **Touch Event Support**: Interactive challenge elements (clickable sprites, buttons, selectable items) MUST handle both mouse click events and touch events (touchend) to ensure proper functionality on iOS, Android, and other mobile platforms
- **Event Prevention**: Touch event handlers MUST prevent default behavior and suppress subsequent click events to avoid double-firing when both touch and click events are triggered
- **Pointer Events**: Interactive images or nested elements within clickable containers SHOULD have `pointer-events: none` to prevent interference with parent touch/click handlers
- **iOS Compatibility**: The system MUST work correctly on iOS Safari and Chrome for iOS, where click events may be unreliable or delayed without proper touch event handling
- **Android Compatibility**: The system MUST work correctly on Android Chrome, Samsung Internet, Firefox for Android, and other Android browsers
- **Viewport Configuration**: The system MUST include proper viewport meta tags (`width=device-width, initial-scale=1.0`) to ensure correct rendering and touch target sizing on mobile devices
- **Touch Target Sizing**: Interactive elements SHOULD have minimum touch target sizes of 44x44 pixels (iOS HIG) or 48x48 pixels (Material Design) to ensure comfortable interaction on mobile devices
- **Performance Considerations**: The system SHOULD be optimized for lower-end Android devices with limited processing power and memory

#### Mobile-Specific Anti-Automation

- **Touch Movement Tracking**: On mobile platforms, the system SHOULD track touch movements (touchmove events) as an alternative to mouse movement tracking for anti-automation purposes
- **Mobile Input Patterns**: The system SHOULD account for different input patterns on mobile (touch vs mouse, virtual keyboard vs physical keyboard) when evaluating anti-automation metrics

The implementation SHOULD test on multiple platforms including:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers:
  - iOS: Safari, Chrome for iOS
  - Android: Chrome, Samsung Internet, Firefox for Android
- Various device sizes and pixel densities

## Challenge Examples

The following are example challenge types that MAY be implemented:

1. **Color Sequence**: Identify the next color in a complex gradient sequence
2. **Shape Rotation**: Determine the correct orientation of rotated shapes
3. **Number Puzzle**: Solve a multi-step arithmetic problem with constraints
4. **Path Finding**: Trace a path through a maze while avoiding obstacles
5. **Pattern Matching**: Find the pattern that doesn't belong in a set
6. **Memory Challenge**: Remember and recreate a sequence of actions

## Blended Challenge Examples

The following are examples of dynamically blended concurrent challenges that MAY be implemented:

1. **Math + Spatial**: Solve a calculation to determine how many times to rotate a shape, then perform the rotation
2. **Sequence + Pattern**: Complete a number sequence while simultaneously identifying which pattern in a visual array is incorrect
3. **Memory + Path**: Remember a sequence of colors, then trace a path through a maze where each turn must match the remembered color sequence
4. **Concurrent Timers**: Two independent challenges with separate countdown timers that must both be completed before either expires
5. **Interdependent Layers**: A mathematical puzzle whose answer unlocks a pattern recognition challenge, while a spatial reasoning task runs concurrently and provides a constraint for the final answer
6. **Resource Competition**: A typing challenge and a mouse-based puzzle that must be solved simultaneously, requiring rapid switching between input methods

## Security Considerations

- Challenges MUST be generated dynamically
- Solutions SHOULD NOT be easily extractable from client-side code
- The system SHOULD implement rate limiting (simulated, client-side)
- The system SHOULD track and flag suspicious behavior patterns
- The system SHOULD use cryptographic hashing for validation tokens

## Future Enhancements

The following features are explicitly excluded from the current implementation but MAY be considered for future versions:

- **Server-side support**: Server-side challenge generation, validation, and database tracking
- Multi-language support
- Audio challenges for accessibility
- Progressive Web App capabilities
