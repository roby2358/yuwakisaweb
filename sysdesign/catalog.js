// LOAD BEARING — catalog: events, insight cards, and the interview rubric.
// Extends and re-exports Content so the load order stays a single chain.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./content.js');
}

// ---------------------------------------------------------------------------
// Events. Milestone events fire once at a fraction of the brief's target and
// are guaranteed story beats; random ones are weather. `needs` gates events
// that only make sense against infrastructure you actually own.
//
// Every field here is read through Engine.eventEffects, which fills in the
// defaults in one place — so no part of the simulation asks "is there an event
// and does it have this property?".
Content.EVENTS = {
  hn: {
    name: 'Front page of everything', icon: '🔥',
    blurb: 'Someone posted you. Four times the traffic, almost all reads, for thirty seconds.',
    milestoneFrac: 0.004, dur: 40, trafficMult: 4, mixMult: { read: 2, media: 1.5 },
  },
  launchDay: {
    name: 'Launch day', icon: '🚀',
    blurb: 'The campaign landed. Three times the traffic and twice the writes.',
    milestoneFrac: 0.12, dur: 75, trafficMult: 3, mixMult: { write: 2 },
  },
  peakHour: {
    name: 'Peak hour', icon: '📶',
    blurb: 'The daily peak, at the scale you now operate. Twice everything.',
    milestoneFrac: 0.55, dur: 60, trafficMult: 2,
  },
  connStorm: {
    name: 'Bad deploy — connection storm', icon: '⚡',
    blurb: 'Every instance reconnects at once. Connection demand goes up 8×.',
    dur: 15, random: true, stormMult: 8,
  },
  hotKey: {
    name: 'One key, all the traffic', icon: '⭐',
    blurb: 'A celebrity row is most of your reads. Hashing sends every one of them to the same node.',
    dur: 20, random: true, cacheCapOne: true,
    needs: s => s.infra.cacheNodes >= 2 && !s.infra.hotKeySpread,
    insight: 'hotkey',
  },
  cacheReboot: {
    name: 'Cache reboot — thundering herd', icon: '🧊',
    blurb: 'The cache comes up cold and the entire read load arrives at the origin at once.',
    dur: 6, random: true, hitMult: { cache: 0 },
    needs: s => s.infra.cacheNodes >= 1 && !s.infra.coalesce,
    insight: 'herd',
  },
  badPurge: {
    name: 'Bad cache purge', icon: '🧹',
    blurb: 'Someone purged the whole CDN. Every PoP is empty and your origin is exposed.',
    dur: 10, random: true, hitMult: { edge: 0.1 },
    needs: s => s.infra.pops >= 2,
    insight: 'shield',
  },
  replicaDown: {
    name: 'Replica falls behind', icon: '🐌',
    blurb: 'One replica per shard stops serving while it catches up on replay.',
    dur: 20, random: true, replicaOut: 1,
    needs: s => s.infra.replicas >= 1,
  },
  reportDay: {
    name: 'Quarter-end reporting', icon: '📊',
    blurb: 'Finance is running the numbers. On production.',
    dur: 20, random: true, mixMult: { analytics: 4 },
  },
  azOutage: {
    name: 'Availability zone lost', icon: '🏚️',
    blurb: 'One zone of three is gone. Everything you run in it went with it.',
    dur: 25, random: true, zoneOut: true,
    // Only once there is a system worth losing. A zone failure at nine hundred
    // requests per second is not a lesson about redundancy, it is a coin flip
    // landing on a startup that could not have afforded a second node yet.
    needs: s => s.report && s.report.demandRps > 8000,
    insight: 'redundancy',
  },
  botFlood: {
    name: 'Scraper flood', icon: '🕷️',
    blurb: 'A bot farm discovered your API. None of it is real traffic, and all of it costs you.',
    dur: 25, random: true, junkMult: 2.5,
    insight: 'quota',
  },
  gpuSqueeze: {
    name: 'Accelerator shortage', icon: '🪫',
    blurb: 'Your provider cut the quota. Inference capacity is down 45% and nobody is taking calls.',
    dur: 30, random: true, capMult: { gpu: 0.55 },
    needs: s => s.mix.infer > 0.02,
    insight: 'capacityrisk',
  },
  regionOutage: {
    name: 'Region degraded', icon: '🌐',
    blurb: 'A whole region is having a bad day. If you only have one, so are you.',
    dur: 30, random: true, regionOut: true,
    needs: s => s.report && s.report.demandRps > 20000,
    insight: 'blastradius',
  },
};
Content.EVENT_KEYS = Object.keys(Content.EVENTS);

