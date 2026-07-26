// Headless playthrough bot for HUG OF DEATH.
// Run: node test/sim.js
// Asserts the teaching beats survive tuning changes:
//   1. sensible reactive play reaches 1M RPS and wins
//   2. skipping the pooler causes connection starvation at low CPU
//   3. the run is deterministic for a fixed seed

const Engine = require('../engine.js');
const Content = require('../content.js');
const Guru = require('../guru.js');
const { botAct } = require('./bot.js');

const S = Content.SIM;
const MAX_T = 2400;

function step(state, seconds, act) {
  const ticks = Math.round(seconds / S.DT);
  for (let i = 0; i < ticks && !state.outcome; i++) {
    Engine.tick(state);
    if (act && Math.round(state.t / S.DT) % 10 === 0) act(state);
  }
}

function summarize(state) {
  const i = state.infra;
  return `tier${i.tier} shards=${i.shards} rep=${i.replicas} cache=${i.cacheNodes} ` +
    `kv=${i.kvNodes}${i.pooler ? ' pool' : ''}${i.indexes ? ' idx' : ''}` +
    `${i.warehouse ? ' olap' : ''}${i.writeQueue ? ' q' : ''}`;
}

function runBot(seed, opts) {
  const state = Engine.createState(seed);
  if (opts.profile) Engine.applyProfile(state, opts.profile);
  let lastLog = 0;
  while (!state.outcome && state.t < MAX_T) {
    step(state, 1, s => {
      botAct(s);
      if (opts.skipPooler) s.infra.pooler = false; // the bot that "forgets" the pooler
    });
    if (!opts.quiet && state.t - lastLog >= 30) {
      lastLog = state.t;
      const r = state.report;
      console.log(
        `t=${state.t.toFixed(0).padStart(4)}s rps=${r.servedRps.toFixed(0).padStart(8)}` +
        `/${r.demandRps.toFixed(0).padStart(8)} err=${(100 * r.failRps / Math.max(1, r.demandRps)).toFixed(1).padStart(5)}%` +
        ` p99=${r.p99.toFixed(0).padStart(5)}ms cash=$${state.cash.toFixed(0).padStart(7)}` +
        ` rep=${state.reputation.toFixed(0).padStart(3)} util=${(100 * r.sql.primaryUtil).toFixed(0).padStart(3)}%` +
        ` conn=${(100 * r.sql.connUsed / Math.max(1, r.sql.connCap)).toFixed(0).padStart(3)}%  ${summarize(state)}`);
    }
  }
  return state;
}

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures++; console.log('  FAIL ' + msg); }
}

console.log('=== sensible bot (seed 7) ===');
const won = runBot(7, {});
console.log(`profile=${won.profile} outcome=${won.outcome} t=${won.t.toFixed(0)}s insights=${Object.keys(won.insights).length}`);
assert(won.outcome === 'won', 'sensible play reaches 1M RPS and wins');
assert(Object.keys(won.insights).length >= 8, `collects >=8 insights (got ${Object.keys(won.insights).length})`);
assert(won.insights.hockey, 'experiences the latency hockey stick');
assert(won.insights.replicawrites, 'sees replicas eaten by write replay');

console.log('\n=== every workload profile is winnable (seed 11) ===');
for (const key of Content.PROFILE_KEYS) {
  const s = runBot(11, { profile: key, quiet: true });
  console.log(`  ${key.padEnd(5)} outcome=${s.outcome} t=${s.t.toFixed(0)}s cache=${s.infra.cacheNodes} shards=${s.infra.shards}`);
  assert(s.outcome === 'won', `profile "${key}" winnable with workload-aware play`);
}

console.log('\n=== cache on a low-repetition workload is a cash sink (iot) ===');
{
  // no bot here: this is the player who bought cache for the wrong workload
  // and leaves it running
  const s = Engine.createState(5);
  Engine.applyProfile(s, 'iot');
  s.cash = 1e9;
  for (const k of ['indexes', 'pooler', 'cache', 'cache', 'cache']) Engine.buy(s, k);
  step(s, 400, null);
  const burn = Engine.expenses(s);
  console.log(`  hitRate=${(s.report.cache.hitRate * 100).toFixed(0)}% burn=$${burn.toFixed(1)}/s cacheroi=${!!s.insights.cacheroi}`);
  assert(s.report.cache.hitRate < 0.45, 'iot hit rate stays low no matter the node count');
  assert(s.insights.cacheroi, 'fires the cache-ROI insight');

  // ...and scaling it back down recovers the whole subsystem cost, fixed included
  while (Engine.scaleDown(s, 'cache').ok) { /* retire every node */ }
  const after = Engine.expenses(s);
  const cacheItem = Engine.shopItem('cache');
  console.log(`  after shutdown: burn=$${after.toFixed(1)}/s (saved $${(burn - after).toFixed(1)}/s)`);
  assert(s.infra.cacheNodes === 0, 'cache can be scaled down to nothing');
  assert(burn - after >= cacheItem.fixed, 'shutting it down recovers the fixed cost, not just hosting');
}

