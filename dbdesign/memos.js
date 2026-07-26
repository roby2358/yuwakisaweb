// HUG OF DEATH — management memos: normative snark, fired at architectural
// choices and at hesitation.
//
// Each memo composes from three decks (see flourish.js): a SENDER, a SUBJECT
// line, and a BARB. A memo with 10 barbs, 12 senders and 4 subjects yields
// ~480 distinct panels, and Flourish guarantees you see every barb before any
// repeats. Adding more is just appending strings — nothing else changes.
//
// check(state, report) → truthy fires it. Purchase-triggered memos read
// state.lastBuy, which the engine stamps on every buy.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./content.js');
}

Content.MEMO_SENDERS = [
  { name: 'Dana Whitcomb', title: 'CEO' },
  { name: 'Priya Raghavan', title: 'CFO' },
  { name: 'Marcus Oyelaran', title: 'COO' },
  { name: 'Kenji Watanabe', title: 'Chief of Staff' },
  { name: 'Chad', title: 'VP, Growth' },
  { name: 'the Board', title: '' },
  { name: 'Investor Relations', title: '' },
  { name: 'Finance', title: '(automated)' },
  { name: 'Procurement', title: '' },
  { name: 'The Steering Committee', title: '' },
  { name: 'Your skip-level', title: '' },
  { name: 'Legal', title: 'cc: everyone' },
];

Content.MEMO_MIN_GAP = 22;   // seconds between any two memos
Content.MEMO_DWELL = 13;     // seconds a memo stays on screen

