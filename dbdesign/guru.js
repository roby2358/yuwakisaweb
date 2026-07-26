// HUG OF DEATH — the Guru: on-demand diagnosis of the situation in front of
// you. Answers the question the player actually has ("CPU is pegged — bigger
// box, or shard?") by looking at WHERE the load is going, not just how much
// there is.
//
// RULES are ordered by priority. advise() returns the first few that match, so
// the top card is always the most urgent thing true right now. The last rule
// matches unconditionally, so there is always an answer.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./memos.js');
  var Fmt = require('./format.js');
}

var Guru = (() => {
  const pct = Fmt.pct;
  const num = Fmt.count;

  // Fractions of total cluster work, by kind. This is the diagnosis.
  function loadMix(report) {
    const u = report.sql.units;
    const total = u.read + u.write + u.analytics + u.replay;
    if (total <= 0) return { read: 0, write: 0, analytics: 0, replay: 0, total: 0 };
    return {
      read: u.read / total, write: u.write / total,
      analytics: u.analytics / total, replay: u.replay / total,
      total,
    };
  }

  // Seconds until growth eats the remaining headroom, at the current rate.
  function secondsToWall(state, report) {
    const util = Math.max(0.01, report.sql.primaryUtil);
    if (report.growthPerS <= 0.0005 || util >= 0.85) return null;
    return Math.log(0.85 / util) / report.growthPerS;
  }

  const RULES = [
    {
      key: 'migrating',
      severity: 'info',
      when: (s) => !!s.migration,
      headline: (s) => 'Resharding — ' + Math.ceil(s.migration.left) + 's left.',
      body: () => 'Capacity is at 60% while data moves between shards. Errors right now are the migration, not a new problem.',
      action: () => 'Hold. Do not buy anything you would regret at full capacity.',
    },
    {
      key: 'broke',
      severity: 'critical',
      when: (s, r) => r.runway < 75 && r.spend > r.income,
      headline: (s, r) => 'Under ' + Math.max(0, Math.round(r.runway)) + 's of runway left.',
      body: (s, r) => 'You are burning $' + r.spend.toFixed(0) + '/s against $' + r.income.toFixed(0) +
        '/s of revenue. $' + r.costs.fixed.toFixed(0) + '/s of that is fixed cost you pay whether or not it helps.',
      action: (s, r) => {
        const worst = r.costs.parts
          .filter(p => p.total > 0 && Content.SHOP_BY_KEY[p.key].canScaleDown(s))
          .sort((a, b) => b.total - a.total)[0];
        return worst
          ? 'Scale something down. Your most expensive removable subsystem is ' + worst.name +
            ' at $' + worst.total.toFixed(0) + '/s.'
          : 'Serve more traffic or shut something down — those are the only two levers.';
      },
    },
    {
      key: 'errors',
      severity: 'critical',
      when: (s, r) => r.demandRps > 0 && r.failRps / r.demandRps > 0.1,
      headline: (s, r) => pct(r.failRps / r.demandRps) + ' of requests are failing.',
      body: (s, r) => {
        const worst = Object.entries(r.fails).sort((a, b) => b[1] - a[1])[0];
        const why = {
          connections: 'the database is refusing connections',
          cpu: 'the cluster is out of query capacity',
          timeout: 'requests are too slow and clients are giving up',
          kv: 'the KV store is out of capacity',
          cache: 'the cache tier is saturated',
        };
        return 'Most of it is ' + (why[worst[0]] || 'saturation') + '. Users churn quadratically in this number, so it compounds.';
      },
      action: () => 'Fix the failing component before buying anything else — every second here permanently costs users.',
    },
    {
      key: 'connStarve',
      severity: 'critical',
      when: (s, r) => !s.infra.pooler && r.sql.rejectRps > 3,
      headline: (s, r) => 'Refusing ' + num(r.sql.rejectRps) + ' req/s on connections, at ' +
        pct(r.sql.primaryUtil) + ' CPU.',
      body: (s, r) => 'You are holding ' + num(r.sql.connUsed) + ' connections against a limit of ' +
        num(r.sql.connCap) + '. App servers hold connections open while idle, so you run out of ' +
        'connections long before you run out of CPU.',
      action: () => 'Buy the connection pooler. It is the cheapest fix on the board and nothing else you buy will help until it is in.',
    },
    {
      key: 'connCapped',
      severity: 'warn',
      when: (s, r) => s.infra.pooler && r.sql.connCap > 0 && r.sql.connUsed > 0.9 * r.sql.connCap,
      headline: (s, r) => {
        const ratio = r.sql.connUsed / r.sql.connCap;
        return ratio > 1.15
          ? 'Connection demand is ' + ratio.toFixed(1) + '× your limit, even with the pooler.'
          : 'Connections are at ' + pct(ratio) + ' of capacity even with the pooler.';
      },
      body: (s, r) => 'Little\'s Law: concurrent connections = arrival rate × hold time. At ' +
        num(r.demandRps) + ' req/s and ~' + Math.round(r.p50) + 'ms per request you need about ' +
        num(r.sql.connUsed) + ' connections. Slow queries hold connections longer, which uses more ' +
        'connections, which queues more queries — this loop tightens itself.',
      action: () => 'Attack hold time, not the limit: cut latency with capacity or by deleting load. More nodes also raise the connection ceiling.',
    },
    {
      key: 'noIndexes',
      severity: 'critical',
      when: (s, r) => !s.infra.indexes && r.demandRps > 300,
      headline: () => 'Every read is scanning the whole table.',
      body: () => 'Unindexed reads cost 10 query units; indexed ones cost 1. You are paying 10× for every read in the system.',
      action: () => 'Buy indexes ($60). Do it before you buy any hardware — hardware cannot outrun a missing index.',
    },
    {
      key: 'backlog',
      severity: 'info',
      when: (s) => s.backlog > 1,
      headline: (s) => 'Write backlog: ' + num(s.backlog) + ' units queued.',
      body: () => 'The queue converted overload into staleness instead of errors. That is strictly better, but it is debt: users cannot see queued writes yet.',
      action: () => 'Add write capacity (shards) so the backlog drains faster than it fills.',
    },
    {
      key: 'analyticsFanout',
      severity: 'warn',
      when: (s, r) => !s.infra.warehouse && loadMix(r).analytics > 0.4 && r.sql.primaryUtil > 0.6,
      headline: (s, r) => 'Analytics is ' + pct(loadMix(r).analytics) + ' of your cluster’s work.',
      body: (s, r) => s.infra.shards > 1
        ? 'Each report fans out to all ' + s.infra.shards + ' shards, so sharding again makes this WORSE, not better — ' +
          'every extra shard adds coordination cost to every report.'
        : 'Reports scan and join; each one costs ~60× what a point read costs. They are drowning the transaction path.',
      action: () => 'Buy the analytics warehouse. It deletes this load rather than adding nodes to absorb it — the cheapest capacity on the board.',
    },
    {
      key: 'lookupFlood',
      severity: 'warn',
      when: (s, r) => s.infra.kvNodes === 0 && r.perType.lookup.demand > 8000 && r.sql.primaryUtil > 0.6,
      headline: (s, r) => num(r.perType.lookup.demand) + ' key lookups/s are hitting SQL.',
      body: () => 'Sessions, flags and counters need no joins and no transactions. They are the one workload that leaves your relational database cleanly.',
      action: () => 'Buy a KV store node. Note the first one is expensive ($28/s fixed — a second system to operate); after that each node is cheap.',
    },
    {
      key: 'cacheable',
      severity: 'warn',
      when: (s, r) => s.repetition >= 0.6 && loadMix(r).read > 0.4 && r.sql.primaryUtil > 0.6
        && r.cache.hitRate < 0.6 && s.infra.cacheNodes < Content.MAX_CACHE,
      headline: (s, r) => 'Reads are ' + pct(loadMix(r).read) + ' of the load and your hit rate is only ' +
        pct(r.cache.hitRate) + '.',
      body: (s) => 'This workload repeats itself (' + pct(s.repetition) + ' of reads are repeats), so a cache can ' +
        'absorb them. Every point of hit rate is load the database never sees.',
      action: () => 'Add cache nodes. Cheaper per unit of relief than any hardware here, as long as the hit rate keeps climbing.',
    },
    {
      key: 'needReplica',
      severity: 'warn',
      when: (s, r) => s.infra.replicas === 0 && r.sql.primaryUtil > 0.7
        && loadMix(r).read + loadMix(r).analytics > 0.45,
      headline: (s, r) => 'Reads and reports are ' + pct(loadMix(r).read + loadMix(r).analytics) +
        ' of the load, and every one of them runs on the primary.',
      body: (s, r) => 'You have ' + s.infra.shards + ' primar' + (s.infra.shards > 1 ? 'ies' : 'y') +
        ' and no replicas, so writes and reads compete for the same nodes. A replica takes the read ' +
        'traffic off the primary — and it raises your connection ceiling too, because every node ' +
        'accepts its own connections (' + num(r.sql.connCap) + ' now across ' +
        (s.infra.shards * (1 + s.infra.replicas)) + ' node' +
        (s.infra.shards * (1 + s.infra.replicas) > 1 ? 's' : '') + ').',
      action: () => 'Add a read replica. It is the classic first horizontal move, and it usually drops CPU and connection pressure at the same time.',
    },
    {
      key: 'cacheDud',
      severity: 'warn',
      when: (s, r) => s.infra.cacheNodes >= 2 && r.cache.hitRate < 0.35 && r.perType.read.demand > 200,
      headline: (s, r) => 'Your cache is only hitting ' + pct(r.cache.hitRate) + '.',
      body: (s) => 'Only ' + pct(s.repetition) + ' of this workload’s reads are repeats, so most requests miss and ' +
        'pay for the trip anyway. More nodes will not raise a hit rate the traffic does not support.',
      action: (s, r) => 'Scale the cache down — you are paying $' +
        r.costs.byKey.cache.total.toFixed(0) + '/s for it.',
    },
    // Sits above the rules that follow it because it is a fact about the board
    // rather than a symptom: at the top of the ladder, every fix below ("cut
    // hold time", "relieve the replicas") is something vertical scaling can no
    // longer deliver. Naming the wall first stops the player buying answers
    // that no longer exist.
    {
      key: 'verticalWall',
      severity: 'warn',
      // Fires at the end of the COMMODITY ladder, not at the last rung. Bigger
      // boxes still exist past tier 6 — they just stop being worth buying, and
      // that is the moment the player needs telling. Waiting for tier 12 would
      // announce the wall to almost nobody.
      when: (s, r) => s.infra.tier >= Content.COMMODITY_TIER && r.sql.primaryUtil > 0.8,
      headline: (s) => s.infra.tier >= Content.MAX_TIER
        ? 'You are on the biggest box that exists, and it is not enough.'
        : 'Vertical scaling has stopped paying, and the box is still pegged.',
      body: (s) => {
        if (s.infra.tier >= Content.MAX_TIER) {
          return 'There is no tier ' + (Content.MAX_TIER + 1) + '. Everything from here is ' +
            'horizontal: more primaries, or less work.';
        }
        const left = Content.MAX_TIER - s.infra.tier;
        return 'Tier ' + Content.COMMODITY_TIER + ' is the last commodity box. There ' +
          (left === 1 ? 'is 1 bigger box' : 'are ' + left + ' bigger boxes') + ' on the price ' +
          'list, but each buys 1.5× the work for 2.5× the money and bills it forever — that is ' +
          'what "prices grow faster than capacity" looks like. Buy one only for what it is: ' +
          'capacity that arrives instantly, where a shard split costs a migration dip first. ' +
          'You are paying a premium for time, not for value.';
      },
      action: (s) => s.infra.shards < Content.MAX_SHARDS
        ? 'Shard split, or delete load (warehouse for reports, KV for lookups, cache for repeated reads).'
        : 'You are at max shards — the only lever left is deleting load: warehouse, KV, cache.',
    },
    {
      key: 'writeWall',
      severity: 'warn',
      when: (s, r) => loadMix(r).write > 0.4 && r.sql.primaryUtil > 0.75,
      headline: (s, r) => 'Writes are ' + pct(loadMix(r).write) + ' of the load — this is a sharding problem.',
      body: (s) => 'Writes must reach the owning primary. Caches cannot absorb them and replicas cannot serve them ' +
        (s.infra.replicas > 0 ? '— your ' + s.infra.replicas + ' replicas per shard replay every one of them. ' : '. ') +
        'Only more primaries add write capacity.',
      // proportional to the ladder, not a fixed rung: "still room to climb"
      action: (s) => s.infra.tier < Content.COMMODITY_TIER
        ? 'A bigger box buys time cheaply right now, but plan the shard split — vertical scaling ends and writes keep growing.'
        : 'Shard split. Do it while you have cash and headroom; a migration at 95% utilization is self-inflicted downtime.',
    },
    {
      key: 'replicaBurn',
      severity: 'warn',
      when: (s, r) => s.infra.replicas >= 2 && r.sql.replayFrac > 0.55,
      headline: (s, r) => 'Replicas spend ' + pct(r.sql.replayFrac) + ' of their capacity replaying writes.',
      body: () => 'A replica must apply every write to stay consistent. As write volume grows, replicas stop being read capacity and become expensive copies.',
      action: () => 'Retire a replica and put the money into shards, which add write capacity instead of duplicating it.',
    },
    {
      key: 'staleReads',
      severity: 'warn',
      when: (s, r) => r.sql.staleFrac > 0.05,
      headline: (s, r) => pct(r.sql.staleFrac) + ' of reads are serving stale data.',
      body: () => 'Overloaded replicas fall behind the primary. Users who just wrote something and read it back do not see it — a read-your-writes violation.',
      action: () => 'Relieve the replicas (cache, or more of them) or accept the lag. In production you would pin recent writers to the primary.',
    },
    {
      key: 'cpuPegged',
      severity: 'warn',
      when: (s, r) => r.sql.primaryUtil > 0.8,
      headline: (s, r) => 'Primaries at ' + pct(r.sql.primaryUtil) + ' — latency is on the cliff.',
      body: (s, r) => {
        const mix = loadMix(r);
        const parts = [['reads', mix.read], ['writes', mix.write],
          ['analytics', mix.analytics], ['write replay', mix.replay]]
          .filter(p => p[1] > 0.05)
          .sort((a, b) => b[1] - a[1])
          .map(p => pct(p[1]) + ' ' + p[0]).join(', ');
        return 'Latency is service time ÷ (1 − utilization), so this is where it goes vertical. Your load is ' + parts + '.';
      },
      // Past the commodity ladder the verticalWall card above has already made
      // the argument, so this one sticks to what the load mix implies.
      action: (s) => {
        if (s.infra.tier >= Content.COMMODITY_TIER) {
          return 'Horizontal is the cheaper capacity from here: shard for writes, replicas for ' +
            'reads, and delete what you can (warehouse, KV, cache).';
        }
        return 'Bigger box: it is the simplest move, needs no redesign, and you have ' +
          (Content.COMMODITY_TIER - s.infra.tier) + ' fairly-priced tier(s) left. ' +
          'Shard instead if writes dominate — vertical never fixes writes for long.';
      },
    },
    {
      key: 'idle',
      severity: 'info',
      when: (s, r) => r.sql.primaryUtil < 0.25 && r.spend > r.income && r.spend > 15,
      headline: (s, r) => 'Cluster is ' + pct(r.sql.primaryUtil) + ' busy and losing $' +
        (r.spend - r.income).toFixed(0) + '/s.',
      body: () => 'Idle capacity bills you exactly as much as busy capacity. Over-provisioning is not safety, it is an expensive insurance policy.',
      action: () => 'Scale something down, or grow into it — but do not buy more until utilization recovers.',
    },
    {
      key: 'healthy',
      severity: 'good',
      when: () => true,
      headline: (s, r) => 'Healthy: ' + pct(r.sql.primaryUtil) + ' utilization, ' +
        pct(r.demandRps > 0 ? r.failRps / r.demandRps : 0) + ' errors, $' +
        (r.income - r.spend).toFixed(0) + '/s net.',
      body: (s, r) => {
        const wall = secondsToWall(s, r);
        if (wall === null) return 'Nothing is on fire. Growth is flat right now, so this is a good moment to buy ahead of the curve rather than under it.';
        return 'At the current growth rate you have roughly ' + Math.round(wall) +
          's before utilization reaches 85% and latency starts to climb.';
      },
      action: (s, r) => {
        const mix = loadMix(r);
        if (mix.analytics > 0.3 && !s.infra.warehouse) return 'Next bottleneck: analytics. A warehouse before it hurts.';
        if (mix.write > 0.35 && s.infra.tier >= Content.COMMODITY_TIER) return 'Next bottleneck: writes. Shard while it is calm — migrations under load are downtime.';
        if (s.repetition >= 0.6 && r.cache.hitRate < 0.7 && s.infra.cacheNodes < Content.MAX_CACHE) {
          return 'Cheapest next win: more cache — this workload repeats and your hit rate has room.';
        }
        return 'Buy capacity ahead of the curve; the goal is to never meet the cliff at all.';
      },
    },
  ];

  function advise(state, report) {
    if (!report) return [];
    return RULES
      .filter(rule => rule.when(state, report))
      .slice(0, 4)
      .map(rule => ({
        key: rule.key,
        severity: rule.severity,
        headline: rule.headline(state, report),
        body: rule.body(state, report),
        action: rule.action(state, report),
      }));
  }

  return { advise, loadMix, secondsToWall, RULES };
})();

if (typeof module !== 'undefined') module.exports = Guru;