// ---------------------------------------------------------------------------
// Insights — the field notes, written the moment the system teaches you
// something. They are also the thing you would take to an interview. `check(state, report)` fires experience-based cards;
// the rest fire from purchases (insightOnBuy) or events (insight).
//
// Every card ends with the sentence you would say out loud in the room.
Content.INSIGHTS = {
  hockey: {
    title: 'The hockey stick',
    text: 'Latency ≈ service time ÷ (1 − utilization). At 50% busy a 5ms call takes 10ms; at 90% it takes 50ms; at 98%, 250ms. Systems do not degrade linearly — they fall off a cliff, and the cliff is at a utilization that looks fine on a dashboard. Interview line: "I would plan capacity for about 70% and alarm at 80%, because the queueing curve means 90% is already a different system."',
    check: (s, r) => r.worstUtil >= 0.9 && r.p99 >= 2 * s.slo.p99Ms,
  },
  littles: {
    title: "Little's Law",
    text: 'Concurrent requests in flight = arrival rate × time each one takes (L = λW). 10,000 rps holding a connection for 10ms is 100 concurrent; the same 10,000 rps holding it for a second is 10,000 concurrent. Hold time, not traffic, is what exhausts a pool. Interview line: "How many concurrent connections does that imply? Rate times hold time."',
    check: (s, r) => r.sql.connUsed >= 0.5 * r.sql.connCap && r.sql.connCap > 0,
  },
  connstarve: {
    title: 'Connection starvation',
    text: 'Your database refused queries while its CPU was nearly idle. Relational databases handle a few hundred connections — each is a process with real memory — while an application fleet holds thousands open, mostly doing nothing. A pooler multiplexes them onto a few dozen busy ones. Interview line: "Before I scale the hardware I would put a connection pooler in front, because this fails on connections long before it fails on CPU."',
    check: (s, r) => r.sql.rejectRps > 1 && r.sql.util < 0.5,
  },
  indexes: {
    title: 'Indexes first',
    text: 'An unindexed query scans the table: O(n) pages. An index makes it O(log n) — 10× cheaper here, often 100–1000× in real life. The cost is that every write maintains every index (~20%) and they eat storage. It is nearly always the first thing to fix and the last thing anyone mentions in an interview.',
  },
  cachemath: {
    title: 'Cache math',
    text: 'A 90% hit rate means the origin sees 10× fewer reads; 99% means another 10×. Hit ratio is the highest-leverage number in a read-heavy system. But writes invalidate entries, so a write-heavy mix blunts it, and the achievable ceiling is set by how repeated the traffic is — not by how much cache you buy.',
    check: (s, r) => s.infra.cacheNodes > 0 && r.hits.cache > 0.75,
  },
  cacheroi: {
    title: 'A cache is only as good as your repetition',
    text: 'Your hit rate is stuck no matter how many nodes you add, because this workload does not re-read the same things. Caching pays when traffic repeats; on unique-read workloads (device telemetry, long-tail search, per-user writes) a cache is RAM-shaped cash on fire. Interview line: "First question: what is the read/write mix, and how repeated are the reads?"',
    check: (s, r) => s.infra.cacheNodes >= 2 && r.hits.cache < 0.45 && r.hits.cache > 0
      && r.perClass.read.demand > 100,
  },
  herd: {
    title: 'Thundering herd',
    text: 'When a cache empties, every request that would have hit it arrives at the origin simultaneously — a spike the exact size of your hit rate. Mitigations: staggered TTLs so keys do not expire together, cache warming, and request coalescing so exactly one miss refills a key. A cache big enough to save your origin is big enough to kill it.',
  },
  shield: {
    title: 'Origin shield',
    text: 'A hundred edge locations missing at once is a hundred requests for the same object arriving at your origin. A tiered cache — PoPs in front of a small mid-tier that fronts the origin — collapses that fan-in to one. Interview line: "I would put an origin shield behind the PoPs so a purge or a cold start does not multiply by the number of edges."',
  },
  cdn: {
    title: 'Push the bytes to the edge',
    text: 'A CDN is the cheapest scaling in this entire game and it is barely architecture: static and semi-static responses are served from a PoP near the user, so they never consume origin capacity, never traverse your app servers, and cost a fraction of the egress. Two numbers matter: hit ratio and how long you dare cache. Interview line: "What is cacheable here, and for how long?"',
  },
  edgecompute: {
    title: 'Compute at the edge',
    text: 'Once code runs in the PoP you can answer requests that are almost-but-not-quite static: personalized headers, auth checks, A/B assignment, redirects. The constraint is that there is no database next to you — an edge function that calls your origin for every request has only moved the latency around. Interview line: "What can be decided without state? That is what belongs at the edge."',
  },
  nodeheadroom: {
    title: 'A node buys two kinds of headroom',
    text: 'That replica did two things, and people plan for only the first. It added read capacity. It also raised the connection ceiling, because every database node accepts its own limited set of connections, so the cluster limit is per-node-limit × node count. That is why CPU and connection pressure often fall together when you widen a cluster — and why a system starving on connections can sometimes be cured by adding a node rather than tuning anything.',
  },
  replicawrites: {
    title: 'Replicas scale reads, not writes',
    text: 'Every replica replays every write to stay current, so replication eats replica capacity in direct proportion to your write volume. Your replicas are now spending a large share of themselves just keeping up. Read replicas multiply read capacity; write capacity does not move until you shard. Interview line: "Replicas are a read solution. If writes are the bottleneck they make it slightly worse."',
    check: (s, r) => r.sql.replayFrac >= 0.3,
  },
  replag: {
    title: 'Replication lag is a consistency choice',
    text: 'An overloaded replica serves the past, so a user who just wrote something reads it back missing. Fixes: route a user to the primary for a few seconds after their own write ("read your writes"), or pin sessions. Lag is not a bug, it is the price of scaling reads asynchronously — and choosing to pay it is an availability-over-consistency decision.',
    check: (s, r) => r.sql.staleFrac > 0.05,
  },
  wall: {
    title: 'The vertical wall',
    text: 'You have ridden the boxes as far as they are worth riding. Vertical scaling is the best deal in systems right up until it is not: no code changes, no new failure modes, no sharding maths — take it while the price tracks the capacity. Then the curve bends and hardware starts charging a premium for being exotic: less work per rung, more money, billed forever. Those boxes are not useless — capacity that arrives instantly is worth something when the alternative is a migration under load — but you are buying time, not value. Interview line: "I would scale vertically until the price stops tracking the capacity, and plan the split before that point, not after."',
    check: (s, r) => s.infra.tier >= Content.COMMODITY_TIER && r.sql.util >= 0.85,
  },
  sharding: {
    title: 'Sharding scales writes',
    text: 'Splitting rows across N primaries by key is the only thing that scales writes. The costs are real: queries that span shards must fan out and merge, transactions across shards get hard, and resharding means moving data while serving traffic. Choose the key so your common queries stay on one shard. Do it before you need it — a migration at 90% utilization is self-inflicted downtime.',
  },
  fanout: {
    title: 'Cross-shard fan-out',
    text: 'Your reports now touch every shard and merge the results. Each shard scans only its slice, so the bill is not N× the work — it is coordination: fan out, wait for the slowest, merge. That overhead climbs with every split, which is why 64 shards makes a report roughly 8× dearer than one. Sharding made writes cheap and joins expensive.',
    check: (s, r) => s.infra.shards >= 4 && !s.infra.olapEngine && r.perClass.analytics.demand > 0
      && r.units.sql.analytics > 0.25 * r.sql.cap,
  },
  hotkey: {
    title: 'Hot keys and skew',
    text: 'One key is most of your traffic, and hashing sends every request for it to the same node — so adding nodes does nothing at all. Fixes: replicate the hot key to every node, add a random suffix and fan in, or cache it in the application itself. Any "shard by key" answer deserves the follow-up you were just handed: what about skew?',
  },
  nosql: {
    title: 'The right store for the boring 60%',
    text: 'Key-value stores scale linearly because they refuse to do the hard things: no joins, no multi-row transactions, no ad-hoc queries. That refusal is the feature — it is what lets them partition without coordination. Sessions, flags, counters and short-link resolves belong there; your reports cannot follow them. Polyglot persistence means each workload on the store shaped like it, and each store costs a team.',
  },
  invertedindex: {
    title: 'Search is a different data structure',
    text: 'Text search on a relational table is a full scan — no B-tree helps you find a word in the middle of a document. An inverted index maps term → documents, which turns the scan into a lookup. The price is a second copy of your data that must be kept fresh, which is exactly the job change data capture exists to do.',
  },
  olap: {
    title: 'OLTP is not OLAP',
    text: 'Row stores answer many tiny point queries; column stores scan billions of rows for one aggregate. Running reports against the transaction database is how quarter-end takes down checkout. Ship changes into a columnar store and let reports be seconds behind and seconds slow — nobody joins a table mid-purchase. Interview line: "Analytics gets its own copy. Always."',
  },
  log: {
    title: 'The queue in front of the database',
    text: 'An append-only log accepts a write in a millisecond and lets every consumer read it at its own pace: the store of record, the search index, the columnar copy, the cache invalidator. It converts overload from errors into backlog, and one write into many derived views. But an acknowledged write is not yet a stored write — that gap is a design decision you must be able to defend.',
  },
  queuedebt: {
    title: 'A queue is debt, not capacity',
    text: 'The log absorbed a burst your database could not, so nothing errored — but the backlog is data your users cannot see yet. A queue converts overload from failure into staleness, which is strictly better and absolutely not free. Watch drain rate against arrival rate: a backlog that never drains is an outage with better manners.',
    check: (s, r) => s.infra.streamParts > 0 && s.backlog > 0 && s.backlogAge > 3,
  },
  idempotency: {
    title: 'At-least-once means twice',
    text: 'Every real queue delivers at least once, which means sometimes twice: a consumer crashes after applying a change but before acknowledging it, and the message comes back. If applying it twice charges the card twice, you do not have a delivery problem, you have a design problem. Give every message a key and make the consumer idempotent — that is what "exactly-once" actually is in practice.',
  },
  cdc: {
    title: 'Change data capture',
    text: 'Rather than writing to your database and your search index and your columnar copy — and being wrong in a different way in each — write once and tail the database\'s own replication log into the queue. Every read model is a consumer. This is how you keep four copies of the truth without four chances to lose it.',
  },
  blob: {
    title: 'Blobs do not go in the database',
    text: 'Media in a relational database consumes the most expensive capacity you own to move bytes that need no transaction, no index and no join. Object storage gives eleven nines of durability for a fraction of the price, and the request never touches your app servers if you hand back a signed URL. Interview line: "Store the object in blob storage and the path in the database."',
  },
  egress: {
    title: 'Bandwidth is a line item',
    text: 'At media scale the bill is not compute, it is bytes leaving your network. This is why the CDN hit ratio is a financial metric and not a performance one: every point of hit rate is egress you do not pay origin prices for. Interview line: "What is the egress volume, and what fraction can be served from cache?"',
    check: (s, r) => r.costs.byKey.usage && r.costs.byKey.usage.total > 0.3 * r.spend && r.spend > 40,
  },
  connections: {
    title: 'Connections are a different resource',
    text: 'A realtime tier is not sized in requests per second, it is sized in concurrent sockets — and a socket costs memory whether or not anyone is talking. That makes it stateful in a way the rest of your fleet is not: a deploy disconnects everyone, reconnects arrive as a stampede, and you must plan for the reconnect, not the steady state.',
  },
  autoscale: {
    title: 'Autoscaling is not a burst plan',
    text: 'Scaling on a metric means observing the metric, deciding, provisioning and warming up — thirty seconds to several minutes. Bursts arrive in one. Autoscaling is a cost optimization that lets you stop paying for the trough; surviving the spike still requires headroom, a queue, or the willingness to shed. Interview line: "Autoscaling handles the diurnal curve. The flash crowd needs headroom or shedding."',
  },
  shed: {
    title: 'Shed load before it sheds you',
    text: 'An overloaded system that accepts everything serves nothing: queues grow, every request times out, and the work is thrown away after being paid for. Rejecting the excess immediately keeps the rest fast, and a fast 429 is a better answer than a slow failure. Interview line: "At the edge of capacity I would rather fail 10% fast than fail 100% slowly."',
  },
  quota: {
    title: 'Rate limiting is capacity planning',
    text: 'A quota at the door is the only thing standing between one badly-written client and your entire error budget. Token bucket per key, enforced as far forward as possible — ideally at the edge, where rejecting is nearly free. It also makes your capacity model possible: you cannot plan for a load you have not bounded.',
  },
  redundancy: {
    title: 'N+1, or it is not redundant',
    text: 'Any tier running on one node is a single point of failure, and the failure will not be dramatic — a zone reboots, a deploy goes wrong, a disk fills. Two nodes is not twice the cost of one, it is the difference between degraded and down. Spread across failure domains, then make sure the remaining nodes can carry the load, because N+1 that cannot survive losing the 1 is just N.',
  },
  failover: {
    title: 'Failover is a practiced thing',
    text: 'A standby you have never promoted is a hypothesis, not a plan. Synchronous replication to another zone costs you commit latency every single day to buy back the one day the primary dies. The interesting question in the room is not "do you have a standby" but "how long does promotion take, who decides, and what happens to the writes in flight?"',
  },
  blastradius: {
    title: 'Blast radius',
    text: 'Every shared thing is a way for one problem to become everyone\'s problem. Cell-based architecture puts a bounded set of users on an independent slice of the stack so a bad deploy or a poison request takes down 1/N of your customers instead of all of them. Regions are the same idea at geographic scale. Interview line: "What is the blast radius of this component failing, and what bounds it?"',
  },
  multiregion: {
    title: 'Multi-region is a consistency decision',
    text: 'A second region buys latency for distant users and survival for a regional failure, and it costs you a copy of everything plus a question you cannot dodge: what happens when both regions accept a write for the same row? Active-passive keeps one writer and fails over. Active-active needs partitioned ownership, or conflict resolution, or data that does not conflict. Pick before you build.',
  },
  cap: {
    title: 'CAP, honestly',
    text: 'Partitions happen; you do not choose whether to tolerate them, only what to do during one. Refuse writes and stay consistent, or accept them and reconcile later. The useful version of the question is per-feature, not per-system: a shopping cart can be eventually consistent, and the payment that empties it cannot. Interview line: "Which operations need strong consistency? Usually far fewer than people assume."',
  },
  signals: {
    title: 'The four golden signals',
    text: 'Every box on this board should answer the same four questions: TRAFFIC — how much is arriving? LATENCY — how long does it take, at p50 and p99? ERRORS — how many fail, and from which cause? SATURATION — how full is the constrained resource? RED (Rate, Errors, Duration) frames the things you call; USE (Utilization, Saturation, Errors) frames the things you own. If you cannot answer all four for a component, you cannot debug it at 3am — and "what would you monitor?" is really "do you know what constrains this?"',
  },
  budget: {
    title: 'Error budgets',
    text: '99.9% availability is not a promise never to fail, it is permission to fail 0.1% of the time — about 43 minutes a month. That allowance is a budget, and it is the only honest way to trade reliability against everything else: if the budget is intact, ship faster; if it is spent, stop shipping and go fix things. Interview line: "What is the availability target, and what does that allow us in minutes?"',
    check: (s, r) => s.budget.spentFrac > 0.5,
  },
  buildvsbuy: {
    title: 'Rent it until renting costs more than owning',
    text: 'A hosted API has zero fixed cost, no capacity planning and a per-request price. Your own fleet has a large fixed cost, real operational weight and a much lower marginal price. There is a crossover volume, and it moves: below it, owning is a hobby; above it, renting is a tax. Interview line: "At what request volume does self-hosting pay for itself, and how confident are we we will get there?"',
  },
  batching: {
    title: 'Throughput and latency are different dials',
    text: 'Batching work through an accelerator raises throughput several-fold by keeping it busy, and raises every individual request\'s latency by the time it waits for a slot. That trade is everywhere — group commit in databases, Nagle in TCP, buffered writes — and it is only a good trade if your latency budget has the room. Interview line: "What is the deadline? That decides how much batching we can afford."',
  },
  semantic: {
    title: 'The cheapest inference is none',
    text: 'A model call costs two orders of magnitude more than any other request in this system, so the architecture is mostly a set of ways to avoid making one: cache answers to near-identical prompts, route easy work to a small model, and retrieve facts instead of asking the model to remember them. Interview line: "What fraction of calls can be answered without invoking the large model?"',
  },
  routing: {
    title: 'Model routing',
    text: 'Most requests do not need your best model. A classifier in front that sends the easy majority to something small and fast cuts cost and latency together, and the interesting failure mode is quiet: quality degrades on the requests you misrouted and nobody notices for a week. If you propose this, propose the evaluation that catches it.',
  },
  retrieval: {
    title: 'Retrieval is a database problem',
    text: 'Grounding a model in your own data is a search system with an embedding step: chunk, embed, index, retrieve, rank, and put the passages in the prompt. The hard parts are the ordinary ones — freshness when documents change, recall you cannot eyeball, and access control on the retrieved passages. Interview line: "Retrieval quality bounds answer quality; I would measure recall before touching the model."',
  },
  capacityrisk: {
    title: 'Someone else\'s capacity is someone else\'s priority',
    text: 'Your provider just cut your quota and there was nothing to buy. Any component you do not control is a dependency with its own incidents, its own limits and its own customers ahead of you. The mitigations are the boring ones: a second provider, graceful degradation to a smaller model, and a queue that lets you serve late rather than not at all.',
  },
  opex: {
    title: 'Every system you add costs a team',
    text: 'Look at your burn: most of it is not hosting. Each distinct system carries a fixed operational cost from the moment it exists — someone has to know it, monitor it, page on it and fix it at 3am. That cost is a step function, not a slope: the first node of anything is expensive, the tenth is cheap. This is the real argument against adding one more database for one more feature.',
    check: (s, r) => r.costs.fixed > 0.45 * r.spend && r.spend > 30,
  },
  runway: {
    title: 'Burn rate and runway',
    text: 'You are spending faster than you earn and the runway counter is the only thing between you and the door. Idle capacity bills every second whether traffic uses it or not — over-provisioning is not "safe", it is expensive insurance. The fix is more served traffic or less architecture: shut down what is not carrying its weight.',
    check: (s, r) => r.spend > r.income && s.cash < 25 * (r.spend - r.income) && s.t > 60,
  },
  estimate: {
    title: 'Back of the envelope',
    text: 'You are serving a number you could have predicted: requests per second × payload = bandwidth, requests × hold time = concurrency, writes per second × retention = storage. Doing that arithmetic out loud early is what turns an architecture argument into an engineering one, and it is most of what an interviewer is listening for in the first ten minutes.',
    check: (s, r) => r.servedRps > 0.25 * s.slo.targetRps && s.budget.spentFrac < 0.35,
  },
};
Content.INSIGHT_KEYS = Object.keys(Content.INSIGHTS);