console.log('\n=== operational cost is a step function ===');
{
  const s = Engine.createState(9);
  Engine.applyProfile(s, 'feed');
  s.cash = 1e9;
  const base = Engine.expenses(s);
  Engine.buy(s, 'kv');
  const one = Engine.expenses(s);
  for (let i = 0; i < 9; i++) Engine.buy(s, 'kv');
  const ten = Engine.expenses(s);
  console.log(`  none=$${base.toFixed(1)}/s  1 node=$${one.toFixed(1)}/s  10 nodes=$${ten.toFixed(1)}/s`);
  assert(one - base > 4 * ((ten - one) / 9),
    'the first KV node costs far more than each additional one');
}

console.log('\n=== sustained meltdown plummets users to busto ===');
{
  const s = Engine.createState(11);
  Engine.applyProfile(s, 'feed');
  step(s, 240, botAct); // grow to real scale with sensible play (but not to a win)
  const peak = s.users;
  // total outage: infrastructure reset to a single tier-1 box, nobody reacts
  s.infra.tier = 1; s.infra.shards = 1; s.infra.replicas = 0;
  s.infra.cacheNodes = 0; s.infra.kvNodes = 0; s.infra.warehouse = false;
  step(s, 400, null);
  console.log(`  peak=${s.peakUsers.toFixed(0)} users=${s.users.toFixed(0)} outcome=${s.outcome} cause=${s.deathCause}`);
  assert(s.outcome === 'lost' && s.users <= Math.max(S.BUST_USERS, s.peakUsers * S.COLLAPSE_FRAC),
    'error churn drains users to bust within minutes');
}

console.log('\n=== every guru rule is reachable from a real board ===');
{
  // Build the situation each rule exists for, and check it actually says so.
  // A rule that can never fire is worse than no rule — the player is stuck
  // with no advice precisely when they need it.
  const situations = [
    { rule: 'cacheable', why: 'repeated reads, no cache',
      profile: 'feed', buys: ['indexes', 'pooler', 'tier', 'tier'], users: 60000 },
    { rule: 'cacheDud', why: 'cache on unique reads',
      profile: 'iot', buys: ['indexes', 'pooler', 'tier', 'cache', 'cache', 'cache'], users: 40000 },
    { rule: 'lookupFlood', why: 'key lookups drowning SQL, no KV',
      profile: 'ads', buys: ['indexes', 'pooler', 'tier', 'tier'], users: 90000 },
    { rule: 'writeWall', why: 'writes dominant and pegged',
      profile: 'iot', buys: ['indexes', 'pooler', 'tier', 'tier', 'warehouse'], users: 60000 },
    { rule: 'replicaBurn', why: 'replicas replaying writes',
      profile: 'iot', buys: ['indexes', 'pooler', 'tier', 'replica', 'replica', 'warehouse'], users: 40000 },
    { rule: 'staleReads', why: 'replicas lagging under load',
      profile: 'feed', buys: ['indexes', 'pooler', 'tier', 'replica'], users: 120000 },
    // Rode vertical to the end of the commodity ladder on a write-heavy
    // workload and never sharded — the exact mistake this rule exists to catch,
    // and the moment it needs catching: bigger boxes still exist, they have
    // just stopped being worth buying. Every load-deleting option is already
    // bought, so nothing cheaper is left to recommend.
    { rule: 'verticalWall', why: 'past the commodity ladder, still pegged',
      profile: 'iot', users: 150000,
      buys: ['indexes', 'pooler', ...Array(Content.COMMODITY_TIER - 1).fill('tier'),
        'warehouse', 'kv', 'replica'] },
    // and the same rule at the true ceiling, where the wording changes
    { rule: 'verticalWall', why: 'the biggest box that exists, still not enough',
      profile: 'iot', users: 2000000,
      buys: ['indexes', 'pooler', ...Array(Content.MAX_TIER - 1).fill('tier'),
        'warehouse', 'kv', 'kv', 'kv', 'replica', 'replica'] },
    { rule: 'backlog', why: 'write queue holding debt',
      profile: 'iot', buys: ['indexes', 'pooler', 'queue'], users: 90000 },
    { rule: 'connCapped', why: 'connection ceiling with a pooler',
      profile: 'feed', buys: ['indexes', 'pooler', 'tier', 'tier'], users: 200000 },
  ];
  for (const sit of situations) {
    const s = Engine.createState(4);
    Engine.applyProfile(s, sit.profile);
    s.cash = 1e7;
    for (const k of sit.buys) { Engine.buy(s, k); s.migration = null; }
    s.users = sit.users;
    // Milestone events fire the instant served RPS crosses their threshold, so
    // at these scales every board would be sitting under a 5× traffic spike.
    // Judge the architecture, not the weather.
    for (const key of Object.keys(Content.EVENTS)) s.milestonesFired[key] = true;
    step(s, 8, null);
    s.cash = 1e7; // judge the advice, not the bank balance
    const keys = Guru.advise(s, s.report).map(a => a.key);
    const hit = keys.includes(sit.rule);
    console.log(`  ${sit.rule.padEnd(13)} (${sit.why})`.padEnd(58) + (hit ? '✓' : '✗ got: ' + keys.join(',')));
    assert(hit, `guru advises on "${sit.rule}" when ${sit.why}`);
  }
}

