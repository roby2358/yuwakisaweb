// HUG OF DEATH — content: every number, request type, shop item, event and
// insight lives here. Engine and UI are generic over this data.

var Content = {}; // var, not const — engine.js re-declares it for Node require

Content.SIM = {
  DT: 0.1,                  // engine step, seconds
  TIMEOUT_MS: 900,          // client patience; latency near this fails requests
  CLIENT_CONNS_PER_APP: 15, // idle conns each app server holds without a pooler
  RPS_PER_APP_SERVER: 50,   // app servers scale with traffic automatically
  START_USERS: 40,
  RPS_PER_USER: 0.5,
  GROWTH_RATE: 0.05,        // max exponential user growth per second (rep 100):
                            // a clean system doubles its users every ~14s,
                            // which is the reaction window when a gauge crosses
                            // a threshold. Faster than this and the player
                            // cannot read, decide and click before it pegs.
  MARKET_USERS: 8000000,    // logistic cap — the internet is finite (4M RPS)
  REP_NEUTRAL: 55,          // reputation below this sheds users
  REP_SHARPNESS: 3,         // reputation ~ successFrac^3, so growth demands
                            // near-perfect service: 10% errors halves your
                            // growth rate, 20% reverses it
  REP_TAU_DOWN: 2,          // reputation crashes fast...
  REP_TAU_UP: 10,           // ...and rebuilds slowly
  ERR_CHURN: 0.35,          // users/s lost at total meltdown (churn is quadratic
                            // in error rate). With the curve above this makes
                            // error rate a real brake on demand: overload sheds
                            // the traffic causing it, so there is always a way
                            // back rather than a runaway you cannot buy out of.
  ERR_TOLERANCE: 0.02,      // users forgive errors below 2%
  BUST_USERS: 25,           // fall this low after having grown — busto
  START_CASH: 3000,         // seed runway — you burn it before revenue arrives
  MIN_INCOME: 1,            // a live customer base always trickles some cash
  WIN_RPS: 1000000,
  WIN_HOLD_S: 30,
  WIN_MAX_ERR: 0.01,
  COLLAPSE_PEAK_RPS: 1000,  // collapse-loss only applies after passing this
  COLLAPSE_FRAC: 0.05,
  BANKRUPT_CASH: -250,      // small overdraft, then the lights go out
  ANALYTICS_UNITS: 60,      // query units per analytics request
  ANALYTICS_FANOUT: 0.12,   // extra cost per EXTRA shard a report must touch.
                            // Each shard scans only its 1/N of the data, so
                            // total work is not N× — what you actually pay is
                            // coordination: touch every shard, wait for the
                            // slowest, merge. Still punishes over-sharding
                            // (64 shards ≈ 8.6× a report's cost) without
                            // making a sharded cluster instantly unaffordable.
  READ_UNITS_RAW: 10,       // unindexed read cost
  READ_UNITS_INDEXED: 1,
  WRITE_UNITS: 5,
  WRITE_INDEX_TAX: 1.2,     // indexes make writes 20% costlier
  LOOKUP_UNITS: 1,          // lookup served by SQL when no KV store
  CACHE_OPS: 120000,        // ops/s per cache node
  CACHE_HIT_BASE: 0.50,
  CACHE_HIT_PER_NODE: 0.07,
  CACHE_HIT_MAX: 0.92,
  KV_OPS: 50000,            // ops/s per KV node
  KV_LAT_MS: 2,
  WAREHOUSE_LAT_MS: 2000,   // reports are slow but never on the OLTP path
  MIGRATION_S: 20,          // shard split window
  MIGRATION_CAP: 0.6,       // capacity multiplier during migration
  MAX_UTIL: 0.98,           // hockey-stick clamp
  LAT_EMA_S: 1.5,           // latency smoothing for the connection gate
  CONN_HOLD_CAP_MS: 600,    // clients hang up; a conn is never held longer
  STALE_UTIL: 0.85,         // replica util where lag/stale reads begin
  HISTORY_DT: 0.5,
  HISTORY_LEN: 480,         // 4 minutes of chart
  EVENT_MIN_T: 90,
  EVENT_COOLDOWN: 50,
  EVENT_MIN_RPS: 200,
  EVENT_CHANCE_PER_S: 1 / 40,
};

