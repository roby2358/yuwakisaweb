// Validates every quiz directory: well-formed QUIZ, linked from index.html,
// and no grade is given away by statement length.
// Run: node test/quizzes.js
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var TURN_COUNT = 100;
var GRADES = ["good", "neutral", "bad"];
var TURN_FIELDS = ["topic"].concat(GRADES);
var MAX_EXTREME_SHARE = 0.45;  // most turns a grade may be longest (or shortest) in; chance gives ~1/3
var MIN_TURN_RATIO = 0.6;      // shortest statement / longest statement, per turn

function quizDirs() {
  return fs.readdirSync(ROOT).filter(function (d) {
    return fs.existsSync(path.join(ROOT, d, "quiz.js"));
  });
}

function loadQuiz(dir) {
  var sandbox = {};
  vm.runInNewContext("var QUIZ;" + fs.readFileSync(path.join(ROOT, dir, "quiz.js"), "utf8") +
    ";this.QUIZ = QUIZ;", sandbox);
  return sandbox.QUIZ;
}

function shapeErrors(quiz) {
  if (!quiz) return ["quiz.js does not define QUIZ"];
  if (typeof quiz.title !== "string" || quiz.title === "") return ["QUIZ.title is missing"];
  if (!Array.isArray(quiz.turns)) return ["QUIZ.turns is not an array"];
  var errors = [];
  if (quiz.turns.length !== TURN_COUNT) errors.push("has " + quiz.turns.length + " turns, expected " + TURN_COUNT);
  quiz.turns.forEach(function (turn, i) {
    TURN_FIELDS.forEach(function (f) {
      if (typeof turn[f] !== "string" || turn[f] === "") errors.push("turn " + (i + 1) + " is missing " + f);
    });
  });
  return errors;
}

function linkErrors(dir, quiz, indexHtml) {
  var link = '<a class="choice" href="quiz.html?quiz=' + dir + '"><span class="text">' + quiz.title + "</span></a>";
  return indexHtml.indexOf(link) === -1 ? ["index.html has no link titled \"" + quiz.title + "\" to quiz.html?quiz=" + dir] : [];
}

function lengths(turn) {
  return GRADES.map(function (grade) { return turn[grade].length; });
}

// Share of turns where grade's statement is strictly longer (sign 1) or shorter (sign -1) than both others.
function extremeShare(turns, grade, sign) {
  var i = GRADES.indexOf(grade);
  var hits = turns.filter(function (turn) {
    var ls = lengths(turn);
    return ls.every(function (l, j) { return j === i || sign * (ls[i] - l) > 0; });
  });
  return hits.length / turns.length;
}

function averageLength(turns, grade) {
  var total = turns.reduce(function (sum, turn) { return sum + turn[grade].length; }, 0);
  return Math.round(total / turns.length);
}

function percent(share) {
  return Math.round(100 * share) + "%";
}

function shareErrors(turns) {
  var errors = [];
  GRADES.forEach(function (grade) {
    var longest = extremeShare(turns, grade, 1);
    var shortest = extremeShare(turns, grade, -1);
    console.log("    " + grade + ": average length " + averageLength(turns, grade) +
      ", longest in " + percent(longest) + ", shortest in " + percent(shortest));
    if (longest > MAX_EXTREME_SHARE) errors.push(grade + " is the longest statement in " + percent(longest) + " of turns (max " + percent(MAX_EXTREME_SHARE) + ")");
    if (shortest > MAX_EXTREME_SHARE) errors.push(grade + " is the shortest statement in " + percent(shortest) + " of turns (max " + percent(MAX_EXTREME_SHARE) + ")");
  });
  return errors;
}

function unevenTurnErrors(turns) {
  var errors = [];
  turns.forEach(function (turn, i) {
    var ls = lengths(turn);
    var ratio = Math.min.apply(null, ls) / Math.max.apply(null, ls);
    if (ratio < MIN_TURN_RATIO) errors.push("turn " + (i + 1) + " (" + turn.topic + ") lengths " + ls.join("/") + " are uneven");
  });
  return errors;
}

function lengthErrors(quiz) {
  return shareErrors(quiz.turns).concat(unevenTurnErrors(quiz.turns));
}

function checkQuiz(dir, indexHtml) {
  var quiz = loadQuiz(dir);
  var shape = shapeErrors(quiz);
  if (shape.length > 0) return shape;
  return linkErrors(dir, quiz, indexHtml).concat(lengthErrors(quiz));
}

var indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
var failures = 0;
quizDirs().forEach(function (dir) {
  console.log(dir);
  var errors = checkQuiz(dir, indexHtml);
  errors.forEach(function (e) { console.log("  FAIL " + e); });
  if (errors.length === 0) console.log("  ok");
  failures += errors.length;
});
process.exit(failures === 0 ? 0 : 1);
