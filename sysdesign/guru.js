// LOAD BEARING — the guru: a live diagnosis of the board.
//
// It answers the question players actually have — "everything is red, what do I
// buy?" — by looking at WHERE the work is going rather than only at how much of
// it there is. Rules are ordered by urgency and each reads live numbers; the
// first few that fire become the cards.
//
// The headless bot in test/sim.js plays from exactly these rules, so the advice
// is not a separate opinion about the game: if the guru is wrong, the bot
// cannot win, and the sim says so.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./memos.js');
  var Engine = require('./engine.js');
}

var Guru = (() => {
  const S = Content.SIM;
  const BAD = Content.BANDS.util.bad;
  const WARN = Content.BANDS.util.warn;

  const util = (r, key) => r.stations[key].util;
  // share of the database's work that one class of traffic is responsible for
  const sqlShare = (r, k) => (r.totalUnits > 0 ? r.units.sql.byClass[k] / Math.max(1, r.sql.cap) : 0);
  // Affordability is three questions, and people only ask the first.
  //   Can I pay the sticker price?
  //   Can I carry the run-rate it leaves behind, forever?
  //   And is this a system I already run, or one I am adopting?
  // That last one is the important one. Widening something you already operate
  // costs hosting; adopting something new costs a team, and a team you cannot
  // pay for out of revenue is not a purchase, it is a countdown.
  const affordable = (s, key) => {
    const item = Content.SHOP_BY_KEY[key];
    const price = item.price(s);
    if (price === null || s.cash < price) return false;
    if (!s.report) return true;
    const income = s.report.income;
    // A cheap piece of software is always worth adopting — indexes, a pooler,
    // coalescing, a quota. It is the systems with a TEAM attached that have to
    // wait until the revenue can carry them.
    if (!item.owned(s) && item.fixed > 3 && item.fixed > 0.3 * income) return false;
    const burn = Engine.expensesIfBought(s, key);
    const left = s.cash - price;
    // Two reserves, and they answer different questions. Eight seconds of total
    // burn, so there is always enough left to buy the NEXT thing rather than
    // spending every dollar the second it arrives. And twenty-five seconds of
    // the net drain, because the gap between burn and income is the only thing
    // actually consuming runway — a system that costs what it earns can be run
    // on very little cash; one that costs twice what it earns cannot.
    return left >= 8 * burn && left >= 25 * Math.max(0, burn - income);
  };

  // Which class of traffic is the one blowing the latency budget, weighted by
  // how much of it there is — a slow class nobody requests is not your problem.
  const slowestClass = (r, s) => Content.CLASS_KEYS
    .filter(k => r.perClass[k].served > 0 && !r.perClass[k].offPath)
    .sort((a, b) => (r.perClass[b].latencyMs - r.perClass[a].latencyMs))
    .find(k => r.perClass[k].served > 0.005 * r.servedRps) || 'read';

  // ...and the thing that makes each one faster. Ordered by leverage: avoid the
  // work, then move it somewhere shaped for it, then buy more of the thing.
  const SLO_FIX = {
    // Avoid the call, then make the call smaller, then make it wait less. Past
    // the point where the accelerators are mostly idle, more of them buy
    // nothing: you cannot fix a 200ms model with a shorter queue.
    infer: (s, r) => {
      if (s.infra.gpuNodes === 0) return 'gpu';
      if (!s.infra.router) return 'router';
      if (s.infra.cacheNodes === 0) return 'cache';
      if (!s.infra.semanticCache) return 'semanticCache';
      return r.stations.gpu.util > 0.35 ? 'gpu' : null;
    },
    analytics: s => derivedFix(s, 'olapEngine'),
    search: s => derivedFix(s, 'searchEngine'),
    media: s => (s.infra.objstore ? 'cdn' : 'objstore'),
    read: s => (s.infra.cacheNodes === 0 ? 'cache' : (s.infra.pops === 0 ? 'cdn' : 'cache')),
    lookup: s => (s.infra.kvEngine ? 'tier' : 'kvEngine'),
    write: s => (s.infra.tier < Content.COMMODITY_TIER ? 'tier' : 'shard'),
    realtime: s => (s.infra.push ? 'app' : 'push'),
  };

  // The one place that answers "this box is full — what do I buy?". Every rule
  // that widens a tier routes through here, so a new station is one entry.
  const SCALE_OUT = {
    edge: 'cdn', app: 'app', cache: 'cache', stream: 'stream',
    sql: 'replica', derived: 'derived', gpu: 'gpu', objstore: null,
  };

  // A read model is two purchases: the engine that answers the query shape, and
  // the fleet it runs on. Ask for whichever is missing.
  const derivedFix = (s, engine) => (s.infra.derivedNodes === 0 ? 'derived' : engine);

  // A rule fires on live numbers and names one purchase. `buy` is what the bot
  // clicks and what the card's button does; null means the advice is to stop
  // buying, which is advice too.
  const RULES = [
    // --- nothing is running yet ---------------------------------------------
    {
      key: 'design',
      when: s => !s.live,
      headline: 'Nothing is built yet',
      why: (r, s) => {
        const top = Content.CLASS_KEYS
          .filter(k => s.mix[k] >= 0.05)
          .sort((a, b) => s.mix[b] - s.mix[a])
          .slice(0, 3);
        return 'This workload is '
          + top.map(k => Math.round(100 * s.mix[k]) + '% ' + Content.CLASSES[k].label).join(', ')
          + '. ' + top.map(k => Content.CLASSES[k].label + ' wants ' + Content.CLASSES[k].wants)
            .join('; ') + '.';
      },
      action: 'Draw the smallest system that can serve this, then go live. You can '
        + 'add boxes once you know what hurts; you cannot know before there is traffic, '
        + 'and everything you build now bills from the moment it exists.',
      buy: s => {
        if (s.infra.appMax === 0) return 'app';
        if (s.infra.tier === 0) return 'tier';
        if (!s.infra.indexes) return 'indexes';
        return null;
      },
    },
    // --- the run ends here, whatever else is wrong ------------------------
    {
      key: 'outOfRunway',
      when: (s, r) => r.spend > r.income && r.runway < 60,
      headline: 'You are about to run out of money, and that ends the run',
      why: (r, s) => 'Spend is $' + r.spend.toFixed(0) + '/s against $' + r.income.toFixed(0)
        + '/s of revenue — about ' + Math.round(r.runway) + ' seconds of runway. Below zero '
        + 'there is no next purchase, whatever the graphs say.',
      action: 'Scale something down. Nothing is refunded, but the run-rate stops '
        + 'immediately — and run-rate is the only thing that was ever going to kill you.',
      buy: null,
      undo: (s, r) => nextScaleDown(s),
    },
    {
      key: 'spof',
      when: (s, r) => r.minRedundancy <= 1 && r.demandRps > 4000,
      headline: 'A tier is running on one node',
      why: (r, s) => {
        const weak = Content.STATION_KEYS
          .filter(k => r.stations[k].owned && r.stations[k].nodes <= 1)
          .map(k => Content.STATIONS[k].short);
        return weak.join(', ') + ' has no redundancy. A zone reboot, a bad deploy or a '
          + 'full disk takes the whole system with it — and the graph will not warn you first.';
      },
      action: 'Double the tier running alone. N+1 is not an optimization.',
      buy: (s, r) => {
        const weak = Content.STATION_KEYS.find(k => r.stations[k].owned && r.stations[k].nodes <= 1);
        return SCALE_OUT[weak];
      },
    },
    {
      key: 'connstarve',
      when: (s, r) => !s.infra.pooler && r.sql.rejectRps > 1,
      headline: 'The database is refusing connections, not queries',
      why: r => 'It is turning away ' + Math.round(r.sql.rejectRps) + ' req/s at '
        + Math.round(100 * r.sql.primaryUtil) + '% CPU. Connections are held, not consumed: '
        + Math.round(r.sql.connUsed) + ' wanted against a ceiling of ' + Math.round(r.sql.connCap) + '.',
      action: 'Buy the connection pooler. It is the cheapest fix on this board.',
      buy: () => 'pooler',
    },
    {
      key: 'indexes',
      when: (s, r) => !s.infra.indexes && sqlShare(r, 'read') > 0.25,
      headline: 'Every read is scanning the table',
      why: r => 'Unindexed reads are ' + Math.round(100 * sqlShare(r, 'read'))
        + '% of your database capacity, at ten units each. Indexed they cost one.',
      action: 'Add indexes. Ten times cheaper reads for a twenty percent write tax.',
      buy: () => 'indexes',
    },
    // --- work in the wrong place. Moving it is cheaper than buying capacity
    //     to do it badly, so these outrank every "widen the tier" rule below.
    {
      key: 'mediaInDb',
      when: (s, r) => !s.infra.objstore && sqlShare(r, 'media') > 0.1 && r.perClass.media.demand > 250,
      headline: 'Media is being served out of the database',
      why: r => 'Blobs are ' + Math.round(100 * sqlShare(r, 'media'))
        + '% of your most expensive capacity, to move bytes that need no transaction, '
        + 'no index and no join.',
      action: 'Provision object storage. Then put a CDN in front of it.',
      buy: () => 'objstore',
    },
    {
      key: 'searchScan',
      when: (s, r) => !s.infra.searchEngine && sqlShare(r, 'search') > 0.12 && r.perClass.search.demand > 300,
      headline: 'Search is a full table scan',
      why: r => 'Text queries are ' + Math.round(100 * sqlShare(r, 'search'))
        + '% of the database. No B-tree can find a word in the middle of a document.',
      action: 'Build the inverted index. It is a different data structure, not a bigger box.',
      buy: s => derivedFix(s, 'searchEngine'),
    },
    {
      key: 'reportsOnProd',
      when: (s, r) => !s.infra.olapEngine && sqlShare(r, 'analytics') > 0.3 && r.demandRps > 4000,
      headline: 'Reports are competing with transactions',
      why: r => 'Analytics is ' + Math.round(100 * sqlShare(r, 'analytics'))
        + '% of your database load. Row stores answer point queries; reports scan. '
        + 'Sharding makes this worse, because every report then fans out to every shard.',
      action: 'Move reporting to a columnar copy and let it be seconds behind.',
      buy: s => derivedFix(s, 'olapEngine'),
    },
    {
      key: 'polling',
      when: (s, r) => !s.infra.push && r.perClass.realtime.demand > 600,
      headline: 'Realtime traffic is polling your app servers',
      why: r => Math.round(r.perClass.realtime.demand) + ' req/s of live updates are being '
        + 'faked with repeated requests, at ' + S.POLL_UNITS + ' units of app-server capacity each.',
      action: 'Turn on push delivery. It is sized in sockets, not requests.',
      buy: () => 'push',
    },
    {
      key: 'lookupsOnSql',
      when: (s, r) => !s.infra.kvEngine && sqlShare(r, 'lookup') > 0.25 && r.perClass.lookup.demand > 2500,
      headline: 'Key lookups are on the relational database',
      why: r => 'Sessions, flags and counters are ' + Math.round(100 * sqlShare(r, 'lookup'))
        + '% of your database. None of them need a join, a transaction or a query planner.',
      action: 'Switch them to the key-value engine — it partitions without coordinating.',
      buy: () => 'kvEngine',
    },
    // --- the database is full, and which fix depends on WHAT filled it -----
    {
      key: 'writeBound',
      when: (s, r) => r.sql.primaryUtil > WARN && r.demandRps > 3000
        && r.units.sql.write + r.units.sql.byClass.realtime > 0.4 * r.sql.cap,
      headline: 'You are write-bound, and only two things move that',
      why: r => 'Writes are ' + Math.round(100 * (r.units.sql.write + r.units.sql.byClass.realtime) / Math.max(1, r.sql.cap))
        + '% of primary capacity. Caches cannot absorb a write and replicas cannot '
        + 'serve one — every replica makes it slightly worse by replaying them all.',
      action: (s) => (s.infra.streamParts === 0
        ? 'Put a queue in front to absorb bursts, then split the shards.'
        : 'Split the shards. N primaries is N× the write capacity.'),
      buy: (s) => (s.infra.streamParts === 0 ? 'stream' : 'shard'),
    },
    {
      key: 'backlogStuck',
      when: (s, r) => s.infra.streamParts > 0 && r.backlog > 2000 && s.backlogAge > 8,
      headline: 'The backlog is not draining',
      why: r => Math.round(r.backlog) + ' units of acknowledged writes are queued and the '
        + 'database is not catching up. A queue converts overload into staleness; it '
        + 'does not remove it.',
      action: 'Add primary capacity — a bigger box now, more shards for good.',
      buy: (s) => (s.infra.tier < Content.COMMODITY_TIER ? 'tier' : 'shard'),
    },
    {
      key: 'replayHeavy',
      when: (s, r) => r.sql.replayFrac > 0.45 && s.infra.replicas > 0
        && r.sql.primaryUtil > WARN && r.demandRps > 3000,
      headline: 'Your replicas are mostly replaying writes',
      why: r => Math.round(100 * r.sql.replayFrac) + '% of replica capacity is spent keeping '
        + 'up with the primary rather than serving anybody. More replicas will not help.',
      action: 'Shard instead — the write volume itself has to be split.',
      buy: () => 'shard',
    },
    {
      key: 'readBound',
      when: (s, r) => r.sql.primaryUtil > WARN && s.infra.replicas === 0
        && r.units.sql.read + r.units.sql.byClass.lookup > 0.35 * r.sql.cap,
      headline: 'You are read-bound with no replicas',
      why: () => 'Reads dominate the database and every one of them is on the primary. '
        + 'A replica adds read capacity AND raises the connection ceiling, because every '
        + 'node accepts its own connections.',
      action: 'Add a read replica — the classic first horizontal move.',
      buy: () => 'replica',
    },
    {
      key: 'verticalWall',
      when: (s, r) => s.infra.tier >= Content.COMMODITY_TIER && r.sql.primaryUtil > WARN,
      headline: 'Vertical scaling has stopped paying',
      why: (r, s) => 'You are on tier ' + s.infra.tier + '. Past the commodity ladder each '
        + 'rung buys 1.5× the work for 2.5× the money, billed forever. There is always a '
        + 'bigger box; the question is whether it is still cheaper than changing the shape.',
      action: 'Split the shards. Everything left is horizontal.',
      buy: () => 'shard',
    },
    {
      key: 'verticalOk',
      when: (s, r) => s.infra.tier < Content.COMMODITY_TIER && r.sql.primaryUtil > WARN,
      headline: 'The database is the bottleneck, and the box is still cheap',
      why: (r, s) => 'Primary at ' + Math.round(100 * r.sql.primaryUtil) + '%, on tier '
        + s.infra.tier + ' of ' + Content.COMMODITY_TIER + ' commodity rungs. Up here the '
        + 'price still tracks the capacity, so a bigger box is honest value and needs no redesign.',
      action: 'Take the bigger box — and plan the shard split before you need it.',
      buy: () => 'tier',
    },
    // --- everything else that is out of capacity ---------------------------
    {
      key: 'appFull',
      when: (s, r) => r.stations.app.ceilUtil > WARN,
      headline: 'The app servers are saturated',
      why: r => 'Instances are at ' + Math.round(100 * r.stations.app.ceilUtil)
        + '% of the fleet ceiling, and latency is service ÷ (1 − utilization) — the last 15% '
        + 'of a fleet costs more latency than the first 70%.',
      action: 'Double the fleet. This is the cheap axis: stateless scales sideways.',
      buy: (s) => (s.infra.appMax >= 4 && !s.infra.autoscale ? 'autoscale' : 'app'),
    },
    {
      key: 'cacheFull',
      when: (s, r) => s.infra.cacheNodes > 0 && util(r, 'cache') > BAD,
      headline: 'The cache is out of capacity',
      why: r => 'Cache nodes are at ' + Math.round(100 * util(r, 'cache'))
        + '%. Past full, misses fall through to the origin all at once.',
      action: 'Double the cache fleet.',
      buy: () => 'cache',
    },
    {
      key: 'derivedFull',
      when: (s, r) => s.infra.derivedNodes > 0 && util(r, 'derived') > BAD,
      headline: 'The read models are saturated',
      why: r => 'Your read models are at ' + Math.round(100 * util(r, 'derived'))
        + '% — search, reports and retrieval share one fleet, and it is full.',
      action: 'Double the read-model fleet.',
      buy: () => 'derived',
    },
    {
      key: 'apiCeiling',
      when: (s, r) => s.infra.gpuNodes === 0 && r.perClass.infer.demand > 0.65 * S.API_RPS,
      headline: 'You have hit the rented rate limit',
      why: r => Math.round(r.perClass.infer.demand) + ' req/s of inference against a provider '
        + 'quota of ' + S.API_RPS + '. There is nothing to buy from them, and the '
        + 'per-request price has already passed what a fleet would cost.',
      action: 'Self-host the accelerators. Above the crossover, renting is a tax.',
      buy: () => 'gpu',
    },
    {
      key: 'inferExpensive',
      when: (s, r) => r.perClass.infer.demand > 50 && util(r, 'gpu') > WARN,
      headline: 'Inference is the constraint, and it is the expensive one',
      why: r => 'Model serving is at ' + Math.round(100 * util(r, 'gpu'))
        + '%, and each call costs two orders of magnitude more than anything else here. '
        + 'Buying more accelerators is the last resort, not the first.',
      action: 'Avoid the call first: semantic cache, then small-model routing, then batching.',
      buy: (s, r) => {
        if (s.infra.cacheNodes === 0) return 'cache';
        if (!s.infra.semanticCache) return 'semanticCache';
        if (s.infra.gpuNodes === 0) return 'gpu';
        if (!s.infra.router) return 'router';
        if (!s.infra.batching && util(r, 'gpu') > 0.75) return 'batching';
        return 'gpu';
      },
    },
    // --- stop accepting work you cannot finish ------------------------------
    {
      key: 'timeouts',
      when: (s, r) => !s.infra.loadShed && (r.fails.timeout || 0) > 0.04 * r.demandRps,
      headline: 'Overload is turning into timeouts',
      why: r => Math.round(r.fails.timeout) + ' req/s are being accepted, queued, worked on '
        + 'and then thrown away past the deadline. That is the worst way to fail: you pay '
        + 'for the work and deliver nothing.',
      action: 'Arm load shedding. A fast rejection beats a slow failure.',
      buy: () => 'loadShed',
    },
    {
      key: 'junk',
      when: (s, r) => !s.infra.rateLimit && r.junkRps > 0.1 * r.realRps,
      headline: 'You are serving traffic that will never pay you',
      why: r => Math.round(r.junkRps) + ' req/s of the load is abuse, and it is consuming '
        + 'the same capacity as your customers.',
      action: 'Enforce quotas at the door, where rejecting is nearly free.',
      buy: () => 'rateLimit',
    },
    // --- fast enough is a requirement too -----------------------------------
    {
      key: 'batchLatency',
      when: (s, r) => s.infra.batching && util(r, 'gpu') < 0.5
        && r.p99 > s.slo.p99Ms * 1.05 && r.perClass.infer.served > 20,
      headline: 'Batching is costing you latency you are not using',
      why: (r, s) => 'Continuous batching buys throughput by making every request wait '
        + 'for a slot — about ' + S.GPU_BATCH_MS + 'ms of it. Your accelerators are only '
        + Math.round(100 * util(r, 'gpu')) + '% busy, so you are paying that tail for '
        + 'throughput you do not need.',
      action: 'Turn batching off. Throughput and latency are different dials, and you '
        + 'are turning the wrong one.',
      buy: null,
      undo: () => 'batching',
    },
    {
      key: 'sloMiss',
      when: (s, r) => r.p99 > s.slo.p99Ms * 1.05 && r.errRate < 0.06 && r.demandRps > 500,
      headline: 'One slow path is setting your p99',
      why: (r, s) => {
        const worst = slowestClass(r, s);
        return Content.CLASSES[worst].label + ' is taking '
          + Math.round(r.perClass[worst].latencyMs) + 'ms against a ' + s.slo.p99Ms
          + 'ms target. A tail is not an average: the slowest few percent of requests '
          + 'are the number the brief is written about.';
      },
      action: (s, r) => 'Make that path faster — or take it off the path entirely.',
      buy: (s, r) => SLO_FIX[slowestClass(r, s)](s, r),
    },
    // --- nothing is broken yet, and this is when the cheap moves are cheap --
    {
      key: 'noRetrieval',
      when: (s, r) => r.perClass.infer.demand > 250 && !s.infra.vectorEngine,
      headline: 'The model is answering without your data',
      why: () => 'Every inference request is going to the model with no retrieved context. '
        + 'Grounding is a search problem before it is a model problem.',
      action: 'Add a vector index so answers come from your corpus.',
      buy: s => derivedFix(s, 'vectorEngine'),
    },
    {
      key: 'edgeOffload',
      when: (s, r) => s.infra.pops === 0
        && (r.perClass.media.demand > 200 || r.perClass.read.demand > 3000),
      headline: 'Nothing is being served from the edge',
      why: r => Math.round(r.perClass.media.demand + r.perClass.read.demand)
        + ' req/s of cacheable traffic is travelling all the way to your origin, and '
        + 'paying origin egress prices to travel back.',
      action: 'Put a CDN in front. It is the cheapest capacity in the game.',
      buy: () => 'cdn',
    },
    {
      key: 'cacheMissing',
      when: (s, r) => s.infra.cacheNodes === 0 && r.perClass.read.demand > 1200 && s.repetition > 0.5,
      headline: 'Repeated reads are all reaching the database',
      why: (r, s) => 'This workload re-reads the same things ' + Math.round(100 * s.repetition)
        + '% of the time, and every one of those reads is currently a database query.',
      action: 'Add cache nodes. Each point of hit rate is load the origin never sees.',
      buy: () => 'cache',
    },
    {
      key: 'cacheFutile',
      when: (s, r) => s.infra.cacheNodes >= 2 && r.hits.cache < 0.4 && r.perClass.read.demand > 500,
      headline: 'More cache will not help this workload',
      why: r => 'Hit rate is stuck at ' + Math.round(100 * r.hits.cache)
        + '% because the traffic does not repeat. Nodes cannot fix that — only '
        + 'more origin capacity can.',
      action: 'Stop buying cache. Buy database capacity, or shed the traffic.',
      buy: null,
    },
    {
      key: 'herdRisk',
      when: (s, r) => s.infra.cacheNodes >= 2 && !s.infra.coalesce && r.hits.cache > 0.6
        && r.perClass.read.demand > 5000,
      headline: 'Your cache is now big enough to kill your database',
      why: r => 'At a ' + Math.round(100 * r.hits.cache) + '% hit rate, an empty cache sends '
        + Math.round(r.hits.cache * r.perClass.read.demand) + ' req/s at the origin in one step.',
      action: 'Add request coalescing so one miss refills a key, not thousands.',
      buy: () => 'coalesce',
    },
    {
      key: 'blind',
      when: (s, r) => s.infra.obs === 0 && r.demandRps > 2500,
      headline: 'You are running this blind',
      why: () => 'No telemetry. Every probe on this board is guessing, and so is anyone '
        + 'you page at 3am.',
      action: 'Buy metrics, then tracing. You cannot fix what you cannot see.',
      buy: () => 'obs',
    },
    // --- the catch-alls ------------------------------------------------------
    {
      key: 'nearWall',
      when: (s, r) => r.worstUtil > WARN,
      headline: 'Something is filling up',
      why: r => {
        const hot = Content.STATION_KEYS
          .filter(k => r.stations[k].owned)
          .sort((a, b) => r.stations[b].util - r.stations[a].util)[0];
        return Content.STATIONS[hot].name + ' is at ' + Math.round(100 * r.stations[hot].util)
          + '%. Latency is service ÷ (1 − utilization), so the curve is already bending.';
      },
      action: 'Widen whatever is fullest, before it is the thing that is red.',
      buy: (s, r) => {
        const hot = Content.STATION_KEYS
          .filter(k => r.stations[k].owned)
          .sort((a, b) => r.stations[b].util - r.stations[a].util)[0];
        if (hot === 'sql') return s.infra.tier < Content.COMMODITY_TIER ? 'tier' : 'shard';
        return SCALE_OUT[hot];
      },
    },
    {
      key: 'clear',
      when: () => true,
      headline: 'Nothing is on fire',
      why: (r, s) => {
        const growth = r.growthPerS;
        if (growth <= 0) return 'Demand is flat or falling. Serve faster and it will come back.';
        const headroom = Math.max(0.01, BAD - r.worstUtil);
        const secs = Math.round(Math.log(1 + headroom / Math.max(0.05, r.worstUtil)) / growth);
        return 'Busiest component is at ' + Math.round(100 * r.worstUtil) + '% and demand is '
          + 'doubling every ' + Math.round(Math.LN2 / growth) + 's — roughly ' + Math.max(1, secs)
          + 's before something reaches ' + Math.round(100 * BAD) + '%.';
      },
      action: 'Buy the next bottleneck now, while it is cheap and nobody is watching.',
      buy: (s, r) => {
        if (s.infra.obs === 0 && r.demandRps > 4000) return 'obs';
        if (!s.infra.indexes) return 'indexes';
        if (!s.infra.pooler) return 'pooler';
        return null;
      },
    },
  ];

  const resolve = (v, a, b) => (typeof v === 'function' ? v(a, b) : v);

  // The ranked diagnosis. Cards are the first few rules that fire; the load
  // breakdown above them is where the database's work is actually going, which
  // is the number that decides what to buy.
  function advise(state) {
    const r = state.report;
    if (!r) return { cards: [], load: [] };
    const cards = [];
    for (const rule of RULES) {
      if (cards.length >= 4) break;
      if (!rule.when(state, r)) continue;
      const buy = rule.buy === null ? null : resolve(rule.buy, state, r);
      const undo = rule.undo ? resolve(rule.undo, state, r) : null;
      cards.push({
        key: rule.key,
        headline: rule.headline,
        why: resolve(rule.why, r, state),
        action: resolve(rule.action, state, r),
        buy: buy && Content.SHOP_BY_KEY[buy] ? buy : null,
        affordable: buy ? affordable(state, buy) : false,
        undo: undo && Content.SHOP_BY_KEY[undo].canScaleDown(state) ? undo : null,
      });
    }
    return { cards, load: loadBreakdown(r) };
  }

  // Where the cluster's work goes, as fractions — the first question in any
  // capacity conversation. "41% of your database is write replay" answers what
  // to buy in a way a CPU percentage never can.
  function loadBreakdown(r) {
    const parts = Content.CLASS_KEYS.map(k => ({
      key: k, label: Content.CLASSES[k].label, color: Content.CLASSES[k].color,
      units: r.units.sql.byClass[k],
    }));
    parts.push({ key: 'replay', label: 'WRITE REPLAY', color: '#8b96a5', units: r.units.sql.replay });
    const total = parts.reduce((sum, p) => sum + p.units, 0);
    return parts
      .map(p => ({ ...p, frac: total > 0 ? p.units / total : 0 }))
      .filter(p => p.frac > 0.004)
      .sort((a, b) => b.frac - a.frac);
  }

  // What the bot clicks: the first card that names something it can afford.
  function nextBuy(state) {
    const { cards } = advise(state);
    for (const card of cards) {
      if (card.buy && card.affordable) return card.buy;
    }
    return null;
  }

  // Advice that costs nothing: something you already own is set up wrong.
  function nextUndo(state) {
    const { cards } = advise(state);
    const card = cards.find(c => c.undo);
    return card ? card.undo : null;
  }

  // The other half of the advice: what to turn off. Picks whatever is idlest
  // among the things that cost real money, because run-rate is the only thing
  // scaling down ever gives back.
  function nextScaleDown(state) {
    const r = state.report;
    if (!r) return null;
    const candidates = Content.SHOP
      .filter(item => item.canScaleDown(state) && r.costs.byKey[item.key].total > 1.5)
      .map(item => ({
        key: item.key,
        util: r.stations[item.box] ? r.stations[item.box].util : 0,
        cost: r.costs.byKey[item.key].total,
      }))
      .filter(c => c.util < 0.5)
      .sort((a, b) => (a.util - b.util) || (b.cost - a.cost));
    return candidates.length ? candidates[0].key : null;
  }

  return { advise, nextBuy, nextUndo, nextScaleDown, loadBreakdown, RULES };
})();

if (typeof module !== 'undefined') module.exports = Guru;