// ---------------------------------------------------------------------------
// The rubric — the architecture review you get when the run ends, written from
// what you built, when you built it, and what it cost.
//
// These seven lines are deliberately the seven things a system design interview
// is listening for, which is the other reason the game exists: a run that reads
// well here is an answer that would read well out loud.
//
// Each line scores 0..1 over the run summary Engine accumulates. `note` turns
// the score back into the sentence a reviewer would write on the sheet.
const band = (x, good, bad) => Math.max(0, Math.min(1, (x - bad) / (good - bad)));

Content.RUBRIC = [
  {
    key: 'requirements', name: 'Requirements met',
    what: 'Did the system do what the brief asked, at the scale and latency it named?',
    score: run => 0.45 * band(run.sloAttainment, 0.99, 0.6)
      + 0.35 * band(1 - run.budgetSpent, 0.6, 0)
      + 0.20 * band(run.peakServedFrac, 1, 0.2),
    note: (run, s) => run.sloAttainment >= 0.98
      ? 'held ' + Math.round(100 * run.sloAttainment) + '% of requests inside the ' + s.slo.p99Ms + 'ms target'
      : 'missed the latency target for ' + Math.round(100 * (1 - run.sloAttainment)) + '% of traffic',
  },
  {
    key: 'estimation', name: 'Capacity planning',
    what: 'Did you provision ahead of the wall, or arrive after it?',
    score: run => 0.6 * band(run.proactiveFrac, 0.8, 0.2) + 0.4 * band(1 - run.idleFrac, 0.75, 0.25),
    note: run => run.proactiveFrac >= 0.7
      ? 'bought capacity before the gauges went red, ' + Math.round(100 * run.proactiveFrac) + '% of the time'
      : Math.round(100 * (1 - run.proactiveFrac)) + '% of purchases were made under fire',
  },
  {
    key: 'design', name: 'Component fit',
    what: 'Is each class of traffic served by the thing shaped for it?',
    score: run => band(run.fitFrac, 0.97, 0.5),
    note: run => (run.fitFrac > 0.95
      ? 'every traffic class landed on the component built for it'
      : 'work stayed on the wrong component: ' + run.misfits.slice(0, 3).join(', ')),
  },
  {
    key: 'bottlenecks', name: 'Bottleneck handling',
    what: 'When it broke, did you find the constraint and clear it quickly?',
    score: run => 0.55 * band(1 - run.redFrac, 0.97, 0.6) + 0.45 * band(1 - run.outageFrac, 1, 0.15),
    note: run => run.redFrac < 0.05
      ? 'kept the system out of saturation for ' + Math.round(100 * (1 - run.redFrac)) + '% of the run'
      : 'ran saturated for ' + Math.round(100 * run.redFrac) + '% of the run',
  },
  {
    key: 'tradeoffs', name: 'Tradeoffs named',
    what: 'Did you meet — and survive — the decisions that have two sides?',
    score: run => 0.6 * band(run.insightFrac, 0.6, 0.1) + 0.4 * band(1 - run.violationFrac, 1, 0.3),
    note: run => run.violations.length === 0
      ? run.insightCount + ' tradeoffs met head-on and survived'
      : 'unresolved: ' + run.violations.slice(0, 2).join('; '),
  },
  {
    key: 'operability', name: 'Operability',
    what: 'Could you see it, and could it survive losing a piece of itself?',
    score: run => 0.4 * band(run.obsLevel / 2, 1, 0) + 0.6 * band(1 - run.spofFrac, 0.9, 0.3),
    note: run => run.spofFrac < 0.15
      ? 'no single points of failure once the system mattered'
      : Math.round(100 * run.spofFrac) + '% of the run had a tier running on one node',
  },
  {
    key: 'cost', name: 'Cost discipline',
    what: 'Would the business have signed off on this bill?',
    score: run => 0.6 * band(run.costRatio, 0.7, 1.6) + 0.4 * band(run.margin, 0.45, -0.2),
    note: (run, s) => run.costRatio <= 1
      ? 'ran at ' + Math.round(100 * run.costRatio) + '% of the $' + s.slo.costCeiling + '/s ceiling'
      : 'ran ' + Math.round(100 * (run.costRatio - 1)) + '% over the cost ceiling',
  },
];

