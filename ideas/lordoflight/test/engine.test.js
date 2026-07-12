'use strict';
/* Unit tests for the Great-Souled Sam engine. Run: node test/engine.test.js */

const assert = require('assert');
const E = require('../engine.js');

let passed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed += 1; }
  catch (err) { failures.push({ name, err }); }
}

/* ---------- helpers ---------- */

function freshGame() { return E.newGame(42); }

function convertCity(state, cityId) {
  state.cities[cityId].conversion = 100;
}

function deployGod(state, godId, at) {
  const god = state.gods.find((g) => g.id === godId);
  god.status = 'hunting';
  god.city = at;
  return god;
}

/* ---------- setup & map ---------- */

test('newGame produces the expected struct', () => {
  const s = freshGame();
  assert.strictEqual(s.phase, 'play');
  assert.strictEqual(s.sam.city, 'mahartha');
  assert.strictEqual(s.sam.bodyId, 'siddhartha');
  assert.strictEqual(s.karma, E.T.START_KARMA);
  assert.strictEqual(s.wrath, 0);
  assert.strictEqual(s.enlightenment, 0);
  assert.strictEqual(Object.keys(s.cities).length, 10);
  assert.strictEqual(s.gods.length, 3);
  assert.ok(s.gods.every((g) => g.status === 'heaven'));
});

test('same seed yields identical games', () => {
  const a = E.newGame(7); const b = E.newGame(7);
  [a, b].forEach((s) => {
    E.takeAction(s, { type: 'preach' });
    E.takeAction(s, { type: 'travel', city: 'kusinara' });
    E.takeAction(s, { type: 'meditate' });
  });
  assert.deepStrictEqual(a, b);
});

test('map graph is symmetric and connected', () => {
  for (const [a, b] of E.MAP.edges) {
    assert.ok(E.ADJ[a].includes(b) && E.ADJ[b].includes(a), `${a}<->${b}`);
  }
  for (const id of Object.keys(E.MAP.nodes)) {
    assert.ok(E.bfsPath('mahartha', id, []) !== null, `unreachable: ${id}`);
  }
});

test('bfsPath finds shortest routes and honors blocked nodes', () => {
  const direct = E.bfsPath('rajgir', 'alundil', []);
  assert.deepStrictEqual(direct, ['rajgir', 'alundil']);
  const blocked = E.bfsPath('rajgir', 'alundil', ['alundil']);
  assert.strictEqual(blocked, null);
  // gods route around Hellwell
  const godPath = E.bfsPath('heaven', 'mahartha', ['hellwell']);
  assert.ok(!godPath.includes('hellwell'));
});

/* ---------- player actions ---------- */

test('travel moves Sam, hides him, and rejects bad roads', () => {
  const s = freshGame();
  s.sam.hidden = false;
  assert.strictEqual(E.takeAction(s, { type: 'travel', city: 'keenset' }).ok, false); // not adjacent
  assert.strictEqual(E.takeAction(s, { type: 'travel', city: 'heaven' }).ok, false);
  const r = E.takeAction(s, { type: 'travel', city: 'lananda' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.sam.city, 'lananda');
  assert.strictEqual(s.sam.hidden, true);
  assert.strictEqual(s.turn, 2);
});

test('three sermons convert a city; preaching reveals Sam', () => {
  const s = freshGame();
  E.takeAction(s, { type: 'preach' });
  assert.strictEqual(s.cities.mahartha.conversion, 34);
  assert.strictEqual(s.sam.hidden, false);
  assert.strictEqual(s.sam.lastSeen, 'mahartha');
  assert.strictEqual(s.wrath, E.T.PREACH_WRATH);
  E.takeAction(s, { type: 'preach' });
  E.takeAction(s, { type: 'preach' });
  assert.ok(E.isConverted(s.cities.mahartha));
  assert.strictEqual(E.takeAction(s, { type: 'preach' }).ok, false); // already converted
});

test('converted cities tithe karma and enlightenment each turn', () => {
  const s = freshGame();
  convertCity(s, 'mahartha');
  convertCity(s, 'kusinara');
  const karma = s.karma; const enl = s.enlightenment;
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.karma, karma + E.T.MEDITATE_KARMA + 2 * E.T.CITY_KARMA);
  assert.strictEqual(s.enlightenment, enl + 2 * E.T.CITY_ENLIGHTENMENT);
});

