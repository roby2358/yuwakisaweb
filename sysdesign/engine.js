// LOAD BEARING — engine: pure simulation over Content. No DOM.
//
// Engine.tick(state) advances one Content.SIM.DT step and leaves a report on
// state.report — the single contract the UI, the guru, the scorecard and the
// tests all read.
//
// The whole simulation is one idea: a CLASS of traffic walks a ROUTE of hops
// through STATIONS, and everything else is a consequence.
//
//   pass 1  — walk every route to find out how much work each station is asked
//             for. Nothing is decided yet.
//   shed    — if load shedding is armed, throw away exactly the excess, at the
//             front door, before it costs anything downstream.
//   admit   — each station decides what fraction of its arrivals it can take.
//             The relational database decides differently from the others,
//             because connections and replicas are real and only it has them.
//   pass 2  — walk the routes again, applying admissions and accumulating
//             latency. Requests that survive to an `ack` hop are served there.
//
// Latency is additive along the walk and each hop pays the queueing tax
// service ÷ (1 − utilization), so the hockey stick emerges rather than being
// asserted, and p99 is a real percentile over the paths requests actually took.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./memos.js'); // memos.js is the end of the content chain
  var Flourish = require('./flourish.js');
}

// `var`, not `const`: guru.js needs Engine under Node and declares it with a
// require-guarded `var`. A `const Engine` here is a LEXICAL global, and the two
// collide the moment both load as classic scripts. Same reason content.js and
// flourish.js use var.
var Engine = (() => {
  const S = Content.SIM;

  // --- deterministic rng (mulberry32) ---------------------------------------
  function rand(state) {
    state.rng = (state.rng + 0x6D2B79F5) | 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const hockey = u => 1 / (1 - clamp(u, 0, S.MAX_UTIL));
  const log2 = n => Math.log(n) / Math.LN2;

  // --- state ----------------------------------------------------------------
  function startingInfra() {
    return {
      pops: 0, edgeCompute: false,
      lbNodes: 1, loadShed: false, rateLimit: false,
      appMax: 1, appNodes: 1, autoscale: false,
      rtNodes: 0,
      cacheNodes: 0, coalesce: false, hotKeySpread: false, semanticCache: false,
      tier: 1, indexes: false, pooler: false, replicas: 0, shards: 1, multiAz: false,
      streamParts: 0, idempotent: false, cdc: false,
      kvNodes: 0,
      objstore: false, directUpload: false,
      searchNodes: 0,
      warehouse: false,
      vectorNodes: 0,
      gpuNodes: 0, batching: false, router: false,
      obs: 0, regions: 1,
    };
  }

  // The brief. Jitter shifts the mix a little so the same scenario is never the
  // same hand twice, then everything is renormalized to still be a mix.
  function applyScenario(state, key) {
    const def = Content.SCENARIOS[key];
    const mix = {};
    let total = 0;
    for (const k of Content.CLASS_KEYS) {
      mix[k] = def.mix[k] * (1 - S.MIX_JITTER / 2 + S.MIX_JITTER * rand(state));
      total += mix[k];
    }
    for (const k of Content.CLASS_KEYS) mix[k] /= total;
    state.scenario = key;
    state.mix = mix;
    state.repetition = def.repetition;
    state.revenue = def.revenue;
    state.rpsPerUser = def.rpsPerUser;
    state.slo = { ...def.slo, targetRps: def.targetRps };
    state.timeoutMs = def.slo.p99Ms * S.TIMEOUT_SLACK;
    // the market is finite, and it is sized so the brief's target is reachable
    state.marketUsers = (def.targetRps / def.rpsPerUser) * 1.6;
  }

  function buildDecks() {
    const decks = { senders: new Flourish(Content.MEMO_SENDERS), subjects: {}, barbs: {} };
    for (const key of Content.MEMO_KEYS) {
      decks.subjects[key] = new Flourish(Content.MEMOS[key].subjects);
      decks.barbs[key] = new Flourish(Content.MEMOS[key].barbs);
    }
    return decks;
  }

  // Everything the scorecard needs, accumulated as the run happens. Grading
  // after the fact from a summary is how you get a rubric that cannot be gamed
  // by a good final screenshot.
  function newRunLog() {
    return {
      servedAll: 0, servedFast: 0,        // requests, and those inside the SLO
      demandAll: 0, failedAll: 0,
      redTime: 0, outageTime: 0, spofTime: 0, liveTime: 0,
      buys: 0, buysProactive: 0,
      capacityPaid: 0, capacityUsed: 0,   // for the idle-provisioning number
      spendSum: 0, incomeSum: 0, spendPeak: 0,
      misfitUnits: 0, totalUnits: 0, misfits: {},
      violations: {},
      obsLevel: 0,
    };
  }

  function createState(seed) {
    const prevLatency = {};
    for (const k of Content.CLASS_KEYS) prevLatency[k] = Content.CLASSES[k].baseMs;
    const state = {
      t: 0,
      rng: seed | 0,
      users: S.START_USERS,
      peakUsers: S.START_USERS,
      peakServed: 0,
      cash: S.START_CASH,
      reputation: 80,
      infra: startingInfra(),
      migration: null,
      backlog: 0,
      backlogAge: 0,
      event: null,
      eventCooldown: 0,
      milestonesFired: {},
      prevLatency,
      insights: {},
      newInsights: [],
      newEvents: [],
      newMemos: [],
      memosFired: {},
      memoLast: {},
      lastMemoT: -999,
      lastBuy: { key: null, t: 0, util: 0 },
      decks: buildDecks(),
      budget: { failed: 0, allowed: 1, spentFrac: 0 },
      run: newRunLog(),
      failWindow: [],
      winTimer: 0,
      history: [],
      historyAcc: 0,
      outcome: null,
      deathCause: null,
      report: null,
    };
    applyScenario(state, Content.SCENARIO_KEYS[Math.floor(rand(state) * Content.SCENARIO_KEYS.length)]);
    return state;
  }

  // --- shop -----------------------------------------------------------------
  function shopItem(key) {
    const item = Content.SHOP_BY_KEY[key];
    if (!item) throw new Error('no shop item: ' + key);
    return item;
  }

  function buy(state, key) {
    if (state.outcome) return { ok: false, msg: 'game over' };
    const item = shopItem(key);
    const price = item.price(state);
    if (price === null) return { ok: false, msg: 'not available' };
    if (state.cash < price) return { ok: false, msg: 'not enough cash' };
    state.cash -= price;
    item.apply(state);
    const r = state.report;
    // Stamped for the memos that react to WHAT you bought and WHEN, and for the
    // capacity-planning grade: buying before the gauges go red is the skill.
    state.lastBuy = { key, t: state.t, util: r ? r.worstUtil : 0 };
    state.run.buys += 1;
    if (!r || (r.worstUtil < Content.BANDS.util.bad && r.errRate < 0.03)) {
      state.run.buysProactive += 1;
    }
    if (item.insightOnBuy) grantInsight(state, item.insightOnBuy);
    return { ok: true };
  }

  function scaleDown(state, key) {
    if (state.outcome) return { ok: false, msg: 'game over' };
    const item = shopItem(key);
    if (!item.canScaleDown(state)) return { ok: false, msg: 'nothing to scale down' };
    item.scaleDown(state);
    return { ok: true };
  }

  // --- money ----------------------------------------------------------------
  // Two shapes of cost, because that is how you are really billed: what a
  // subsystem costs to exist, and what it costs to use.
  function costBreakdown(state, usage) {
    const parts = Content.SHOP.map(item => {
      const on = !!item.owned(state);
      const fixed = on ? item.fixed : 0;
      const marginal = on ? item.marginal(state) : 0;
      return {
        key: item.key, name: item.name, color: item.color, box: item.box,
        fixedNote: item.fixedNote, fixed, marginal, total: fixed + marginal,
      };
    });
    parts.push({
      key: 'usage', name: 'Bandwidth & metered API', color: '#ff7b72', box: 'usage',
      fixedNote: 'bytes leaving your network, and every request you rent rather than own',
      fixed: 0, marginal: usage, total: usage,
    });
    return parts;
  }

  function costTotals(state, usage) {
    const parts = costBreakdown(state, usage);
    const byKey = {};
    let fixed = 0, marginal = 0;
    for (const p of parts) {
      byKey[p.key] = p;
      fixed += p.fixed;
      marginal += p.marginal;
    }
    return { parts, byKey, fixed, marginal, total: fixed + marginal };
  }

  function expenses(state) {
    return costTotals(state, state.report ? state.report.usageCost : 0).total;
  }

  // What the whole bill would be after buying one of these. Price is what you
  // pay once; this is forever — and a purchase can raise costs elsewhere (a
  // shard split doubles the nodes the database tier bills for).
  function expensesIfBought(state, key) {
    const item = shopItem(key);
    if (item.price(state) === null) return expenses(state);
    const probe = { ...state, infra: { ...state.infra } };
    item.apply(probe);
    probe.report = state.report;
    return expenses(probe);
  }

  // --- insights & memos -----------------------------------------------------
  function grantInsight(state, key) {
    if (state.insights[key]) return;
    state.insights[key] = true;
    state.newInsights.push(key);
  }

  function checkInsights(state, report) {
    for (const key of Content.INSIGHT_KEYS) {
      const ins = Content.INSIGHTS[key];
      if (ins.check && !state.insights[key] && ins.check(state, report)) grantInsight(state, key);
    }
  }

  function fireMemo(state, key) {
    const decks = state.decks;
    const sender = decks.senders.draw(rand(state));
    state.newMemos.push({
      key,
      from: sender.name,
      title: sender.title,
      subject: decks.subjects[key].draw(rand(state)),
      body: decks.barbs[key].draw(rand(state)),
    });
    state.memosFired[key] = true;
    state.memoLast[key] = state.t;
    state.lastMemoT = state.t;
  }

  function checkMemos(state, report) {
    if (state.t - state.lastMemoT < Content.MEMO_MIN_GAP) return;
    for (const key of Content.MEMO_KEYS) {
      const memo = Content.MEMOS[key];
      if (memo.once && state.memosFired[key]) continue;
      const last = state.memoLast[key];
      if (last !== undefined && state.t - last < memo.cooldown) continue;
      if (!memo.check(state, report)) continue;
      fireMemo(state, key);
      return; // management sends one at a time, mercifully
    }
  }

  // --- events ---------------------------------------------------------------
  // One place fills in every default, so nothing else in the simulation ever
  // asks "is there an event, and does it have this property?".
  function eventEffects(state) {
    const def = state.event ? Content.EVENTS[state.event.key] : null;
    const eff = {
      def,
      trafficMult: 1, junkMult: 1, stormMult: 1, replicaOut: 0,
      cacheCapOne: false, zoneOut: false, regionOut: false,
      mixMult: {}, capMult: {}, hitMult: { edge: 1, cache: 1, semantic: 1 },
    };
    if (!def) return eff;
    for (const k of ['trafficMult', 'junkMult', 'stormMult', 'replicaOut']) {
      if (def[k] !== undefined) eff[k] = def[k];
    }
    eff.cacheCapOne = !!def.cacheCapOne;
    eff.zoneOut = !!def.zoneOut;
    eff.regionOut = !!def.regionOut;
    if (def.mixMult) eff.mixMult = def.mixMult;
    if (def.capMult) eff.capMult = def.capMult;
    if (def.hitMult) Object.assign(eff.hitMult, def.hitMult);
    return eff;
  }

  function startEvent(state, key) {
    const def = Content.EVENTS[key];
    state.event = { key, left: def.dur };
    state.newEvents.push(key);
    if (def.insight) grantInsight(state, def.insight);
  }

  function updateEvents(state, servedRps, dt) {
    if (state.event) {
      state.event.left -= dt;
      if (state.event.left <= 0) {
        state.event = null;
        state.eventCooldown = S.EVENT_COOLDOWN;
      }
      return;
    }
    state.eventCooldown = Math.max(0, state.eventCooldown - dt);
    for (const key of Content.EVENT_KEYS) {
      const def = Content.EVENTS[key];
      if (!def.milestoneFrac || state.milestonesFired[key]) continue;
      if (servedRps < def.milestoneFrac * state.slo.targetRps) continue;
      state.milestonesFired[key] = true;
      startEvent(state, key);
      return;
    }
    if (state.t < S.EVENT_MIN_T || servedRps < S.EVENT_MIN_RPS) return;
    if (state.eventCooldown > 0) return;
    if (rand(state) > S.EVENT_CHANCE_PER_S * dt) return;
    const pool = Content.EVENT_KEYS
      .filter(k => Content.EVENTS[k].random && (!Content.EVENTS[k].needs || Content.EVENTS[k].needs(state)));
    if (pool.length) startEvent(state, pool[Math.floor(rand(state) * pool.length)]);
  }

  // --- demand ---------------------------------------------------------------
  function demand(state, eff) {
    const rps = state.users * state.rpsPerUser * eff.trafficMult;
    const weights = {};
    let total = 0;
    for (const k of Content.CLASS_KEYS) {
      weights[k] = state.mix[k] * (eff.mixMult[k] || 1);
      total += weights[k];
    }
    const perClass = {};
    for (const k of Content.CLASS_KEYS) perClass[k] = rps * weights[k] / total;
    // junk traffic is real load that earns nothing — unless you bounce it at
    // the door, which is what a quota is for
    const junk = state.infra.rateLimit ? 0 : (eff.junkMult - 1) * rps;
    return { rps: rps + junk, real: rps, junk, perClass };
  }

  // --- the architecture as stations -----------------------------------------
  // Node counts and capacities, after whatever the current event is doing to
  // them. A tier running on one node loses everything to a zone failure; one
  // running on several loses a third. That difference is the whole argument
  // for N+1, priced in seconds of outage.
  function buildStations(state, eff) {
    const infra = state.infra;
    const migrating = state.migration ? S.MIGRATION_CAP : 1;
    const stations = {};
    for (const key of Content.STATION_KEYS) {
      const def = Content.STATIONS[key];
      const nodes = def.nodes(infra);
      let cap = def.cap(infra);
      if (key === 'sql') cap *= migrating;
      if (eff.capMult[key]) cap *= eff.capMult[key];
      if (eff.zoneOut) cap *= nodes >= 2 ? 2 / 3 : 0;
      if (eff.regionOut) cap *= infra.regions > 1 ? (infra.regions - 1) / infra.regions : 0.25;
      if (key === 'cache' && eff.cacheCapOne && !infra.hotKeySpread) {
        cap = Math.min(cap, S.CACHE_OPS); // a hot key does not spread across nodes
      }
      stations[key] = {
        key, def, nodes, cap: Math.max(0, cap),
        inRps: 0, units: 0, asyncUnits: 0,
        util: 0, admit: 1, serviceMs: def.serviceMs(infra),
        classUtil: {}, failRps: 0, servedRps: 0, owned: !!def.owned(infra),
      };
    }
    return stations;
  }

  // What fraction of each class never needs to travel further. These are the
  // three cheapest things in the game: work you delete costs nothing to serve.
  function hitRates(state, eff) {
    const infra = state.infra, rep = state.repetition;
    const cacheCurve = Math.min(
      S.CACHE_HIT_MAX,
      S.CACHE_HIT_BASE + S.CACHE_HIT_PER_DOUBLING * log2(Math.max(1, infra.cacheNodes)),
    );
    return {
      edgeStatic: S.EDGE_HIT_STATIC * eff.hitMult.edge,
      edgeDynamic: S.EDGE_HIT_DYNAMIC * rep * eff.hitMult.edge,
      cacheBase: cacheCurve * rep,
      cache: 0, // filled in once the write mix is known — writes invalidate
      semantic: S.SEMANTIC_HIT * (0.6 + 0.4 * rep) * eff.hitMult.semantic,
    };
  }

  // --- pass 1: what is everything being asked for ---------------------------
  function walkDemand(stations, routes, perClass, scale) {
    for (const k of Content.CLASS_KEYS) {
      let remaining = perClass[k] * scale;
      let acked = false;
      for (const h of routes[k]) {
        const st = stations[h.at];
        st.inRps += remaining;
        const units = remaining * h.units;
        if (acked) st.asyncUnits += units;
        else st.units += units;
        if (h.ack) acked = true;
        if (h.absorb > 0) remaining *= (1 - h.absorb);
      }
    }
  }

  function resetStations(stations) {
    for (const key of Content.STATION_KEYS) {
      const st = stations[key];
      st.inRps = 0; st.units = 0; st.asyncUnits = 0;
    }
  }

  // --- the relational database ----------------------------------------------
  // The one station that is not generic, because it is the one with the parts
  // an interview is actually about: connections that are held rather than
  // consumed, replicas that can only take reads, and a backlog that turns
  // failure into staleness.
  function sqlAdmission(state, stations, eff, unitsByClass, demandRps, dt) {
    const infra = state.infra;
    const st = stations.sql;
    const replicas = Math.max(0, infra.replicas - eff.replicaOut);
    const nodeCap = st.cap / Math.max(1, st.nodes); // per-node, after events
    const primaryCap = infra.shards * nodeCap;
    const replicaCap = infra.shards * replicas * nodeCap;

    // Little's Law: concurrent connections = arrival rate × hold time. Without
    // a pooler every instance also parks connections it is not using, which is
    // how a database refuses queries while its CPU is idle.
    let connUsed = 0;
    for (const k of Content.CLASS_KEYS) {
      if (!unitsByClass[k]) continue;
      connUsed += unitsByClass[k].rps * (Math.min(state.prevLatency[k], S.CONN_HOLD_CAP_MS) / 1000);
    }
    if (!infra.pooler) connUsed += infra.appNodes * S.CLIENT_CONNS_PER_APP * eff.stormMult;
    else if (eff.stormMult > 1) connUsed *= 2; // reconnect churn still doubles held conns
    const connCap = infra.shards * (1 + replicas) * Content.TIERS[infra.tier - 1].conns;
    const connAdmit = connUsed > connCap ? connCap / connUsed : 1;

    // Reads and reports can run on a replica; writes cannot. Every replica also
    // owes the primary a replay of every write, and that debt is paid out of
    // the same capacity you bought to serve reads.
    const readUnits = (unitsByClass.read.units + unitsByClass.lookup.units
      + unitsByClass.search.units + unitsByClass.media.units
      + unitsByClass.analytics.units) * connAdmit;
    const writeUnits = (unitsByClass.write.units + unitsByClass.realtime.units
      + unitsByClass.infer.units) * connAdmit;
    const replayUnits = (writeUnits + st.asyncUnits) * replicas * S.REPLAY_SHARE;
    const onReplicas = Math.min(readUnits, Math.max(0, replicaCap - replayUnits));
    let primaryLoad = writeUnits + (readUnits - onReplicas);

    // The log absorbs write overflow as backlog instead of as errors — strictly
    // better, and strictly not capacity.
    const asyncWanted = st.asyncUnits * connAdmit;
    const roomForAsync = Math.max(0, primaryCap - primaryLoad);
    const asyncApplied = Math.min(asyncWanted, roomForAsync);
    state.backlog += (asyncWanted - asyncApplied) * dt;
    primaryLoad += asyncApplied;
    const drain = Math.min(state.backlog, Math.max(0, primaryCap - primaryLoad) * dt);
    state.backlog -= drain;
    primaryLoad += drain / dt;
    state.backlogAge = state.backlog > 1 ? state.backlogAge + dt : 0;

    const primaryUtil = primaryCap > 0 ? primaryLoad / primaryCap : 0;
    const replicaUtil = replicaCap > 0 ? (onReplicas + replayUnits) / replicaCap : 0;
    const replicaShare = readUnits > 0 ? onReplicas / readUnits : 0;
    const readUtil = replicaShare * replicaUtil + (1 - replicaShare) * primaryUtil;
    const overflow = Math.max(0, primaryLoad - primaryCap);
    const capAdmit = primaryLoad > 0 ? 1 - overflow / primaryLoad : 1;

    st.admit = connAdmit * capAdmit;
    st.util = Math.min(1, Math.max(primaryUtil, replicaUtil));
    for (const k of Content.CLASS_KEYS) st.classUtil[k] = Math.min(1, primaryUtil);
    for (const k of ['read', 'lookup', 'search', 'analytics', 'media']) {
      st.classUtil[k] = Math.min(1, readUtil);
    }
    return {
      connUsed, connCap, connAdmit, primaryUtil, replicaUtil, replicaShare,
      primaryCap, replicaCap, replicas,
      replayFrac: replicaCap > 0 ? replayUnits / replicaCap : 0,
      rejectRps: st.inRps * (1 - connAdmit),
      staleFrac: replicas > 0 ? clamp((replicaUtil - S.STALE_UTIL) * 2, 0, 0.3) : 0,
      backlogDrain: drain / dt,
    };
  }

  // --- pass 2: what actually happened ---------------------------------------
  // Walk each route again with the admissions decided, accumulating latency as
  // we go. A request that reaches an `ack` hop is answered there; anything
  // still travelling at the end is answered at the end.
  function walkService(state, stations, routes, perClass, shedFrac) {
    const ledger = {};
    const fails = {};
    const buckets = [];   // {rps, ms} — the served latency distribution
    const links = [];     // {from, to, rps, cls} — the map's arrows, and the
                          // honest answer to "where does this traffic go?"
    let bytesEdge = 0, bytesOrigin = 0;

    for (const k of Content.CLASS_KEYS) {
      const cls = Content.CLASSES[k];
      const total = perClass[k];
      const hops = routes[k];
      const offPath = hops[hops.length - 1].at === 'warehouse';
      const entry = { demand: total, served: 0, fail: 0, latencyMs: cls.baseMs, shed: 0, offPath };
      ledger[k] = entry;
      if (total <= 0) continue;

      const shed = total * shedFrac;
      if (shed > 0) {
        entry.fail += shed;
        entry.shed = shed;
        fails.shed = (fails.shed || 0) + shed;
      }
      let remaining = total - shed;
      let ms = cls.baseMs;
      let latSum = 0;

      let from = 'client';
      for (const h of routes[k]) {
        const st = stations[h.at];
        links.push({ from, to: st.key, rps: remaining, cls: k });
        from = st.key;
        const dropped = remaining * (1 - st.admit);
        if (dropped > 0) {
          entry.fail += dropped;
          fails[st.key] = (fails[st.key] || 0) + dropped;
          remaining -= dropped;
        }
        ms += st.serviceMs * hockey(st.classUtil[k] === undefined ? st.util : st.classUtil[k]);
        if (h.absorb > 0) {
          const here = remaining * h.absorb;
          remaining -= here;
          latSum += here * ms;
          entry.served += here;
          buckets.push({ rps: here, ms, offPath: false });
          if (h.at === 'edge') bytesEdge += here * cls.bytes;
          else bytesOrigin += here * cls.bytes;
        }
        if (h.ack) {
          latSum += remaining * ms;
          entry.served += remaining;
          buckets.push({ rps: remaining, ms, offPath: false });
          bytesOrigin += remaining * cls.bytes;
          remaining = 0;
          break; // everything after the ack is the system's problem, not the user's
        }
      }
      if (remaining > 0) {
        latSum += remaining * ms;
        entry.served += remaining;
        // a report that runs in the warehouse is slow on purpose and nobody is
        // waiting on it — counting it in p99 would punish moving it off the
        // transaction path, which is the opposite of the lesson
        buckets.push({ rps: remaining, ms, offPath });
        bytesOrigin += remaining * cls.bytes;
      }
      entry.latencyMs = entry.served > 0 ? latSum / entry.served : ms;
    }

    // anything slower than client patience was never really served
    const timeout = state.timeoutMs;
    for (const b of buckets) {
      if (b.ms < timeout || b.offPath) continue;
      const lost = b.rps;
      b.rps = 0;
      fails.timeout = (fails.timeout || 0) + lost;
    }
    for (const k of Content.CLASS_KEYS) {
      const entry = ledger[k];
      if (entry.offPath) continue;
      if (entry.latencyMs < timeout || entry.served <= 0) continue;
      entry.fail += entry.served;
      entry.served = 0;
    }
    return { ledger, fails, buckets, links, bytesEdge, bytesOrigin };
  }

  // A real percentile over the paths requests actually took — a cache hit and a
  // cache miss are different experiences, and p99 is where that shows up.
  function percentiles(buckets) {
    const live = buckets.filter(b => b.rps > 0 && !b.offPath).sort((a, b) => a.ms - b.ms);
    const total = live.reduce((sum, b) => sum + b.rps, 0);
    if (total <= 0) return { p50: 1, p99: 1, total: 0, within: 0 };
    const at = frac => {
      let seen = 0;
      for (const b of live) {
        seen += b.rps;
        if (seen >= frac * total) return b.ms;
      }
      return live[live.length - 1].ms;
    };
    return { p50: at(0.5), p99: at(0.99), total, live };
  }

  function withinTarget(live, total, targetMs) {
    if (total <= 0) return 1;
    let ok = 0;
    for (const b of live) if (b.ms <= targetMs) ok += b.rps;
    return ok / total;
  }

  // --- demand side ----------------------------------------------------------
  // Reputation is the slow signal and decides growth; error rate is the fast
  // one and churns users out now. That split is what makes overload self-
  // limiting: a meltdown sheds the traffic causing it, so there is always a way
  // back rather than a runaway you cannot buy your way out of.
  function updateDemandSide(state, tot, sat, demandRps, dt) {
    const successFrac = demandRps > 0 ? tot.servedRps / demandRps : 1;
    const target = state.slo.p99Ms;
    let repTarget = 100 * Math.pow(successFrac, S.REP_SHARPNESS)
      - 25 * clamp((tot.p99 - target) / (3 * target), 0, 1)
      - 10 * sat.staleFrac / 0.3
      - (state.backlog > 1 ? 5 + 10 * clamp(state.backlog / (sat.primaryCap * 5), 0, 1) : 0);
    repTarget = clamp(repTarget, 0, 100);
    const tau = repTarget < state.reputation ? S.REP_TAU_DOWN : S.REP_TAU_UP;
    state.reputation += (repTarget - state.reputation) * dt / tau;

    const errFrac = demandRps > 0 ? tot.failRps / demandRps : 0;
    const churn = S.ERR_CHURN * Math.pow(Math.max(0, errFrac - S.ERR_TOLERANCE), 2);
    const market = Math.max(0, 1 - state.users / state.marketUsers);
    let growth = S.GROWTH_RATE * clamp((state.reputation - S.REP_NEUTRAL) / (100 - S.REP_NEUTRAL), -1, 1);
    if (growth > 0) growth *= market;
    growth -= churn;
    state.users = Math.max(1, state.users * Math.exp(growth * dt));
    state.peakUsers = Math.max(state.peakUsers, state.users);
    return growth;
  }

  // Autoscaling runs only what the traffic needs — and reacts in half a minute,
  // which is not fast enough for a burst and is exactly fast enough for a day.
  function updateFleet(state, appUnits, dt) {
    const infra = state.infra;
    if (!infra.autoscale) {
      infra.appNodes = infra.appMax;
      return;
    }
    const want = clamp(Math.ceil(appUnits * S.APP_HEADROOM / S.APP_UNITS), 1, infra.appMax);
    infra.appNodes += (want - infra.appNodes) * Math.min(1, dt / S.APP_WARM_S);
    infra.appNodes = clamp(infra.appNodes, 1, infra.appMax);
  }

  function settleMoney(state, tot, bytes, usageCost) {
    let earned = 0;
    for (const k of Content.CLASS_KEYS) {
      earned += tot.ledger[k].served * state.revenue * Content.CLASSES[k].revenueMult;
    }
    const income = state.users > 1 ? Math.max(S.MIN_INCOME, earned) : earned;
    const costs = costTotals(state, usageCost);
    state.cash += (income - costs.total) * S.DT;
    return { income, spend: costs.total, costs };
  }

  // Bytes leaving your network, and requests you rent instead of own. This is
  // the bill that grows with success rather than with architecture.
  function usageCosts(state, bytesEdge, bytesOrigin, inferServed) {
    const egress = (bytesOrigin + bytesEdge * S.EDGE_EGRESS_MULT) / 1e9 * S.EGRESS_PER_GB;
    const api = state.infra.gpuNodes === 0 ? inferServed * S.API_PER_REQ : 0;
    return { egress, api, total: egress + api };
  }

  // --- grading accumulators -------------------------------------------------
  // Where a class of work landed, versus where it belongs. This is the "did you
  // pick the right component" grade, and it is measured in units of work rather
  // than in purchases, because buying a search cluster you do not route to is
  // not the same as using one.
  const HOMES = {
    media: { station: 'objstore', label: 'media on the database' },
    search: { station: 'search', label: 'search as a table scan' },
    analytics: { station: 'warehouse', label: 'reports on the primary' },
    lookup: { station: 'kv', label: 'key lookups on SQL' },
    realtime: { station: 'realtime', label: 'realtime polled off the service tier' },
  };

  function updateRunLog(state, report, dt) {
    const run = state.run;
    run.demandAll += report.demandRps * dt;
    run.failedAll += report.failRps * dt;
    run.servedAll += report.servedRps * dt;
    run.servedFast += report.servedRps * report.withinSlo * dt;
    run.spendSum += report.spend * dt;
    run.incomeSum += report.income * dt;
    run.spendPeak = Math.max(run.spendPeak, report.spend);
    run.obsLevel = Math.max(run.obsLevel, state.infra.obs);
    if (report.worstUtil >= Content.BANDS.util.bad) run.redTime += dt;
    if (report.errRate > 0.4) run.outageTime += dt;
    if (report.demandRps > 2000) {
      run.liveTime += dt;
      if (report.minRedundancy <= 1) run.spofTime += dt;
    }
    // paid-for capacity that nothing used — the honest measure of over-provisioning
    for (const key of Content.STATION_KEYS) {
      const st = report.stations[key];
      if (!st.owned || st.cap <= 0) continue;
      run.capacityPaid += dt;
      run.capacityUsed += Math.min(1, st.util) * dt;
    }
    // component fit, in units of work
    for (const [k, home] of Object.entries(HOMES)) {
      const units = report.units.sql.byClass[k];
      if (units <= 0.15 * Math.max(1, report.sql.cap)) continue;
      run.misfitUnits += units * dt;
      run.misfits[home.label] = (run.misfits[home.label] || 0) + units * dt;
    }
    if (state.infra.gpuNodes === 0 && report.perClass.infer.demand > S.API_RPS * 0.8) {
      const units = report.perClass.infer.demand;
      run.misfitUnits += units * dt;
      run.misfits['inference stuck behind a rented rate limit'] = (run.misfits['inference stuck behind a rented rate limit'] || 0) + units * dt;
    }
    run.totalUnits += report.totalUnits * dt;

    // the tradeoffs you did not resolve
    const v = run.violations;
    if (state.slo.consistency === 'strong' && state.infra.streamParts > 0 && !state.infra.idempotent) {
      v['acked writes through a queue with no idempotency'] = true;
    }
    if (state.slo.durable && !state.infra.objstore && report.perClass.media.demand > 50) {
      v['durable media never left the database'] = true;
    }
    if (state.slo.consistency === 'strong' && report.sql.staleFrac > 0.05) {
      v['strong consistency promised, stale replicas served'] = true;
    }
    if (report.backlog > 5000 && state.backlogAge > 20) {
      v['a backlog that never drained'] = true;
    }
  }

  // --- the tick -------------------------------------------------------------
  function tick(state) {
    if (state.outcome) return state.report;
    const dt = S.DT;
    state.t += dt;
    if (state.migration) {
      state.migration.left -= dt;
      if (state.migration.left <= 0) state.migration = null;
    }

    const eff = eventEffects(state);
    const d = demand(state, eff);
    const hits = hitRates(state, eff);
    // writes invalidate cached entries, so a write-heavy mix blunts the cache
    hits.cache = state.infra.cacheNodes > 0
      ? hits.cacheBase * clamp(1 - 0.25 * d.perClass.write / Math.max(1, d.perClass.read), 0.5, 1)
      : 0;

    const ctx = { infra: state.infra, hits };
    const routes = {};
    for (const k of Content.CLASS_KEYS) routes[k] = Content.CLASSES[k].route(ctx);

    const stations = buildStations(state, eff);
    walkDemand(stations, routes, d.perClass, 1);
    updateFleet(state, stations.app.units, dt);
    stations.app.cap = state.infra.appNodes * S.APP_UNITS;
    // What matters for "should I buy more fleet" is the ceiling you purchased,
    // not the instances autoscaling has warmed up yet — otherwise every buy
    // looks like it did nothing for thirty seconds and you buy four more.
    stations.app.ceilCap = state.infra.appMax * S.APP_UNITS;
    if (eff.zoneOut) stations.app.cap *= state.infra.appNodes >= 2 ? 2 / 3 : 0;

    // Shedding: reject exactly the excess, at the door, before it costs
    // anything downstream. Failing 10% fast beats failing 100% slowly.
    const shedFrac = state.infra.loadShed ? sheddingFraction(stations) : 0;
    if (shedFrac > 0) {
      resetStations(stations);
      walkDemand(stations, routes, d.perClass, 1 - shedFrac);
    }

    // per-class units at the database, which the connection gate and the
    // replica placement both need broken out
    const unitsByClass = {};
    for (const k of Content.CLASS_KEYS) unitsByClass[k] = { units: 0, rps: 0 };
    for (const k of Content.CLASS_KEYS) {
      let remaining = d.perClass[k] * (1 - shedFrac);
      for (const h of routes[k]) {
        if (h.at === 'sql') {
          unitsByClass[k].units += remaining * h.units;
          unitsByClass[k].rps += remaining;
        }
        if (h.absorb > 0) remaining *= (1 - h.absorb);
      }
    }

    for (const key of Content.STATION_KEYS) {
      const st = stations[key];
      if (key === 'sql') continue;
      st.util = st.cap > 0 ? st.units / st.cap : (st.units > 0 ? 1 : 0);
      st.ceilUtil = st.ceilCap ? st.units / st.ceilCap : st.util;
      st.admit = st.util > 1 ? 1 / st.util : 1;
      for (const k of Content.CLASS_KEYS) st.classUtil[k] = Math.min(1, st.util);
    }
    const sat = sqlAdmission(state, stations, eff, unitsByClass, d.rps, dt);

    const flow = walkService(state, stations, routes, d.perClass, shedFrac);
    const pct = percentiles(flow.buckets);
    const withinSlo = withinTarget(pct.live || [], pct.total, state.slo.p99Ms);

    let servedRps = 0, failRps = 0;
    for (const k of Content.CLASS_KEYS) {
      servedRps += flow.ledger[k].served;
      failRps += flow.ledger[k].fail;
      state.prevLatency[k] += (flow.ledger[k].latencyMs - state.prevLatency[k])
        * Math.min(1, dt / S.LAT_EMA_S);
    }
    state.peakServed = Math.max(state.peakServed, servedRps);

    const usage = usageCosts(state, flow.bytesEdge, flow.bytesOrigin, flow.ledger.infer.served);
    const tot = { servedRps, failRps, p50: pct.p50, p99: pct.p99, ledger: flow.ledger };
    const growth = updateDemandSide(state, tot, sat, d.rps, dt);
    const money = settleMoney(state, tot, flow, usage.total);

    // error budget: the availability target, expressed as the failures it
    // permits, spent down over the run
    state.budget.failed += failRps * dt;
    state.budget.allowed = Math.max(1, state.run.demandAll + d.rps * dt) * (1 - state.slo.availability);
    state.budget.spentFrac = state.budget.failed / state.budget.allowed;

    let worstUtil = 0, minRedundancy = 99;
    for (const key of Content.STATION_KEYS) {
      const st = stations[key];
      if (!st.owned) continue;
      worstUtil = Math.max(worstUtil, st.util);
      minRedundancy = Math.min(minRedundancy, st.nodes);
    }

    const sqlUnitsByClass = {};
    let totalUnits = 0;
    for (const k of Content.CLASS_KEYS) {
      sqlUnitsByClass[k] = unitsByClass[k].units;
      totalUnits += unitsByClass[k].units;
    }
    for (const key of Content.STATION_KEYS) totalUnits += stations[key].units;

    const report = {
      t: state.t,
      demandRps: d.rps, realRps: d.real, junkRps: d.junk,
      servedRps, failRps,
      errRate: d.rps > 0 ? failRps / d.rps : 0,
      perClass: flow.ledger, fails: flow.fails, shedFrac, links: flow.links,
      stations, hits, worstUtil, minRedundancy,
      p50: pct.p50, p99: pct.p99, withinSlo,
      sql: {
        util: stations.sql.util, primaryUtil: sat.primaryUtil, replicaUtil: sat.replicaUtil,
        replayFrac: sat.replayFrac, staleFrac: sat.staleFrac, replicas: sat.replicas,
        connUsed: sat.connUsed, connCap: sat.connCap, rejectRps: sat.rejectRps,
        cap: sat.primaryCap, replicaCap: sat.replicaCap, readOnReplicaFrac: sat.replicaShare,
        shards: state.infra.shards,
      },
      units: { sql: { byClass: sqlUnitsByClass, read: sqlUnitsByClass.read, write: sqlUnitsByClass.write, analytics: sqlUnitsByClass.analytics, search: sqlUnitsByClass.search, replay: sat.replayFrac * sat.replicaCap } },
      totalUnits,
      bytesPerS: flow.bytesEdge + flow.bytesOrigin, bytesEdge: flow.bytesEdge,
      usageCost: usage.total, usage,
      income: money.income, spend: money.spend, costs: money.costs,
      margin: money.income > 0 ? (money.income - money.spend) / money.income : -1,
      runway: money.spend > money.income ? state.cash / (money.spend - money.income) : Infinity,
      growthPerS: growth, backlog: state.backlog, backlogDrain: sat.backlogDrain,
      budget: state.budget,
      event: state.event ? { key: state.event.key, left: state.event.left } : null,
      migration: state.migration ? { left: state.migration.left } : null,
    };
    state.report = report;

    state.failWindow.push({ t: state.t, fails: { ...flow.fails } });
    while (state.failWindow.length && state.failWindow[0].t < state.t - 15) state.failWindow.shift();

    updateRunLog(state, report, dt);
    checkInsights(state, report);
    checkMemos(state, report);
    updateEvents(state, servedRps, dt);
    updateHistory(state, report, dt);
    updateOutcome(state, report, dt);
    return report;
  }

  // Shed exactly enough to bring the worst-loaded station back to its capacity.
  // Computed rather than tuned, so it converges in one step instead of
  // oscillating the way a feedback controller would.
  function sheddingFraction(stations) {
    let worst = 1;
    for (const key of Content.STATION_KEYS) {
      const st = stations[key];
      if (!st.owned || st.cap <= 0) continue;
      worst = Math.max(worst, st.units / (st.cap * S.SHED_UTIL));
    }
    return worst > 1 ? Math.min(0.9, 1 - 1 / worst) : 0;
  }

  function updateHistory(state, report, dt) {
    state.historyAcc += dt;
    if (state.historyAcc < S.HISTORY_DT) return;
    state.historyAcc = 0;
    state.history.push({
      t: state.t, demand: report.demandRps, served: report.servedRps,
      fail: report.failRps, p50: report.p50, p99: report.p99,
      cash: state.cash, spend: report.spend, income: report.income,
    });
    if (state.history.length > S.HISTORY_LEN) state.history.shift();
  }

  function failReasonTotals(state) {
    const totals = {};
    for (const sample of state.failWindow) {
      for (const [reason, rps] of Object.entries(sample.fails)) {
        totals[reason] = (totals[reason] || 0) + rps;
      }
    }
    return totals;
  }

  function updateOutcome(state, report, dt) {
    if (report.servedRps >= state.slo.targetRps && report.errRate < 0.01
        && report.p99 <= state.slo.p99Ms) {
      state.winTimer += dt;
      if (state.winTimer >= S.WIN_HOLD_S) state.outcome = 'won';
    } else {
      state.winTimer = 0;
    }
    if (state.cash < S.BANKRUPT_CASH) {
      state.outcome = 'lost';
      state.deathCause = 'bankrupt';
      return;
    }
    const peakRps = state.peakUsers * state.rpsPerUser;
    const collapsed = peakRps >= S.COLLAPSE_PEAK_RPS && state.users <= state.peakUsers * S.COLLAPSE_FRAC;
    const busto = state.peakUsers > 2 * S.START_USERS && state.users <= S.BUST_USERS;
    if (!collapsed && !busto) return;
    state.outcome = 'lost';
    const totals = failReasonTotals(state);
    const worst = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    state.deathCause = worst && worst[1] > 0 ? worst[0] : 'latency';
  }

  return {
    createState, tick, buy, scaleDown, expenses, expensesIfBought,
    costTotals, shopItem, failReasonTotals, applyScenario,
  };
})();

if (typeof module !== 'undefined') module.exports = Engine;
