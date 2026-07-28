// LOAD BEARING — content: every number, traffic class, station, shop item, event,
// insight and rubric line lives here. Engine and UI are generic over this data.
//
// The shape of the simulation:
//   a CLASS of traffic walks a ROUTE of hops through STATIONS.
// A hop consumes `units` of a station's capacity, may `absorb` a fraction of the
// traffic there (a cache hit, a CDN hit), and may `ack` — meaning the user gets
// their answer at that hop and everything after it is asynchronous.
// Everything else in the game is a consequence of that walk.
//
// EIGHT boxes, and no service uses all eight.
//
// A finished system design is five to seven components; more than that is a
// shopping list, not a design. So the board only holds things that answer a
// question about what the system DOES: where content lives near users, where
// code runs, what remembers quickly, what remembers truthfully, what happens
// later, where the big files are, what answers questions the store of record
// cannot, and what answers with a model.
//
// Load balancers, DNS, connection routing, socket gateways and the rest of the
// plumbing are real and are not decisions — they are folded into the box they
// belong to. A load balancer is how a service tier has more than one instance,
// not a component you choose. Likewise a key-value store and a search index are
// engines you turn on inside a box, not new boxes: the interesting question is
// "does this query shape belong on the store of record?", and drawing it as a
// separate rectangle answers that question before you have asked it.

var Content = {}; // var, not const — engine.js re-declares it for Node require

Content.SIM = {
  DT: 0.1,                  // engine step, seconds
  START_CASH: 50000,       // seed runway — you burn it before revenue arrives.
                            // Sized so the opening design is a real choice, not
                            // a bare-bones one: enough to draw the boxes the
                            // brief implies AND pay their run-rate while the
                            // first users trickle in.
  START_USERS: 70,          // skip the stretch where nothing is happening yet
  MIN_INCOME: 3,            // a live customer base always trickles some cash

  // --- demand side ---------------------------------------------------------
  GROWTH_RATE: 0.025,       // max user growth/s at reputation 100 — doubles the
                            // user base every ~28s. This single number sets the
                            // pace of the whole game: it is the window between a
                            // gauge going amber and it pegging, so it has to be
                            // long enough to read a probe, think, and decide.
                            // Faster than this and the only viable play is
                            // pattern-matching, which is not the skill.
  REP_NEUTRAL: 55,          // reputation below this sheds users
  REP_SHARPNESS: 3,         // reputation ~ successFrac³ — growth needs near-
                            // perfect service, and overload is self-limiting
  REP_TAU_DOWN: 2,          // reputation crashes fast...
  REP_TAU_UP: 8,            // ...and rebuilds slowly
  ERR_CHURN: 0.20,          // users/s lost at total meltdown (quadratic in errors)
  ERR_TOLERANCE: 0.02,      // users forgive errors below 2%
  BUST_USERS: 25,           // fall this low after having grown — busto
  BANKRUPT_CASH: -400,
  COLLAPSE_FRAC: 0.05,      // lose this fraction of peak users → collapse
  COLLAPSE_PEAK_RPS: 3000,  // collapse-loss only applies after passing this

  // --- queueing ------------------------------------------------------------
  MAX_UTIL: 0.98,           // hockey-stick clamp
  TIMEOUT_SLACK: 4,         // a request dies at 4× the service's p99 target
  LAT_EMA_S: 1.5,           // latency smoothing for the connection gate
  CONN_HOLD_CAP_MS: 600,    // clients hang up; a conn is never held longer
  CLIENT_CONNS_PER_APP: 20, // idle conns each service instance holds, no pooler
  SHED_UTIL: 0.85,          // load shedding starts when downstream passes this
  SHED_MS: 2,               // a shed request fails FAST — that is the point

  // --- unit costs (what one request costs a station) -----------------------
  READ_UNITS_RAW: 10,       // unindexed read: a table scan
  READ_UNITS_INDEXED: 1,
  WRITE_UNITS: 5,
  WRITE_INDEX_TAX: 1.2,     // indexes make writes 20% costlier
  LOOKUP_UNITS: 1,          // a key lookup on the relational engine
  KV_LOOKUP_UNITS: 0.02,    // ...and on the partitioned key-value engine
  KV_UTIL: 0.3,             // a KV engine partitions without coordinating, so it
                            // is never the thing that is full — it just bills
  KV_PER_KRPS: 0.025,       // $/s per thousand lookups/s. Linear, forever.
  ANALYTICS_UNITS: 60,      // a report on the store of record
  ANALYTICS_FANOUT: 0.12,   // coordination cost per EXTRA shard a report touches
  SEARCH_SCAN_UNITS: 140,   // "WHERE body LIKE '%...%'" — no index can save you
  BLOB_IN_DB_UNITS: 40,     // media served out of the datastore. Do not do this.
  BLOB_IN_APP_UNITS: 6,     // ...and the bytes go through your service tier too
  POLL_UNITS: 12,           // realtime faked by polling the service tier
  PUSH_UNITS: 1.5,          // ...and delivered over a connection already open
  SOCKET_COST: 0.0002,      // $/s per connected user. A socket costs memory
                            // whether or not anybody is saying anything.
  INFER_ORCH_UNITS: 3,      // prompt assembly, retrieval glue, streaming out
  REPLAY_SHARE: 1,          // each replica replays every write of its shard

  // --- station capacities (per node, per second) ---------------------------
  EDGE_OPS: 400000,         // one PoP's request capacity
  EDGE_HIT_STATIC: 0.97,    // CDN hit rate on immutable media
  EDGE_HIT_DYNAMIC: 0.45,   // what edge compute can answer without an origin trip
  APP_UNITS: 400,           // per service instance — small on purpose: a fleet is
                            // hundreds of boxes, and each one parks connections
  APP_WARM_S: 12,           // autoscaling reacts in seconds, not instantly
  APP_HEADROOM: 2.0,        // ...and targets ~50% busy, because 100% is a cliff
  CACHE_OPS: 120000,
  CACHE_HIT_BASE: 0.55,
  CACHE_HIT_PER_DOUBLING: 0.09,
  CACHE_HIT_MAX: 0.92,
  STREAM_OPS: 40000,        // per partition
  OBJ_OPS: 90000,           // object store request rate (bytes cost money, not capacity)
  DERIVED_OPS: 9000,        // per derived-store node, shared across its engines
  SEARCH_UNITS: 1,          // an inverted-index lookup
  OLAP_UNITS: 6,            // a columnar scan — a tenth of the same report on rows
  VECTOR_UNITS: 2,          // an approximate nearest-neighbour query
  OLAP_LAT_MS: 2000,        // reports are slow, but never on the request path
  SEARCH_LAT_MS: 25,
  VECTOR_LAT_MS: 12,
  GPU_RPS: 55,              // requests/s per accelerator node, no batching
  GPU_BATCH_MULT: 3.2,      // continuous batching: throughput up...
  GPU_BATCH_MS: 90,         // ...queueing delay up
  API_RPS: 900,             // hosted inference API — a hard provider rate limit
  API_MS: 700,
  MODEL_MS: 220,            // your own fleet, large model
  SMALL_MODEL_MS: 45,       // ...and the one you route the easy majority to
  SEMANTIC_HIT: 0.38,       // share of prompts a semantic cache can answer
  ROUTER_SHARE: 0.6,        // share of prompts a small model can handle
  ROUTER_SPEEDUP: 5,        // ...at this multiple of throughput

  // --- store of record -----------------------------------------------------
  MIGRATION_S: 20,          // shard split window
  MIGRATION_CAP: 0.6,       // capacity multiplier during migration
  STALE_UTIL: 0.85,         // replica utilization where lag/stale reads begin

  // --- money ---------------------------------------------------------------
  EGRESS_PER_GB: 0.03,      // what leaving your network costs, per gigabyte
  EDGE_EGRESS_MULT: 0.25,   // bytes served from a PoP are much cheaper
  API_PER_REQ: 0.02,        // hosted inference, per request — the crossover

  // --- run structure -------------------------------------------------------
  WIN_HOLD_S: 30,
  HISTORY_DT: 1,            // the charts hold eight minutes, which is about one run
  HISTORY_LEN: 480,
  EVENT_MIN_T: 140,
  EVENT_COOLDOWN: 60,
  EVENT_MIN_RPS: 200,
  EVENT_CHANCE_PER_S: 1 / 45,
  MIX_JITTER: 0.3,          // each share scaled by 0.85–1.15 before normalizing
  RELEVANT_SHARE: 0.005,    // a box is on the board if this much traffic could use it
};

