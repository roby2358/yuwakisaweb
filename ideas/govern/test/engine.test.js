// CHARTER — engine unit tests. Run: node test/engine.test.js
const assert = require('assert');
const D = require('../js/data.js');
const E = require('../js/engine.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok — ' + name);
}

// Drain the season's spawned petitions/disputes cheaply so tests can steer.
function endSeason(state) {
  const r = E.act(state, { type: 'endSeason' });
  assert.strictEqual(r.ok, true, 'endSeason should succeed');
}

test('newGame is deterministic for a given seed', function () {
  const a = E.newGame(42);
  const b = E.newGame(42);
  assert.deepStrictEqual(a.log.map(function (l) { return l.title; }),
    b.log.map(function (l) { return l.title; }));
  assert.strictEqual(a.rngState, b.rngState);
});

test('a new regency starts with 3 AP, the starting purse, and a petition or two', function () {
  const s = E.newGame(7);
  assert.strictEqual(s.ap, D.ECON.apPerSeason);
  assert.strictEqual(s.turn, 1);
  assert.ok(s.petitions.length >= 1 && s.petitions.length <= 2);
  assert.strictEqual(s.phase, 'playing');
});

test('drafting an edict costs 2 AP and enters the book', function () {
  const s = E.newGame(7);
  const r = E.act(s, { type: 'draft', template: 'levy', domain: 'grain' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.ap, 1);
  assert.strictEqual(s.edicts.length, 1);
  assert.strictEqual(s.edicts[0].template, 'levy');
});

test('duplicate edicts are refused without spending AP', function () {
  const s = E.newGame(7);
  E.act(s, { type: 'draft', template: 'levy', domain: 'grain' });
  endSeason(s);
  const before = s.ap;
  const r = E.act(s, { type: 'draft', template: 'levy', domain: 'grain' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(s.ap, before);
});

test('insufficient AP fails fast', function () {
  const s = E.newGame(7);
  s.ap = 1;
  const r = E.act(s, { type: 'draft', template: 'ban', domain: 'ale' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(s.edicts.length, 0);
});

test('contentment: a grain levy pulls the Commons down; a subsidy pulls them up', function () {
  const s = E.newGame(7);
  E.act(s, { type: 'draft', template: 'levy', domain: 'grain' });
  assert.strictEqual(E.contentment(s, 'commons'), D.CONTRIB.levyLiked);
  assert.strictEqual(E.contentment(s, 'garrison'), 0);
});

test('standings drift toward the law book, capped at 5 per season', function () {
  const s = E.newGame(7);
  s.factions.commons.standing = 0;
  s.edicts.push({ id: 99, template: 'levy', domain: 'grain', amended: false, turnEnacted: 1 });
  s.upcoming = []; // silence next season's events so only drift moves the needle
  const before = s.factions.commons.standing;
  endSeason(s);
  assert.ok(s.factions.commons.standing < before, 'commons should sour toward the book');
  assert.ok(before - s.factions.commons.standing <= 5, 'drift is capped at 5');
});

test('contradictions are detected and block ratification', function () {
  const s = E.newGame(7);
  s.edicts.push({ id: 1, template: 'levy', domain: 'ale', amended: false, turnEnacted: 1 });
  s.edicts.push({ id: 2, template: 'subsidy', domain: 'ale', amended: false, turnEnacted: 1 });
  s.edicts.push({ id: 3, template: 'ban', domain: 'festival', amended: false, turnEnacted: 1 });
  s.edicts.push({ id: 4, template: 'mandate', domain: 'festival', amended: false, turnEnacted: 1 });
  const found = E.contradictions(s);
  assert.strictEqual(found.length, 2);
  D.FACTION_IDS.forEach(function (f) { s.factions[f].endorsed = true; });
  s.legitimacy = 90;
  const r = E.act(s, { type: 'ratify' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.msg.indexOf('disagrees with itself') >= 0);
});

test('press level derives from the law book', function () {
  const s = E.newGame(7);
  assert.strictEqual(E.pressLevel(s), 1);
  s.edicts.push({ id: 1, template: 'ban', domain: 'press', amended: false, turnEnacted: 1 });
  assert.strictEqual(E.pressLevel(s), 0);
  s.edicts = [{ id: 2, template: 'mandate', domain: 'press', amended: false, turnEnacted: 1 }];
  assert.strictEqual(E.pressLevel(s), 2);
});

test('responding to a petition spends 1 AP and resolves it', function () {
  const s = E.newGame(7);
  const p = s.petitions[0];
  const r = E.act(s, { type: 'respond', uid: p.uid, optionIndex: 0 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.ap, 2);
  assert.ok(!s.petitions.some(function (q) { return q.uid === p.uid; }));
});

test('an ignored petition festers after two seasons and is logged as such', function () {
  const s = E.newGame(7);
  const uid = s.petitions[0].uid;
  endSeason(s);
  // respond to nothing; the original petition ages to 2 at next season end
  endSeason(s);
  assert.ok(!s.petitions.some(function (q) { return q.uid === uid; }), 'festered petition should be gone');
  assert.ok(s.log.some(function (l) { return l.title.indexOf('Festered') >= 0; }));
  assert.ok(s.stats.petitionsFestered >= 1);
});

test('precedent: refusing a cited petition costs double', function () {
  const s = E.newGame(7);
  s.precedents['tax-relief'] = 1;
  const petition = { uid: 999, defId: 'dyers', age: 0, cites: true };
  const def = D.PETITIONS.find(function (p) { return p.id === 'dyers'; });
  const refusal = def.options[1];
  const doubled = E.optionEffects(petition, refusal);
  assert.strictEqual(doubled[0].amount, refusal.effects[0].amount * 2);
  const unremarkable = E.optionEffects({ uid: 1, defId: 'dyers', age: 0, cites: false }, refusal);
  assert.strictEqual(unremarkable[0].amount, refusal.effects[0].amount);
});

test('interpretation disputes auto-uphold at season end if unattended', function () {
  const s = E.newGame(7);
  E.act(s, { type: 'draft', template: 'levy', domain: 'river' });
  s.disputes.push({ uid: 50, edictId: s.edicts[0].id });
  const commonsBefore = s.factions.commons.standing;
  endSeason(s);
  assert.strictEqual(s.disputes.filter(function (d) { return d.uid === 50; }).length, 0);
  assert.ok(s.log.some(function (l) { return l.title.indexOf('The Ruling Stands') >= 0; }));
  assert.ok(s.factions.commons.standing < commonsBefore, 'the ferryman ruling should anger the commons');
});

test('court: overrule costs legitimacy, uphold earns it', function () {
  const a = E.newGame(7);
  E.act(a, { type: 'draft', template: 'levy', domain: 'river' });
  a.disputes.push({ uid: 51, edictId: a.edicts[0].id });
  const legitBefore = a.legitimacy;
  E.act(a, { type: 'court', uid: 51, ruling: 'overrule' });
  assert.strictEqual(a.legitimacy, legitBefore - 4);
  assert.strictEqual(a.stats.overrules, 1);

  const b = E.newGame(7);
  E.act(b, { type: 'draft', template: 'levy', domain: 'river' });
  b.disputes.push({ uid: 52, edictId: b.edicts[0].id });
  const before = b.legitimacy;
  E.act(b, { type: 'court', uid: 52, ruling: 'uphold' });
  assert.strictEqual(b.legitimacy, before + 2);
  assert.strictEqual(b.stats.upholds, 1);
});

test('amending an edict resolves its dispute and halves its probe weight', function () {
  const s = E.newGame(7);
  E.act(s, { type: 'draft', template: 'ban', domain: 'ale' });
  s.disputes.push({ uid: 53, edictId: s.edicts[0].id });
  s.ap = 3; // drafting spent 2; refill for the amendment
  const r = E.act(s, { type: 'amend', edictId: s.edicts[0].id });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.edicts[0].amended, true);
  assert.strictEqual(s.disputes.length, 0);
  const again = E.act(s, { type: 'amend', edictId: s.edicts[0].id });
  assert.strictEqual(again.ok, false);
});

test('repeal removes the edict and its beneficiaries take it hardest', function () {
  const s = E.newGame(7);
  E.act(s, { type: 'draft', template: 'subsidy', domain: 'grain' });
  const commonsAfterEnact = s.factions.commons.standing;
  E.act(s, { type: 'repeal', edictId: s.edicts[0].id });
  assert.strictEqual(s.edicts.length, 0);
  // shock is -(contrib/2) - 4 = -8 for the commons (contrib +8)
  assert.strictEqual(s.factions.commons.standing, commonsAfterEnact - 8);
});

test('endorsement demands warmth and the price met, then marks the seal', function () {
  const s = E.newGame(7);
  const cold = E.act(s, { type: 'endorse', faction: 'garrison' });
  assert.strictEqual(cold.ok, false);

  s.factions.garrison.standing = 30;
  const unpriced = E.act(s, { type: 'endorse', faction: 'garrison' });
  assert.strictEqual(unpriced.ok, false);
  assert.ok(unpriced.msg.indexOf('price') >= 0);

  E.act(s, { type: 'draft', template: 'subsidy', domain: 'arms' });
  endSeason(s);
  s.factions.garrison.standing = 30;
  const sealed = E.act(s, { type: 'endorse', faction: 'garrison' });
  assert.strictEqual(sealed.ok, true);
  assert.strictEqual(s.factions.garrison.endorsed, true);
});

test('an endorsement is withdrawn when its price is broken', function () {
  const s = E.newGame(7);
  E.act(s, { type: 'draft', template: 'subsidy', domain: 'arms' });
  s.ap = 3; // drafting spent 2; refill for the endorsement
  s.factions.garrison.standing = 40;
  E.act(s, { type: 'endorse', faction: 'garrison' });
  assert.strictEqual(s.factions.garrison.endorsed, true);
  E.act(s, { type: 'repeal', edictId: s.edicts[0].id });
  s.factions.garrison.standing = 40; // keep them warm; only the price is broken
  endSeason(s);
  assert.strictEqual(s.factions.garrison.endorsed, false);
  assert.ok(s.log.some(function (l) { return l.title.indexOf('Endorsement Withdrawn') >= 0; }));
});

test('ratification wins the game when seals, legitimacy, and coherence align', function () {
  const s = E.newGame(7);
  ['guilds', 'temple', 'commons'].forEach(function (f) { s.factions[f].endorsed = true; });
  s.legitimacy = 60;
  const r = E.act(s, { type: 'ratify' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.phase, 'won');
  assert.ok(s.score > 0);
  assert.strictEqual(s.epithet.title, 'the Lawgiver');
});

test('legitimacy at zero deposes the Regent', function () {
  const s = E.newGame(7);
  s.legitimacy = 3;
  E.act(s, { type: 'court', uid: -1, ruling: 'overrule' }); // no dispute: fails, no cost
  assert.strictEqual(s.phase, 'playing');
  E.act(s, { type: 'draft', template: 'levy', domain: 'river' });
  s.disputes.push({ uid: 60, edictId: s.edicts[0].id });
  E.act(s, { type: 'court', uid: 60, ruling: 'overrule' });
  assert.strictEqual(s.phase, 'lost');
  assert.strictEqual(s.endReason, 'deposed');
});

test('a hostile garrison for three seasons attempts a coup', function () {
  const s = E.newGame(7);
  // pin them hostile past drift by making the book hateful and the standing low
  s.factions.garrison.standing = -100;
  s.legitimacy = 40;
  let seasons = 0;
  while (s.phase === 'playing' && seasons < 4) {
    s.factions.garrison.standing = -100;
    endSeason(s);
    seasons += 1;
  }
  assert.strictEqual(s.phase, 'lost');
  assert.strictEqual(s.endReason, 'coup');
});

test('festival: full price full cheer, and diminishing on repeat', function () {
  const s = E.newGame(7);
  const commons = s.factions.commons.standing;
  E.act(s, { type: 'festival' });
  assert.strictEqual(s.factions.commons.standing, commons + 8);
  assert.strictEqual(s.festivalCooldown, D.ECON.festivalCooldown);
  s.ap = 3;
  const c2 = s.factions.commons.standing;
  E.act(s, { type: 'festival' });
  assert.strictEqual(s.factions.commons.standing, c2 + 4, 'a stale festival cheers half as much');
});

test('every template:domain pair yields an interpretation scenario', function () {
  Object.keys(D.TEMPLATES).forEach(function (t) {
    const targets = t === 'right' ? D.FACTION_IDS : D.DOMAINS;
    targets.forEach(function (d) {
      const sc = D.interpretationFor(t, d);
      assert.ok(sc.title.length > 0, t + ':' + d + ' has a title');
      assert.ok(sc.body('the Test Edict', 'the Test Domain').length > 20, t + ':' + d + ' has a body');
      assert.ok(Array.isArray(sc.uphold) && Array.isArray(sc.overrule) && Array.isArray(sc.amend));
    });
  });
});

test('the regency expires at season 24 with a score and an epithet', function () {
  const s = E.newGame(7);
  let guard = 0;
  while (s.phase === 'playing' && guard < 30) {
    // keep everyone placid so we reach the end of the calendar
    D.FACTION_IDS.forEach(function (f) { s.factions[f].standing = 20; });
    s.legitimacy = Math.max(s.legitimacy, 50);
    endSeason(s);
    guard += 1;
  }
  assert.strictEqual(s.endReason, 'expired');
  assert.ok(typeof s.score === 'number');
  assert.ok(s.epithet && s.epithet.title.length > 0);
});

test('random-agent regencies never crash and always end (10 seeds)', function () {
  for (let seed = 1; seed <= 10; seed++) {
    const s = E.newGame(seed * 1000 + 17);
    let rng = seed;
    const roll = function (n) { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng % n; };
    let guard = 0;
    while (s.phase === 'playing' && guard < 400) {
      guard += 1;
      const dice = roll(10);
      if (dice < 2 && s.petitions.length > 0) {
        const p = s.petitions[roll(s.petitions.length)];
        E.act(s, { type: 'respond', uid: p.uid, optionIndex: roll(E.petitionDef(p).options.length) });
      } else if (dice < 3 && s.disputes.length > 0) {
        const d = s.disputes[roll(s.disputes.length)];
        E.act(s, { type: 'court', uid: d.uid, ruling: roll(2) === 0 ? 'uphold' : 'overrule' });
      } else if (dice < 5) {
        const templates = Object.keys(D.TEMPLATES);
        const t = templates[roll(templates.length)];
        const targets = t === 'right' ? D.FACTION_IDS : D.DOMAINS;
        E.act(s, { type: 'draft', template: t, domain: targets[roll(targets.length)] });
      } else if (dice < 6 && s.edicts.length > 0) {
        E.act(s, { type: 'repeal', edictId: s.edicts[roll(s.edicts.length)].id });
      } else if (dice < 7) {
        E.act(s, { type: 'festival' });
      } else if (dice < 8) {
        E.act(s, { type: 'audience', faction: D.FACTION_IDS[roll(4)] });
      } else {
        E.act(s, { type: 'endSeason' });
      }
    }
    assert.ok(s.phase !== 'playing', 'seed ' + seed + ' should reach an ending');
    assert.ok(s.log.length > 10, 'seed ' + seed + ' should have a chronicle');
  }
});

console.log('\n' + passed + ' tests passed.');