Content.MEMOS = {
  // ---------------------------------------------------------------- spending
  verticalEarly: {
    cooldown: 100,
    subjects: ['Re: infrastructure spend', 'Quick question', 'Following up on the invoice',
      'Our charter'],
    check: (s, r) => s.lastBuy && s.lastBuy.key === 'tier' && s.t - s.lastBuy.t < 0.5
      && r.sql.primaryUtil < 0.55,
    barbs: [
      'Our charter is to make money, not to spend it. The box you replaced was not out of breath.',
      'Bigger boxes are not good for their own sake. Which number were you trying to move?',
      'A larger instance is not a strategy. It is a receipt.',
      'We looked at the graph. The old box was asleep. Now we have a bigger box, asleep.',
      'You have doubled our capacity and our bill. Only one of those was requested.',
      'Reminder: the cheapest server is the one we did not need to rent.',
      'Please demonstrate that the current box is the constraint before replacing it.',
      'Hardware is the tax we pay on unexamined queries.',
      'Was there an index you could have added instead? There is usually an index you could have added instead.',
      'Approved, reluctantly. We cannot buy our way out of every problem — only the expensive ones.',
      'Every tier costs about two and a half times the last. Growth does not.',
    ],
  },

  idleCapacity: {
    cooldown: 120,
    subjects: ['Utilization review', 'Re: the fleet', 'Cost per served request',
      'A gentle observation'],
    check: (s, r) => r.sql.primaryUtil < 0.2 && r.spend > r.income && r.spend > 20 && s.t > 120,
    barbs: [
      'We are paying for a great deal of silence.',
      'Utilization is in the teens. Somewhere a server is being paid to think about nothing.',
      'Idle capacity is not insurance. It is a subscription to a problem we do not have.',
      'The fleet is bored, and bored is expensive.',
      'If we are provisioning for a spike, please name the spike and its arrival time.',
      'Our burn assumes growth we are not currently experiencing.',
      'Headroom is prudent. This is not headroom, this is a warehouse.',
      'We may be the most over-provisioned company of our size. Not the record we wanted.',
      'Please scale something down before the board asks us to.',
      'Finance ran the numbers twice and would like to know whether the servers are okay.',
    ],
  },

  runwayShort: {
    cooldown: 75,
    subjects: ['Runway', 'URGENT: burn rate', 'Re: solvency', 'Please read this one'],
    check: (s, r) => r.runway < 90 && s.t > 60,
    barbs: [
      'At current burn we have under two minutes of company left.',
      'Burn exceeds revenue. This is normally the point at which someone receives a title change.',
      'Finance is not asking you to be frugal. Finance is asking you to be solvent.',
      'We can afford this architecture or we can afford payroll.',
      'The runway counter is not decorative.',
      'Please shut something down. Anything. Surprise us.',
      'We are optimizing uptime for a company that is about to stop existing.',
      'Every subsystem bills us whether or not it is helping. Several are not helping.',
    ],
  },

  // ------------------------------------------------------- wrong tool, wrong time
  cacheWasted: {
    cooldown: 90,
    subjects: ['Re: the cache', 'Hit rate', 'Cost review: caching layer', 'Circling back'],
    check: (s, r) => s.infra.cacheNodes >= 2 && r.cache.hitRate < 0.35
      && r.perType.read.demand > 200,
    barbs: [
      'The cache is hitting under a third of the time. We are paying a cache to shrug.',
      'We bought a cache; the workload does not repeat itself. These two facts are related.',
      'Caching unique reads adds a hop and a bill, and nothing else.',
      'Hit rate is the only number that justifies a cache. Ours does not justify it.',
      'Either make the traffic repeat, or stop paying for the assumption that it does.',
      'The caching layer has been very busy invalidating things nobody asked for twice.',
      'This is an expensive way to add latency.',
      'There is no shame in deleting a component. There is some shame in the invoice.',
      'We have built a very fast way of not having the data.',
    ],
  },

  nosqlPremature: {
    cooldown: 150, once: true,
    subjects: ['Re: the new datastore', 'Headcount implications', 'Architecture review',
      'Who is on call for this?'],
    check: (s, r) => s.lastBuy && s.lastBuy.key === 'kv' && s.t - s.lastBuy.t < 0.5
      && r.perType.lookup.demand < 8000,
    barbs: [
      'A second datastore is a second team, a second pager, and a second set of 3am surprises.',
      'We now operate two databases. Please confirm the first one was at capacity.',
      'The lookups you moved amount to a rounding error. The bill does not.',
      'Every architecture diagram gains a box. Very few of them ever lose one.',
      'NoSQL is not free, it is differently expensive, and the difference is people.',
      'Congratulations on the new datastore. Who is on call for it?',
      'We have adopted a technology to solve a problem we do not currently have.',
      'Polyglot persistence is a phase most companies survive.',
      'Please note this decision is effectively permanent. Nobody has ever removed a datastore.',
    ],
  },

  warehousePremature: {
    cooldown: 150, once: true,
    subjects: ['Re: the data platform', 'Reporting strategy', 'Was this the quarter for this?'],
    check: (s, r) => s.lastBuy && s.lastBuy.key === 'warehouse' && s.t - s.lastBuy.t < 0.5
      && r.perType.analytics.demand < 400,
    barbs: [
      'We have built a warehouse to hold approximately nothing.',
      'Reports are a sliver of traffic. We have answered with an entire data platform.',
      'The ETL pipeline now has more moving parts than the product.',
      'Please identify the specific report that justified this.',
      'A warehouse is a data team wearing a trench coat.',
      'This is the correct decision, roughly eighteen months early.',
    ],
  },

  replicaWaste: {
    cooldown: 110,
    subjects: ['Re: read replicas', 'Replication overhead', 'A question about the fleet'],
    check: (s, r) => s.infra.replicas >= 2 && r.sql.replayFrac > 0.55,
    barbs: [
      'Every replica replays every write. On this workload, that is most of what they do.',
      'We are paying several servers to keep up with each other.',
      'Replicas scale reads. We do not have reads. We have writes.',
      'The replicas are busy. Not useful — busy.',
      'This is an elaborate and costly form of backup.',
      'Please retire one and let us know whether anybody notices.',
    ],
  },

  // ------------------------------------------------------------- not acting
  dither: {
    cooldown: 70,
    subjects: ['Are we doing anything?', 'Status?', 'Re: the graphs', 'Following up (again)'],
    check: (s, r) => r.demandRps > 0 && r.failRps / r.demandRps > 0.08
      && s.t - s.lastBuy.t > 55,
    barbs: [
      'The graphs are red and the architecture is unchanged. Is this a strategy?',
      'Doing nothing is a decision, and it is being made loudly, in production.',
      'Customers are receiving errors. We are receiving silence.',
      'The incident channel has become one long question mark.',
      'A wrong fix beats no fix, because a wrong fix produces information.',
      'Please advise whether you are thinking or waiting.',
      'Every second of deliberation is billed to us in churn.',
      'We do not require a perfect plan. We require a plan.',
      'The window in which this was cheap to fix closed a while ago.',
      'Standing by. Increasingly literally.',
    ],
  },

  poolerMissing: {
    cooldown: 80,
    subjects: ['Connections', 'Re: the outage', 'This one is cheap', 'Solved problem'],
    check: (s, r) => !s.infra.pooler && r.sql.rejectRps > 5 && r.sql.primaryUtil < 0.6,
    barbs: [
      'The database is refusing connections while its CPU idles. This is a solved problem, and we have not solved it.',
      'We are turning away customers over bookkeeping.',
      'A connection pooler costs less than this memo took to write.',
      'Every app server is hoarding connections like canned goods.',
      'Our database can serve this traffic. It is simply not being allowed to.',
      'This is the cheapest fix on the board and it remains unpurchased.',
      'Please explain to the board why we scaled hardware instead of multiplexing connections.',
    ],
  },

  indexless: {
    cooldown: 90,
    subjects: ['Query plans', 'Re: table scans', 'Sixty dollars', 'A modest proposal'],
    check: (s, r) => !s.infra.indexes && r.demandRps > 400,
    barbs: [
      'We are scanning entire tables at scale. There has been a database feature for this since 1971.',
      'Every query reads everything. This is thorough, and insane.',
      'Indexes cost sixty dollars. Sixty.',
      'Our queries take a full inventory of the warehouse in order to find one box.',
      'The most expensive line item this quarter is a missing WHERE clause optimization.',
    ],
  },

  errorsIgnored: {
    cooldown: 65,
    subjects: ['Customer impact', 'Support is asking', 'Re: error rate', 'The spinner'],
    check: (s, r) => r.demandRps > 0 && r.failRps / r.demandRps > 0.18 && s.t > 90,
    barbs: [
      'Nearly one in five requests is failing. Customers can count.',
      'Our error rate has become a product feature, in the worst sense.',
      'Support is fielding this and would like it to stop.',
      'Users do not read status pages. They read the spinner.',
      'We are converting expensive traffic into free complaints.',
      'Every failed request cost us money to receive and earned us none.',
      'The graph is shaped like an apology tour.',
    ],
  },

  shardPanic: {
    cooldown: 120,
    subjects: ['Sequencing', 'Re: the migration', 'Bold', 'Timing'],
    check: (s, r) => s.lastBuy && s.lastBuy.key === 'shard' && s.t - s.lastBuy.t < 0.5
      && s.lastBuy.util > 0.85,
    barbs: [
      'Migrating data while the system is on fire is a bold sequencing choice.',
      'We are resharding at peak. The word for this is "anyway".',
      'The correct time to shard was before we needed it. Every later time is worse.',
      'Capacity drops during migration. So does patience.',
      'Noted. Please schedule the next crisis further in advance.',
    ],
  },

  // ------------------------------------------------------------- backhanded praise
  doingWell: {
    cooldown: 160,
    subjects: ['Nice work', 'Re: metrics', 'Noted', 'Raising the target'],
    check: (s, r) => r.income > r.spend * 1.6 && r.demandRps > 5000
      && r.failRps / Math.max(1, r.demandRps) < 0.01 && s.reputation > 80,
    barbs: [
      'Metrics are green. We assume this is temporary and are planning accordingly.',
      'Well run. The board has noticed, and will now expect it permanently.',
      'Nothing is broken, which we understand is the most suspicious possible state.',
      'Margins are healthy. Leadership will shortly propose a feature to correct that.',
      'Good work. As a reward, the growth target has been raised.',
      'The system is stable. Please do not touch it, and also please add capacity.',
      'Whatever you are doing, continue, but cheaper.',
    ],
  },
};

Content.MEMO_KEYS = Object.keys(Content.MEMOS);

if (typeof module !== 'undefined') module.exports = Content;
