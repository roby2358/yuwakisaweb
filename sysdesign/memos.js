// LOAD BEARING — memos: the normative voice.
//
// Insight cards explain how systems work. Memos say what you should have done,
// in the voice of the people who sign the invoices and answer the phones.
// Each memo composes from three decks — sender × subject × barb — so a handful
// of hand-written lines becomes thousands of distinct panels, and Flourish
// draws without replacement so nobody hears the same joke twice in a row.
//
// Extends and re-exports Content: content.js → catalog.js → memos.js → engine.

if (typeof require !== 'undefined' && typeof Content === 'undefined') {
  var Content = require('./catalog.js');
}

Content.MEMO_MIN_GAP = 14;   // seconds between any two memos

Content.MEMO_SENDERS = [
  { name: 'Priya', title: 'CFO' },
  { name: 'Dave', title: 'VP Engineering' },
  { name: 'Marcus', title: 'Head of Support' },
  { name: 'Yuki', title: 'CEO' },
  { name: 'Ellen', title: 'Staff Engineer' },
  { name: 'Tobias', title: 'on-call, again' },
  { name: 'Ravi', title: 'Data Science' },
  { name: 'Nadia', title: 'board observer' },
  { name: 'Gareth', title: 'Security' },
  { name: 'Lin', title: 'Product' },
];