// What counts as bad. Every gauge, probe row and status colour in the game
// reads its verdict from this table via Fmt.level(value, band) — so "82% CPU"
// is amber in exactly one place and the canvas can never disagree with the
// panel beside it. {warn, bad}; when bad > warn the metric is worse high (CPU,
// errors), when bad < warn it is worse low (hit rate, reputation).
//
// The CPU band is deliberately tighter than the point where things actually
// break: latency ≈ service ÷ (1 − utilization), so 85% is already 6.7× the
// service time. Amber at 70% is the game telling you to buy BEFORE the cliff,
// which is the entire lesson.
Content.BANDS = {
  cpu: { warn: 0.70, bad: 0.85 },
  saturation: { warn: 0.70, bad: 0.90 },  // caches, KV — no hockey stick, just full
  conns: { warn: 0.75, bad: 0.90 },
  errRate: { warn: 0.01, bad: 0.05 },
  p50: { warn: 200, bad: 500 },
  p99: { warn: 200, bad: 500 },
  staleReads: { warn: 0.01, bad: 0.05 },
  reputation: { warn: 70, bad: 55 },      // worse when low
  hitRate: { warn: 0.70, bad: 0.40 },     // worse when low
  goodput: { warn: 0.99, bad: 0.95 },     // worse when low
};

// SQL node tiers (applies to primaries and replicas alike).
//
// Two regimes, and the change between them IS the vertical wall.
//
// Tiers 1-6 are commodity: capacity doubles, run-rate doubles, price rises
// ~2.1×. Cost per unit of work is flat, so climbing is a fair trade and you
// should ride it as far as it goes. This is the honest case for vertical
// scaling — no redesign, no new failure modes, no sharding maths.
//
// Tiers 7-12 are the exotic end of the catalogue: capacity now grows 1.5× per
// step while the sticker price grows 2.5×. You can still buy your way up, and
// a player who wants to can pour a fortune into one enormous box — but each
// rung buys less and costs more, which is exactly what "prices grow faster
// than capacity" means in a real vendor's price list. The wall is no longer a
// hard stop; it is the point where money stops being the answer.
Content.TIERS = [
  { cap: 6000,    conns: 200,   run: 0.5 },
  { cap: 12000,   conns: 300,   run: 1 },
  { cap: 24000,   conns: 450,   run: 2 },
  { cap: 48000,   conns: 700,   run: 4 },
  { cap: 96000,   conns: 1000,  run: 8 },
  { cap: 192000,  conns: 1500,  run: 16 },
  // — the commodity ladder ends here; everything below is bespoke hardware —
  { cap: 288000,  conns: 2250,  run: 24 },
  { cap: 432000,  conns: 3400,  run: 36 },
  { cap: 648000,  conns: 5100,  run: 54 },
  { cap: 972000,  conns: 7600,  run: 81 },
  { cap: 1458000, conns: 11400, run: 121.5 },
  { cap: 2187000, conns: 17100, run: 182.25 },
];
Content.MAX_TIER = Content.TIERS.length;
Content.COMMODITY_TIER = 6;   // last rung where price tracks capacity
// Upgrading to tier 2..6. These MUST scale at roughly the same rate as
// capacity (~2.1× per step), because your income scales with the traffic you
// can serve — i.e. with capacity. Price them at 2.5× and each tier takes
// longer to afford than the last (38s → 95s of income) while demand doubles
// every ~14s, so vertical scaling becomes mathematically unreachable and the
// player is pinned watching red gauges. Playtest found exactly that.
// Price to reach tier 2..MAX_TIER. Through the commodity ladder these track
// capacity (~2.1× per step) so each tier stays about as affordable as the last
// — see the note above; pricing them steeper than capacity makes vertical
// scaling mathematically unreachable and pins the player watching red gauges.
// Past tier 6 they deliberately outrun capacity (2.5× price for 1.5× work).
Content.TIER_PRICES = [180, 380, 800, 1700, 3600, 9000, 22500, 56000, 140000, 350000, 875000];

// Ceilings are set high enough that a player can massively over-buy any one of
// them — that is the point. Over-provisioning has to be REACHABLE for its cost
// to be a lesson: a cache stops gaining hit rate after ~7 nodes but keeps
// billing, replicas past the write-replay point are expensive copies, and
// every extra shard makes reports dearer. The game should let you find that
// out by doing it, not by being told you cannot.
Content.MAX_SHARDS = 128;
Content.MAX_REPLICAS = 8;
Content.MAX_CACHE = 16;
Content.MAX_KV = 80;