// What counts as bad. Every gauge, probe row and status colour reads its verdict
// from this table via Fmt.level(value, band), so the bar on the canvas can never
// disagree with the row in the panel beside it. {warn, bad}; when bad > warn the
// metric is worse high, when bad < warn it is worse low.
//
// The utilization band is deliberately tighter than the point where things
// break: latency ≈ service ÷ (1 − utilization), so 85% is already 6.7× the
// service time. Amber at 70% is the game telling you to buy BEFORE the cliff.
Content.BANDS = {
  util: { warn: 0.70, bad: 0.85 },
  conns: { warn: 0.75, bad: 0.90 },
  errRate: { warn: 0.01, bad: 0.05 },
  latency: { warn: 1.0, bad: 2.0 },       // as a multiple of the service's target
  budget: { warn: 0.5, bad: 0.85 },       // error budget burned
  staleReads: { warn: 0.01, bad: 0.05 },
  reputation: { warn: 70, bad: 55 },      // worse when low
  hitRate: { warn: 0.70, bad: 0.40 },     // worse when low
  redundancy: { warn: 2, bad: 1 },        // worse when low — 1 node is a SPOF
};

// The shapes of work. Not boxes — boxes are where work goes; these are what the
// work IS, and the mix of them is what makes one service unlike another.
Content.CLASS_KEYS = ['read', 'write', 'lookup', 'media', 'search', 'analytics', 'realtime', 'infer'];

// ---------------------------------------------------------------------------
// Hops. A route is a list of these. Every hop carries every field — there are
// no optional shapes, so the engine never asks what kind of hop this is.
//   units   — capacity consumed at that station per request passing through
//   absorb  — fraction served right here and returned (a hit)
//   ack     — the user's answer comes back here; later hops are asynchronous
//   offPath — nobody is waiting on this, so it stays out of the latency the
//             service is judged on (a report is slow on purpose)
const hop = (at, units) => ({ at, units, absorb: 0, ack: false, offPath: false });
const absorbAt = (at, units, frac) => ({ at, units, absorb: frac, ack: false, offPath: false });
const ackAt = (at, units) => ({ at, units, absorb: 0, ack: true, offPath: false });
const offPathAt = (at, units) => ({ at, units, absorb: 0, ack: false, offPath: true });

// ---------------------------------------------------------------------------
// Stations — the eight boxes. Each is a queueing station with a capacity in
// units/s and a service time in ms; latency is service ÷ (1 − util).
//
// `cap`, `serviceMs` and `nodes` read only infra, so the whole architecture is
// one struct and the board is a rendering of it. `nodes` is what redundancy
// means here: a box running on one node is a single point of failure, and the
// game will eventually prove it to you.
//
// `serves` is which classes of work can end up here. It decides whether the box
// is even drawn: a service with no media does not get a blob store on its
// diagram, because a real design would not have drawn one.
Content.STATIONS = {
  edge: {
    name: 'EDGE', short: 'EDGE', color: '#5fd3c4', col: 0, row: 1,
    serves: ['read', 'media'],
    desc: 'Points of presence close to your users. Cached bytes, and — once code runs there — whole responses that never travel to your origin at all. The cheapest capacity in the game is the request you never receive.',
    cap: i => i.pops * Content.SIM.EDGE_OPS,
    serviceMs: () => 8,
    nodes: i => i.pops,
    owned: i => i.pops > 0,
    idleLabel: () => 'not built',
  },
  app: {
    name: 'SERVICES', short: 'SVC', color: '#4ea3ff', col: 1, row: 1,
    serves: Content.CLASS_KEYS,
    desc: 'Your application instances. Stateless is the whole trick: any instance can serve any request, so capacity is a number you can change. Everything about getting traffic to them — balancing, health checks, routing — is a property of this box, not a decision.',
    cap: i => i.appNodes * Content.SIM.APP_UNITS,
    serviceMs: () => 8,
    nodes: i => i.appNodes,
    owned: i => i.appMax > 0,
    idleLabel: () => 'not built',
  },
  cache: {
    name: 'CACHE', short: 'CACHE', color: '#e3b341', col: 2, row: 0,
    serves: ['read', 'infer'],
    desc: 'Shared in-memory cache in front of everything slower. Absorbs repeated reads in about a millisecond; every point of hit rate is load the rest of the system never sees. It is also where a semantic cache lives, which is the cheapest inference there is.',
    cap: i => i.cacheNodes * Content.SIM.CACHE_OPS,
    serviceMs: () => 1,
    nodes: i => i.cacheNodes,
    owned: i => i.cacheNodes > 0,
    idleLabel: () => 'not built',
  },
  stream: {
    name: 'STREAM', short: 'LOG', color: '#f0883e', col: 2, row: 2,
    serves: ['write', 'realtime'],
    desc: 'A partitioned append-only log. It accepts a write in a millisecond and lets everything downstream consume it at its own pace — the datastore, the search index, the analytics copy. One write in, many derived views out.',
    cap: i => i.streamParts * Content.SIM.STREAM_OPS,
    serviceMs: () => 3,
    nodes: i => i.streamParts,
    owned: i => i.streamParts > 0,
    idleLabel: () => 'not built',
  },
  sql: {
    name: 'DATASTORE', short: 'DATA', color: '#7bb7ff', col: 3, row: 1,
    serves: Content.CLASS_KEYS,
    desc: 'The store of record. Everything here is a decision about a resource you cannot simply clone — indexes, connections, box size, replicas, shards — plus the choice of which query shapes belong on a relational engine at all.',
    cap: i => i.shards * (1 + i.replicas) * Content.tierOf(i).cap,
    serviceMs: () => 4,
    nodes: i => (i.tier === 0 ? 0 : i.shards * (1 + i.replicas) + (i.multiAz ? i.shards : 0)),
    owned: i => i.tier > 0,
    idleLabel: () => 'not built',
  },
  objstore: {
    name: 'BLOB STORE', short: 'BLOB', color: '#b0a0ff', col: 4, row: 0,
    serves: ['media'],
    desc: 'Durable object storage for media. Cheap, effectively infinite, eleven nines of durability — and an egress bill you will learn to respect, which is exactly what the edge is for.',
    cap: i => (i.objstore ? Content.SIM.OBJ_OPS * 40 : 0),
    serviceMs: () => 35,
    nodes: i => (i.objstore ? 3 : 0),
    owned: i => i.objstore,
    idleLabel: () => 'not built',
  },
  derived: {
    name: 'DERIVED STORES', short: 'DERIVED', color: '#b48cff', col: 4, row: 2,
    serves: ['search', 'analytics', 'infer'],
    desc: 'Read models built FROM the write path, each shaped for a query the store of record answers badly: an inverted index for text, a columnar copy for reports, a vector index for retrieval. They share a fleet and each costs a pipeline to keep fresh.',
    cap: i => i.derivedNodes * Content.SIM.DERIVED_OPS,
    serviceMs: (i, k) => Content.DERIVED_LAT[k],
    nodes: i => i.derivedNodes,
    owned: i => i.derivedNodes > 0,
    idleLabel: () => 'not built',
  },
  gpu: {
    name: 'INFERENCE', short: 'MODEL', color: '#ff7b72', col: 5, row: 1,
    serves: ['infer'],
    desc: 'Model serving. Either a hosted API you rent by the request, or accelerators you own and must keep busy. Every request here costs two orders of magnitude more than anything else on the board, which makes each trick that avoids one worth real money.',
    cap: i => Content.gpuCapacity(i),
    serviceMs: i => Content.gpuServiceMs(i),
    nodes: i => i.gpuNodes,
    owned: i => i.gpuNodes > 0,
    idleLabel: () => 'renting',
  },
};
Content.STATION_KEYS = Object.keys(Content.STATIONS);