// once: fires at most once per run. cooldown: seconds before it may repeat.
Content.MEMOS = {
  bigboxearly: {
    once: false, cooldown: 70,
    check: s => s.lastBuy.key === 'tier' && s.t - s.lastBuy.t < 1 && s.lastBuy.util < 0.35,
    subjects: [
      're: that invoice',
      're: the upgrade',
      'quick question about the bill',
      're: capacity (?)',
    ],
    barbs: [
      'You bought a bigger database while the old one was a third busy. I am not an engineer, but I can read a graph.',
      'We are now paying for headroom we are not standing in. Was there a cheaper thing first?',
      'Genuine question: what was the number that told you to do that? I would like to see it.',
      'The box was bored. Now it is bored and expensive.',
    ],
  },
  noindexes: {
    once: true, cooldown: 999,
    check: (s, r) => s.t > 45 && !s.infra.indexes && r.units.sql.read > 0.35 * r.sql.cap,
    subjects: ['a thought', 're: the database', 'before you buy anything else'],
    barbs: [
      'Every read is scanning the whole table. There is a sixty dollar fix for that and you have not bought it.',
      'I looked at the query plans. They are all sequential scans. All of them.',
      'We are spending hardware money to avoid a schema change. That is a choice, I suppose.',
    ],
  },
  nopooler: {
    once: true, cooldown: 999,
    check: (s, r) => !s.infra.pooler && r.sql.rejectRps > 5,
    subjects: ['database is refusing us', 're: connection errors', 'the 3am thing'],
    barbs: [
      'The database is turning away queries while its CPU sits idle. It is not out of power, it is out of connections.',
      'Every instance is holding connections it is not using. There is a small piece of software whose entire job is this.',
      'I counted: we have more open connections than the database has permission slips.',
    ],
  },
  blobindb: {
    once: false, cooldown: 90,
    check: (s, r) => !s.infra.objstore && r.perClass.media.demand > 60,
    subjects: ['re: where the photos live', 'storage question', 'this cannot be right'],
    barbs: [
      'We are serving media out of the transactional database. Please tell me there is a plan.',
      'The most expensive storage we own is full of holiday photos.',
      'Every image request is competing with checkout for the same box. I want that sentence to sit with you.',
    ],
  },
  searchscan: {
    once: false, cooldown: 90,
    check: (s, r) => !s.infra.searchEngine && r.units.sql.search > 0.25 * r.sql.cap,
    subjects: ['search is slow', 're: the search box', 'customers are noticing'],
    barbs: [
      'Every search runs a full scan. Users type two letters and we read the entire table.',
      'Search is now a quarter of our database load and none of it is indexed in any useful sense.',
      'We built a search feature on a data structure that cannot search. Bold.',
    ],
  },
  reportsonprod: {
    once: false, cooldown: 100,
    check: (s, r) => !s.infra.olapEngine && r.units.sql.analytics > 0.35 * r.sql.cap,
    subjects: ['sorry about the dashboard', 're: quarter-end', 'my queries'],
    barbs: [
      'I ran one report and the site got slow. I have been asked to stop. I would rather we fixed it.',
      'Analytics is now most of the load on the database customers are trying to buy things from.',
      'Reports and transactions want opposite things from a storage engine. We picked one and are doing both.',
    ],
  },
  cachecold: {
    once: false, cooldown: 100,
    check: (s, r) => s.infra.cacheNodes >= 2 && r.hits.cache < 0.35 && r.perClass.read.demand > 200,
    subjects: ['re: the cache', 'about that memory bill', 'checking my understanding'],
    barbs: [
      'The cache is missing two times in three. We are paying for RAM to store things nobody asks for twice.',
      'Adding nodes has not moved the hit rate. Perhaps the problem is not the number of nodes.',
      'This workload does not repeat itself. The cache does, every month, on the invoice.',
    ],
  },
  spof: {
    once: false, cooldown: 80,
    check: (s, r) => r.minRedundancy <= 1 && r.demandRps > 2000,
    subjects: ['risk register', 're: the single node', 'insurance question'],
    barbs: [
      'One tier is running on exactly one machine. I have written its name on the risk register in pen.',
      'We have redundancy everywhere except the one place a failure would take the whole thing down.',
      'If that box reboots, what happens? I asked three people and got three answers.',
    ],
  },
  blind: {
    once: true, cooldown: 999,
    check: (s, r) => s.infra.obs === 0 && r.demandRps > 3000,
    subjects: ['how do we know?', 're: the incident', 'a process question'],
    barbs: [
      'When it broke, how did we find out? I would like the answer to be a graph and not a tweet.',
      'We are running a system at this scale with no telemetry. I do not know what to say to that.',
      'Nobody can tell me which component is slow, only that something is. That is not a debugging session, that is a séance.',
    ],
  },
  idle: {
    once: false, cooldown: 60,
    check: (s, r) => s.t - s.lastBuy.t > 55 && r.errRate > 0.06 && s.cash > 800,
    subjects: ['are we doing anything?', 're: the red graphs', 'checking in'],
    barbs: [
      'Everything is on fire, we have money in the bank, and nothing has been bought in a minute. Help me understand.',
      'The graphs are red and the budget is not spent. One of those should change.',
      'I am told we are "monitoring the situation". The situation is monitoring us back.',
    ],
  },
  overprovision: {
    once: false, cooldown: 90,
    check: (s, r) => r.spend > 2.2 * r.income && s.t > 70 && r.worstUtil < 0.4,
    subjects: ['the burn', 're: runway', 'a difficult conversation'],
    barbs: [
      'We are burning twice what we earn on capacity that is under half used. That is not resilience, that is inventory.',
      'I have compared our infrastructure bill to our revenue. I would like to un-compare them.',
      'Every idle node bills the same as a busy one. Ours are having a lovely quiet time.',
    ],
  },
  apibill: {
    once: false, cooldown: 90,
    check: (s, r) => s.infra.gpuNodes === 0 && r.costs.byKey.usage.total > 60,
    subjects: ['the model bill', 're: per-request pricing', 'this scales badly'],
    barbs: [
      'Our inference bill is now larger than everything else combined, and it grows exactly as fast as we succeed.',
      'We are renting every single answer. At this volume, has anyone priced owning the machines?',
      'The good news is usage is up. The bad news is the invoice is a linear function of the good news.',
    ],
  },
  queuenoidem: {
    once: true, cooldown: 999,
    check: s => s.slo.consistency === 'strong' && s.infra.streamParts > 0 && !s.infra.idempotent,
    subjects: ['duplicate charges', 're: the refunds', 'support queue is unhappy'],
    barbs: [
      'Customers are being charged twice. The queue retried, the consumer applied it again, and here we are.',
      'We acknowledged a write before it was durable and then applied it more than once. Both halves of that are fixable.',
      'At-least-once delivery met a not-quite-idempotent consumer. The finance team found out first.',
    ],
  },
  praise: {
    once: false, cooldown: 120,
    check: (s, r) => r.errRate < 0.005 && r.spend < 0.7 * r.income && s.t > 90 && r.servedRps > 20000,
    subjects: ['huh', 'credit where due', 're: the graphs (positive)'],
    barbs: [
      'Everything is green and we are making money. I have asked twice whether the dashboard is broken.',
      'Nobody has paged anyone in a while. It is unsettling. Keep doing it.',
      'The margin is real and the latency is flat. I am told this is what it is supposed to look like.',
    ],
  },
};
Content.MEMO_KEYS = Object.keys(Content.MEMOS);

if (typeof module !== 'undefined') module.exports = Content;
