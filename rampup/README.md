# Prep Quizzes

Intermediate, conversational familiarity drills. Open `index.html` directly in a browser to pick a quiz (no server and no build step needed).

- `cloudflare/`: Cloudflare (DNS, TLS, caching, security, Workers and storage, Zero Trust)
- `cloudformation/`: AWS CloudFormation (templates, updates and change sets, rollback, protection policies, cross-stack, extensibility, drift, tooling)

Every quiz works the same way:

- **100 turns.** Each turn shows a topic and three related statements: one **good**, one **neutral**, and one **bad**, in shuffled order.
- **First click scores the turn:** good = 2, neutral = 1, bad = 0. Then all three statements are labeled and the good one is highlighted.
- **Clicking the good statement advances** to the next turn. Keys `1`–`3` click the statements.
- **The score bar across the top** shows the turn, a rolling average of the last 20 turns, and the overall average (both scaled to 0–1 by dividing by 2).
- **At the end** you see the final score and a list of every turn you missed, each with its good statement.

The engine (`quiz.html`, `engine.js`, `styles.css`) lives at the top level. Each quiz is a directory holding only a `quiz.js` that defines `var QUIZ = { title, turns: [{ topic, good, neutral, bad }, ...] }`. `quiz.html?quiz=<dir>` loads `<dir>/quiz.js` with a plain `<script>` tag, so it still works from `file://`. To add a quiz, create a directory with its `quiz.js` and add a `quiz.html?quiz=<dir>` link (text = `QUIZ.title`) to `index.html`.

`node test/quizzes.js` checks every quiz: 100 complete turns, a matching link in `index.html`, and that length gives nothing away. No grade may be the longest or the shortest statement in more than 45% of turns, and in every turn the shortest statement must be at least 60% as long as the longest.

## Reusable prompt

Swap in a new topic, level, and focus to generate the same kind of quiz for something else:

> In HTML, CSS, and JS (plain `<script>` includes, no modules or build step, so it runs by double-clicking `index.html`), write an **intermediate {TOPIC} prep quiz**.
>
> **Content.** Write 100 turns, grouped loosely by subtopic. Each turn has a short topic label and three related statements about that same topic:
> - **good**: accurate and useful, the thing a fluent practitioner would actually say in conversation. It names the real mechanism, trade-off, or gotcha.
> - **neutral**: true but shallow, vague, or beside the point. It's trivia or UI location rather than understanding.
> - **bad**: a plausible-sounding misconception that an intermediate learner might really believe. It is not an absurd joke.
>
> Make the three statements similar in length and tone so the good one can't be spotted by its style. The focus is **conversational familiarity at an intermediate level**, meaning the knowledge you'd need to talk shop with a colleague, not trivia or memorized limits. Keep the content in its own `quiz.js` as a global `QUIZ = { title, turns: [{ topic, good, neutral, bad }] }`. If a shared quiz engine already exists, add the quiz as a new directory containing only `quiz.js`.
>
> **Play.** Shuffle the three statements on each turn. The first click scores the turn (good 2, neutral 1, bad 0), then labels all three and highlights the good one. Clicking the good statement advances to the next turn. Number keys 1–3 click the statements.
>
> **Score.** A sticky bar across the top shows the turn number (n / 100), a rolling average over the last 20 turns and the overall average (both scaled to 0–1 by dividing by 2, two decimals), and a progress bar. The end screen shows the final score, a list of missed turns with their good statements, and a restart button. Support both light and dark mode, and make it readable on a phone.
>
> Summarize the form of the test in README.md as a reusable prompt.
