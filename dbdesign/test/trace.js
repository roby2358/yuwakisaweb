// Behavioural fingerprint of the simulation.
//
// Runs a fixed set of seeds × workload profiles through a scripted build-out
// and prints a compact trace of the report. The output is checked into
// test/trace.golden.txt, so:
//
//   node test/trace.js          # diff against the golden file; fail on drift
//   node test/trace.js --save   # accept the current behaviour as the new golden
//   node test/trace.js --print  # just print the trace
//
// This is the guard for REFACTORING: any change that is supposed to be
// structure-only must leave this byte-identical. It is not a balance
// assertion — when you deliberately retune numbers, re-run with --save and
// the diff in the commit shows exactly what the retune did to the game.

'use strict';
const fs = require('fs');
const path = require('path');
const Engine = require('../engine.js');
const Content = require('../content.js');

const GOLDEN = path.join(__dirname, 'trace.golden.txt');

// Scripted purchases: [tick, key]. Fixed so the trace exercises every lane —
// cache, KV, warehouse, replicas, shards — rather than whatever a bot decides.
const SCRIPT = [
  [20, 'indexes'], [40, 'pooler'], [80, 'tier'], [120, 'cache'], [160, 'tier'],
  [200, 'replica'], [240, 'kv'], [300, 'shard'], [360, 'warehouse'],
  [420, 'tier'], [480, 'queue'], [540, 'shard'], [600, 'cache'],
];

// 6 significant digits: tolerant of harmless float reassociation, tight enough
// that any real change in the model shows up.
const sig = n => (Number.isFinite(n) ? Number(n).toPrecision(6) : String(n));

function traceRun(seed, profile) {
  const state = Engine.createState(seed);
  Engine.applyProfile(state, profile);
  state.cash = 1e7;              // cash is not what this trace is measuring
  const script = SCRIPT.slice();
  const lines = [];
  for (let i = 1; i <= 900; i++) {
    while (script.length && script[0][0] === i) Engine.buy(state, script.shift()[1]);
    const r = Engine.tick(state);
    if (i % 60 !== 0) continue;
    lines.push([
      String(i).padStart(4),
      sig(r.demandRps), sig(r.servedRps), sig(r.failRps),
      sig(r.p50), sig(r.p99),
      sig(state.users), sig(state.reputation),
      sig(r.sql.primaryUtil), sig(r.sql.replicaUtil), sig(r.sql.connUsed),
      sig(r.cache.hitRate), sig(r.kv.rps),
      sig(r.sql.units.read), sig(r.sql.units.write),
      sig(r.sql.units.analytics), sig(r.sql.units.replay),
      sig(r.income), sig(r.spend), sig(state.backlog),
    ].join(' '));
  }
  return '## seed=' + seed + ' profile=' + profile + '\n' + lines.join('\n');
}

function trace() {
  const runs = [];
  for (const profile of Content.PROFILE_KEYS) {
    for (const seed of [7, 1234]) runs.push(traceRun(seed, profile));
  }
  return runs.join('\n\n') + '\n';
}

const mode = process.argv[2];
const text = trace();

if (mode === '--print') {
  process.stdout.write(text);
  process.exit(0);
}

if (mode === '--save') {
  fs.writeFileSync(GOLDEN, text);
  console.log('saved ' + GOLDEN + ' (' + text.split('\n').length + ' lines)');
  process.exit(0);
}

if (!fs.existsSync(GOLDEN)) {
  console.log('no golden file — run: node test/trace.js --save');
  process.exit(1);
}

const golden = fs.readFileSync(GOLDEN, 'utf8');
if (golden === text) {
  console.log('  PASS simulation trace matches test/trace.golden.txt');
  process.exit(0);
}

const a = golden.split('\n'), b = text.split('\n');
let shown = 0;
for (let i = 0; i < Math.max(a.length, b.length) && shown < 8; i++) {
  if (a[i] === b[i]) continue;
  console.log('  line ' + (i + 1) + '\n    golden: ' + a[i] + '\n    now:    ' + b[i]);
  shown++;
}
console.log('  FAIL simulation behaviour changed (--save to accept)');
process.exit(1);