// Letter grades. The boundaries are deliberately generous at the bottom and
// tight at the top: a system that stayed up is a pass, and an A means you did
// the thing a good architect would have done before being asked.
Content.GRADES = [
  { min: 0.93, letter: 'A' }, { min: 0.86, letter: 'A-' }, { min: 0.79, letter: 'B+' },
  { min: 0.71, letter: 'B' }, { min: 0.63, letter: 'B-' }, { min: 0.55, letter: 'C+' },
  { min: 0.46, letter: 'C' }, { min: 0.36, letter: 'C-' }, { min: 0.25, letter: 'D' },
  { min: -1, letter: 'F' },
];

Content.gradeOf = score => Content.GRADES.find(g => score >= g.min).letter;

// The verdict line at the top of the review.
Content.VERDICTS = [
  { min: 0.90, text: 'Textbook. Every constraint was named before it bit.' },
  { min: 0.78, text: 'Solid. You found the bottleneck each time, mostly before it found you.' },
  { min: 0.64, text: 'Workable. The architecture is right; the timing was late.' },
  { min: 0.50, text: 'It stayed up. The bill and the pager tell the rest of the story.' },
  { min: 0.34, text: 'Rough. The right components arrived after the outage.' },
  { min: -1, text: 'This is a post-mortem, not an architecture.' },
];

if (typeof module !== 'undefined') module.exports = Content;