// Each derived engine answers a different question and takes a different time
// doing it. A report is slow on purpose; a search is not allowed to be.
Content.DERIVED_LAT = {
  search: Content.SIM.SEARCH_LAT_MS,
  analytics: Content.SIM.OLAP_LAT_MS,
  infer: Content.SIM.VECTOR_LAT_MS,
  read: Content.SIM.SEARCH_LAT_MS, write: Content.SIM.SEARCH_LAT_MS,
  lookup: Content.SIM.SEARCH_LAT_MS, media: Content.SIM.SEARCH_LAT_MS,
  realtime: Content.SIM.SEARCH_LAT_MS,
};

// Inference capacity is two different businesses wearing the same box.
// Renting: someone else's fleet, a hard rate limit, billed per request.
// Owning: your accelerators, capacity you can grow, billed whether busy or not.
Content.gpuCapacity = i => {
  if (i.gpuNodes === 0) return Content.SIM.API_RPS;
  const batch = i.batching ? Content.SIM.GPU_BATCH_MULT : 1;
  const router = i.router
    ? (1 - Content.SIM.ROUTER_SHARE) + Content.SIM.ROUTER_SHARE * Content.SIM.ROUTER_SPEEDUP
    : 1;
  return i.gpuNodes * Content.SIM.GPU_RPS * batch * router;
};

Content.gpuServiceMs = i => {
  if (i.gpuNodes === 0) return Content.SIM.API_MS;
  const S = Content.SIM;
  // a small model is not just cheaper, it is faster — routing moves the whole
  // latency distribution, which is why it can rescue a tight deadline
  const base = i.router
    ? (1 - S.ROUTER_SHARE) * S.MODEL_MS + S.ROUTER_SHARE * S.SMALL_MODEL_MS
    : S.MODEL_MS;
  return base + (i.batching ? S.GPU_BATCH_MS : 0);
};

// Datastore node tiers. Two regimes, and the change between them IS the
// vertical wall. Tiers 1-6 are commodity: capacity doubles, price rises ~2.1×,
// so cost per unit of work is flat and you should ride it. Tiers 7-12 are the
// exotic end of the catalogue: 1.5× the work for 2.5× the money. Still buyable
// — the wall is not a hard stop, it is the point where money stops being the
// answer.
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
Content.COMMODITY_TIER = 6;
// Indexed by the tier you have now, so [0] is what it costs to have a datastore
// at all. You start with nothing: every box on the board is one you drew.
Content.TIER_PRICES = [120, 180, 380, 800, 1700, 3600, 9000, 22500, 56000, 140000, 350000, 875000];
// Tier 0 is not a small box, it is no box. One accessor so nothing else in the
// game has to remember that.
Content.tierOf = i => Content.TIERS[i.tier - 1] || { cap: 0, conns: 0, run: 0 };

// Ceilings are set high enough that every one of them can be massively
// over-bought. Over-provisioning has to be REACHABLE for its cost to teach
// anything — you should be able to find out that a cache stopped paying by
// buying one that does.
Content.MAX = {
  pops: 64, appMax: 16384, cacheNodes: 64, streamParts: 256,
  shards: 128, replicas: 8, derivedNodes: 128, gpuNodes: 512, regions: 4,
};

// ---------------------------------------------------------------------------
// Traffic classes. Each is a shape of work, a route through the architecture,
// and a distinct answer to "which box is this request's home?".
//
// bytes  — response size, which is what the egress bill is made of
// baseMs — think time that is nobody's fault
// route(ctx) → hops, given { infra, hits }
Content.CLASSES = {
  read: {
    label: 'READ',
    wants: 'a cache, and an edge if any of it can be decided there', color: '#4ea3ff', bytes: 14000, baseMs: 4, revenueMult: 1,
    desc: 'Dynamic page and feed reads. Small, hot, and repeated — the only large class a cache can absorb, and the reason to run code at the edge at all.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      const hops = [];
      if (i.pops > 0 && i.edgeCompute) hops.push(absorbAt('edge', 1, ctx.hits.edgeDynamic));
      hops.push(hop('app', 1));
      if (i.cacheNodes > 0) hops.push(absorbAt('cache', 1, ctx.hits.cache));
      hops.push(hop('sql', i.indexes ? S.READ_UNITS_INDEXED : S.READ_UNITS_RAW));
      return hops;
    },
  },
  write: {
    label: 'WRITE',
    wants: 'primaries — and a log in front if the bursts are spiky', color: '#ff9d3c', bytes: 800, baseMs: 6, revenueMult: 1.4,
    desc: 'Mutations. Every one is new data, so nothing caches them and no replica can serve one. Only more primaries — or a log in front — scale writes.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      const hops = [hop('app', 1)];
      const sqlUnits = S.WRITE_UNITS * (i.indexes ? S.WRITE_INDEX_TAX : 1);
      if (i.streamParts > 0) {
        hops.push(ackAt('stream', 1));      // durable in the log; the user is done
        hops.push(hop('sql', sqlUnits));    // ...the datastore catches up after
        return hops;
      }
      hops.push(hop('sql', sqlUnits));
      return hops;
    },
  },
  lookup: {
    label: 'LOOKUP',
    wants: 'a key-value engine; a relational one is the wrong shape', color: '#43d17a', bytes: 300, baseMs: 2, revenueMult: 0.6,
    desc: 'Sessions, flags, counters, short-link resolves. Enormous rate, trivial size, no joins ever — the query shape a relational engine is worst at and a partitioned key-value engine is built for.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      return [hop('app', 1), hop('sql', i.kvEngine ? S.KV_LOOKUP_UNITS : S.LOOKUP_UNITS)];
    },
  },
  media: {
    label: 'MEDIA',
    wants: 'blob storage behind an edge, and nowhere near the datastore', color: '#c9a0ff', bytes: 180000, baseMs: 8, revenueMult: 0.5,
    desc: 'Images and video segments. Almost pure bytes: capacity barely matters, egress bills and cache-hit ratio are everything. Belongs nowhere near your store of record.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      const hops = [];
      if (i.pops > 0) hops.push(absorbAt('edge', 1, ctx.hits.edgeStatic));
      if (i.objstore) {
        // the service tier hands back a signed URL; the bytes never touch it
        hops.push(hop('app', i.directUpload ? 0.15 : 0.6), hop('objstore', 1));
        return hops;
      }
      hops.push(hop('app', S.BLOB_IN_APP_UNITS), hop('sql', S.BLOB_IN_DB_UNITS));
      return hops;
    },
  },
  search: {
    label: 'SEARCH',
    wants: 'an inverted index; a scan will not hold', color: '#ffb86b', bytes: 9000, baseMs: 10, revenueMult: 1.2,
    desc: 'Text queries. On a relational engine this is a full scan of the table; on an inverted index it is a lookup. Few query shapes have a wider gap between the right structure and the wrong one.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      const hops = [hop('app', 1)];
      hops.push(i.searchEngine && i.derivedNodes > 0
        ? hop('derived', S.SEARCH_UNITS)
        : hop('sql', S.SEARCH_SCAN_UNITS));
      return hops;
    },
  },
  analytics: {
    label: 'ANALYTICS',
    wants: 'a columnar copy, off the request path', color: '#b48cff', bytes: 40000, baseMs: 40, revenueMult: 2.5,
    desc: 'Reports and dashboards. A tiny share of requests and a huge share of the work — 60× a point read each on a row store. Request counts lie; work is what fills a cluster.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      const hops = [hop('app', 1)];
      if (i.olapEngine && i.derivedNodes > 0) {
        hops.push(offPathAt('derived', S.OLAP_UNITS));
        return hops;
      }
      const fanout = 1 + S.ANALYTICS_FANOUT * (i.shards - 1);
      hops.push(hop('sql', S.ANALYTICS_UNITS * fanout));
      return hops;
    },
  },
  realtime: {
    label: 'REALTIME',
    wants: 'push delivery; polling costs twelve times as much', color: '#f778ba', bytes: 900, baseMs: 3, revenueMult: 1.1,
    desc: 'Messages over a connection that is already open — chat, presence, live updates. The scarce resource is not requests per second, it is how many sockets your fleet is holding while nobody is talking.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      if (!i.push) {
        // no push delivery: clients poll the service tier, expensively
        return [hop('app', S.POLL_UNITS), hop('sql', S.READ_UNITS_RAW)];
      }
      const hops = [hop('app', S.PUSH_UNITS)];
      if (i.streamParts > 0) hops.push(ackAt('stream', 1), hop('sql', S.WRITE_UNITS));
      else hops.push(hop('sql', S.WRITE_UNITS));
      return hops;
    },
  },
  infer: {
    label: 'INFERENCE',
    wants: 'a model tier, and every trick that avoids calling it', color: '#ff7b72', bytes: 6000, baseMs: 5, revenueMult: 1.2,
    desc: 'Model calls. Two orders of magnitude more expensive per request than anything else in this system, which makes the architecture mostly a set of ways to avoid making one.',
    route: ctx => {
      const i = ctx.infra, S = Content.SIM;
      const hops = [hop('app', S.INFER_ORCH_UNITS)];
      if (i.semanticCache && i.cacheNodes > 0) hops.push(absorbAt('cache', 2, ctx.hits.semantic));
      if (i.vectorEngine && i.derivedNodes > 0) hops.push(hop('derived', S.VECTOR_UNITS));
      hops.push(hop('gpu', 1));
      return hops;
    },
  },
};