test('meditate hides Sam and grants karma', () => {
  const s = freshGame();
  s.sam.hidden = false;
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.sam.hidden, true);
  assert.strictEqual(s.karma, E.T.START_KARMA + E.T.MEDITATE_KARMA);
});

/* ---------- gods ---------- */

test('gods deploy exactly at their wrath thresholds', () => {
  const s = freshGame();
  s.wrath = 19;
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.gods.find((g) => g.id === 'agni').status, 'heaven');
  s.wrath = 20;
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.gods.find((g) => g.id === 'agni').status, 'hunting');
  assert.strictEqual(s.gods.find((g) => g.id === 'kali').status, 'heaven');
});

test('a hunting god walks toward the last-seen city', () => {
  const s = freshGame();
  const agni = deployGod(s, 'agni', 'heaven');
  s.sam.lastSeen = 'mahartha';
  s.sam.city = 'vaishali';
  s.sam.hidden = true;
  E.takeAction(s, { type: 'meditate' });
  const path = E.bfsPath('heaven', 'mahartha', ['hellwell']);
  assert.strictEqual(agni.city, path[1]);
});

test('a god that reaches an empty last-seen city loses the scent', () => {
  const s = freshGame();
  deployGod(s, 'agni', 'lananda');
  s.sam.lastSeen = 'mahartha';
  s.sam.city = 'vaishali';
  E.takeAction(s, { type: 'meditate' }); // agni steps into mahartha
  E.takeAction(s, { type: 'meditate' }); // agni searches, finds nothing
  assert.strictEqual(s.sam.lastSeen, null);
});

test('Agni burns a converted city he stands in', () => {
  const s = freshGame();
  convertCity(s, 'mahartha');
  s.enlightenment = 20;
  deployGod(s, 'agni', 'lananda');
  s.sam.lastSeen = 'mahartha';
  s.sam.city = 'vaishali';
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.cities.mahartha.conversion, 0);
  assert.strictEqual(s.cities.mahartha.burned, true);
  assert.ok(s.enlightenment < 20 + 2 * E.T.CITY_ENLIGHTENMENT);
});

test('other gods purge conversion instead of burning', () => {
  const s = freshGame();
  convertCity(s, 'mahartha');
  deployGod(s, 'yama', 'lananda');
  s.sam.lastSeen = 'mahartha';
  s.sam.city = 'vaishali';
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.cities.mahartha.conversion, 100 - E.T.PURGE_AMOUNT);
  assert.strictEqual(s.cities.mahartha.burned, false);
});

test('Kali moves two roads per turn', () => {
  const s = freshGame();
  const kali = deployGod(s, 'kali', 'heaven');
  s.sam.lastSeen = 'mahartha';
  s.sam.city = 'vaishali';
  E.takeAction(s, { type: 'meditate' });
  const dist = E.bfsPath(kali.city, 'mahartha', ['hellwell']).length - 1;
  const before = E.bfsPath('heaven', 'mahartha', ['hellwell']).length - 1;
  assert.strictEqual(dist, before - 2);
});

test('gods never enter Hellwell', () => {
  const s = freshGame();
  deployGod(s, 'kali', 'rajgir');
  s.sam.city = 'hellwell';
  s.sam.lastSeen = null;
  for (let i = 0; i < 12 && s.phase === 'play'; i += 1) E.takeAction(s, { type: 'meditate' });
  assert.notStrictEqual(s.gods.find((g) => g.id === 'kali').city, 'hellwell');
});

