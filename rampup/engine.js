// Shared quiz engine. quiz.html?quiz=<dir> loads <dir>/quiz.js, which defines QUIZ.
//
// Vocabulary (matches README.md):
//   quiz      — one subject: { title, turns }, living in its own directory
//   turn      — { topic, good, neutral, bad }: a topic plus three statements
//   grade     — good / neutral / bad; what a statement is worth
//   run       — one pass through a quiz: the current turn, points earned, turns missed
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

function newRun() {
  return {
    index: 0,          // current turn
    points: [],        // one entry per scored turn
    missed: [],        // { turn, picked } for turns where the first pick wasn't good
    revealed: false    // current turn has been scored
  };
}

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function formatScore(points) {
  if (points.length === 0) return "—";
  var sum = points.reduce(function (s, p) { return s + p; }, 0);
  return (sum / points.length / MAX_POINTS).toFixed(2);
}

function renderScorebar() {
  el("turn").textContent = Math.min(run.index + 1, turns.length) + " / " + turns.length;
  el("rolling").textContent = formatScore(run.points.slice(-ROLLING_WINDOW));
  el("overall").textContent = formatScore(run.points);
  el("progress-fill").style.width = (100 * run.points.length / turns.length) + "%";
}

function renderTurn() {
  var turn = turns[run.index];
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
  var turn = turns[run.index];
  run.revealed = true;
  run.points.push(GRADES[grade].points);
  if (grade !== "good") run.missed.push({ turn: turn, picked: grade });
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

function pick(grade, button) {
  if (!run.revealed) { reveal(grade, button); return; }
  if (grade === "good") advance();
}

function advance() {
  run.index++;
  if (run.index >= turns.length) { showResults(); return; }
  renderTurn();
}

function showResults() {
  renderScorebar();
  el("play").classList.add("hidden");
  el("results").classList.remove("hidden");
  el("final").textContent = "Overall " + formatScore(run.points) + " across " + run.points.length +
    " turns — " + (run.points.length - run.missed.length) + " picked good on the first try.";
  el("missed-heading").classList.toggle("hidden", run.missed.length === 0);
  var list = el("missed");
  list.innerHTML = "";
  run.missed.forEach(function (m) {
    var li = document.createElement("li");
    li.innerHTML = '<strong></strong> <em></em><p></p>';
    li.querySelector("strong").textContent = m.turn.topic;
    li.querySelector("em").textContent = "(you picked " + GRADES[m.picked].label + ")";
    li.querySelector("p").textContent = m.turn.good;
    list.appendChild(li);
  });
}

function startRun() {
  run = newRun();
  el("results").classList.add("hidden");
  el("play").classList.remove("hidden");
  renderTurn();
}

function fail(message) {
  el("topic").textContent = message;
  el("hint").innerHTML = '<a href="index.html">Back to all quizzes</a>';
}

function startQuiz() {
  document.title = QUIZ.title + " Prep Quiz";
  turns = QUIZ.turns;
  el("window").textContent = ROLLING_WINDOW;
  startRun();
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
  if (n >= 1 && !el("play").classList.contains("hidden")) {
    var b = el("statements").children[n - 1];
    if (b) b.click();
  }
});

el("restart").addEventListener("click", startRun);
loadQuiz(new URLSearchParams(location.search).get("quiz"));
