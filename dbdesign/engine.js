// HUG OF DEATH — engine: pure simulation over Content. No DOM.
// Engine.tick(state) advances one Content.SIM.DT step and stores a report
// on state.report for the UI / tests.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./memos.js'); // memos.js extends and re-exports Content
  var Flourish = require('./flourish.js');
}

const Engine = (() => {
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

  // --- state ----------------------------------------------------------------
  // Roll a workload profile with jittered proportions. Called at creation and
  // by tests that need a specific archetype (re-rolls jitter deterministically).
  function applyProfile(state, key) {
    const def = Content.PROFILES[key];
    const mix = {};
    let total = 0;
    for (const k of Content.TYPE_KEYS) {
      mix[k] = def.mix[k] * (1 - Content.MIX_JITTER / 2 + Content.MIX_JITTER * rand(state));
      total += mix[k];
    }
    for (const k of Content.TYPE_KEYS) mix[k] /= total;
    state.mix = mix;
    state.profile = key;
    state.repetition = def.repetition;
    state.revenue = def.revenue;
  }

  // One deck per variation list, per game — so a run is reproducible and the
  // player sees every line before any repeat.
  function buildDecks() {
    const decks = {
      senders: new Flourish(Content.MEMO_SENDERS),
      subjects: {},
      barbs: {},
    };
    for (const key of Content.MEMO_KEYS) {
      decks.subjects[key] = new Flourish(Content.MEMOS[key].subjects);
      decks.barbs[key] = new Flourish(Content.MEMOS[key].barbs);
    }
    return decks;
  }

  function createState(seed) {
    const prevLatency = {};
    for (const k of Content.TYPE_KEYS) prevLatency[k] = Content.TYPES[k].baseMs;
    const state = {
      t: 0,
      rng: seed | 0,
      users: S.START_USERS,
      peakUsers: S.START_USERS,
      cash: S.START_CASH,
      reputation: 80,
      infra: {
        tier: 1, indexes: false, pooler: false, replicas: 0,
        cacheNodes: 0, kvNodes: 0, shards: 1, warehouse: false, writeQueue: false,
      },
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
      failWindow: [],           // recent {reason, rps} samples for post-mortem
      winTimer: 0,
      history: [],
      historyAcc: 0,
      outcome: null,
      report: null,
    };
    applyProfile(state, Content.PROFILE_KEYS[Math.floor(rand(state) * Content.PROFILE_KEYS.length)]);
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
    if (price === null) return { ok: false, msg: 'maxed out' };
    if (state.cash < price) return { ok: false, msg: 'not enough cash' };
    state.cash -= price;
    item.apply(state);
    // stamped for memos that react to WHAT you bought and WHEN
    state.lastBuy = {
      key, t: state.t,
      util: state.report ? state.report.sql.primaryUtil : 0,
    };
    if (item.insightOnBuy) grantInsight(state, item.insightOnBuy);
    return { ok: true };
  }

  // Scale a subsystem back down — retire a node, downgrade a box, decommission
  // the whole thing. Nothing is refunded: provisioning is a commitment, and the
  // only thing you get back is the run-rate.
  function scaleDown(state, key) {
    if (state.outcome) return { ok: false, msg: 'game over' };
    const item = shopItem(key);
    if (!item.canScaleDown(state)) return { ok: false, msg: 'nothing to scale down' };
    item.scaleDown(state);
    return { ok: true };
  }

  // Per-subsystem run-rate: fixed (the team, the pager) + marginal (the nodes).
  function costBreakdown(state) {
    return Content.SHOP.map(item => {
      const on = !!item.owned(state);
      const fixed = on ? item.fixed : 0;
      const marginal = on ? item.marginal(state) : 0;
      return {
        key: item.key, name: item.name, color: item.color,
        fixedNote: item.fixedNote,
        fixed, marginal, total: fixed + marginal,
      };
    });
  }

  // What this subsystem would run at if you bought one more of it — the
  // number that matters before adding a node, not the sticker price.
  function costIfBought(state, key) {
    const item = shopItem(key);
    if (item.price(state) === null) return 0;
    const probe = { ...state, infra: { ...state.infra } };
    item.apply(probe);
    return item.owned(probe) ? item.fixed + item.marginal(probe) : 0;
  }

  // Total burn AFTER buying one of these — the honest number, because a
  // purchase can raise costs elsewhere (a shard split doubles the node count
  // the SQL cluster bills for). Price is what you pay once; this is forever.
  function expensesIfBought(state, key) {
    const item = shopItem(key);
    if (item.price(state) === null) return expenses(state);
    const probe = { ...state, infra: { ...state.infra } };
    item.apply(probe);
    return expenses(probe);
  }

  // parts is the ordered list the money bar draws; byKey is the same objects
  // indexed, because every panel that mentions a cost wants exactly one of them.
  function costTotals(state) {
    const parts = costBreakdown(state);
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
    return costTotals(state).total;
  }

  // --- insights -------------------------------------------------------------
  function grantInsight(state, key) {
    if (state.insights[key]) return;
    state.insights[key] = true;
    state.newInsights.push(key);
  }

  function checkInsights(state, report) {
    for (const key of Content.INSIGHT_KEYS) {
      const ins = Content.INSIGHTS[key];
      if (ins.check && !state.insights[key] && ins.check(state, report)) {
        grantInsight(state, key);
      }
    }
  }

  // --- management memos -----------------------------------------------------
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
  function eventDef(state) {
    return state.event ? Content.EVENTS[state.event.key] : null;
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
    // milestones first — guaranteed story beats
    for (const [key, def] of Object.entries(Content.EVENTS)) {
      if (def.milestoneRps && !state.milestonesFired[key] && servedRps >= def.milestoneRps) {
        state.milestonesFired[key] = true;
        startEvent(state, key);
        return;
      }
    }
    if (state.t < S.EVENT_MIN_T || servedRps < S.EVENT_MIN_RPS) return;
    if (state.eventCooldown > 0) return;
    if (rand(state) > S.EVENT_CHANCE_PER_S * dt) return;
    const pool = Object.entries(Content.EVENTS)
      .filter(([, d]) => d.random && (!d.needs || d.needs(state)))
      .map(([k]) => k);
    if (pool.length) startEvent(state, pool[Math.floor(rand(state) * pool.length)]);
  }

  // --- demand ---------------------------------------------------------------
  function demand(state) {
    const ev = eventDef(state);
    const trafficMult = (ev && ev.trafficMult) || 1;
    const rps = state.users * S.RPS_PER_USER * trafficMult;
    const weights = {};
    let total = 0;
    for (const k of Content.TYPE_KEYS) {
      const mult = (ev && ev.mixMult && ev.mixMult[k]) || 1;
      weights[k] = state.mix[k] * mult;
      total += weights[k];
    }
    const perType = {};
    for (const k of Content.TYPE_KEYS) perType[k] = rps * weights[k] / total;
    return { rps, perType };
  }

  // --- the tick -------------------------------------------------------------
  //
  // One step is a request's journey through the architecture, in stages. Each
  // stage takes what the previous ones produced and returns a concrete object.
  //
  // Two things are threaded through and mutated by several stages, because they
  // are genuinely cumulative: `ledger` (per request type: demanded, served,
  // failed, latency) and `fails` (failed rps by cause). Everything a request
  // meets can add to both, and the report reads them at the end.

  // The fixed facts of this step, resolved once: which box, how many nodes, and
  // whatever the current event is doing to them.
  function tickContext(state) {
    const ev = eventDef(state);
    const infra = state.infra;
    const tier = Content.TIERS[infra.tier - 1];
    return {
      state, infra, ev, tier,
      dt: S.DT,
      shards: infra.shards,
      replicas: Math.max(0, infra.replicas - ((ev && ev.replicaOut) || 0)),
      nodeCap: tier.cap * (state.migration ? S.MIGRATION_CAP : 1),
    };
  }

  function newLedger(perTypeDemand) {
    const ledger = {};
    for (const k of Content.TYPE_KEYS) {
      ledger[k] = {
        demand: perTypeDemand[k], served: 0, fail: 0,
        latencyMs: Content.TYPES[k].baseMs,
      };
    }
    return ledger;
  }

  // ---- offload lanes -------------------------------------------------------
  // The three ways to keep work off the database. Each absorbs one request type
  // and reports what still has to reach SQL. This is the cheapest capacity in
  // the game: load you delete never needs a node to serve it.

  function kvLane(ctx, ledger, fails) {
    const nodes = ctx.infra.kvNodes;
    const lookup = ledger.lookup;
    if (nodes === 0) return { kv: { rps: 0, util: 0, nodes: 0 }, lookupToSql: lookup.demand };
    const cap = nodes * S.KV_OPS;
    const served = Math.min(lookup.demand, cap);
    const over = lookup.demand - served;
    const util = lookup.demand / cap;
    lookup.latencyMs = S.KV_LAT_MS * hockey(util);
    lookup.served = served;
    lookup.fail += over;
    fails.kv += over;
    return { kv: { rps: served, util, nodes }, lookupToSql: 0 };
  }

  function cacheLane(ctx, ledger) {
    const nodes = ctx.infra.cacheNodes;
    const reads = ledger.read.demand;
    if (nodes === 0) return { hits: 0, misses: reads, hitRate: 0, util: 0, nodes: 0 };
    const ev = ctx.ev;
    // repetition caps what any amount of cache can achieve on this workload
    let hitRate = Math.min(S.CACHE_HIT_MAX, S.CACHE_HIT_BASE + S.CACHE_HIT_PER_NODE * nodes)
      * ctx.state.repetition;
    // writes invalidate entries
    hitRate *= clamp(1 - 0.25 * ledger.write.demand / Math.max(1, reads), 0.5, 1);
    if (ev && ev.hitZero) hitRate = 0;
    const nodesEff = (ev && ev.cacheCapOne) ? 1 : nodes;
    const cap = nodesEff * S.CACHE_OPS;
    const hits = Math.min(reads * hitRate, cap);
    return {
      hits, misses: reads - hits, hitRate, nodes,
      util: reads > 0 ? (reads * hitRate) / cap : 0,
    };
  }

  function warehouseLane(ctx, ledger) {
    if (!ctx.infra.warehouse) return ledger.analytics.demand;
    ledger.analytics.served = ledger.analytics.demand;
    ledger.analytics.latencyMs = S.WAREHOUSE_LAT_MS;
    return 0;
  }

  // ---- the cluster ---------------------------------------------------------

  // Query units, not requests, are what fills a database. This conversion is
  // why a workload that is 3% reports can be 60% of the load.
  function clusterWork(ctx, ledger, cache, lookupToSql, analyticsToSql) {
    const infra = ctx.infra;
    return {
      readUnits: cache.misses * (infra.indexes ? S.READ_UNITS_INDEXED : S.READ_UNITS_RAW)
        + lookupToSql * S.LOOKUP_UNITS,
      writeUnits: ledger.write.demand * S.WRITE_UNITS * (infra.indexes ? S.WRITE_INDEX_TAX : 1),
      // cross-shard fan-out: coordination overhead per extra shard, not N× work
      analyticsUnits: analyticsToSql * S.ANALYTICS_UNITS
        * (1 + S.ANALYTICS_FANOUT * (ctx.shards - 1)),
      // SQL-bound rps per type — the connection gate applies to these
      sqlRps: {
        read: cache.misses,
        write: ledger.write.demand,
        lookup: lookupToSql,
        analytics: analyticsToSql,
      },
    };
  }

  // Gate one: connections. Little's Law — concurrent connections = arrival rate
  // × hold time. Without a pooler every app server also holds some while idle,
  // which is how a database refuses queries at 20% CPU.
  function connectionGate(ctx, ledger, sqlRps, demandRps, fails) {
    const state = ctx.state, ev = ctx.ev;
    let connUsed = 0;
    for (const k of Content.TYPE_KEYS) {
      connUsed += sqlRps[k] * (Math.min(state.prevLatency[k], S.CONN_HOLD_CAP_MS) / 1000);
    }
    if (!ctx.infra.pooler) {
      const appServers = Math.ceil(demandRps / S.RPS_PER_APP_SERVER);
      const stormMult = (ev && ev.stormMult) || 1;
      connUsed += appServers * S.CLIENT_CONNS_PER_APP * stormMult;
    } else if (ev && ev.stormMult) {
      connUsed *= 2; // reconnect churn still doubles held conns briefly
    }
    // every node accepts its own connections, so widening the cluster raises
    // the ceiling as well as the capacity
    const connCap = ctx.shards * (1 + ctx.replicas) * ctx.tier.conns;
    const admit = connUsed > connCap ? connCap / connUsed : 1;
    for (const k of Content.TYPE_KEYS) {
      const rejected = sqlRps[k] * (1 - admit);
      sqlRps[k] -= rejected;
      ledger[k].fail += rejected;
      fails.connections += rejected;
    }
    return { connUsed, connCap, admit };
  }

  // Where the admitted work lands: replicas take reads and reports first, minus
  // the write replay every one of them owes the primary. The rest is primaries.
  function placeLoad(ctx, work, admit) {
    const readUnits = work.readUnits * admit;
    const analyticsUnits = work.analyticsUnits * admit;
    const writeUnits = work.writeUnits * admit;
    const replicaCapTotal = ctx.shards * ctx.replicas * ctx.nodeCap;
    const replayUnits = work.writeUnits * ctx.replicas; // each replica replays its shard's writes
    const readWork = readUnits + analyticsUnits;
    const onReplicas = Math.min(readWork, Math.max(0, replicaCapTotal - replayUnits));
    return {
      readUnits, writeUnits, analyticsUnits, replayUnits,
      replicaCapTotal, primaryCapTotal: ctx.shards * ctx.nodeCap,
      readWork, onReplicas,
      primaryLoad: writeUnits + (readWork - onReplicas),
    };
  }

  // The write queue turns overload into backlog instead of errors — strictly
  // better, but it is staleness debt, not capacity.
  function absorbOverflow(ctx, place) {
    const state = ctx.state, dt = ctx.dt;
    let primaryLoad = place.primaryLoad;
    let overflow = Math.max(0, primaryLoad - place.primaryCapTotal);
    let queuedUnits = 0;
    if (overflow > 0 && ctx.infra.writeQueue) {
      queuedUnits = Math.min(overflow, place.writeUnits);
      state.backlog += queuedUnits * dt;
      overflow -= queuedUnits;
      primaryLoad -= queuedUnits;
    }
    const drain = Math.min(state.backlog, Math.max(0, place.primaryCapTotal - primaryLoad) * dt);
    state.backlog -= drain;
    state.backlogAge = state.backlog > 1 ? state.backlogAge + dt : 0;
    return { primaryLoad, overflow, queuedUnits };
  }

  function saturation(ctx, place, flow) {
    const primaryUtil = place.primaryCapTotal > 0 ? flow.primaryLoad / place.primaryCapTotal : 0;
    const replicaUtil = place.replicaCapTotal > 0
      ? (place.onReplicas + place.replayUnits) / place.replicaCapTotal : 0;
    const replicaShare = place.readWork > 0 ? place.onReplicas / place.readWork : 0;
    return {
      primaryUtil, replicaUtil, replicaShare,
      replayFrac: place.replicaCapTotal > 0 ? place.replayUnits / place.replicaCapTotal : 0,
      // a read costs whatever the pool serving it is doing
      readUtil: replicaShare * replicaUtil + (1 - replicaShare) * primaryUtil,
      // an overloaded replica serves the past
      staleFrac: ctx.replicas > 0 ? clamp((replicaUtil - S.STALE_UTIL) * 2, 0, 0.3) : 0,
    };
  }

  // Gate two: capacity. Past it, work is dropped proportionally across whatever
  // was still in flight — except queued writes, which are backlog now, not loss.
  function dropOverCapacity(ledger, sqlRps, flow, fails) {
    const cpuLoad = flow.primaryLoad + flow.overflow;
    const cpuDropFrac = cpuLoad > 0 ? flow.overflow / cpuLoad : 0;
    for (const k of Content.TYPE_KEYS) {
      if (k === 'write' && flow.queuedUnits > 0) continue; // queued, not dropped
      const dropped = sqlRps[k] * cpuDropFrac;
      sqlRps[k] -= dropped;
      ledger[k].fail += dropped;
      fails.cpu += dropped;
    }
  }

  // The hockey stick: latency = service time ÷ (1 − utilization). Anything that
  // crosses client patience is a timeout, on a smooth ramp rather than a cliff.
  function applyLatency(ctx, ledger, sqlRps, sat, cache, fails) {
    const latMult = {
      read: hockey(sat.readUtil), write: hockey(sat.primaryUtil),
      lookup: hockey(sat.readUtil), analytics: hockey(sat.readUtil),
    };
    for (const k of Content.TYPE_KEYS) {
      if (sqlRps[k] <= 0) continue;
      const lat = Content.TYPES[k].baseMs * latMult[k];
      const timeoutFrac = clamp((lat / S.TIMEOUT_MS - 0.5) * 1.2, 0, 1);
      const timedOut = sqlRps[k] * timeoutFrac;
      ledger[k].fail += timedOut;
      fails.timeout += timedOut;
      ledger[k].served += sqlRps[k] - timedOut;
      ledger[k].latencyMs = lat;
    }
    // cached reads blend into the read latency users actually feel
    if (cache.hits > 0) {
      const dbLat = ledger.read.latencyMs;
      ledger.read.served += cache.hits;
      ledger.read.latencyMs = (cache.hits * 1 + cache.misses * dbLat)
        / Math.max(1, ledger.read.demand);
    }
    const state = ctx.state;
    for (const k of Content.TYPE_KEYS) {
      state.prevLatency[k] += (ledger[k].latencyMs - state.prevLatency[k])
        * Math.min(1, ctx.dt / S.LAT_EMA_S);
    }
  }

  function totals(ctx, ledger) {
    let servedRps = 0, failRps = 0, latSum = 0;
    for (const k of Content.TYPE_KEYS) {
      servedRps += ledger[k].served;
      failRps += ledger[k].fail;
      latSum += ledger[k].served * ledger[k].latencyMs;
    }
    // a 2s report is not on the checkout path, so warehouse latency is excluded
    // from the p50/p99 users actually feel
    const offPath = ctx.infra.warehouse ? ledger.analytics.served : 0;
    const oltpServed = servedRps - offPath;
    const oltpLatSum = latSum - offPath * S.WAREHOUSE_LAT_MS;
    const p50 = oltpServed > 0 ? oltpLatSum / oltpServed : 1;
    return { servedRps, failRps, p50, p99: Math.min(p50 * 3, 5000) };
  }

  // Reputation is the slow signal and decides growth; error rate is the fast
  // one and churns users out NOW. That split is what makes overload self-
  // limiting: a meltdown sheds the very traffic causing it, so there is always
  // a way back rather than a runaway you cannot buy your way out of.
  function updateDemandSide(ctx, tot, sat, place, demandRps) {
    const state = ctx.state, dt = ctx.dt;
    const successFrac = demandRps > 0 ? tot.servedRps / demandRps : 1;
    let repTarget = 100 * Math.pow(successFrac, S.REP_SHARPNESS)
      - 25 * clamp((tot.p99 - 400) / 1600, 0, 1)
      - 10 * sat.staleFrac / 0.3
      - (state.backlog > 1 ? 5 + 10 * clamp(state.backlog / (place.primaryCapTotal * 5), 0, 1) : 0);
    repTarget = clamp(repTarget, 0, 100);
    // reputation crashes fast and rebuilds slowly — meltdowns leave scars
    const repTau = repTarget < state.reputation ? S.REP_TAU_DOWN : S.REP_TAU_UP;
    state.reputation += (repTarget - state.reputation) * dt / repTau;

    const errFrac = demandRps > 0 ? tot.failRps / demandRps : 0;
    const churn = S.ERR_CHURN * Math.pow(Math.max(0, errFrac - S.ERR_TOLERANCE), 2);
    const market = Math.max(0, 1 - state.users / S.MARKET_USERS);
    let growth = S.GROWTH_RATE
      * clamp((state.reputation - S.REP_NEUTRAL) / (100 - S.REP_NEUTRAL), -1, 1);
    if (growth > 0) growth *= market;
    growth -= churn;
    state.users = Math.max(1, state.users * Math.exp(growth * dt));
    state.peakUsers = Math.max(state.peakUsers, state.users);
    return growth;
  }

  // Any live customer base means some cash flow — subscriptions, contracts, the
  // traffic that did get through. Revenue floors while anyone is left.
  function settleMoney(ctx, servedRps) {
    const state = ctx.state;
    const earned = servedRps * state.revenue;
    const income = state.users > 1 ? Math.max(S.MIN_INCOME, earned) : earned;
    const costs = costTotals(state);
    state.cash += (income - costs.total) * ctx.dt;
    return { income, spend: costs.total, costs };
  }

  function tick(state) {
    if (state.outcome) return state.report;
    const dt = S.DT;
    state.t += dt;
    if (state.migration) {
      state.migration.left -= dt;
      if (state.migration.left <= 0) state.migration = null;
    }

    const ctx = tickContext(state);
    const d = demand(state);
    const ledger = newLedger(d.perType);
    const fails = { connections: 0, cpu: 0, timeout: 0, cache: 0, kv: 0 };

    // keep work off the database wherever it can go somewhere cheaper
    const { kv, lookupToSql } = kvLane(ctx, ledger, fails);
    const cache = cacheLane(ctx, ledger);
    const analyticsToSql = warehouseLane(ctx, ledger);

    // the rest becomes query units, and has to pass two gates to be served
    const work = clusterWork(ctx, ledger, cache, lookupToSql, analyticsToSql);
    const conns = connectionGate(ctx, ledger, work.sqlRps, d.rps, fails);
    const place = placeLoad(ctx, work, conns.admit);
    const flow = absorbOverflow(ctx, place);
    const sat = saturation(ctx, place, flow);
    dropOverCapacity(ledger, work.sqlRps, flow, fails);
    applyLatency(ctx, ledger, work.sqlRps, sat, cache, fails);

    // what all that did to the business
    const tot = totals(ctx, ledger);
    const growth = updateDemandSide(ctx, tot, sat, place, d.rps);
    const money = settleMoney(ctx, tot.servedRps);

    // ---- report: the contract with the UI, the guru and the tests ----
    const report = {
      demandRps: d.rps, servedRps: tot.servedRps, failRps: tot.failRps, perType: ledger,
      cache, kv,
      sql: {
        primaryUtil: Math.min(1, sat.primaryUtil), replicaUtil: Math.min(1, sat.replicaUtil),
        replayFrac: sat.replayFrac, staleFrac: sat.staleFrac,
        connUsed: conns.connUsed, connCap: conns.connCap, rejectRps: fails.connections,
        primaryCapTotal: place.primaryCapTotal, analyticsUnits: place.analyticsUnits,
        // where the cluster's work actually goes — the first question in any
        // capacity conversation, and what the guru reasons over
        units: {
          read: place.readUnits,
          write: place.writeUnits,
          analytics: place.analyticsUnits,
          replay: place.replayUnits,
        },
        clusterCapTotal: place.primaryCapTotal + place.replicaCapTotal,
        shards: ctx.shards, replicas: ctx.replicas, nodeCap: ctx.nodeCap,
        readOnReplicaFrac: sat.replicaShare,
      },
      fails, p50: tot.p50, p99: tot.p99,
      income: money.income, spend: money.spend, costs: money.costs,
      growthPerS: growth,
      runway: money.spend > money.income
        ? state.cash / (money.spend - money.income) : Infinity,
      backlog: state.backlog,
      event: state.event ? { key: state.event.key, left: state.event.left } : null,
      migration: state.migration ? { left: state.migration.left } : null,
    };
    state.report = report;

    // post-mortem window: remember what has been failing lately
    state.failWindow.push({ t: state.t, fails: { ...fails } });
    while (state.failWindow.length && state.failWindow[0].t < state.t - 15) state.failWindow.shift();

    checkInsights(state, report);
    checkMemos(state, report);
    updateEvents(state, tot.servedRps, dt);
    updateHistory(state, report, dt);
    updateOutcome(state, report, dt);
    return report;
  }

  function updateHistory(state, report, dt) {
    state.historyAcc += dt;
    if (state.historyAcc < S.HISTORY_DT) return;
    state.historyAcc = 0;
    state.history.push({
      t: state.t, demand: report.demandRps, served: report.servedRps,
      fail: report.failRps, p50: report.p50, p99: report.p99, cash: state.cash,
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
    const errFrac = report.demandRps > 0 ? report.failRps / report.demandRps : 0;
    if (report.servedRps >= S.WIN_RPS && errFrac < S.WIN_MAX_ERR) {
      state.winTimer += dt;
      if (state.winTimer >= S.WIN_HOLD_S) state.outcome = 'won';
    } else {
      state.winTimer = 0;
    }
    if (state.cash < S.BANKRUPT_CASH) {
      state.outcome = 'lost';
      state.deathCause = 'bankrupt';
    }
    const peakRps = state.peakUsers * S.RPS_PER_USER;
    const collapsed = peakRps >= S.COLLAPSE_PEAK_RPS && state.users <= state.peakUsers * S.COLLAPSE_FRAC;
    const busto = state.peakUsers > 2 * S.START_USERS && state.users <= S.BUST_USERS;
    if (collapsed || busto) {
      state.outcome = 'lost';
      const totals = failReasonTotals(state);
      const worst = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
      state.deathCause = worst && worst[1] > 0 ? worst[0] : 'latency';
    }
  }

  return {
    createState, tick, buy, scaleDown, expenses, costBreakdown, costTotals,
    costIfBought, expensesIfBought,
    shopItem, failReasonTotals, applyProfile,
  };
})();

if (typeof module !== 'undefined') module.exports = Engine;
