// Interactive human version of the principle benchmark.
// Flow per suite: read the shown statements, type the principle (<= CHAR_LIMIT
// chars), then select matching statements from the full list. Scoring mirrors
// src/score.py from the benchmark.

const CHAR_LIMIT = 300;
const STORAGE_KEY = "principle-human-run";

// Model comparison rows: fill in later from benchmark results
// (results/report/scores.json). Shape: { model, shownAccuracy, heldOutRecall,
// nearFpr, farFpr, fpr, overall } with rates as fractions in [0, 1].
const MODEL_SCORES = [];

const app = document.getElementById("app");

// answers[i] = { principle: string, selected: [1-based statement numbers] }
let state = { suiteIndex: 0, phase: "intro", answers: [] };

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.phase && Array.isArray(saved.answers)) return saved;
  } catch (e) { /* corrupt save: ignore */ }
  return null;
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const key in attrs || {}) {
    if (key === "text") node.textContent = attrs[key];
    else if (key === "html") node.innerHTML = attrs[key];
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), attrs[key]);
    else node.setAttribute(key, attrs[key]);
  }
  for (const child of children || []) node.appendChild(child);
  return node;
}

function render() {
  app.replaceChildren();
  app.className = state.phase;
  if (state.phase === "intro") renderIntro();
  else if (state.phase === "generalize") renderGeneralize();
  else if (state.phase === "classify") renderClassify();
  else renderResults();
}

// ---------------------------------------------------------------- intro

function renderIntro() {
  const resumable = state.answers.length > 0 || state.suiteIndex > 0;
  app.append(
    el("header", { class: "intro-header" }, [
      el("img", { class: "logo", src: "../../pics/logo_yuwakisa_daughters.png",
                  alt: "Yuwakisa" }),
      el("h1", { class: "intro-title", text: "The Principle Benchmark" }),
      el("p", { class: "intro-tagline", text:
        "Models are measured on how well they induce a rule from a few " +
        "examples and apply it to unseen cases. Now it's your turn." }),
    ]),
    el("section", { class: "steps" }, [
      el("div", { class: "step" }, [
        el("h3", { text: "Read" }),
        el("p", { text:
          "Each of the " + SUITES.length + " suites opens with a handful of " +
          "observations that share a single unifying principle." }),
      ]),
      el("div", { class: "step" }, [
        el("h3", { text: "Generalize" }),
        el("p", { text:
          `State the principle in ${CHAR_LIMIT} characters or fewer — the ` +
          "same limit the models get." }),
      ]),
      el("div", { class: "step" }, [
        el("h3", { text: "Classify" }),
        el("p", { text:
          "Then face the full list of 40 statements and select every one " +
          "that meets the principle." }),
      ]),
    ]),
    el("p", { class: "intro-note", text:
      "Progress is saved in your browser, so you can close the tab and come " +
      "back. At the end you get the same metrics the models are scored on." }),
    el("div", { class: "actions intro-actions" }, [
      el("button", { class: "primary", text: resumable ? "Resume" : "Begin",
        onclick: () => {
          // A saved principle without a selection means classify was in progress.
          const current = state.answers[state.suiteIndex];
          state.phase = current && current.principle && current.selected == null
            ? "classify" : "generalize";
          saveState();
          render();
        } }),
      resumable
        ? el("button", { text: "Start over", onclick: () => {
            clearState();
            state = { suiteIndex: 0, phase: "generalize", answers: [] };
            saveState();
            render();
          } })
        : el("span"),
    ])
  );
}

// ---------------------------------------------------------------- generalize

