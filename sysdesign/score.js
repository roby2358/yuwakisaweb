// LOAD BEARING — score: the architecture review, written from the run.
//
// Everything here reads the accumulators Engine kept while the run happened,
// never the final screenshot. A system that was right for the last ten seconds
// and wrong for the previous four minutes should not grade like a good answer,
// because in the room it would not sound like one.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./memos.js');
  var Fmt = require('./format.js');
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

  // The brief, line by line: each promise the intro named, met or not, with the
  // measured reason. Same accumulators as the rubric — but where the rubric
  // grades how you worked, this answers whether the system did what it said.
  function requirements(state) {
    const slo = state.slo;
    const run = state.run;
    const won = state.outcome === 'won';
    const att = frac(run.servedFast, run.servedAll);
    const budgetSpent = state.budget.spentFrac;
    const costRatio = run.spendPeak / slo.costCeiling;
    const broke = key => Object.keys(run.violations).filter(v => v.includes(key));

    const rows = [];
    rows.push({
      label: 'scale', target: Fmt.rate(slo.targetRps),
      met: won,
      why: won
        ? 'held ' + Fmt.rate(slo.targetRps) + ' for the full '
          + Content.SIM.WIN_HOLD_S + ' seconds'
        : state.peakServed >= slo.targetRps
          ? 'reached the target but never held it for ' + Content.SIM.WIN_HOLD_S + ' seconds'
          : 'peaked at ' + Fmt.rate(state.peakServed) + ' — '
            + Math.round(100 * frac(state.peakServed, slo.targetRps)) + '% of target',
    });
    rows.push({
      label: 'p99', target: slo.p99Ms + 'ms',
      met: att >= 0.99,
      why: Math.round(100 * att) + '% of served requests came back inside '
        + slo.p99Ms + 'ms' + (att >= 0.99 ? '' : ' — the tail was the product'),
    });
    rows.push({
      label: 'availability', target: (100 * slo.availability).toFixed(2) + '%',
      met: budgetSpent <= 1,
      why: budgetSpent <= 1
        ? 'spent ' + Math.round(100 * budgetSpent) + '% of the error budget'
        : 'overspent the error budget ' + budgetSpent.toFixed(1)
          + '× — every failure past the allowance broke the promise',
    });
    rows.push({
      label: 'cost', target: '$' + slo.costCeiling + '/s',
      met: costRatio <= 1,
      why: 'peak burn ' + Fmt.moneyRate(run.spendPeak) + ' against the $'
        + slo.costCeiling + '/s ceiling'
        + (costRatio <= 1 ? '' : ' — the business would not have signed'),
    });
    const staleness = broke('stale').concat(broke('idempotency'));
    rows.push({
      label: 'consistency', target: slo.consistency,
      met: slo.consistency !== 'strong' || staleness.length === 0,
      why: slo.consistency !== 'strong'
        ? 'eventual was acceptable — caches, replicas and queues were free to be stale'
        : staleness.length === 0
          ? 'no stale replica reads served, no acked write at risk of applying twice'
          : staleness.join('; '),
    });
    const leaked = broke('durable media');
    rows.push({
      label: 'durability', target: slo.durable ? 'required' : 'best effort',
      met: !slo.durable || leaked.length === 0,
      why: !slo.durable
        ? 'best effort was acceptable — nothing here was irreplaceable'
        : leaked.length === 0
          ? (state.infra.objstore
            ? 'durable objects lived in real storage, not a table'
            : 'media volume never reached the point of risk')
          : leaked[0],
    });
    return rows;
  }

  // The subsystems the mix implied, versus the ones on the board. Three honest
  // outcomes per entry: built and needed, needed and never built, or built for
  // a workload that had nothing to send it. Entries that were neither needed
  // nor built are silence — correctly skipping a box is not a line item.
  function subsystems(state) {
    const rows = [];
    for (const e of Content.EXPECTED) {
      const item = Content.SHOP_BY_KEY[e.item];
      const share = e.classes.reduce((sum, k) => sum + (state.mix[k] || 0), 0);
      const expected = share >= e.min;
      const built = !!item.owned(state);
      if (!expected && !built) continue;
      const pct = Math.round(100 * share);
      rows.push({
        label: item.name,
        status: expected ? (built ? 'met' : 'missed') : 'overbuilt',
        why: expected
          ? (built
            ? 'built, with ' + pct + '% of the mix to serve — ' + e.need
            : 'never built, and ' + pct + '% of the mix needed it — ' + e.need)
          : 'built for a workload that sent it ' + pct
            + '% of the mix — run-rate without work to carry',
      });
    }
    return rows;
  }

  return { summary, card, requirements, subsystems };
})();

if (typeof module !== 'undefined') module.exports = Score;