// ---------------------------------------------------------------------------
// Services — the thing you are running. One is rolled per run (with jitter on
// the mix). The workload IS the level design: it decides which of the boxes
// this system actually needs, and the objectives decide what "working" even
// means. No service needs all of them — that is the point.
//
// slo.p99Ms      — the latency users were promised
// slo.availability — 0.999 means one request in a thousand may fail, forever;
//                  that allowance is the error budget, and it is spendable
// slo.costCeiling — $/s the business will tolerate at target scale
// slo.consistency — 'strong' briefs punish acking a write before it is durable
// slo.durable    — media must live somewhere that does not lose it
Content.SCENARIOS = {
  shortener: {
    name: 'URL shortener',
    icon: '🔗',
    blurb: 'Paste a long link, get a short one. Then serve the redirect a hundred million times.',
    functional: [
      'POST /shorten returns a 7-character key',
      'GET /:key redirects in single-digit milliseconds',
      'creators can see click counts',
    ],
    winShape: 'A redirect is a key lookup with no joins and near-total repetition. Cache and KV carry the whole game; the relational database is nearly a bystander.',
    mix: { lookup: 0.82, read: 0.11, write: 0.02, media: 0, search: 0, analytics: 0.025, realtime: 0.025, infer: 0 },
    repetition: 0.95, revenue: 0.02505, rpsPerUser: 0.6,
    targetRps: 900000,
    slo: { p99Ms: 60, availability: 0.9995, costCeiling: 5400, consistency: 'eventual', durable: false },
  },
  feed: {
    name: 'Social photo feed',
    icon: '📸',
    blurb: 'Everyone posts, everyone scrolls, and everyone looks at the same viral photo at once.',
    functional: [
      'home timeline of posts from people you follow',
      'upload a photo, see it appear',
      'search users and captions',
    ],
    winShape: 'Two workloads in one: bytes and rows. Media belongs on a CDN in front of object storage; timelines belong in a cache in front of shards.',
    mix: { read: 0.44, media: 0.30, write: 0.09, lookup: 0.11, search: 0.02, analytics: 0.015, realtime: 0.025, infer: 0 },
    repetition: 0.9, revenue: 0.02070, rpsPerUser: 0.55,
    targetRps: 700000,
    slo: { p99Ms: 240, availability: 0.999, costCeiling: 4300, consistency: 'eventual', durable: true },
  },
  chat: {
    name: 'Chat / messaging',
    icon: '💬',
    blurb: 'A billion messages a day, each one expected to land before the sender looks up.',
    functional: [
      'deliver a message to an online recipient in under 100ms',
      'store history, deliver on reconnect',
      'presence: who is online right now',
    ],
    winShape: 'Connections, not requests. Push delivery holds the sockets, a log fans messages out, and a key-value engine answers presence.',
    mix: { realtime: 0.52, write: 0.24, lookup: 0.13, read: 0.06, media: 0.03, search: 0.01, analytics: 0.01, infer: 0 },
    repetition: 0.45, revenue: 0.01635, rpsPerUser: 1.4,
    targetRps: 600000,
    slo: { p99Ms: 110, availability: 0.9995, costCeiling: 3800, consistency: 'eventual', durable: true },
  },
  video: {
    name: 'Video streaming',
    icon: '🎬',
    blurb: 'Segments, manifests and a bandwidth bill that dwarfs everything else on the board.',
    functional: [
      'stream adaptive-bitrate segments without rebuffering',
      'transcode an upload into every rendition',
      'resume where the viewer left off',
    ],
    winShape: 'Almost pure egress. The CDN hit ratio is not a performance number here, it is the P&L — and transcoding belongs behind a queue, not on the request path.',
    mix: { media: 0.86, read: 0.07, lookup: 0.03, write: 0.01, analytics: 0.01, realtime: 0.01, search: 0.01, infer: 0 },
    repetition: 0.85, revenue: 0.03105, rpsPerUser: 0.35,
    targetRps: 260000,
    slo: { p99Ms: 320, availability: 0.999, costCeiling: 1750, consistency: 'eventual', durable: true },
  },
  rideshare: {
    name: 'Ride-hailing dispatch',
    icon: '🚕',
    blurb: 'Every car on the road writes its position every four seconds, forever.',
    functional: [
      'match a rider to the nearest available driver',
      'ingest driver location pings continuously',
      'live trip tracking for the rider',
    ],
    winShape: 'A write firehose with a geographic key. Sharding is mandatory and hot cells are the catch — downtown at 6pm is one shard and one shard only.',
    mix: { write: 0.52, lookup: 0.19, read: 0.14, realtime: 0.08, search: 0.03, analytics: 0.02, media: 0.02, infer: 0 },
    repetition: 0.35, revenue: 0.01545, rpsPerUser: 1.1,
    targetRps: 550000,
    slo: { p99Ms: 130, availability: 0.9995, costCeiling: 3400, consistency: 'strong', durable: false },
  },
  adtech: {
    name: 'Ad exchange',
    icon: '📈',
    blurb: 'You have thirty milliseconds to decide what an impression is worth. Total.',
    functional: [
      'respond to a bid request within the auction deadline',
      'look up user segments and campaign budgets',
      'stay inside the deadline or drop the bid entirely',
    ],
    winShape: 'The deadline is the design. Everything must be a key lookup, the model must be small enough to answer inside the budget, and anything slow must be dropped rather than waited for.',
    mix: { lookup: 0.64, read: 0.26, write: 0.07, analytics: 0.02, realtime: 0.01, media: 0, search: 0, infer: 0 },
    repetition: 0.6, revenue: 0.02130, rpsPerUser: 2.2,
    targetRps: 1000000,
    slo: { p99Ms: 45, availability: 0.999, costCeiling: 6100, consistency: 'eventual', durable: false },
  },
  checkout: {
    name: 'Flash-sale commerce',
    icon: '🛒',
    blurb: 'Ten thousand units, four hundred thousand people, one minute.',
    functional: [
      'browse the catalogue and search it',
      'take payment and decrement inventory exactly once',
      'never sell the same unit twice',
    ],
    winShape: 'Browsing is cacheable and checkout is not. This is the brief where a queue in front of the write path is a trap unless the consumer is idempotent.',
    mix: { read: 0.44, write: 0.28, lookup: 0.14, search: 0.06, media: 0.04, analytics: 0.03, realtime: 0.01, infer: 0 },
    repetition: 0.8, revenue: 0.01650, rpsPerUser: 0.5,
    targetRps: 420000,
    slo: { p99Ms: 240, availability: 0.9995, costCeiling: 2700, consistency: 'strong', durable: true },
  },
  assistant: {
    name: 'AI assistant (RAG)',
    icon: '🤖',
    blurb: 'Every answer costs more than a thousand database reads. Design accordingly.',
    functional: [
      'answer questions grounded in the customer\'s own documents',
      'retrieve relevant passages before generating',
      'keep conversation history',
    ],
    winShape: 'Unit economics are the architecture. Anything that answers without waking an accelerator — a semantic cache, a smaller model, a retrieved passage — is the design.',
    mix: { infer: 0.50, read: 0.19, lookup: 0.13, write: 0.09, search: 0.05, analytics: 0.02, realtime: 0.02, media: 0 },
    repetition: 0.55, revenue: 0.08100, rpsPerUser: 0.22,
    targetRps: 24000,
    slo: { p99Ms: 2600, availability: 0.995, costCeiling: 850, consistency: 'eventual', durable: false },
  },
};
Content.SCENARIO_KEYS = Object.keys(Content.SCENARIOS);

