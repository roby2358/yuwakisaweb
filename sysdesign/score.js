// LOAD BEARING — score: the architecture review, written from the run.
//
// Everything here reads the accumulators Engine kept while the run happened,
// never the final screenshot. A system that was right for the last ten seconds
// and wrong for the previous four minutes should not grade like a good answer,
// because in the room it would not sound like one.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./memos.js');
}

var Score = (() => {
  const frac = (a, b) => (b > 0 ? a / b : 0);

  // Turn the raw run log into the handful of numbers the rubric asks about.
  function summary(state) {
    const run = state.run;
    // only the misplacements that were actually a share of the problem — a
    // trickle of work on the wrong box early on is not what went wrong
    const misfitTotal = Object.values(run.misfits).reduce((sum, v) => sum + v, 0);
    const misfits = Object.entries(run.misfits)
      .filter(([, v]) => v > 0.1 * misfitTotal)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);
    const violations = Object.keys(run.violations);
    const insightCount = Object.keys(state.insights).length;
    return {
      sloAttainment: frac(run.servedFast, run.servedAll),
      budgetSpent: Math.min(1.5, state.budget.spentFrac),
      peakServedFrac: Math.min(1, state.peakServed / state.slo.targetRps),
      proactiveFrac: run.buys > 0 ? run.buysProactive / run.buys : 0.5,
      idleFrac: 1 - frac(run.capacityUsed, run.capacityPaid),
      fitFrac: 1 - Math.min(1, frac(run.misfitUnits, run.totalUnits)),
      misfits,
      redFrac: frac(run.redTime, state.t),
      outageFrac: frac(run.outageTime, state.t),
      insightCount,
      insightFrac: insightCount / Content.INSIGHT_KEYS.length,
      violations,
      violationFrac: Math.min(1, violations.length / 3),
      obsLevel: run.obsLevel,
      spofFrac: run.liveTime > 0 ? frac(run.spofTime, run.liveTime) : 0,
      costRatio: run.spendPeak / state.slo.costCeiling,
      margin: run.incomeSum > 0 ? (run.incomeSum - run.spendSum) / run.incomeSum : -1,
    };
  }

  // One line per rubric dimension, plus the overall a reviewer writes at
  // the top. Weighting is deliberately flat: none of these is optional.
  function card(state) {
    const run = summary(state);
    const lines = Content.RUBRIC.map(dim => {
      const score = Math.max(0, Math.min(1, dim.score(run, state)));
      return {
        key: dim.key, name: dim.name, what: dim.what, score,
        letter: Content.gradeOf(score),
        note: dim.note(run, state),
      };
    });
    const overall = lines.reduce((sum, l) => sum + l.score, 0) / lines.length;
    return {
      run, lines, overall,
      letter: Content.gradeOf(overall),
      verdict: Content.VERDICTS.find(v => overall >= v.min).text,
    };
  }

  return { summary, card };
})();

if (typeof module !== 'undefined') module.exports = Score;
