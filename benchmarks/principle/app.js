// Interactive human version of the principle benchmark.
// Suites are taken one at a time: a random draw from the suites with the
// fewest completed iterations. Completing a suite stores that iteration's
// result (retakes overwrite), and the results page aggregates the latest
// result per suite. Scoring mirrors src/score.py from the benchmark.

const CHAR_LIMIT = 300;
const STORAGE_KEY = "principle-human-run";

// Model comparison rows: fill in later from benchmark results
// (results/report/scores.json). Shape: { model, shownAccuracy, heldOutRecall,
// nearFpr, farFpr, fpr, overall } with rates as fractions in [0, 1].
const MODEL_SCORES = [];

const app = document.getElementById("app");

// results[suiteId] = { iteration, principle, selected: [1-based numbers] }
// current = { suiteId, principle } for a suite in progress (principle null
// until the generalize step is submitted).
let state = { phase: "intro", results: {}, current: null };

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.phase && saved.results && typeof saved.results === "object")
      return saved;
  } catch (e) { /* corrupt save: ignore */ }
  return null;
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
  window.scrollTo(0, 0);
  if (state.phase === "intro") renderIntro();
  else if (state.phase === "generalize") renderGeneralize();
  else if (state.phase === "classify") renderClassify();
  else renderResults();
}

function suiteById(suiteId) {
  return SUITES.find((s) => s.suiteId === suiteId);
}

function iterationOf(suiteId) {
  return state.results[suiteId] ? state.results[suiteId].iteration : 0;
}

// Uniform random draw from the suites with the fewest completed iterations.
function drawSuite() {
  const low = Math.min(...SUITES.map((s) => iterationOf(s.suiteId)));
  const pool = SUITES.filter((s) => iterationOf(s.suiteId) === low);
  return pool[Math.floor(Math.random() * pool.length)];
}

function beginSuite(suiteId) {
  state.current = { suiteId, principle: null };
  state.phase = "generalize";
  saveState();
  render();
}

// ---------------------------------------------------------------- intro

function renderIntro() {
  const attempted = Object.keys(state.results).length;
  const buttons = [];
  if (state.current) {
    buttons.push(el("button", { class: "primary",
      text: `Resume ${state.current.suiteId}`,
      onclick: () => {
        state.phase = state.current.principle ? "classify" : "generalize";
        saveState();
        render();
      } }));
  }
  buttons.push(el("button", { class: state.current ? "" : "primary",
    text: attempted > 0 ? "Take a suite" : "Begin",
    onclick: () => beginSuite(drawSuite().suiteId) }));
  if (attempted > 0) {
    buttons.push(el("button", { text: "Go to results", onclick: () => {
      state.phase = "results";
      saveState();
      render();
    } }));
  }

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
          "Each suite opens with a handful of observations that share a " +
          "single unifying principle. You get one of the " + SUITES.length +
          " suites at random, least-taken first." }),
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
      "Each completed suite lands you on the results page, scored on the " +
      "same metrics as the models. Retaking a suite replaces its result. " +
      "Everything is saved in your browser." }),
    el("div", { class: "actions intro-actions" }, buttons)
  );
}

// ---------------------------------------------------------------- generalize

function renderGeneralize() {
  const suite = suiteById(state.current.suiteId);
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
    state.current.principle = textarea.value.trim();
    state.phase = "classify";
    saveState();
    render();
  });

  app.append(
    el("div", { class: "progress",
      text: `Suite ${suite.suiteId} · iteration ${iterationOf(suite.suiteId) + 1}` }),
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
  const suite = suiteById(state.current.suiteId);

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
    text: "Finish and see results",
    onclick: () => {
      state.results[suite.suiteId] = {
        iteration: iterationOf(suite.suiteId) + 1,
        principle: state.current.principle,
        selected: checkboxes
          .map((box, i) => (box.checked ? i + 1 : 0))
          .filter(Boolean),
      };
      state.current = null;
      state.phase = "results";
      saveState();
      render();
    } });

  app.append(
    el("div", { class: "progress",
      text: `Suite ${suite.suiteId} · iteration ${iterationOf(suite.suiteId) + 1}` }),
    el("h1", { text: "Select every statement that meets your principle" }),
    el("p", { class: "note", text: "Your principle:" }),
    el("div", { class: "principle-box", text: state.current.principle }),
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

function backToStartActions() {
  return el("div", { class: "actions" }, [
    el("button", { class: "primary", text: "Back to start", onclick: () => {
      state.phase = "intro";
      saveState();
      render();
    } }),
  ]);
}

function renderResults() {
  // Latest result per attempted suite, in canonical suite order.
  const scored = SUITES
    .filter((suite) => state.results[suite.suiteId])
    .map((suite) => ({
      suite,
      result: state.results[suite.suiteId],
      score: scoreSuite(suite, state.results[suite.suiteId].selected || []),
    }));

  app.append(el("h1", { text: "Your results" }));

  if (scored.length === 0) {
    app.append(el("p", { text: "No suites completed yet." }), backToStartActions());
    return;
  }

  const means = {
    shownAccuracy: mean(scored.map((r) => r.score.shownAccuracy)),
    heldOutRecall: mean(scored.map((r) => r.score.heldOutRecall)),
    nearFpr: mean(scored.map((r) => r.score.nearFpr)),
    farFpr: mean(scored.map((r) => r.score.farFpr)),
    fpr: mean(scored.map((r) => r.score.fpr)),
    overall: mean(scored.map((r) => r.score.overall)),
  };
  const meanLabel = `Mean (${scored.length} of ${SUITES.length} suites)`;

  // --- per-suite metrics, matching the benchmark's scoring ---
  app.append(el("h2", { text: "Performance" }));
  app.append(el("table", {}, [
    el("thead", {}, [el("tr", {},
      [el("th", { text: "Suite" }), el("th", { text: "Difficulty" }),
       el("th", { class: "num", text: "Iter" })]
        .concat(METRIC_HEADERS.map((h) => el("th", { class: "num", text: h }))))]),
    el("tbody", {},
      scored.map((r) => el("tr", {},
        [el("td", { text: r.suite.suiteId }),
         el("td", { text: r.suite.difficulty }),
         el("td", { class: "num", text: String(r.result.iteration) })]
          .concat(metricCells(r.score))))
      .concat([el("tr", { class: "mean-row" },
        [el("td", { text: meanLabel }), el("td", {}), el("td", {})]
          .concat(metricCells(means)))])),
  ]));
  app.append(el("p", { class: "note", text:
    "Shown acc: fraction of the statements you were shown that you re-selected. " +
    "Held-out recall: fraction of unseen statements matching the true principle that you caught. " +
    "FPR: fraction of distractors you wrongly selected (near = same-domain lookalikes, far = unrelated facts). " +
    "Overall: fraction of all statements classified correctly. " +
    "Iter: how many times you've taken the suite — scores are from the latest take." }));

  // --- model comparison (scores to be filled in later) ---
  app.append(el("h2", { text: "Comparison with models" }));
  const comparisonRows = [
    el("tr", {}, [el("td", { text: `You (${scored.length} of ${SUITES.length} suites)` })]
      .concat(metricCells(means))),
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
        el("div", { class: "ptext", text: r.result.principle }),
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

  app.append(backToStartActions());
}

// ---------------------------------------------------------------- boot

const saved = loadState();
if (saved) {
  state = saved;
  if (state.phase !== "results") state.phase = "intro";
}
render();