// ---------------------------------------------------------------------------
// Shop. Each item is one decision, and each belongs to one of the eight boxes.
//
// Run-rate is deliberately TWO numbers, because that is how operations really
// bills you:
//   fixed    — $/s the moment you own ANY of it: the team who knows it, the
//              dashboards, the alert rotation, the 3am pages.
//   marginal — $/s per node. Usually small: once you run the thing, running
//              more of it is mostly hosting.
// That gap is the argument against "let's just add one more system for this one
// feature". Your first node of anything is expensive; your tenth is cheap.
//
// Fleets double. Every horizontal component is bought by doubling it, which
// keeps the click count logarithmic and matches how capacity actually arrives:
// in chunks, priced by what you already have.
//
// price(state) → dollars, or null when owned/maxed/unavailable.
const dbl = (field, unit) => ({
  price: s => (s.infra[field] >= Content.MAX[field] ? null : unit * Math.max(1, s.infra[field])),
  apply: s => { s.infra[field] = Math.max(1, s.infra[field] * 2); },
});
const halve = field => ({
  canScaleDown: s => s.infra[field] > 0,
  scaleDown: s => { s.infra[field] = Math.floor(s.infra[field] / 2); },
});
// a flag you either have or you do not: on/off, with its own ops weight
const toggle = (field, cost, gate) => ({
  price: s => (s.infra[field] || !gate(s) ? null : cost),
  apply: s => { s.infra[field] = true; },
  owned: s => s.infra[field],
  canScaleDown: s => s.infra[field],
  scaleDown: s => { s.infra[field] = false; },
});