console.log('\n=== the guru names the right first horizontal move ===');
{
  // read-heavy, primary pegged, zero replicas — the situation where the answer
  // is "add a replica", not "buy a bigger box"
  const s = Engine.createState(4);
  Engine.applyProfile(s, 'feed');
  s.cash = 1e6;
  Engine.buy(s, 'indexes'); Engine.buy(s, 'pooler');
  for (let i = 0; i < 3; i++) Engine.buy(s, 'tier');
  s.users = 120000;
  step(s, 8, null);
  const advice = Guru.advise(s, s.report);
  const rec = advice.find(a => a.key === 'needReplica');
  console.log(`  util=${(100 * s.report.sql.primaryUtil).toFixed(0)}% replicas=${s.infra.replicas} → ${advice.map(a => a.key).join(', ')}`);
  if (rec) console.log(`  “${rec.headline}”\n   → ${rec.action}`);
  assert(!!rec, 'read-heavy + pegged + no replicas recommends a read replica');

  // and buying one relieves BOTH CPU and connections
  const before = { util: s.report.sql.primaryUtil, conn: s.report.sql.connUsed / s.report.sql.connCap };
  Engine.buy(s, 'replica');
  step(s, 8, null);
  const after = { util: s.report.sql.primaryUtil, conn: s.report.sql.connUsed / s.report.sql.connCap };
  console.log(`  after one replica: CPU ${(100 * before.util).toFixed(0)}%→${(100 * after.util).toFixed(0)}%, ` +
    `connections ${(100 * before.conn).toFixed(0)}%→${(100 * after.conn).toFixed(0)}%`);
  assert(after.util < before.util && after.conn < before.conn,
    'one replica relieves CPU and connection pressure together');
  assert(s.insights.nodeheadroom, 'buying it teaches that a node buys both kinds of headroom');
}

console.log('\n=== management notices specific mistakes ===');
{
  // buy a bigger box on day one, at 4% utilization, exactly as warned against
  const s = Engine.createState(3);
  Engine.applyProfile(s, 'feed');
  s.cash = 1e6;
  step(s, 5, null);
  Engine.buy(s, 'tier');
  Engine.tick(s);
  const m = s.newMemos[0];
  console.log(`  ${m ? '“' + m.body + '” — ' + m.from + (m.title ? ', ' + m.title : '') : '(silence)'}`);
  assert(m && m.key === 'verticalEarly', 'scaling vertically on day one draws a memo');

  // and the deck is deep: distinct barbs across repeated firings
  const bodies = new Set();
  for (let i = 0; i < 8; i++) {
    s.memoLast = {}; s.lastMemoT = -999;
    Engine.buy(s, 'tier');
    s.infra.tier = 1; // reset so the purchase stays "early"
    Engine.tick(s);
    while (s.newMemos.length) bodies.add(s.newMemos.shift().body);
  }
  console.log(`  ${bodies.size} distinct barbs over 8 repeat firings`);
  assert(bodies.size >= 6, 'repeated firings draw fresh lines, not the same one');
}

console.log('\n=== pooler-skipping bot (seed 7) ===');
const starved = runBot(7, { skipPooler: true });
console.log(`outcome=${starved.outcome} t=${starved.t.toFixed(0)}s peakRps=${(starved.peakUsers * S.RPS_PER_USER).toFixed(0)}`);
assert(starved.insights.connstarve, 'hits connection starvation (rejects while CPU < 50%)');
assert(starved.outcome !== 'won' || starved.t > won.t,
  'skipping the pooler is punished (no win, or a much slower one)');

console.log('\n=== determinism (seed 7 twice) ===');
const a = runBot(7, { quiet: true }), b = runBot(7, { quiet: true });
assert(a.t === b.t && a.cash.toFixed(6) === b.cash.toFixed(6) && a.outcome === b.outcome,
  'identical seeds produce identical runs');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