// Request types — data-driven; the engine dispatches on this table.
// desc characterizes each class along the axes that matter for capacity
// planning: rate, payload size, repeated vs unique, latency expectation.
Content.TYPES = {
  read: {
    label: 'READ', color: '#4ea3ff', baseMs: 5,
    desc: 'Content fetches — small payloads, high rate, users expect <100ms. Splits into repeated (cacheable) and unique (always reaches the database).',
  },
  write: {
    label: 'WRITE', color: '#ff9d3c', baseMs: 10,
    desc: 'Unique small mutations — every one is new data, so nothing can be cached. Must reach the owning primary. Only sharding scales these.',
  },
  lookup: {
    label: 'LOOKUP', color: '#43d17a', baseMs: 2,
    desc: 'Tiny key→value hits — sessions, flags, counters. Huge rate, trivial size, sub-10ms expected. No joins needed: perfect NoSQL fodder.',
  },
  analytics: {
    label: 'ANALYTICS', color: '#b48cff', baseMs: 120,
    desc: 'Large scans and joins — low rate but enormous per-query work, slow by nature. Users tolerate seconds; your OLTP path does not.',
  },
};
Content.TYPE_KEYS = ['read', 'write', 'lookup', 'analytics'];

// Display classes for the workload mix bar, ordered by the architecture that
// answers each one: shards → replicas/shards → cache → KV → warehouse. READ
// splits by repetition, because only the repeated part is ever cacheable, and
// that split is the difference between a cache that pays and a cash sink.
// share() takes the live per-type fractions of current demand.
Content.MIX_CLASSES = [
  {
    key: 'write', label: 'WRITE', color: '#ff9d3c',
    share: (state, live) => live.write,
    desc: 'Unique small mutations — every one is new data, so nothing can be cached and every one must reach the owning primary. Only sharding scales these.',
  },
  {
    key: 'readUnique', label: 'READ · unique', color: '#2b608f',
    share: (state, live) => live.read * (1 - state.repetition),
    desc: 'Long-tail reads nobody asks for twice — a cache would miss on every one. High rate, small payloads, and they always land on the database: this is what replicas and shards are for.',
  },
  {
    key: 'readRepeat', label: 'READ · repeated', color: '#4ea3ff',
    share: (state, live) => live.read * state.repetition,
    desc: 'The same hot rows over and over — the only traffic a cache can absorb. Every point of hit rate here is load your database never sees. A big share means buy cache; a small one means cache is a cash sink.',
  },
  {
    key: 'lookup', label: 'LOOKUP', color: '#43d17a',
    share: (state, live) => live.lookup,
    desc: 'Tiny key→value hits — sessions, flags, counters. Huge rate, trivial size, sub-10ms expected, no joins needed: perfect NoSQL fodder.',
  },
  {
    key: 'analytics', label: 'ANALYTICS', color: '#b48cff',
    share: (state, live) => live.analytics,
    desc: 'Large scans and joins — low rate but enormous per-query work, slow by nature, never cacheable. Users tolerate seconds; your transaction path does not. This is what a warehouse is for.',
  },
];

// Workload profiles — one is rolled (with jitter) at the start of each run.
// The mix IS the level design: it decides which architecture carries the game.
// repetition = how much of the read traffic is the same rows again and again.
// It scales the achievable cache hit rate: high repetition makes the cache the
// centerpiece; low repetition makes it a cash sink.
// Analytics is a SMALL share of requests everywhere (0.8%-10%) but each one
// costs 60x a point read, so it is still a large share of the WORK. That
// asymmetry is the point: request counts lie, work is what fills a cluster.
// Do not raise these shares — at 5%+ analytics dominates cluster work in every
// profile, the warehouse becomes the only correct answer everywhere, and the
// workload differentiation this whole design rests on quietly stops existing.
// revenue = dollars per served request. Unit economics differ by business:
// a B2B dashboard hit is worth 2× a telemetry ping — which is what pays for
// the heavier queries those workloads demand.
Content.PROFILES = {
  feed: {
    name: 'Social photo feed', repetition: 1.0, revenue: 0.006,
    blurb: 'Everyone stares at the same hot content — highly repeated reads. Cache hit ratio is your whole ballgame.',
    mix: { read: 0.740, write: 0.12, lookup: 0.132, analytics: 0.008 },
  },
  shop: {
    name: 'Flash-sale commerce', repetition: 0.8, revenue: 0.009,
    blurb: 'Product pages repeat, but carts and inventory writes don\'t. The cache helps browsing; only sharding scales checkout.',
    mix: { read: 0.500, write: 0.32, lookup: 0.160, analytics: 0.020 },
  },
  iot: {
    name: 'IoT telemetry ingest', repetition: 0.4, revenue: 0.010,
    blurb: 'A million devices never stop writing, and every read is a unique device query. A cache here is a cash sink.',
    mix: { read: 0.220, write: 0.61, lookup: 0.140, analytics: 0.030 },
  },
  ads: {
    name: 'Ad-tech exchange', repetition: 0.7, revenue: 0.006,
    blurb: 'Bid requests demand a key lookup in single-digit milliseconds. NoSQL was invented for this.',
    mix: { read: 0.320, write: 0.10, lookup: 0.572, analytics: 0.008 },
  },
  saas: {
    name: 'B2B analytics SaaS', repetition: 0.6, revenue: 0.013,
    blurb: 'Customers live in their own dashboards — reads repeat per tenant, and reports are most of the work. OLTP vs OLAP is the war.',
    mix: { read: 0.520, write: 0.16, lookup: 0.220, analytics: 0.100 },
  },
};
Content.PROFILE_KEYS = Object.keys(Content.PROFILES);
Content.MIX_JITTER = 0.4; // each share scaled by 0.8–1.2 before normalizing