Content.SHOP = [
  // --- edge ---------------------------------------------------------------
  {
    key: 'cdn', box: 'edge', name: 'CDN points of presence', color: '#5fd3c4',
    blurb: 'Cache bytes at the edge. 97% of media served from a PoP never reaches you.',
    tradeoff: 'Stale content until it expires, and cache invalidation is one of the two hard problems.',
    ...dbl('pops', 90), ...halve('pops'),
    owned: s => s.infra.pops > 0,
    fixed: 5, fixedNote: 'purge tooling, cache-key bugs, and a vendor to argue with',
    marginal: s => s.infra.pops * 0.8,
    ownedLabel: s => (s.infra.pops ? s.infra.pops + ' PoPs' : null),
    scaleDownLabel: 'halve the PoP footprint',
    insightOnBuy: 'cdn',
  },
  {
    key: 'edgeCompute', box: 'edge', name: 'Edge compute', color: '#7ee6d8',
    blurb: 'Run code in the PoP: personalize, authorize and assemble responses with no origin trip.',
    tradeoff: 'A second place your logic lives, with milliseconds of CPU and no datastore next to it.',
    ...toggle('edgeCompute', 500, s => s.infra.pops > 0),
    fixed: 7, fixedNote: 'a second deploy target, a second set of logs, a second runtime',
    marginal: () => 0,
    ownedLabel: s => (s.infra.edgeCompute ? 'deployed' : null),
    scaleDownLabel: 'withdraw to the origin',
    insightOnBuy: 'edgecompute',
  },
  // --- services -----------------------------------------------------------
  {
    key: 'app', box: 'app', name: 'Service instances', color: '#4ea3ff',
    blurb: 'Double the stateless fleet. This is the easy axis — use it.',
    tradeoff: 'Stateless only scales what is stateless. Everything behind it is still one datastore.',
    ...dbl('appMax', 12),
    owned: s => s.infra.appMax > 0,
    fixed: 2, fixedNote: 'deploys, rollbacks, balancing, health checks, and the pager for all of it',
    marginal: s => s.infra.appNodes * 0.09,
    ownedLabel: s => (s.infra.appMax === 0 ? null
      : Math.round(s.infra.appNodes) + ' / ' + s.infra.appMax + ' running'),
    canScaleDown: s => s.infra.appMax > 0,
    scaleDown: s => { s.infra.appMax = Math.floor(s.infra.appMax / 2); },
    scaleDownLabel: 'halve the fleet ceiling',
  },
  {
    key: 'autoscale', box: 'app', name: 'Autoscaling', color: '#79c0ff',
    blurb: 'Run only the instances the traffic needs, up to your ceiling. You stop paying for idle.',
    tradeoff: 'It reacts in ~12s. A burst arrives in one — autoscaling is not a burst plan.',
    ...toggle('autoscale', 320, () => true),
    fixed: 2, fixedNote: 'scaling policies, flapping, and warm-up time nobody budgets for',
    marginal: () => 0,
    ownedLabel: s => (s.infra.autoscale ? 'tracking demand' : null),
    scaleDownLabel: 'pin the fleet at its ceiling',
    insightOnBuy: 'autoscale',
  },
  {
    key: 'push', box: 'app', name: 'Push delivery', color: '#f778ba',
    blurb: 'Hold a connection open per online user and push. Live updates stop being repeated requests.',
    tradeoff: 'Now part of your fleet is stateful: sockets cost memory idle, and a deploy disconnects everyone.',
    ...toggle('push', 420, () => true),
    fixed: 6, fixedNote: 'sticky sessions, drain-on-deploy, and reconnect storms',
    marginal: s => (s.report ? s.report.perClass.realtime.demand * Content.SIM.SOCKET_COST * 40 : 0),
    ownedLabel: s => (s.infra.push ? 'connections held' : null),
    scaleDownLabel: 'go back to polling',
    insightOnBuy: 'connections',
  },
  {
    key: 'loadShed', box: 'app', name: 'Load shedding', color: '#d29922',
    blurb: 'Past 85% utilization, reject the excess immediately instead of queueing it.',
    tradeoff: 'You choose to fail some requests. In exchange the rest stay fast — and nothing melts down.',
    ...toggle('loadShed', 260, () => true),
    fixed: 2, fixedNote: 'concurrency limits to tune and a 429 your clients must handle',
    marginal: () => 0,
    ownedLabel: s => (s.infra.loadShed ? 'armed' : null),
    scaleDownLabel: 'disarm (overload becomes timeouts again)',
    insightOnBuy: 'shed',
  },
  {
    key: 'rateLimit', box: 'app', name: 'Rate limiting', color: '#a5a5ff',
    blurb: 'Per-client quotas at the front. Abuse and floods stop here rather than at your datastore.',
    tradeoff: 'Someone will be limited who should not have been.',
    ...toggle('rateLimit', 180, () => true),
    fixed: 2.5, fixedNote: 'quota policy, false positives, and an appeals inbox',
    marginal: () => 0,
    ownedLabel: s => (s.infra.rateLimit ? 'enforcing' : null),
    scaleDownLabel: 'drop the quotas',
  },
  // --- cache --------------------------------------------------------------
  {
    key: 'cache', box: 'cache', name: 'Cache nodes', color: '#e3b341',
    blurb: 'Serve repeated reads in ~1ms. Hit rate climbs toward 92% as you double.',
    tradeoff: 'Writes invalidate; a cold cache is a thundering herd; hit rate is capped by repetition.',
    ...dbl('cacheNodes', 150), ...halve('cacheNodes'),
    owned: s => s.infra.cacheNodes > 0,
    fixed: 6, fixedNote: 'invalidation bugs, eviction tuning, cold-start incidents',
    marginal: s => s.infra.cacheNodes * 1.6,
    ownedLabel: s => (s.infra.cacheNodes ? s.infra.cacheNodes + ' nodes' : null),
    scaleDownLabel: 'halve the cache',
  },
  {
    key: 'coalesce', box: 'cache', name: 'Request coalescing', color: '#f2cc60',
    blurb: 'On a miss, exactly one request refills the key; the rest wait for it.',
    tradeoff: 'Nothing, really — this is the cheap fix for the herd everyone learns about too late.',
    ...toggle('coalesce', 220, s => s.infra.cacheNodes > 0),
    fixed: 1, fixedNote: 'singleflight locks, and the deadlock you will write once',
    marginal: () => 0,
    ownedLabel: s => (s.infra.coalesce ? 'enabled' : null),
    scaleDownLabel: 'disable coalescing',
  },
  {
    key: 'hotkey', box: 'cache', name: 'Hot-key replication', color: '#ffd866',
    blurb: 'Copy the hottest keys to every node so one celebrity row cannot pin one box.',
    tradeoff: 'Duplicated memory, and N copies to invalidate instead of one.',
    ...toggle('hotKeySpread', 300, s => s.infra.cacheNodes >= 2),
    fixed: 1.5, fixedNote: 'key-heat detection and a fanout of invalidations',
    marginal: () => 0,
    ownedLabel: s => (s.infra.hotKeySpread ? 'enabled' : null),
    scaleDownLabel: 'stop replicating hot keys',
  },
  {
    key: 'semanticCache', box: 'cache', name: 'Semantic cache', color: '#ffc1bc',
    blurb: 'Near-identical prompts reuse a previous answer. ~38% of model calls never happen.',
    tradeoff: 'Sometimes "near enough" is not.',
    ...toggle('semanticCache', 340, s => s.infra.cacheNodes > 0),
    fixed: 3, fixedNote: 'similarity thresholds, and the answer that was almost right',
    marginal: () => 0,
    ownedLabel: s => (s.infra.semanticCache ? 'enabled' : null),
    scaleDownLabel: 'disable semantic caching',
    insightOnBuy: 'semantic',
  },
  // --- stream -------------------------------------------------------------
  {
    key: 'stream', box: 'stream', name: 'Log partitions', color: '#f0883e',
    blurb: 'Writes become an append to a durable log — acked in milliseconds, applied at leisure.',
    tradeoff: 'The acknowledged write is not in the datastore yet. That gap is real and users can see it.',
    ...dbl('streamParts', 210), ...halve('streamParts'),
    owned: s => s.infra.streamParts > 0,
    fixed: 12, fixedNote: 'brokers, consumer lag, replay tooling, and 3am backlog pages',
    marginal: s => s.infra.streamParts * 0.9,
    ownedLabel: s => (s.infra.streamParts ? s.infra.streamParts + ' partitions' : null),
    scaleDownLabel: 'halve the partitions',
    insightOnBuy: 'log',
  },
  {
    key: 'idempotent', box: 'stream', name: 'Idempotent consumers', color: '#ffa657',
    blurb: 'Every message carries a key; applying it twice is the same as applying it once.',
    tradeoff: 'A dedupe store to keep and expire. Without it, at-least-once delivery means double orders.',
    ...toggle('idempotent', 280, s => s.infra.streamParts > 0),
    fixed: 2, fixedNote: 'dedupe keys, TTLs, and the exactly-once argument you will have',
    marginal: () => 0,
    ownedLabel: s => (s.infra.idempotent ? 'enabled' : null),
    scaleDownLabel: 'disable dedupe',
    insightOnBuy: 'idempotency',
  },
  {
    key: 'cdc', box: 'stream', name: 'Change data capture', color: '#ffc680',
    blurb: 'Tail the datastore\'s own replication log into the stream. Every derived store is then one consumer, not one more pipeline — which halves what they cost to run.',
    tradeoff: 'A connector nobody owns, and when it stops, nothing downstream says so.',
    ...toggle('cdc', 340, s => s.infra.streamParts > 0),
    fixed: 4, fixedNote: 'schema-change breakage and a connector nobody owns',
    marginal: () => 0,
    ownedLabel: s => (s.infra.cdc ? 'streaming' : null),
    scaleDownLabel: 'stop the capture',
    insightOnBuy: 'cdc',
  },
  // --- datastore ----------------------------------------------------------
  {
    key: 'indexes', box: 'sql', name: 'Add indexes', color: '#8b96a5',
    blurb: 'Reads cost 10 units → 1. The cheapest 10× you will ever buy.',
    tradeoff: 'Writes get ~20% costlier — every insert maintains every index.',
    ...toggle('indexes', 60, () => true),
    fixed: 0.5, fixedNote: 'schema review, bloat monitoring, the occasional REINDEX',
    marginal: () => 0,
    ownedLabel: s => (s.infra.indexes ? 'installed' : null),
    scaleDownLabel: 'drop indexes (writes cheaper, reads 10× dearer)',
    insightOnBuy: 'indexes',
  },
  {
    key: 'pooler', box: 'sql', name: 'Connection pooler', color: '#5fd3c4',
    blurb: 'Connections held only while a query runs, not while clients idle.',
    tradeoff: 'None. That is the lesson — everybody forgets the free win.',
    price: s => (s.infra.pooler ? null : 120),
    apply: s => { s.infra.pooler = true; },
    owned: s => s.infra.pooler,
    fixed: 2, fixedNote: 'one more hop to monitor, and pool-exhaustion alerts',
    marginal: () => 0,
    ownedLabel: s => (s.infra.pooler ? 'installed' : null),
    canScaleDown: () => false,
    scaleDown: null,
    scaleDownLabel: null,
  },
  {
    key: 'kvEngine', box: 'sql', name: 'Key-value engine', color: '#43d17a',
    blurb: 'Move sessions, flags and counters onto a partitioned key-value engine. It scales linearly and you never size it — it just bills you per thousand lookups.',
    tradeoff: 'Key→value only: no joins, no ad-hoc queries. And a second engine to run is a team, whatever the hosting costs.',
    ...toggle('kvEngine', 380, () => true),
    fixed: 20, fixedNote: 'a SECOND storage engine: new expertise, new oncall, new failure modes',
    marginal: s => (s.report
      ? s.report.perClass.lookup.served / 1000 * Content.SIM.KV_PER_KRPS : 0),
    ownedLabel: s => (s.infra.kvEngine ? 'lookups partitioned' : null),
    scaleDownLabel: 'put lookups back on the relational engine',
    insightOnBuy: 'nosql',
  },
  {
    key: 'tier', box: 'sql', name: 'Datastore box size', color: '#7bb7ff',
    blurb: 'Provision the store of record, then make it bigger: 2× query units and connections a rung.',
    tradeoff: 'Fair value to tier 6; past that each rung buys 1.5× the work for 2.5× the money.',
    price: s => (s.infra.tier >= Content.MAX_TIER ? null : Content.TIER_PRICES[s.infra.tier]),
    apply: s => { s.infra.tier += 1; },
    owned: s => s.infra.tier > 0,
    fixed: 3, fixedNote: 'DBAs, backups, failover drills, the on-call rotation',
    marginal: s => s.infra.shards * (1 + s.infra.replicas) * Content.tierOf(s.infra).run,
    ownedLabel: s => (s.infra.tier === 0 ? null : 'tier ' + s.infra.tier + ' / ' + Content.MAX_TIER),
    canScaleDown: s => s.infra.tier > 0,
    scaleDown: s => { s.infra.tier -= 1; },
    scaleDownLabel: 'downgrade to a smaller (cheaper) box',
  },
  {
    key: 'replica', box: 'sql', name: 'Read replica (per shard)', color: '#9ecbff',
    blurb: 'One more read-serving copy of every shard — and every node raises the connection ceiling too.',
    tradeoff: 'Each replica replays ALL writes; when hot it lags, and lag is a stale read.',
    price: s => (s.infra.replicas >= Content.MAX.replicas ? null : 250 * s.infra.shards),
    apply: s => { s.infra.replicas += 1; },
    owned: s => s.infra.replicas > 0,
    fixed: 3, fixedNote: 'lag dashboards, failover runbooks, read-your-writes bugs',
    marginal: () => 0,   // the nodes themselves are billed under the box tier
    ownedLabel: s => s.infra.replicas + ' per shard',
    canScaleDown: s => s.infra.replicas > 0,
    scaleDown: s => { s.infra.replicas -= 1; },
    scaleDownLabel: 'retire one replica per shard',
    insightOnBuy: 'nodeheadroom',
  },
  {
    key: 'shard', box: 'sql', name: 'Shard split (×2)', color: '#ff9d3c',
    blurb: 'Split every table across twice as many primaries. Writes finally scale.',
    tradeoff: 'Reports fan out to every shard; 20s migration at 60% capacity; one-way door.',
    price: s => (s.infra.shards >= Content.MAX.shards ? null : 400 * s.infra.shards),
    apply: s => {
      s.infra.shards *= 2;
      s.migration = { left: Content.SIM.MIGRATION_S };
    },
    owned: s => s.infra.shards > 1,
    fixed: 6, fixedNote: 'rebalancing, hot-shard hunts, cross-shard query reviews',
    marginal: s => 2 * (s.infra.shards - 1),
    ownedLabel: s => s.infra.shards + (s.infra.shards > 1 ? ' shards' : ' shard'),
    canScaleDown: () => false,  // sharding is a one-way door
    scaleDown: null,
    scaleDownLabel: null,
    insightOnBuy: 'sharding',
  },
  {
    key: 'multiAz', box: 'sql', name: 'Multi-AZ failover', color: '#56d364',
    blurb: 'A synchronous standby in another availability zone, promoted automatically.',
    tradeoff: 'Doubles the primary bill and adds commit latency. Buys you the outage you never have.',
    ...toggle('multiAz', 700, () => true),
    fixed: 5, fixedNote: 'a standby billed at full price for doing nothing, until the day it does',
    marginal: s => s.infra.shards * Content.tierOf(s.infra).run * 0.9,
    ownedLabel: s => (s.infra.multiAz ? 'standby ready' : null),
    scaleDownLabel: 'drop the standby',
    insightOnBuy: 'failover',
  },
  // --- blob store ---------------------------------------------------------
  {
    key: 'objstore', box: 'objstore', name: 'Object storage', color: '#b0a0ff',
    blurb: 'Media moves to durable blob storage. Eleven nines, effectively infinite, cheap to keep.',
    tradeoff: 'Egress is billed by the gigabyte — which is what a CDN in front of it is for.',
    ...toggle('objstore', 260, () => true),
    fixed: 3, fixedNote: 'bucket policy, lifecycle rules, and one public bucket incident',
    marginal: () => 0,
    ownedLabel: s => (s.infra.objstore ? 'provisioned' : null),
    scaleDownLabel: 'decommission (media goes back into the datastore)',
    insightOnBuy: 'blob',
  },
  {
    key: 'directUpload', box: 'objstore', name: 'Pre-signed direct transfer', color: '#c9b8ff',
    blurb: 'Clients transfer straight to storage. Bytes stop passing through your service tier.',
    tradeoff: 'Signed URLs leak if you get expiry wrong, and you lose a place to inspect the bytes.',
    ...toggle('directUpload', 200, s => s.infra.objstore),
    fixed: 1, fixedNote: 'URL expiry, CORS, and a virus scan you now have to do elsewhere',
    marginal: () => 0,
    ownedLabel: s => (s.infra.directUpload ? 'enabled' : null),
    scaleDownLabel: 'proxy the bytes again',
  },
  // --- derived stores -----------------------------------------------------
  {
    key: 'derived', box: 'derived', name: 'Derived store nodes', color: '#b48cff',
    blurb: 'Capacity for whichever read models you have switched on. They share one fleet.',
    tradeoff: 'A second copy of your data, at your expense, that is only as fresh as its feed.',
    ...dbl('derivedNodes', 220), ...halve('derivedNodes'),
    owned: s => s.infra.derivedNodes > 0,
    fixed: 4, fixedNote: 'reindexing, compaction, and a fleet whose freshness nobody watches',
    marginal: s => s.infra.derivedNodes * 1.3,
    ownedLabel: s => (s.infra.derivedNodes ? s.infra.derivedNodes + ' nodes' : null),
    scaleDownLabel: 'halve the derived fleet',
  },
  {
    key: 'searchEngine', box: 'derived', name: 'Inverted index', color: '#ffb86b',
    blurb: 'Text search becomes a lookup instead of a scan of every row.',
    tradeoff: 'Relevance tuning, and an index that is wrong the moment its feed stops.',
    ...toggle('searchEngine', 240, s => s.infra.derivedNodes > 0),
    fixed: 6, fixedNote: 'mappings, reindexing, and relevance complaints',
    marginal: s => (s.infra.cdc ? 0 : 4),
    ownedLabel: s => (s.infra.searchEngine ? 'indexing' : null),
    scaleDownLabel: 'drop the index (search goes back to scanning)',
    insightOnBuy: 'invertedindex',
  },
  {
    key: 'olapEngine', box: 'derived', name: 'Columnar copy', color: '#c39bff',
    blurb: 'Reports run on a columnar copy in open table format, off the request path entirely.',
    tradeoff: 'Reports are seconds behind and seconds slow. Nobody joins a table mid-purchase.',
    ...toggle('olapEngine', 420, s => s.infra.derivedNodes > 0),
    fixed: 8, fixedNote: 'a data team, a pipeline, and everything it breaks on',
    marginal: s => (s.infra.cdc ? 0 : 5),
    ownedLabel: s => (s.infra.olapEngine ? 'running' : null),
    scaleDownLabel: 'shut it down (reports go back on the store of record)',
    insightOnBuy: 'olap',
  },
  {
    key: 'vectorEngine', box: 'derived', name: 'Vector index', color: '#7ee787',
    blurb: 'Nearest-neighbour search over embeddings — how a model answers from YOUR data.',
    tradeoff: 'Embeddings go stale as documents change, and re-embedding a corpus is not free.',
    ...toggle('vectorEngine', 380, s => s.infra.derivedNodes > 0),
    fixed: 6, fixedNote: 'an embedding pipeline, index rebuilds, and recall you cannot eyeball',
    marginal: s => (s.infra.cdc ? 0 : 4),
    ownedLabel: s => (s.infra.vectorEngine ? 'retrieving' : null),
    scaleDownLabel: 'drop the vector index',
    insightOnBuy: 'retrieval',
  },
  // --- inference ----------------------------------------------------------
  {
    key: 'gpu', box: 'gpu', name: 'Self-hosted accelerators', color: '#ff7b72',
    blurb: 'Own the fleet instead of renting the API. Capacity you can double, billed by the second.',
    tradeoff: 'You pay for every idle second. Below the crossover the hosted API is simply cheaper.',
    // Accelerators do not arrive one at a time. The first order is a rack, sized
    // to at least replace the rented quota — otherwise "self-hosting" would be a
    // capacity cliff rather than an economic decision, which is not the lesson.
    price: s => (s.infra.gpuNodes >= Content.MAX.gpuNodes ? null
      : (s.infra.gpuNodes === 0 ? 2200 : 130 * s.infra.gpuNodes)),
    apply: s => { s.infra.gpuNodes = s.infra.gpuNodes === 0 ? 16 : s.infra.gpuNodes * 2; },
    ...halve('gpuNodes'),
    owned: s => s.infra.gpuNodes > 0,
    fixed: 18, fixedNote: 'model deploys, driver versions, and capacity you cannot return',
    marginal: s => s.infra.gpuNodes * 5.5,
    ownedLabel: s => (s.infra.gpuNodes ? s.infra.gpuNodes + ' accelerators' : 'hosted API'),
    scaleDownLabel: 'halve the fleet (zero = back to the hosted API)',
    insightOnBuy: 'buildvsbuy',
  },
  {
    key: 'batching', box: 'gpu', name: 'Continuous batching', color: '#ff9f97',
    blurb: 'Interleave requests through the model instead of one at a time. 3.2× the throughput.',
    tradeoff: 'Every request waits for a batch slot: ~90ms of queueing added to all of them.',
    ...toggle('batching', 380, s => s.infra.gpuNodes > 0),
    fixed: 2, fixedNote: 'a serving stack to tune and tail latency to explain',
    marginal: () => 0,
    ownedLabel: s => (s.infra.batching ? 'enabled' : null),
    scaleDownLabel: 'serve one at a time',
    insightOnBuy: 'batching',
  },
  {
    key: 'router', box: 'gpu', name: 'Small-model routing', color: '#ffd3cf',
    blurb: 'Send the easy 60% to a small fast model and keep the large one for what needs it.',
    tradeoff: 'You must be right about which is which — and the classifier is itself a model.',
    ...toggle('router', 460, s => s.infra.gpuNodes > 0),
    fixed: 4, fixedNote: 'two models to evaluate, and quality regressions nobody notices for a week',
    marginal: () => 0,
    ownedLabel: s => (s.infra.router ? 'routing' : null),
    scaleDownLabel: 'send everything to the big model',
    insightOnBuy: 'routing',
  },
  // --- cross-cutting ------------------------------------------------------
  // Not boxes. Things that are true of the whole system rather than a place a
  // request goes, which is exactly why they are the two people forget.
  {
    key: 'obs', box: 'cross', name: 'Telemetry', color: '#a5d6ff',
    blurb: 'Metrics, then distributed tracing. Until you have it, the probes only guess.',
    tradeoff: 'Sampling decisions, cardinality bills, and a dashboard nobody reads.',
    price: s => [140, 460, null][s.infra.obs],
    apply: s => { s.infra.obs += 1; },
    owned: s => s.infra.obs > 0,
    fixed: 3, fixedNote: 'retention, cardinality, and an observability bill that rivals the app',
    marginal: s => s.infra.obs * 2.5,
    ownedLabel: s => ['blind', 'metrics', 'metrics + traces'][s.infra.obs],
    canScaleDown: s => s.infra.obs > 0,
    scaleDown: s => { s.infra.obs -= 1; },
    scaleDownLabel: 'cut the telemetry budget',
    insightOnBuy: 'signals',
  },
  {
    key: 'region', box: 'cross', name: 'Additional region', color: '#79c0ff',
    blurb: 'A full copy of the stack somewhere else. Users get a near replica; a region can die.',
    tradeoff: 'Cross-region replication lag, a bill multiplied by N, and a consistency argument.',
    price: s => (s.infra.regions >= Content.MAX.regions ? null : 1200 * s.infra.regions),
    apply: s => { s.infra.regions += 1; },
    owned: s => s.infra.regions > 1,
    fixed: 14, fixedNote: 'data residency, replication lag, and failover you must actually test',
    marginal: s => (s.infra.regions - 1) * 9,
    ownedLabel: s => s.infra.regions + (s.infra.regions > 1 ? ' regions' : ' region'),
    canScaleDown: s => s.infra.regions > 1,
    scaleDown: s => { s.infra.regions -= 1; },
    scaleDownLabel: 'consolidate a region',
    insightOnBuy: 'multiregion',
  },
];
Content.SHOP_BY_KEY = {};
for (const item of Content.SHOP) Content.SHOP_BY_KEY[item.key] = item;