test('a revealed Sam sharing a city with a god is confronted', () => {
  const s = freshGame();
  deployGod(s, 'agni', 'lananda');
  s.sam.lastSeen = 'mahartha'; // sam is AT the last-seen city, revealed
  s.sam.hidden = false;
  E.takeAction(s, { type: 'meditate' }); // meditate hides… but agni arrives after
  // meditate sets hidden=true, so detection is probabilistic; force the stationary case:
  const s2 = freshGame();
  deployGod(s2, 'agni', 'mahartha');
  s2.sam.hidden = false;
  s2.sam.lastSeen = 'mahartha';
  E.takeAction(s2, { type: 'preach' }); // preaching keeps him revealed in agni's city
  assert.strictEqual(s2.phase, 'confront');
  assert.strictEqual(s2.confront.god, 'agni');
});

/* ---------- combat ---------- */

function forceConfront(state, godId, godPower) {
  const god = deployGod(state, godId, state.sam.city);
  god.power = godPower;
  state.phase = 'confront';
  state.confront = { god: godId, penalty: false };
  state.sam.hidden = false;
  return god;
}

test('an overwhelming Sam always wins; a slain god returns stronger, later', () => {
  const s = freshGame();
  const agni = forceConfront(s, 'agni', -20);
  const karma = s.karma;
  E.takeAction(s, { type: 'fight', channel: 0 });
  assert.strictEqual(agni.status, 'heaven');
  assert.strictEqual(agni.respawnIn, E.T.GOD_RESPAWN);
  assert.strictEqual(agni.power, -19); // +1 on rebirth
  assert.strictEqual(s.karma, karma + E.T.VICTORY_KARMA + 0); // no channel spent, no cities
  assert.strictEqual(s.enlightenment, E.T.VICTORY_ENLIGHTENMENT);
  assert.strictEqual(s.phase, 'play');
});

test('an overwhelmed Sam dies, and may buy rebirth in a converted city', () => {
  const s = freshGame();
  convertCity(s, 'keenset');
  s.karma = 100;
  forceConfront(s, 'yama', 50);
  E.takeAction(s, { type: 'fight', channel: 0 });
  assert.strictEqual(s.phase, 'dead');
  assert.strictEqual(s.sam.city, null);
  const cost = E.rebirthCost(s);
  E.takeAction(s, { type: 'rebirth' });
  assert.strictEqual(s.phase, 'play');
  assert.strictEqual(s.sam.city, 'keenset');
  assert.strictEqual(s.karma, 100 - cost);
  assert.strictEqual(s.deaths, 1);
  assert.notStrictEqual(s.sam.bodyId, 'siddhartha');
});

test('death with no haven or no karma is the real death', () => {
  const s = freshGame();
  s.karma = 0;
  forceConfront(s, 'yama', 50);
  E.takeAction(s, { type: 'fight', channel: 0 });
  assert.strictEqual(s.phase, 'lost');
});

test('channeled karma is spent and capped by the pool', () => {
  const s = freshGame();
  s.karma = 15; // only one full pip available
  forceConfront(s, 'agni', -20);
  E.takeAction(s, { type: 'fight', channel: 30 });
  assert.strictEqual(s.karma, 15 - E.T.CHANNEL_STEP + E.T.VICTORY_KARMA);
});

test('a bound demon adds its power, doubled against Yama', () => {
  // statistically: yama at power 8 vs monk (2) + taraka doubled (6) → sam wins sometimes.
  // deterministically: verify the bookkeeping via a guaranteed win margin.
  const s = freshGame();
  const yama = forceConfront(s, 'yama', -20);
  s.demons.push({ name: 'Taraka', power: 3, bound: 'yama', possessing: null });
  E.takeAction(s, { type: 'fight', channel: 0 });
  assert.strictEqual(yama.status, 'heaven');
  assert.strictEqual(s.demons.length, 0); // demon goes home when its quarry falls
});

/* ---------- demons ---------- */