// ---------------------------------------------------------------------------
// Shop — each item is one interview talking point.
//
// Run-rate is deliberately TWO numbers, because that is how operations really
// bills you:
//   fixed    — $/s the moment you own ANY of it: the team who knows it, the
//              dashboards, the alert rotation, the runbooks, the 3am pages.
//              This is a step function. A second datastore costs a team.
//   marginal — $/s per additional node. Usually small: once you run the thing,
//              running more of it is mostly hosting.
// That gap is the whole lesson: adding your first KV store is expensive,
// adding its tenth node is cheap.
//
// price(state) → dollars, or null when owned/maxed. apply(state) mutates infra.
// owned(state) gates the fixed cost. scaleDown(state) gives it back.
Content.SHOP = [
  {
    key: 'indexes', name: 'Add indexes', color: '#8b96a5',
    blurb: 'Reads cost 10 units → 1. The cheapest 10× you will ever buy.',
    tradeoff: 'Writes get ~20% costlier (index maintenance).',
    price: s => s.infra.indexes ? null : 60,
    apply: s => { s.infra.indexes = true; },
    owned: s => s.infra.indexes,
    fixed: 0.5, fixedNote: 'schema review, bloat monitoring, the occasional REINDEX',
    marginal: () => 0,
    ownedLabel: s => s.infra.indexes ? 'installed' : null,
    canScaleDown: s => s.infra.indexes,
    scaleDown: s => { s.infra.indexes = false; },
    scaleDownLabel: 'drop indexes (writes get cheaper, reads 10× dearer)',
    insightOnBuy: 'indexes',
  },
  {
    key: 'pooler', name: 'Connection pooler', color: '#5fd3c4',
    blurb: 'Connections held only while a query runs, not while clients idle.',
    tradeoff: 'None. That is the lesson — people forget the free win.',
    price: s => s.infra.pooler ? null : 120,
    apply: s => { s.infra.pooler = true; },
    owned: s => s.infra.pooler,
    fixed: 2, fixedNote: 'one more hop to monitor, and pool-exhaustion alerts',
    marginal: () => 0,
    ownedLabel: s => s.infra.pooler ? 'installed' : null,
    canScaleDown: () => false,
    scaleDown: null,
    scaleDownLabel: null,
  },
  {
    key: 'tier', name: 'Bigger boxes (vertical)', color: '#4ea3ff',
    blurb: '2× query units and more connections on every SQL node.',
    tradeoff: 'Fair value to tier 6; past that each rung buys 1.5× the work for 2.5× the money.',
    price: s => s.infra.tier >= Content.MAX_TIER ? null : Content.TIER_PRICES[s.infra.tier - 1],
    apply: s => { s.infra.tier += 1; },
    owned: () => true, // you always have a database
    fixed: 4, fixedNote: 'DBAs, backups, failover drills, the on-call rotation',
    marginal: s => s.infra.shards * (1 + s.infra.replicas) * Content.TIERS[s.infra.tier - 1].run,
    ownedLabel: s => 'tier ' + s.infra.tier + ' / ' + Content.MAX_TIER,
    canScaleDown: s => s.infra.tier > 1,
    scaleDown: s => { s.infra.tier -= 1; },
    scaleDownLabel: 'downgrade to a smaller (cheaper) box',
  },
  {
    key: 'replica', name: 'Read replica (per shard)', color: '#7bb7ff',
    blurb: 'One more read-serving copy of every shard — and every node it adds raises the cluster connection limit too.',
    tradeoff: 'Each replica replays ALL writes; lags (stale reads) when hot.',
    price: s => s.infra.replicas >= Content.MAX_REPLICAS ? null : 250 * s.infra.shards,
    apply: s => { s.infra.replicas += 1; },
    owned: s => s.infra.replicas > 0,
    fixed: 3, fixedNote: 'lag dashboards, failover runbooks, read-your-writes bugs',
    marginal: () => 0, // the nodes themselves are billed under the SQL cluster
    ownedLabel: s => s.infra.replicas + ' per shard',
    insightOnBuy: 'nodeheadroom',
    canScaleDown: s => s.infra.replicas > 0,
    scaleDown: s => { s.infra.replicas -= 1; },
    scaleDownLabel: 'retire one replica per shard',
  },
  {
    key: 'cache', name: 'Cache node', color: '#e3b341',
    blurb: 'Serves repeated reads in ~1ms. Hit rate climbs to 92% max.',
    tradeoff: 'Writes invalidate entries; a cold cache is a thundering herd.',
    price: s => s.infra.cacheNodes >= Content.MAX_CACHE ? null : 150,
    apply: s => { s.infra.cacheNodes += 1; },
    owned: s => s.infra.cacheNodes > 0,
    fixed: 8, fixedNote: 'invalidation bugs, eviction tuning, cold-start incidents',
    marginal: s => s.infra.cacheNodes * 2,
    ownedLabel: s => s.infra.cacheNodes ? s.infra.cacheNodes + ' nodes' : null,
    canScaleDown: s => s.infra.cacheNodes > 0,
    scaleDown: s => { s.infra.cacheNodes -= 1; },
    scaleDownLabel: 'retire a cache node (all of them = no cache team)',
  },
  {
    key: 'kv', name: 'NoSQL KV store node', color: '#43d17a',
    blurb: 'Sessions & flags (LOOKUP) leave SQL forever. Scales linearly.',
    tradeoff: 'Key→value only: no joins, no transactions. ANALYTICS stays on SQL.',
    price: s => s.infra.kvNodes >= Content.MAX_KV ? null : 100,
    apply: s => { s.infra.kvNodes += 1; },
    owned: s => s.infra.kvNodes > 0,
    fixed: 28, fixedNote: 'a SECOND datastore: new expertise, new oncall, new failure modes',
    marginal: s => s.infra.kvNodes * 1.5,
    ownedLabel: s => s.infra.kvNodes ? s.infra.kvNodes + ' nodes' : null,
    canScaleDown: s => s.infra.kvNodes > 0,
    scaleDown: s => { s.infra.kvNodes -= 1; },
    scaleDownLabel: 'retire a KV node (all of them = one less system to run)',
    insightOnBuy: 'nosql',
  },
  {
    key: 'shard', name: 'Shard split (×2)', color: '#ff9d3c',
    blurb: 'Split every table across twice as many primaries. Writes finally scale.',
    tradeoff: 'ANALYTICS fans out to every shard; 20s migration at 60% capacity.',
    price: s => s.infra.shards >= Content.MAX_SHARDS ? null : 400 * s.infra.shards,
    apply: s => {
      s.infra.shards *= 2;
      s.migration = { left: Content.SIM.MIGRATION_S };
    },
    owned: s => s.infra.shards > 1,
    fixed: 6, fixedNote: 'rebalancing, hot-shard hunts, cross-shard query reviews',
    marginal: s => 2 * (s.infra.shards - 1),
    ownedLabel: s => s.infra.shards + (s.infra.shards > 1 ? ' shards' : ' shard'),
    canScaleDown: () => false, // sharding is a one-way door
    scaleDown: null,
    scaleDownLabel: null,
    insightOnBuy: 'sharding',
  },
  {
    key: 'warehouse', name: 'Analytics warehouse (OLAP)', color: '#b48cff',
    blurb: 'Reports run on a columnar copy, off the transaction path entirely.',
    tradeoff: 'Reports take seconds (batch-fed), and the thing is not cheap to run.',
    price: s => s.infra.warehouse ? null : 1800,
    apply: s => { s.infra.warehouse = true; },
    owned: s => s.infra.warehouse,
    fixed: 24, fixedNote: 'a data team, an ETL pipeline, and everything it breaks on',
    marginal: () => 0,
    ownedLabel: s => s.infra.warehouse ? 'running' : null,
    canScaleDown: s => s.infra.warehouse,
    scaleDown: s => { s.infra.warehouse = false; },
    scaleDownLabel: 'shut down the warehouse (reports go back on SQL)',
    insightOnBuy: 'olap',
  },
  {
    key: 'queue', name: 'Write queue', color: '#f0883e',
    blurb: 'Write overflow becomes backlog instead of errors.',
    tradeoff: 'Backlog is staleness debt — users see old data until it drains.',
    price: s => s.infra.writeQueue ? null : 200,
    apply: s => { s.infra.writeQueue = true; },
    owned: s => s.infra.writeQueue,
    fixed: 12, fixedNote: 'brokers to run, replay tooling, and backlog pages at 3am',
    marginal: () => 0,
    ownedLabel: s => s.infra.writeQueue ? 'installed' : null,
    canScaleDown: s => s.infra.writeQueue,
    scaleDown: s => { s.infra.writeQueue = false; },
    scaleDownLabel: 'decommission the queue (overflow errors again)',
  },
];
Content.SHOP_BY_KEY = {};
for (const item of Content.SHOP) Content.SHOP_BY_KEY[item.key] = item;

