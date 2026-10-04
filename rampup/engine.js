// Shared quiz engine. quiz.html?quiz=<dir> loads <dir>/quiz.js, which defines QUIZ.
//
// Vocabulary (matches README.md):
//   quiz      — one subject: { title, turns }, living in its own directory
//   turn      — { topic, good, neutral, bad }: a topic plus three statements
//   grade     — good / neutral / bad; what a statement is worth
//   pass      — every turn once, in a freshly shuffled order
//   run       — continuous play: pass after pass until the player leaves
//   missed    — turns whose first pick wasn't good, for review
//   score     — points scaled to 0–1
//
// The first pick on a turn scores it and reveals every grade; picking the good statement advances.
var GRADES = {
  good:    { points: 2, label: "Good" },
  neutral: { points: 1, label: "Neutral" },
  bad:     { points: 0, label: "Bad" }
};
var MAX_POINTS = GRADES.good.points;
var ROLLING_WINDOW = 20;
var QUIZ_DIR_PATTERN = /^[a-z0-9-]+$/;

var turns = [];
var run = null;

var el = function (id) { return document.getElementById(id); };

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function shuffledDeck() {
  return shuffle(turns.map(function (_, i) { return i; }));
}

function newRun() {
  return {
    deck: shuffledDeck(),  // turn indices for the current pass
    position: 0,           // place in the deck
    pass: 1,
    points: [],            // one entry per scored turn, across all passes
    missed: [],            // { turn, count, picked }, most recently missed first
    revealed: false        // current turn has been scored
  };
}

function currentTurn() {
  return turns[run.deck[run.position]];
}

function score(points) {
  var sum = points.reduce(function (s, p) { return s + p; }, 0);
  return sum / points.length / MAX_POINTS;
}

function formatScore(points) {
  if (points.length === 0) return "—";
  return score(points).toFixed(2);
}

// Rolling and overall score after each scored turn, for the chart.
function scoreHistory(points) {
  return points.map(function (_, i) {
    return {
      rolling: score(points.slice(Math.max(0, i + 1 - ROLLING_WINDOW), i + 1)),
      overall: score(points.slice(0, i + 1))
    };
  });
}

// SVG polyline points in a 0–100 box: x spans the scored turns, y is score 1 (top) to 0 (bottom).
function chartLine(history, key) {
  var span = Math.max(1, history.length - 1);
  return history.map(function (h, i) {
    return (100 * i / span).toFixed(2) + "," + (100 * (1 - h[key])).toFixed(2);
  }).join(" ");
}

function renderChart() {
  var history = scoreHistory(run.points);
  el("chart-rolling").setAttribute("points", chartLine(history, "rolling"));
  el("chart-overall").setAttribute("points", chartLine(history, "overall"));
}

function renderScorebar() {
  el("pass").textContent = run.pass;
  el("turn").textContent = (run.position + 1) + " / " + turns.length;
  el("rolling").textContent = formatScore(run.points.slice(-ROLLING_WINDOW));
  el("overall").textContent = formatScore(run.points);
  el("review-count").textContent = run.missed.length;
  renderChart();
  var done = run.position + (run.revealed ? 1 : 0);
  el("progress-fill").style.width = (100 * done / turns.length) + "%";
}

function renderTurn() {
  var turn = currentTurn();
  run.revealed = false;
  el("topic").textContent = turn.topic;
  el("hint").textContent = "Pick the best statement.";
  var box = el("statements");
  box.innerHTML = "";
  shuffle(Object.keys(GRADES)).forEach(function (grade, i) {
    var b = document.createElement("button");
    b.className = "choice";
    b.dataset.grade = grade;
    b.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="text"></span><span class="tag"></span>';
    b.querySelector(".text").textContent = turn[grade];
    b.addEventListener("click", function () { pick(grade, b); });
    box.appendChild(b);
  });
  renderScorebar();
}

function reveal(grade, button) {
  run.revealed = true;
  run.points.push(GRADES[grade].points);
  if (grade !== "good") recordMiss(currentTurn(), grade);
  el("statements").querySelectorAll(".choice").forEach(function (b) {
    b.classList.add("revealed", b.dataset.grade);
    b.querySelector(".tag").textContent = GRADES[b.dataset.grade].label;
  });
  button.classList.add("picked");
  el("hint").textContent = grade === "good"
    ? "Right. Click it again to continue."
    : "The good statement is highlighted. Click it to continue.";
  renderScorebar();
}

function recordMiss(turn, grade) {
  var previous = run.missed.filter(function (m) { return m.turn === turn; });
  var count = previous.length === 0 ? 1 : previous[0].count + 1;
  run.missed = [{ turn: turn, count: count, picked: grade }].concat(
    run.missed.filter(function (m) { return m.turn !== turn; }));
}

function pick(grade, button) {
  if (!run.revealed) { reveal(grade, button); return; }
  if (grade === "good") advance();
}

function advance() {
  run.position++;
  if (run.position >= run.deck.length) {
    run.deck = shuffledDeck();
    run.position = 0;
    run.pass++;
  }
  renderTurn();
}

function reviewing() {
  return !el("review").classList.contains("hidden");
}

function renderReview() {
  el("review-empty").classList.toggle("hidden", run.missed.length > 0);
  var list = el("missed");
  list.innerHTML = "";
  run.missed.forEach(function (m) {
    var li = document.createElement("li");
    li.innerHTML = '<strong></strong> <em></em><p></p>';
    li.querySelector("strong").textContent = m.turn.topic;
    li.querySelector("em").textContent = "(missed " + m.count + "×, last picked " + GRADES[m.picked].label + ")";
    li.querySelector("p").textContent = m.turn.good;
    list.appendChild(li);
  });
}

function toggleReview() {
  if (!run) return;
  var show = !reviewing();
  if (show) renderReview();
  el("review").classList.toggle("hidden", !show);
  el("play").classList.toggle("hidden", show);
  el("review-button").firstChild.textContent = show ? "Back to quiz " : "Review ";
}

function fail(message) {
  el("topic").textContent = message;
  el("hint").innerHTML = '<a href="index.html">Back to all quizzes</a>';
}

function startQuiz() {
  document.title = QUIZ.title + " Prep Quiz";
  turns = QUIZ.turns;
  el("window").textContent = ROLLING_WINDOW;
  run = newRun();
  renderTurn();
}

function loadQuiz(dir) {
  if (!dir) { fail("No quiz selected."); return; }
  if (!QUIZ_DIR_PATTERN.test(dir)) { fail("No quiz named \"" + dir + "\"."); return; }
  var script = document.createElement("script");
  script.src = dir + "/quiz.js";
  script.onload = startQuiz;
  script.onerror = function () { fail("Couldn't load " + script.src + "."); };
  document.body.appendChild(script);
}

document.addEventListener("keydown", function (e) {
  var n = parseInt(e.key, 10);
  if (!(n >= 1) || reviewing()) return;
  var b = el("statements").children[n - 1];
  if (b) b.click();
});

el("review-button").addEventListener("click", toggleReview);
el("review-back").addEventListener("click", toggleReview);
loadQuiz(new URLSearchParams(location.search).get("quiz"));