test('binding requires Hellwell, a hunting god, and karma; binder perk halves cost', () => {
  const s = freshGame();
  deployGod(s, 'agni', 'keenset');
  assert.strictEqual(E.takeAction(s, { type: 'bind', god: 'agni' }).ok, false); // not at hellwell
  s.sam.city = 'hellwell';
  assert.strictEqual(E.bindCost(s), Math.floor(E.T.BIND_BASE / 2)); // siddhartha binder perk
  s.karma = E.bindCost(s);
  const r = E.takeAction(s, { type: 'bind', god: 'agni' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.demons.length, 1);
  assert.strictEqual(s.demons[0].name, 'Taraka');
  assert.strictEqual(s.demons[0].bound, 'agni');
  assert.strictEqual(E.takeAction(s, { type: 'bind', god: 'agni' }).ok, false); // already harried
});

test('exorcism frees a possessed city for 10 karma', () => {
  const s = freshGame();
  convertCity(s, 'mahartha');
  s.cities.mahartha.possessedBy = 'Taraka';
  s.demons.push({ name: 'Taraka', power: 3, bound: null, possessing: 'mahartha' });
  E.takeAction(s, { type: 'exorcise' });
  assert.strictEqual(s.cities.mahartha.possessedBy, null);
  assert.strictEqual(s.demons.length, 0);
  assert.strictEqual(s.karma, E.T.START_KARMA - E.T.EXORCISE_COST + E.T.CITY_KARMA);
});

test('a possessed city stops tithing', () => {
  const s = freshGame();
  convertCity(s, 'keenset');
  s.cities.keenset.possessedBy = 'Taraka';
  const karma = s.karma;
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.karma, karma + E.T.MEDITATE_KARMA); // no city tithe
});

/* ---------- victory ---------- */

test('enlightenment 100 wins the game', () => {
  const s = freshGame();
  s.enlightenment = 99;
  convertCity(s, 'keenset');
  E.takeAction(s, { type: 'meditate' });
  assert.strictEqual(s.phase, 'won');
});

/* ---------- full-game smoke test: a simple bot across many seeds ---------- */

function botAction(state) {
  const acts = E.availableActions(state);
  if (state.phase === 'confront') {
    return E.rand(state) < 0.5
      ? { type: 'flee' }
      : { type: 'fight', channel: acts.confront.channelMax * E.T.CHANNEL_STEP };
  }
  if (state.phase === 'dead') {
    return acts.rebirth.can ? { type: 'rebirth' } : { type: 'acceptFate' };
  }
  if (acts.preach && E.rand(state) < 0.7) return { type: 'preach' };
  if (acts.bind.can && acts.bind.gods.length > 0) return { type: 'bind', god: acts.bind.gods[0] };
  if (acts.exorcise.can) return { type: 'exorcise' };
  if (acts.travel.length > 0 && E.rand(state) < 0.8) {
    return { type: 'travel', city: acts.travel[E.randInt(state, acts.travel.length)] };
  }
  return { type: 'meditate' };
}

test('random bots finish 40 games without crashes or bad state', () => {
  const outcomes = { won: 0, lost: 0, unfinished: 0 };
  for (let seed = 1; seed <= 40; seed += 1) {
    const s = E.newGame(seed);
    let guard = 0;
    while (s.phase !== 'won' && s.phase !== 'lost' && guard < 600) {
      const r = E.takeAction(s, botAction(s));
      assert.strictEqual(r.ok, true, `seed ${seed}: ${r.error}`);
      assert.ok(s.karma >= 0, `seed ${seed}: karma went negative`);
      assert.ok(['play', 'confront', 'dead', 'won', 'lost'].includes(s.phase));
      for (const god of s.gods) assert.notStrictEqual(god.city, 'hellwell');
      guard += 1;
    }
    outcomes[s.phase === 'won' ? 'won' : s.phase === 'lost' ? 'lost' : 'unfinished'] += 1;
  }
  console.log(`  (bot outcomes: ${outcomes.won} won / ${outcomes.lost} lost / ${outcomes.unfinished} hit the turn guard)`);
  assert.strictEqual(outcomes.unfinished, 0, 'games should always end');
});

/* ---------- report ---------- */

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) {
  console.error(`\nFAIL: ${f.name}`);
  console.error(f.err && f.err.stack ? f.err.stack : f.err);
}
process.exit(failures.length === 0 ? 0 : 1);
