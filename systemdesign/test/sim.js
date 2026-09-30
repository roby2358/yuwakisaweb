// LOAD BEARING — headless playtest.
//
//   node test/sim.js                 every brief, one run each
//   node test/sim.js feed --verbose  one brief, with a running commentary
//   node test/sim.js --seeds 5       five seeds per brief
//
// The bot plays from Guru.nextBuy, so this is not a separate opinion about the
// game: it is the game's own advice, executed. If a tuning change makes the
// advice wrong, the bot stops winning and this file says so.
//
// Three things are asserted and must stay true:
//   1. sensible play wins every service
//   2. the same play WITHOUT the connection pooler does not
//   3. every finished design is five to seven boxes — more than that is a
//      shopping list, and the whole point of the board is that it is a design
// Anything else printed here is for eyeballing balance.

const path = require('path');
const dir = f => path.join(__dirname, '..', f);
const Content = require(dir('memos.js'));
const Engine = require(dir('engine.js'));
const Guru = require(dir('guru.js'));
const Score = require(dir('score.js'));
const Fmt = require(dir('format.js'));

const MAX_T = 1500;         // twenty-ish minutes of game time is a long run
const BUY_EVERY = 0.6;      // the bot considers a purchase this often

function play(scenario, seed, options) {
  const state = Engine.createState(seed);
  Engine.applyScenario(state, scenario);
  const log = [];
  // Design first. The bot builds the smallest thing that can serve this
  // workload — which is what the guru advises before there is any traffic —
  // and then goes live.
  while (!state.live) {
    const key = Guru.nextBuy(state);
    if (!key || options.skip.includes(key) || !Engine.buy(state, key).ok) break;
  }
  Engine.goLive(state);
  let nextBuy = 0;
  while (!state.outcome && state.t < MAX_T) {
    Engine.tick(state);
    if (state.t < nextBuy) continue;
    nextBuy = state.t + BUY_EVERY;
    const undo = Guru.nextUndo(state);
    if (undo) Engine.scaleDown(state, undo);
    const key = Guru.nextBuy(state);
    if (!key) {
      // no purchase advised — the guru may still be saying "turn something off"
      const off = Guru.advise(state).cards[0];
      if (off && off.key === 'brokeAndIdle') {
        const shrink = Guru.nextScaleDown(state);
        if (shrink) Engine.scaleDown(state, shrink);
      }
      continue;
    }
    if (options.skip.includes(key)) continue;
    const res = Engine.buy(state, key);
    if (res.ok && options.verbose) {
      log.push(state.t.toFixed(0) + 's  ' + key.padEnd(14)
        + ' served ' + Fmt.rate(state.report.servedRps).padStart(9)
        + '  worst ' + Fmt.pct(state.report.worstUtil).padStart(4)
        + '  err ' + Fmt.pct(state.report.errRate).padStart(4)
        + '  $' + state.report.spend.toFixed(0) + '/s'
        + '  cash ' + Fmt.money(state.cash));
    }
  }
  return { state, log };
}

const DESIGN_MAX = 7;   // a finished design is five to seven boxes

function line(state) {
  const card = Score.card(state);
  const s = Content.SCENARIOS[state.scenario];
  const stations = state.report.stations;
  return {
    board: Content.STATION_KEYS.filter(k => stations[k].relevant).length,
    built: Content.STATION_KEYS.filter(k => stations[k].owned),
    scenario: state.scenario,
    outcome: state.outcome || 'timeout',
    cause: state.deathCause || '',
    t: state.t,
    peak: state.peakServed,
    target: state.slo.targetRps,
    frac: state.peakServed / state.slo.targetRps,
    grade: card.letter,
    overall: card.overall,
    card,
    name: s.name,
  };
}

function report(rows) {
  console.log('\n  service              outcome     time   peak served / target      grade  design');
  console.log('  ' + '-'.repeat(84));
  for (const r of rows) {
    console.log('  ' + r.name.padEnd(20)
      + r.outcome.padEnd(11)
      + (r.t.toFixed(0) + 's').padStart(5) + '   '
      + (Fmt.rate(r.peak) + ' / ' + Fmt.rate(r.target)).padStart(22) + '  '
      + (Math.round(100 * r.frac) + '%').padStart(5) + '   '
      + r.grade.padStart(3) + ' (' + Math.round(100 * r.overall) + ')'
      + ('  ' + r.built.length + '/' + r.board).padStart(7)
      + (r.cause ? '  ← ' + r.cause : ''));
  }
}

function scorecard(row) {
  console.log('\n  ── ' + row.name + ' ──  ' + row.card.verdict);
  for (const l of row.card.lines) {
    console.log('     ' + l.letter.padEnd(3) + l.name.padEnd(22) + l.note);
  }
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const seedsAt = args.indexOf('--seeds');
  const seeds = seedsAt >= 0 ? Number(args[seedsAt + 1]) : 1;
  const only = args.filter(a => Content.SCENARIOS[a]);
  const list = only.length ? only : Content.SCENARIO_KEYS;

  const rows = [];
  for (const key of list) {
    for (let i = 0; i < seeds; i++) {
      const { state, log } = play(key, 1234 + i * 977, { skip: [], verbose });
      if (verbose) {
        console.log('\n=== ' + Content.SCENARIOS[key].name + ' (seed ' + i + ') ===');
        log.forEach(l => console.log('  ' + l));
      }
      rows.push(line(state));
    }
  }
  report(rows);
  rows.filter((r, i) => only.length || i % seeds === 0).forEach(scorecard);

  // --- the two assertions ---------------------------------------------------
  const losses = rows.filter(r => r.outcome !== 'won');
  const pooled = play('feed', 4242, { skip: [], verbose: false }).state;
  const unpooled = play('feed', 4242, { skip: ['pooler'], verbose: false }).state;

  console.log('\n  pooler check:  with = ' + (pooled.outcome || 'timeout')
    + ' @ ' + Fmt.rate(pooled.peakServed)
    + '   without = ' + (unpooled.outcome || 'timeout')
    + ' @ ' + Fmt.rate(unpooled.peakServed));

  const problems = [];
  if (losses.length) {
    problems.push('sensible play failed to win: '
      + losses.map(r => r.scenario + ' (' + r.outcome + (r.cause ? '/' + r.cause : '') + ')').join(', '));
  }
  if (unpooled.peakServed > 0.6 * pooled.peakServed) {
    problems.push('skipping the pooler barely hurt — the connection lesson is not biting');
  }
  const sprawl = rows.filter(r => r.built.length > DESIGN_MAX);
  if (sprawl.length) {
    problems.push('a finished design grew past ' + DESIGN_MAX + ' boxes: '
      + sprawl.map(r => r.scenario + ' built ' + r.built.length
        + ' (' + r.built.map(k => Content.STATIONS[k].short).join(' ') + ')').join(', '));
  }
  if (!problems.length) {
    const widest = rows.reduce((a, r) => Math.max(a, r.built.length), 0);
    console.log('\n  OK — every service is winnable with the guru\'s own advice,'
      + ' and the widest design is ' + widest + ' boxes.\n');
    return;
  }
  console.log('');
  problems.forEach(p => console.log('  FAIL  ' + p));
  console.log('');
  process.exitCode = 1;
}

main();