// ---------------------------------------------------------------------------
// Events. Milestone events fire once at a served-RPS threshold; random events
// roll after EVENT_MIN_T with a cooldown. `needs` gates events that only make
// sense against existing infrastructure.
Content.EVENTS = {
  hn: {
    name: 'Hacker News frontpage', icon: '🔥',
    blurb: 'The original hug of death. 5× traffic, almost all reads.',
    milestoneRps: 1000, dur: 30, trafficMult: 5, mixMult: { read: 2 },
  },
  blackfriday: {
    name: 'Black Friday', icon: '🛒',
    blurb: '3× traffic and everyone is writing orders.',
    milestoneRps: 100000, dur: 60, trafficMult: 3, mixMult: { write: 2 },
  },
  connStorm: {
    name: 'Bad deploy — connection storm', icon: '⚡',
    blurb: 'Every app server reconnects at once.',
    dur: 15, random: true, stormMult: 8,
  },
  hotKey: {
    name: 'Celebrity signup — hot key', icon: '⭐',
    blurb: 'One row is 90% of traffic. Hot keys do not spread across nodes.',
    dur: 20, random: true, cacheCapOne: true,
    needs: s => s.infra.cacheNodes >= 2,
    insight: 'hotkey',
  },
  reportDay: {
    name: 'Report day', icon: '📊',
    blurb: 'Finance is running quarter-end queries. On production.',
    dur: 20, random: true, mixMult: { analytics: 4 },
  },
  cacheReboot: {
    name: 'Cache reboot — thundering herd', icon: '🧊',
    blurb: 'Cache comes up cold. The full read load hits SQL at once.',
    dur: 6, random: true, hitZero: true,
    needs: s => s.infra.cacheNodes >= 1,
    insight: 'herd',
  },
  replicaDown: {
    name: 'Replica falls behind', icon: '🐌',
    blurb: 'One replica per shard stops serving while it catches up.',
    dur: 20, random: true, replicaOut: 1,
    needs: s => s.infra.replicas >= 1,
  },
  signupSurge: {
    name: 'Signup surge', icon: '📝',
    blurb: 'A campaign landed. Writes triple.',
    dur: 25, random: true, trafficMult: 1.5, mixMult: { write: 3 },
  },
};

