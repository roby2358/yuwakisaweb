// HUG OF DEATH — engine: pure simulation over Content. No DOM.
// Engine.tick(state) advances one Content.SIM.DT step and stores a report
// on state.report for the UI / tests.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./content.js');
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
    return Content.SHOP.find(i => i.key === key);
  }

  function buy(state, key) {
    if (state.outcome) return { ok: false, msg: 'game over' };
    const item = shopItem(key);
    const price = item.price(state);
    if (price === null) return { ok: false, msg: 'maxed out' };
    if (state.cash < price) return { ok: false, msg: 'not enough cash' };
    state.cash -= price;
    item.apply(state);
    if (item.insightOnBuy) grantInsight(state, item.insightOnBuy);
    return { ok: true };
  }

  function expenses(state) {
    let sum = 0;
    for (const item of Content.SHOP) sum += item.run(state);
    return sum;
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
  function tick(state) {
    if (state.outcome) return state.report;
    const dt = S.DT;
    state.t += dt;
    if (state.migration) {
      state.migration.left -= dt;
      if (state.migration.left <= 0) state.migration = null;
    }

    const ev = eventDef(state);
    const infra = state.infra;
    const tier = Content.TIERS[infra.tier - 1];
    const capMult = state.migration ? S.MIGRATION_CAP : 1;
    const d = demand(state);

    // per-type accounting: served/fail rps and latency
    const out = {};
    for (const k of Content.TYPE_KEYS) {
      out[k] = { demand: d.perType[k], served: 0, fail: 0, latencyMs: Content.TYPES[k].baseMs };
    }
    const fails = { connections: 0, cpu: 0, timeout: 0, cache: 0, kv: 0 };

    // ---- KV lane (NoSQL) ----
    let kv = { rps: 0, util: 0, nodes: infra.kvNodes };
    let lookupToSql = out.lookup.demand;
    if (infra.kvNodes > 0) {
      const cap = infra.kvNodes * S.KV_OPS;
      kv.rps = Math.min(out.lookup.demand, cap);
      const over = out.lookup.demand - kv.rps;
      kv.util = out.lookup.demand / cap;
      out.lookup.latencyMs = S.KV_LAT_MS * hockey(kv.util);
      out.lookup.served = kv.rps;
      out.lookup.fail += over;
      fails.kv += over;
      lookupToSql = 0;
    }

    // ---- Cache lane (reads) ----
    const reads = out.read.demand;
    let cache = { hits: 0, misses: reads, hitRate: 0, util: 0, nodes: infra.cacheNodes };
    if (infra.cacheNodes > 0) {
      // repetition caps what any amount of cache can achieve on this workload
      let hitRate = Math.min(S.CACHE_HIT_MAX, S.CACHE_HIT_BASE + S.CACHE_HIT_PER_NODE * infra.cacheNodes)
        * state.repetition;
      // writes invalidate entries
      hitRate *= clamp(1 - 0.25 * out.write.demand / Math.max(1, reads), 0.5, 1);
      if (ev && ev.hitZero) hitRate = 0;
      const nodesEff = (ev && ev.cacheCapOne) ? 1 : infra.cacheNodes;
      const cap = nodesEff * S.CACHE_OPS;
      cache.hits = Math.min(reads * hitRate, cap);
      cache.misses = reads - cache.hits;
      cache.hitRate = hitRate;
      cache.util = reads > 0 ? (reads * hitRate) / cap : 0;
    }

    // ---- Warehouse lane (analytics) ----
    let analyticsToSql = out.analytics.demand;
    if (infra.warehouse) {
      out.analytics.served = out.analytics.demand;
      out.analytics.latencyMs = S.WAREHOUSE_LAT_MS;
      analyticsToSql = 0;
    }

    // ---- SQL cluster ----
    const N = infra.shards;
    const R = Math.max(0, infra.replicas - ((ev && ev.replicaOut) || 0));
    const nodeCap = tier.cap * capMult;
    const readUnits = cache.misses * (infra.indexes ? S.READ_UNITS_INDEXED : S.READ_UNITS_RAW)
      + lookupToSql * S.LOOKUP_UNITS;
    const writeUnits = out.write.demand * S.WRITE_UNITS * (infra.indexes ? S.WRITE_INDEX_TAX : 1);
    const analyticsUnits = analyticsToSql * S.ANALYTICS_UNITS * N; // cross-shard fan-out

    // SQL-bound rps per type (connection gate applies to these)
    const sqlRps = {
      read: cache.misses,
      write: out.write.demand,
      lookup: lookupToSql,
      analytics: analyticsToSql,
    };

    // connections: Little's law + idle app-server connections when unpooled
    const sqlTotalRps = Content.TYPE_KEYS.reduce((a, k) => a + sqlRps[k], 0);
    let connUsed = 0;
    for (const k of Content.TYPE_KEYS) {
      connUsed += sqlRps[k] * (Math.min(state.prevLatency[k], S.CONN_HOLD_CAP_MS) / 1000);
    }
    if (!infra.pooler) {
      const appServers = Math.ceil(d.rps / S.RPS_PER_APP_SERVER);
      const stormMult = (ev && ev.stormMult) || 1;
      connUsed += appServers * S.CLIENT_CONNS_PER_APP * stormMult;
    } else if (ev && ev.stormMult) {
      connUsed *= 2; // reconnect churn still doubles held conns briefly
    }
    const connCap = N * (1 + R) * tier.conns;
    const admit = connUsed > connCap ? connCap / connUsed : 1;
    for (const k of Content.TYPE_KEYS) {
      const rejected = sqlRps[k] * (1 - admit);
      sqlRps[k] -= rejected;
      out[k].fail += rejected;
      fails.connections += rejected;
    }

    // CPU: replicas serve reads/analytics first (minus write replay), rest on primaries
    const admitReadUnits = readUnits * admit;
    const admitWriteUnits = writeUnits * admit;
    const admitAnalyticsUnits = analyticsUnits * admit;
    const replicaCapTotal = N * R * nodeCap;
    const replayUnits = writeUnits * R; // every replica replays its shard's writes
    const replicaAvail = Math.max(0, replicaCapTotal - replayUnits);
    const readWork = admitReadUnits + admitAnalyticsUnits;
    const onReplicas = Math.min(readWork, replicaAvail);
    const primaryCapTotal = N * nodeCap;
    let primaryLoad = admitWriteUnits + (readWork - onReplicas);

    // write queue absorbs the write share of any overflow
    let overflow = Math.max(0, primaryLoad - primaryCapTotal);
    let queuedUnits = 0;
    if (overflow > 0 && infra.writeQueue) {
      queuedUnits = Math.min(overflow, admitWriteUnits);
      state.backlog += queuedUnits * dt;
      overflow -= queuedUnits;
      primaryLoad -= queuedUnits;
    }
    const drain = Math.min(state.backlog, Math.max(0, primaryCapTotal - primaryLoad) * dt);
    state.backlog -= drain;
    state.backlogAge = state.backlog > 1 ? state.backlogAge + dt : 0;

    const primaryUtil = primaryCapTotal > 0 ? primaryLoad / primaryCapTotal : 0;
    const replicaUtil = replicaCapTotal > 0 ? (onReplicas + replayUnits) / replicaCapTotal : 0;
    const replayFrac = replicaCapTotal > 0 ? replayUnits / replicaCapTotal : 0;

    // CPU overflow drops requests proportionally (queued writes exempt)
    const cpuLoad = primaryLoad + overflow;
    const cpuDropFrac = cpuLoad > 0 ? overflow / cpuLoad : 0;
    for (const k of Content.TYPE_KEYS) {
      if (k === 'write' && queuedUnits > 0) continue; // queued, not dropped
      const dropped = sqlRps[k] * cpuDropFrac;
      sqlRps[k] -= dropped;
      out[k].fail += dropped;
      fails.cpu += dropped;
    }

    // latency per type from the pool that serves it
    const replicaShare = readWork > 0 ? onReplicas / readWork : 0;
    const readUtil = replicaShare * replicaUtil + (1 - replicaShare) * primaryUtil;
    const latMult = { read: hockey(readUtil), write: hockey(primaryUtil), lookup: hockey(readUtil), analytics: hockey(readUtil) };
    for (const k of Content.TYPE_KEYS) {
      if (sqlRps[k] <= 0) continue;
      let lat = Content.TYPES[k].baseMs * latMult[k];
      // timeouts: a smooth ramp toward client patience
      const timeoutFrac = clamp((lat / S.TIMEOUT_MS - 0.5) * 1.2, 0, 1);
      const timedOut = sqlRps[k] * timeoutFrac;
      out[k].fail += timedOut;
      fails.timeout += timedOut;
      out[k].served += sqlRps[k] - timedOut;
      out[k].latencyMs = lat;
    }
    // cached reads blend into read latency
    if (cache.hits > 0) {
      out.read.served += cache.hits;
      const dbLat = out.read.latencyMs;
      out.read.latencyMs = (cache.hits * 1 + cache.misses * dbLat) / Math.max(1, reads);
    }
    for (const k of Content.TYPE_KEYS) {
      state.prevLatency[k] += (out[k].latencyMs - state.prevLatency[k]) * Math.min(1, dt / S.LAT_EMA_S);
    }

    // stale reads from lagging replicas
    const staleFrac = R > 0 ? clamp((replicaUtil - S.STALE_UTIL) * 2, 0, 0.3) : 0;

    // ---- totals, reputation, money ----
    let servedRps = 0, failRps = 0, latSum = 0;
    for (const k of Content.TYPE_KEYS) {
      servedRps += out[k].served;
      failRps += out[k].fail;
      latSum += out[k].served * out[k].latencyMs;
    }
    // warehouse latency excluded from the OLTP p50/p99 the users feel
    const oltpServed = servedRps - (infra.warehouse ? out.analytics.served : 0);
    const oltpLatSum = latSum - (infra.warehouse ? out.analytics.served * S.WAREHOUSE_LAT_MS : 0);
    const p50 = oltpServed > 0 ? oltpLatSum / oltpServed : 1;
    const p99 = Math.min(p50 * 3, 5000);

    const successFrac = d.rps > 0 ? servedRps / d.rps : 1;
    let repTarget = 100 * successFrac
      - 25 * clamp((p99 - 400) / 1600, 0, 1)
      - 10 * staleFrac / 0.3
      - (state.backlog > 1 ? 5 + 10 * clamp(state.backlog / (primaryCapTotal * 5), 0, 1) : 0);
    repTarget = clamp(repTarget, 0, 100);
    // reputation crashes fast and rebuilds slowly — meltdowns leave scars
    const repTau = repTarget < state.reputation ? S.REP_TAU_DOWN : S.REP_TAU_UP;
    state.reputation += (repTarget - state.reputation) * dt / repTau;

    // errors churn users directly: burned users leave NOW, and rep-driven
    // growth only wins them back slowly afterward
    const errFrac = d.rps > 0 ? failRps / d.rps : 0;
    const churn = S.ERR_CHURN * Math.pow(Math.max(0, errFrac - S.ERR_TOLERANCE), 2);
    const market = Math.max(0, 1 - state.users / S.MARKET_USERS);
    let growth = S.GROWTH_RATE * clamp((state.reputation - S.REP_NEUTRAL) / (100 - S.REP_NEUTRAL), -1, 1);
    if (growth > 0) growth *= market;
    growth -= churn;
    state.users = Math.max(1, state.users * Math.exp(growth * dt));
    state.peakUsers = Math.max(state.peakUsers, state.users);

    const income = servedRps * state.revenue;
    const spend = expenses(state);
    state.cash += (income - spend) * dt;

    // ---- report ----
    const report = {
      demandRps: d.rps, servedRps, failRps, perType: out,
      cache, kv,
      sql: {
        primaryUtil: Math.min(1, primaryUtil), replicaUtil: Math.min(1, replicaUtil),
        replayFrac, staleFrac,
        connUsed, connCap, rejectRps: fails.connections,
        primaryCapTotal, analyticsUnits: admitAnalyticsUnits,
        shards: N, replicas: R, nodeCap,
        readOnReplicaFrac: replicaShare,
      },
      fails, p50, p99, income, spend,
      backlog: state.backlog,
      event: state.event ? { key: state.event.key, left: state.event.left } : null,
      migration: state.migration ? { left: state.migration.left } : null,
    };
    state.report = report;

    // post-mortem window: remember what has been failing lately
    state.failWindow.push({ t: state.t, fails: { ...fails } });
    while (state.failWindow.length && state.failWindow[0].t < state.t - 15) state.failWindow.shift();

    checkInsights(state, report);
    updateEvents(state, servedRps, dt);
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

  return { createState, tick, buy, expenses, shopItem, failReasonTotals, applyProfile };
})();

if (typeof module !== 'undefined') module.exports = Engine;
