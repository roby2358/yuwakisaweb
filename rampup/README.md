# Prep Quizzes

Beginner-to-intermediate, conversational familiarity drills: the level of an ordinary developer interview, not trivia or deep edge cases. Open `index.html` directly in a browser to pick a quiz (no server and no build step needed).

- `cloudflare/`: Cloudflare (DNS, TLS, caching, security, Workers and storage, Zero Trust)
- `cloudformation/`: AWS CloudFormation (templates, updates and change sets, rollback, protection policies, cross-stack, extensibility, drift, tooling)
- `react/`: React (JSX and rendering, hooks, performance and architecture, Server Components and React 19, ecosystem)
- `oop/`: Object-Oriented Programming (objects and encapsulation, inheritance and polymorphism, design principles, design patterns and testing)
- `fp/`: Functional Programming, language-neutral (purity and immutability, collections and composition, algebraic types and errors, functors/monads and practice)

Every quiz works the same way:

- **Continuous play.** The 100 turns come in a shuffled order. After all 100, they're reshuffled for another pass, and so on until you stop. Each turn shows a topic and three related statements: one **good**, one **neutral**, and one **bad**, in shuffled order.
- **First click scores the turn:** good = 2, neutral = 1, bad = 0. Then all three statements are labeled and the good one is highlighted.
- **Clicking the good statement advances** to the next turn. Keys `1`–`3` click the statements.
- **Review** (in the score bar, with a count) lists every turn you've missed, most recent first, with how many times you missed it and its good statement.
- **The score bar across the top** shows the pass, the turn within it, a rolling average of the last 20 turns, and the overall average across all passes (both scaled to 0–1 by dividing by 2). A graph below them plots both averages after every scored turn, and the progress bar tracks the current pass. **Home** returns to the quiz list.

The engine (`quiz.html`, `engine.js`, `styles.css`) lives at the top level. Each quiz is a directory holding only a `quiz.js` that defines `var QUIZ = { title, turns: [{ topic, good, neutral, bad }, ...] }`. `quiz.html?quiz=<dir>` loads `<dir>/quiz.js` with a plain `<script>` tag, so it still works from `file://`. To add a quiz, create a directory with its `quiz.js` and add a `quiz.html?quiz=<dir>` link (text = `QUIZ.title`) to `index.html`.

`node test/quizzes.js` checks every quiz: 100 complete turns, a matching link in `index.html`, and that length gives nothing away. No grade may be the longest or the shortest statement in more than 45% of turns, and in every turn the shortest statement must be at least 60% as long as the longest.

`node test/tells.js [dir ...]` checks that wording gives nothing away either. For each style feature (semicolons, parentheses, "so/because", absolutes like "always", history and naming trivia, "such as", talk about a concept instead of the concept itself, false reassurance like "safe" or "fine", "X is a ..." openers, and so on), it counts the turns where each grade's statement shows that feature. It fails when one grade shows a feature at least twice as often as the other two, with an excess of more than 8% of turns. Every quiz passes.

## Reusable prompt

Swap in a new topic, level, and focus to generate the same kind of quiz for something else:

> In HTML, CSS, and JS (plain `<script>` includes, no modules or build step, so it runs by double-clicking `index.html`), write a **beginner-to-intermediate {TOPIC} prep quiz**.
>
> **Content.** Write 100 turns, grouped loosely by subtopic. Each turn has a short topic label and three related statements about that same topic:
> - **good**: accurate and useful, the thing a fluent practitioner would actually say in conversation. It names the real mechanism, trade-off, or gotcha.
> - **neutral**: true but shallow, vague, or beside the point. It's trivia or UI location rather than understanding.
> - **bad**: a plausible-sounding misconception that a beginner-to-intermediate learner might really believe. It is not an absurd joke.
>
> Make the three statements similar in length and tone so the good one can't be spotted by its style. The focus is **conversational familiarity at a beginner-to-intermediate level**, meaning what you would say in an ordinary (not FAANG) interview or a chat with a teammate, not trivia, version history, memorized limits or deep edge cases. Keep the content in its own `quiz.js` as a global `QUIZ = { title, turns: [{ topic, good, neutral, bad }] }`. If a shared quiz engine already exists, add the quiz as a new directory containing only `quiz.js`.
>
> **Play.** Shuffle the three statements on each turn. The first click scores the turn (good 2, neutral 1, bad 0), then labels all three and highlights the good one. Clicking the good statement advances to the next turn. Number keys 1–3 click the statements.
>
> **Score.** Play is continuous: shuffle the turns, and after every turn has been seen, reshuffle and keep going until the player leaves. A sticky bar across the top shows the pass number, the turn within the pass (n / 100), a rolling average over the last 20 turns and the overall average (both scaled to 0–1 by dividing by 2, two decimals), a small graph of both averages over time, a Home link back to the quiz list, and a progress bar for the current pass. A Review button in the bar lists missed turns (most recent first, with a miss count and the good statement) and returns to play. Support both light and dark mode, and make it readable on a phone.
>
> Summarize the form of the test in README.md as a reusable prompt.