function renderGeneralize() {
  const suite = SUITES[state.suiteIndex];
  const shown = suite.statements.filter((s) => s.role === "shown");
  const counter = el("div", { class: "charcount", text: `0 / ${CHAR_LIMIT}` });
  const textarea = el("textarea", {
    maxlength: String(CHAR_LIMIT),
    placeholder: "State the unifying principle…",
  });
  const nextButton = el("button", { class: "primary", text: "Show all statements", disabled: "" });

  textarea.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length} / ${CHAR_LIMIT}`;
    if (textarea.value.trim()) nextButton.removeAttribute("disabled");
    else nextButton.setAttribute("disabled", "");
  });
  nextButton.addEventListener("click", () => {
    state.answers[state.suiteIndex] = { principle: textarea.value.trim(), selected: null };
    state.phase = "classify";
    saveState();
    render();
  });

  app.append(
    el("div", { class: "progress", text: `Suite ${state.suiteIndex + 1} of ${SUITES.length}` }),
    el("h1", { text: "What do these have in common?" }),
    el("p", { text:
      `Here are ${shown.length} observations that share a single unifying principle. ` +
      `Identify the principle and state it in ${CHAR_LIMIT} characters or fewer.` }),
    el("ol", { class: "statements" }, shown.map((s) => el("li", { text: s.text }))),
    textarea,
    counter,
    el("div", { class: "actions" }, [nextButton])
  );
  textarea.focus();
}

// ---------------------------------------------------------------- classify

function renderClassify() {
  const suite = SUITES[state.suiteIndex];
  const answer = state.answers[state.suiteIndex];
  const last = state.suiteIndex === SUITES.length - 1;

  const checkboxes = [];
  const list = el("ul", { class: "checklist" }, suite.statements.map((s, i) => {
    const box = el("input", { type: "checkbox" });
    checkboxes.push(box);
    return el("li", {}, [
      el("label", {}, [
        box,
        el("span", { class: "stmt-num", text: String(i + 1) + "." }),
        el("span", { text: s.text }),
      ]),
    ]);
  }));

  const doneButton = el("button", { class: "primary",
    text: last ? "Finish and see results" : "Next suite",
    onclick: () => {
      answer.selected = checkboxes
        .map((box, i) => (box.checked ? i + 1 : 0))
        .filter(Boolean);
      if (last) {
        state.phase = "results";
      } else {
        state.suiteIndex += 1;
        state.phase = "generalize";
      }
      saveState();
      window.scrollTo(0, 0);
      render();
    } });

  app.append(
    el("div", { class: "progress", text: `Suite ${state.suiteIndex + 1} of ${SUITES.length}` }),
    el("h1", { text: "Select every statement that meets your principle" }),
    el("p", { class: "note", text: "Your principle:" }),
    el("div", { class: "principle-box", text: answer.principle }),
    el("p", { text: `Here are ${suite.statements.length} statements. Check every one that meets the principle — including the ones you already saw.` }),
    el("div", { class: "scrollbox" }, [
      list,
      el("div", { class: "actions" }, [doneButton]),
    ])
  );
}

// ---------------------------------------------------------------- scoring
// Mirrors src/score.py: positives = shown + held_out, distractors = near + far.

function scoreSuite(suite, selected) {
  const byRole = { shown: new Set(), held_out: new Set(), near: new Set(), far: new Set() };
  suite.statements.forEach((s, i) => byRole[s.role].add(i + 1));
  const sel = new Set(selected);
  const count = (set) => [...set].filter((n) => sel.has(n)).length;
  const shownHit = count(byRole.shown);
  const heldOutHit = count(byRole.held_out);
  const nearHit = count(byRole.near);
  const farHit = count(byRole.far);
  const distractorTotal = byRole.near.size + byRole.far.size;
  const positiveTotal = byRole.shown.size + byRole.held_out.size;
  return {
    shownAccuracy: shownHit / byRole.shown.size,
    heldOutRecall: heldOutHit / byRole.held_out.size,
    nearFpr: nearHit / byRole.near.size,
    farFpr: farHit / byRole.far.size,
    fpr: (nearHit + farHit) / distractorTotal,
    overall: (shownHit + heldOutHit + (distractorTotal - nearHit - farHit)) /
             suite.statements.length,
    falsePositives: suite.statements
      .map((s, i) => ({ ...s, number: i + 1 }))
      .filter((s) => (s.role === "near" || s.role === "far") && sel.has(s.number)),
    falseNegatives: suite.statements
      .map((s, i) => ({ ...s, number: i + 1 }))
      .filter((s) => (s.role === "shown" || s.role === "held_out") && !sel.has(s.number)),
  };
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---------------------------------------------------------------- results

function pct(x) {
  return (x * 100).toFixed(0) + "%";
}

function metricCells(score) {
  return [score.shownAccuracy, score.heldOutRecall, score.nearFpr, score.farFpr,
          score.fpr, score.overall]
    .map((v) => el("td", { class: "num", text: pct(v) }));
}

const METRIC_HEADERS = ["Shown acc", "Held-out recall", "Near FPR", "Far FPR",
                        "FPR", "Overall"];

function renderResults() {
  const scored = SUITES.map((suite, i) => ({
    suite,
    answer: state.answers[i],
    score: scoreSuite(suite, state.answers[i].selected || []),
  }));
  const means = {
    shownAccuracy: mean(scored.map((r) => r.score.shownAccuracy)),
    heldOutRecall: mean(scored.map((r) => r.score.heldOutRecall)),
    nearFpr: mean(scored.map((r) => r.score.nearFpr)),
    farFpr: mean(scored.map((r) => r.score.farFpr)),
    fpr: mean(scored.map((r) => r.score.fpr)),
    overall: mean(scored.map((r) => r.score.overall)),
  };

  app.append(el("h1", { text: "Your results" }));

  // --- per-suite metrics, matching the benchmark's scoring ---
  app.append(el("h2", { text: "Performance" }));
  app.append(el("table", {}, [
    el("thead", {}, [el("tr", {},
      [el("th", { text: "Suite" }), el("th", { text: "Difficulty" })]
        .concat(METRIC_HEADERS.map((h) => el("th", { class: "num", text: h }))))]),
    el("tbody", {},
      scored.map((r) => el("tr", {},
        [el("td", { text: r.suite.suiteId }), el("td", { text: r.suite.difficulty })]
          .concat(metricCells(r.score))))
      .concat([el("tr", { class: "mean-row" },
        [el("td", { text: "Mean" }), el("td", {})].concat(metricCells(means)))])),
  ]));
  app.append(el("p", { class: "note", text:
    "Shown acc: fraction of the statements you were shown that you re-selected. " +
    "Held-out recall: fraction of unseen statements matching the true principle that you caught. " +
    "FPR: fraction of distractors you wrongly selected (near = same-domain lookalikes, far = unrelated facts). " +
    "Overall: fraction of all statements classified correctly." }));

  // --- model comparison (scores to be filled in later) ---
  app.append(el("h2", { text: "Comparison with models" }));
  const comparisonRows = [
    el("tr", {}, [el("td", { text: "You" })].concat(metricCells(means))),
  ].concat(MODEL_SCORES.map((m) =>
    el("tr", {}, [el("td", { text: m.model })].concat(metricCells(m)))));
  app.append(el("table", {}, [
    el("thead", {}, [el("tr", {},
      [el("th", { text: "Who" })]
        .concat(METRIC_HEADERS.map((h) => el("th", { class: "num", text: h }))))]),
    el("tbody", {}, comparisonRows),
  ]));
  if (MODEL_SCORES.length === 0)
    app.append(el("p", { class: "note", text: "Model scores not loaded yet." }));

  // --- per-suite detail: principles vs. mistakes ---
  app.append(el("h2", { text: "Detail" }));
  app.append(el("div", { class: "legend", html:
    'Incorrect answers only.<span class="swatch fp"></span>false positive ' +
    '(selected, but a distractor)<span class="swatch fn"></span>false negative ' +
    "(missed, but matches the principle)" }));
  app.append(el("table", { class: "detail-table" }, [
    el("thead", {}, [el("tr", {}, [
      el("th", { text: "Principle" }),
      el("th", { text: "Incorrect answers" }),
    ])]),
    el("tbody", {}, scored.map((r) => {
      const left = el("td", { class: "principles" }, [
        el("div", { class: "plabel", text: `Actual (${r.suite.suiteId}):` }),
        el("div", { class: "ptext", text: r.suite.principle }),
        el("div", { class: "plabel", text: "Yours:" }),
        el("div", { class: "ptext", text: r.answer.principle }),
      ]);
      const errors = r.score.falsePositives
        .map((s) => el("span", { class: "errcell fp" }, [
          el("span", { class: "tag", text: "FP" }),
          document.createTextNode(s.text),
        ]))
        .concat(r.score.falseNegatives.map((s) => el("span", { class: "errcell fn" }, [
          el("span", { class: "tag", text: "FN" }),
          document.createTextNode(s.text),
        ])));
      const right = el("td", {}, errors.length
        ? errors
        : [el("span", { class: "all-correct", text: "All 40 correct" })]);
      return el("tr", {}, [left, right]);
    })),
  ]));

  app.append(el("div", { class: "actions" }, [
    el("button", { text: "Start over", onclick: () => {
      clearState();
      state = { suiteIndex: 0, phase: "intro", answers: [] };
      render();
    } }),
  ]));
}

// ---------------------------------------------------------------- boot

const saved = loadState();
if (saved) {
  state = saved;
  if (state.phase !== "results") state.phase = "intro";
}
render();
