// LOAD BEARING — a readable trace of one run, and the golden file.
//
//   node test/trace.js feed              bot-played, sampled every 20s
//   node test/trace.js feed --every 5    finer grain
//   node test/trace.js feed --rich       add the money and station breakdowns
//   node test/trace.js --golden          every brief, diffed against the golden
//   node test/trace.js --golden --save   record a deliberate balance change
//
// The first three modes are the tuning instrument: demand against served, where
// the money went, and which station was fullest at each moment.
//
// --golden is the line between RETUNING and BREAKING. It replays every brief on
// a fixed seed and compares against test/trace.golden.txt. A refactor must leave
// it byte-identical. A deliberate balance change is --save, and the diff in that
// commit is an exact record of what the change did to the game.

const fs = require('fs');
const path = require('path');
const dir = f => path.join(__dirname, '..', f);
const Content = require(dir('memos.js'));
const Engine = require(dir('engine.js'));
const Guru = require(dir('guru.js'));
const Fmt = require(dir('format.js'));

const pad = (s, n) => String(s).padStart(n);

function hottest(report) {
  const live = Content.STATION_KEYS
    .filter(k => report.stations[k].owned)
    .sort((a, b) => report.stations[b].util - report.stations[a].util)[0];
  return Content.STATIONS[live].short + ' ' + Fmt.pct(report.stations[live].util);
}

function row(state) {
  const r = state.report;
  return '  ' + pad(r.t.toFixed(0) + 's', 5)
    + pad(Fmt.rate(r.demandRps), 10)
    + pad(Fmt.rate(r.servedRps), 10)
    + pad(Fmt.pct(r.errRate), 6)
    + pad(Fmt.ms(r.p99), 8)
    + pad(hottest(r), 12)
    + pad('$' + r.income.toFixed(0), 8)
    + pad('$' + r.spend.toFixed(0), 8)
    + pad(Fmt.money(state.cash), 8)
    + pad(Fmt.pct(state.budget.spentFrac), 7);
}

function moneyLine(report) {
  return report.costs.parts
    .filter(p => p.total > 0.5)
    .sort((a, b) => b.total - a.total)
    .slice(0, 7)
    .map(p => p.key + ' $' + p.total.toFixed(0))
    .join('  ');
}

function stationLine(report) {
  return Content.STATION_KEYS
    .filter(k => report.stations[k].owned && report.stations[k].util > 0.02)
    .sort((a, b) => report.stations[b].util - report.stations[a].util)
    .map(k => Content.STATIONS[k].short + ':' + Fmt.pct(report.stations[k].util))
    .join(' ');
}

// One bot-played run, emitting a line every `every` seconds. Returns the lines
// rather than printing them, so the same function feeds both the human-readable
// mode and the golden file.
function play(scenario, every, rich) {
  const state = Engine.createState(1234);
  Engine.applyScenario(state, scenario);
  const brief = Content.SCENARIOS[scenario];
  const out = [
    '',
    '  ' + brief.icon + '  ' + brief.name + ' — target ' + Fmt.rate(brief.targetRps)
      + ', p99 < ' + brief.slo.p99Ms + 'ms, ceiling $' + brief.slo.costCeiling + '/s',
    '',
    '     t    demand    served   err     p99     hottest  income   spend    cash  budget',
    '  ' + '-'.repeat(80),
  ];

  let nextBuy = 0, nextRow = 0;
  const bought = [];
  while (!state.outcome && state.t < 1500) {
    Engine.tick(state);
    if (state.t >= nextBuy) {
      nextBuy = state.t + 1.5;
      const undo = Guru.nextUndo(state);
      if (undo) Engine.scaleDown(state, undo);
      const key = Guru.nextBuy(state);
      if (key && Engine.buy(state, key).ok) bought.push(state.t.toFixed(0) + 's:' + key);
    }
    if (state.t < nextRow) continue;
    nextRow = state.t + every;
    out.push(row(state));
    if (!rich) continue;
    out.push('        $  ' + moneyLine(state.report));
    out.push('        ▪  ' + stationLine(state.report));
    if (bought.length) out.push('        +  ' + bought.join(' '));
    bought.length = 0;
  }
  out.push(row(state));
  out.push('');
  out.push('  outcome: ' + (state.outcome || 'timeout')
    + (state.deathCause ? ' (' + state.deathCause + ')' : '')
    + '   peak ' + Fmt.rate(state.peakServed) + ' of ' + Fmt.rate(state.slo.targetRps));
  return out;
}

const GOLDEN = path.join(__dirname, 'trace.golden.txt');

function golden(save) {
  const lines = Content.SCENARIO_KEYS.flatMap(key => play(key, 60, true));
  const text = lines.join('\n') + '\n';
  if (save) {
    fs.writeFileSync(GOLDEN, text);
    console.log('\n  wrote ' + GOLDEN + ' (' + lines.length + ' lines)\n');
    return;
  }
  if (!fs.existsSync(GOLDEN)) {
    console.log('\n  no golden file yet — run with --save\n');
    process.exitCode = 1;
    return;
  }
  const want = fs.readFileSync(GOLDEN, 'utf8').split('\n');
  const got = text.split('\n');
  const diffs = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] === got[i]) continue;
    diffs.push('  line ' + (i + 1) + '\n    was: ' + (want[i] || '')
      + '\n    now: ' + (got[i] || ''));
  }
  if (!diffs.length) {
    console.log('\n  OK — the trace is byte-identical to the golden file.\n');
    return;
  }
  console.log('\n  ' + diffs.length + ' line(s) changed:\n');
  diffs.slice(0, 25).forEach(d => console.log(d));
  if (diffs.length > 25) console.log('\n  ...and ' + (diffs.length - 25) + ' more');
  console.log('\n  If this was deliberate, re-record with --save and commit the diff.\n');
  process.exitCode = 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--golden')) {
    golden(args.includes('--save'));
    return;
  }
  const scenario = args.find(a => Content.SCENARIOS[a]) || 'feed';
  const everyAt = args.indexOf('--every');
  const every = everyAt >= 0 ? Number(args[everyAt + 1]) : 20;
  play(scenario, every, args.includes('--rich')).forEach(l => console.log(l));
  console.log('');
}

main();