// What a workload's mix implies about the shape of the answer: each entry says
// "this much of this traffic wants that subsystem". Thresholds are in request
// share but chosen with the class's unit cost in mind — 3% search is a lot of
// database, 3% lookups is nothing. The review grades against this table:
// built-and-needed, needed-and-missing, or built-for-nothing.
Content.EXPECTED = [
  { item: 'objstore', classes: ['media'], min: 0.02,
    need: 'uploads are durable bytes, not rows in a table' },
  { item: 'cdn', classes: ['media'], min: 0.10,
    need: 'media at this share is a bandwidth business — serve it from the edge' },
  { item: 'cache', classes: ['read'], min: 0.35,
    need: 'reads this hot and repeated should not all reach the datastore' },
  { item: 'kvEngine', classes: ['lookup'], min: 0.25,
    need: 'key lookups dominate, and a relational engine is the wrong shape for them' },
  { item: 'stream', classes: ['write', 'realtime'], min: 0.20,
    need: 'a write share this heavy arrives in bursts a log can absorb' },
  { item: 'searchEngine', classes: ['search'], min: 0.03,
    need: 'text search without an inverted index is a full scan per query' },
  { item: 'olapEngine', classes: ['analytics'], min: 0.02,
    need: 'reports cost 60× a read each — they need their own columnar copy' },
  { item: 'gpu', classes: ['infer'], min: 0.05,
    need: 'inference at this share cannot live behind a rented rate limit' },
  { item: 'vectorEngine', classes: ['infer'], min: 0.20,
    need: 'grounded answers mean retrieving passages, which is a vector index' },
  { item: 'push', classes: ['realtime'], min: 0.05,
    need: 'realtime faked by polling multiplies every connected client' },
];

// The cheatsheet reads the same table the review grades against, from the
// brief's base mix — what each system expects before the jitter is dealt.
Content.expectedFor = key => {
  const mix = Content.SCENARIOS[key].mix;
  return Content.EXPECTED.filter(e =>
    e.classes.reduce((sum, k) => sum + (mix[k] || 0), 0) >= e.min);
};

// The shop's headings: the eight boxes, in the order work reaches them, plus
// the two things that are not boxes at all.
Content.BOXES = Content.STATION_KEYS
  .map(key => ({ key, name: Content.STATIONS[key].name }))
  .concat([{ key: 'cross', name: 'CROSS-CUTTING' }]);

if (typeof module !== 'undefined') module.exports = Content;