// ---------------------------------------------------------------------------
// Insights — the collectible crib notes. `check(state)` fires experience-based
// cards; others fire from purchases (insightOnBuy) or events (insight).
Content.INSIGHTS = {
  hockey: {
    title: 'The Hockey Stick',
    text: 'Latency ≈ service time ÷ (1 − utilization). At 50% busy a 5ms query takes 10ms. At 90% it takes 50ms. At 98%, 250ms. Systems do not degrade linearly — they fall off a cliff. Capacity-plan for ~70%, alarm at 80%.',
    check: (s, r) => r.sql.primaryUtil >= 0.9 && r.p99 >= 200,
  },
  littles: {
    title: "Little's Law",
    text: 'Concurrent connections = arrival rate × time each request holds one (L = λW). 10,000 RPS holding connections 10ms each = only 100 concurrent. The same 10,000 RPS holding them 1s = 10,000 concurrent. Hold time, not traffic, is what kills you.',
    check: (s, r) => r.sql.connUsed >= 0.5 * r.sql.connCap && r.sql.connCap > 0,
  },
  connstarve: {
    title: 'Connection starvation',
    text: 'Your database refused queries at low CPU. Postgres-style databases handle a few hundred connections (each is a process with real memory); app fleets hold thousands open, mostly idle. A pooler (PgBouncer/RDS Proxy) multiplexes them onto a few dozen busy ones. Interview line: "I would put a connection pooler in front before scaling hardware."',
    check: (s, r) => r.sql.rejectRps > 1 && r.sql.primaryUtil < 0.5,
  },
  cachemath: {
    title: 'Cache math',
    text: 'A 90% hit rate means the database sees 10× fewer reads. Going 90% → 99% is another 10×. Cache hit ratio is the single highest-leverage number in a read-heavy system — but writes invalidate entries, so write-heavy traffic blunts it.',
    check: (s, r) => s.infra.cacheNodes > 0 && r.cache.hits > 4 * Math.max(1, r.cache.misses),
  },
  cacheroi: {
    title: 'A cache is only as good as your repetition',
    text: 'Your cache is stuck at a low hit rate no matter how many nodes you add — this workload just does not re-read the same rows. Caching pays when traffic is repeated; on unique-read workloads (device telemetry, long-tail search) the cache is RAM-shaped cash on fire. Measure the hit ratio before buying more of it. Interview line: "First question: what is the read/write mix, and how repeated are the reads?"',
    check: (s, r) => s.infra.cacheNodes >= 2 && r.cache.hitRate < 0.45 && r.cache.hitRate > 0
      && r.perType.read.demand > 100,
  },
  nodeheadroom: {
    title: 'A node buys two kinds of headroom',
    text: 'That replica did two things at once, and people usually only plan for the first. It added read capacity — queries can now run somewhere other than the primary. It also raised your connection ceiling, because every database node accepts its own limited set of connections, so the cluster-wide limit is per-node-limit × node count. That is why CPU and connection pressure often fall together the moment you widen a cluster, and why a system starving on connections can sometimes be cured by adding a node rather than by tuning anything. The reverse holds too: scale nodes down and you narrow both at once.',
  },
  replicawrites: {
    title: 'Replicas scale reads, not writes',
    text: 'Every replica must replay every write to stay consistent. Your replicas are spending a big slice of their capacity just keeping up with the primary. Read replicas multiply read capacity; write capacity is unchanged until you shard.',
    check: (s, r) => r.sql.replayFrac >= 0.3,
  },
  replag: {
    title: 'Replication lag',
    text: 'An overloaded replica serves the past. Users who just wrote data and read it back see it missing ("read-your-writes" violation). Fixes: read your own writes from the primary, or session-pin recent writers. Lag is the price of scaling reads asynchronously.',
    check: (s, r) => r.sql.staleFrac > 0.05,
  },
  indexes: {
    title: 'Indexes first',
    text: 'An unindexed query scans the table — O(n) pages. An index makes it O(log n): ~10× cheaper here, often 100–1000× in real life. Cost: every write must also update the index (~20% tax) and it eats storage. Almost always the first thing to fix.',
  },
  wall: {
    title: 'The vertical wall',
    text: 'You have ridden the boxes as far as they are worth riding, and it is still not enough. Vertical scaling is the best deal in systems right up until it is not: no code changes, no new failure modes, no sharding maths — take it while the price tracks the capacity. Then the curve bends. Past the commodity tier, hardware starts charging you a premium for being exotic: each step buys less work for more money, and bills it forever. Those boxes are not useless — capacity that arrives instantly is worth something when a shard split would cost you a migration under load — but you are buying time, not value. There is usually a bigger box; the question is never "does one exist?" but "is it still cheaper than changing the architecture?" Once the answer is no, everything left is horizontal — more primaries, or less work. Interview line: "I would scale vertically until the price stops tracking the capacity, and plan the shard split before that point, not after."',
    check: (s, r) => s.infra.tier >= Content.COMMODITY_TIER && r.sql.primaryUtil >= 0.85,
  },
  sharding: {
    title: 'Sharding scales writes',
    text: 'Splitting rows across N primaries by key (user_id % N) is the only way writes scale. Costs: cross-shard queries must fan out to every shard, transactions across shards get hard, and resharding means migrating data while serving traffic. Do it before you need it — a migration at 90% utilization is self-inflicted downtime.',
  },
  fanout: {
    title: 'Cross-shard fan-out',
    text: 'Your analytics queries now touch every shard and merge the results. Each shard scans only its slice, so the bill is not N× the work — it is coordination: fan out, wait for the slowest shard, merge. That overhead climbs with every split, which is why 64 shards makes a report ~8× dearer than one. Sharding made writes cheap and joins expensive. Pick shard keys so common queries stay single-shard; everything else belongs in a warehouse.',
    check: (s, r) => s.infra.shards >= 4 && !s.infra.warehouse && r.perType.analytics.demand > 0 && r.sql.analyticsUnits > 0.25 * r.sql.primaryCapTotal,
  },
  nosql: {
    title: 'NoSQL: the right tool for the boring 15%',
    text: 'Key→value stores (DynamoDB/Redis-style) shard automatically and scale linearly because they refuse to do the hard things: no joins, no multi-row transactions, no ad-hoc queries. Perfect for sessions, flags, counters. Your analytics cannot follow them there — polyglot persistence means each workload on the store shaped like it.',
  },
  olap: {
    title: 'OLTP is not OLAP',
    text: 'Row stores serve many tiny point queries; column stores scan billions of rows for one report. Running reports on the transaction database is how Report Day takes down checkout. Ship changes to a warehouse (ETL/CDC) and let reports be seconds slow — nobody joins a table mid-purchase.',
  },
  queuedebt: {
    title: 'Queues turn failure into debt',
    text: 'The write queue absorbed a burst your primaries could not: nothing errored, but the backlog is data your users cannot see yet. A queue converts overload from failures into staleness — strictly better, but it is debt with interest, not free capacity. Watch drain rate vs arrival rate.',
    check: (s, r) => s.infra.writeQueue && s.backlog > 0 && s.backlogAge > 3,
  },
  herd: {
    title: 'Thundering herd',
    text: 'When a cache dies, every request that would have hit it arrives at the database simultaneously — a load spike equal to your full hit rate. Real mitigations: staggered TTLs, cache warming, request coalescing ("only one miss per key refills"). A cache big enough to save your DB is big enough to kill it.',
  },
  observability: {
    title: 'The four golden signals',
    text: 'Hover any component to interrogate it. Every box in an architecture should answer the same four questions (Google SRE\'s golden signals): TRAFFIC — how much is arriving? LATENCY — how long does it take, at p50 AND p99? ERRORS — how many fail, and from which cause? SATURATION — how full is the constrained resource? Two older framings say the same thing from different ends: RED (Rate, Errors, Duration) for services you call, USE (Utilization, Saturation, Errors) for resources you own. If you cannot answer all four for a component, you cannot debug it at 3am — and in an interview, "what would you monitor?" is really "do you know what constrains this?"',
    check: (s, r) => r.demandRps > 4000 && s.infra.indexes && s.infra.pooler,
  },
  opex: {
    title: 'Every system you add costs a team',
    text: 'Look at your burn: most of it is not hosting. Each distinct system carries a fixed operational cost the moment it exists — someone has to know it, monitor it, page on it, and be the one who fixes it at 3am. That cost is a step function, not a slope: your first KV node is expensive, your tenth is cheap. This is the real argument against "just add Redis/Kafka/Mongo for this one feature". Interview line: "What is the operational cost of a second datastore, and is this feature worth a team?"',
    check: (s, r) => r.costs && r.costs.fixed > 0.45 * r.spend && r.spend > 25,
  },
  runway: {
    title: 'Burn rate and runway',
    text: 'You are spending faster than you earn, and the runway counter is the only thing between you and the door. Idle capacity bills you every second whether traffic uses it or not — over-provisioning is not "safe", it is expensive insurance. The fix is either more served traffic (revenue) or less architecture (burn): shut down what is not carrying its weight.',
    check: (s, r) => r.spend > r.income && s.cash < 25 * (r.spend - r.income) && s.t > 60,
  },
  hotkey: {
    title: 'Hot keys',
    text: 'One celebrity row gets 90% of traffic, and hashing sends every request for it to the same node — adding nodes does nothing. Fixes: replicate the hot key to every node, or cache it in the app layer. Any "shard by key" design question deserves the follow-up: what about skew?',
  },
};
Content.INSIGHT_KEYS = Object.keys(Content.INSIGHTS);

if (typeof module !== 'undefined') module.exports = Content;
