// Checks that a statement's grade can't be guessed from its wording: for each
// style feature (punctuation, causal "so", history trivia, absolutes, talk about
// the concept instead of the concept, false reassurance, "X is a ..." openers, ...),
// counts the turns where each grade's statement shows it, and fails when one
// grade shows it far more than the other two.
// Run: node test/tells.js [dir ...]   (default: every quiz directory)
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var GRADES = ["good", "neutral", "bad"];
var SKEW_RATIO = 2;         // a grade may show a feature at most this many times the others' average...
var SKEW_MIN_SHARE = 0.08;  // ...unless the excess is below this share of turns
var SKEW_MIN_TURNS = 3;     // (or below this many turns, for small sets)

var FEATURES = {
  semicolon: /;/,
  colon: /:/,
  parentheses: /\(/,
  digits: /\d/,
  causal: /\b(so|because|since|therefore|which means)\b/i,
  contrast: /\b(but|while|whereas|instead|rather|unless|though)\b/i,
  negation: /n't\b|\b(not|no|nor)\b/i,
  absolutes: /\b(always|never|only|just|every|all|any|entirely|completely)\b/i,
  hedges: /\b(can|may|might|usually|typically|generally|often|tends?)\b/i,
  history: /\b(was|were|introduced|originally|first|renamed|released|launched|shipped|years?|era|since \d)\b/i,
  naming: /\b(name|named|names|called|stands for|acronym|nickname)\b/i,
  examples: /\b(such as|e\.g\.|for example|like)\b/i,
  reference: /\b(docs|documentation|devtools|dashboard|console|common|commonly|popular|many teams)\b/i,
  meta: /\b(interviews?|interviewers?|reviewers?|code reviews?|comes? up|mentioned|you'll hear|textbook|classic|well-known|books?|IDEs?|slogan|phrase|catalog|credited|named after|people|developers|discussions?)\b/i,
  reassurance: /\b(safe|safely|fine|harmless|guaranteed|cleaner|works well)\b/i,
  definition: /^[^,;:.]{0,40}\b(is|are) (a|an|the|one)\b/i,
  manyCommas: /,[^,]*,[^,]*,/
};

function loadTurns(dir) {
  var sandbox = {};
  vm.runInNewContext("var QUIZ;" + fs.readFileSync(path.join(ROOT, dir, "quiz.js"), "utf8") +
    ";this.QUIZ = QUIZ;", sandbox);
  return sandbox.QUIZ.turns;
}

function quizDirs() {
  return fs.readdirSync(ROOT).filter(function (d) {
    return fs.existsSync(path.join(ROOT, d, "quiz.js"));
  });
}

function featureCounts(turns, pattern) {
  var counts = {};
  GRADES.forEach(function (grade) {
    counts[grade] = turns.filter(function (turn) { return pattern.test(turn[grade]); }).length;
  });
  return counts;
}

// The grade that shows the feature far more than the other two, or null.
function skewedGrade(counts, turnCount) {
  var minExcess = Math.max(SKEW_MIN_TURNS, SKEW_MIN_SHARE * turnCount);
  return GRADES.find(function (grade) {
    var others = GRADES.filter(function (g) { return g !== grade; });
    var otherAverage = (counts[others[0]] + counts[others[1]]) / 2;
    var excess = counts[grade] - otherAverage;
    return excess >= minExcess && counts[grade] >= SKEW_RATIO * otherAverage;
  }) || null;
}

// One row per feature: { feature, counts, skewed }.
function tellReport(turns) {
  return Object.keys(FEATURES).map(function (feature) {
    var counts = featureCounts(turns, FEATURES[feature]);
    return { feature: feature, counts: counts, skewed: skewedGrade(counts, turns.length) };
  });
}

function printReport(report) {
  report.forEach(function (row) {
    var counts = GRADES.map(function (g) { return g + " " + row.counts[g]; }).join(", ");
    console.log("  " + (row.skewed ? "FAIL " : "     ") + row.feature + ": " + counts +
      (row.skewed ? "  (gives away " + row.skewed + ")" : ""));
  });
  return report.filter(function (row) { return row.skewed; }).length;
}

module.exports = { tellReport: tellReport, printReport: printReport };

if (require.main === module) {
  var dirs = process.argv.length > 2 ? process.argv.slice(2) : quizDirs();
  var failures = 0;
  dirs.forEach(function (dir) {
    console.log(dir);
    failures += printReport(tellReport(loadTurns(dir)));
  });
  process.exit(failures === 0 ? 0 : 1);
}
