// CHARTER — winnability test. Near-miss architecture demands the game be
// winnable by competent play and lost gracefully otherwise. A fixed policy
// bot plays 40 seeded regencies; we assert a healthy win band and that wins
// land late (the breathless final stretch, not an early stroll).
const assert = require('assert');
const D = require('../js/data.js');
const E = require('../js/engine.js');

const COALITION = ['temple', 'garrison', 'commons'];
const BUILD = [
  ['levy', 'trade'], ['levy', 'river'],
  ['subsidy', 'grain'], ['mandate', 'festival'], ['subsidy', 'arms'], ['mandate', 'arms'],
];

function coalitionValue(effects) {
  return effects.reduce(function (sum, fx) {
    if (fx.standing !== undefined && COALITION.indexOf(fx.standing) >= 0) return sum + fx.amount;
    if (fx.legitimacy !== undefined) return sum + fx.legitimacy;
    return sum;
  }, 0);
}

function policy(s) {
  if (s.disputes.length > 0) {
    const d = s.disputes[0];
    const edict = s.edicts.find(function (e) { return e.id === d.edictId; });
    if (s.ap >= 2 && !edict.amended) return { type: 'amend', edictId: d.edictId };
    if (s.ap >= 1) return { type: 'court', uid: d.uid, ruling: 'uphold' };
  }
  if (s.petitions.length > 0 && s.ap >= 1) {
    const p = s.petitions[0];
    const def = E.petitionDef(p);
    let best = 0, bestVal = -Infinity;
    def.options.forEach(function (opt, i) {
      let v = coalitionValue(E.optionEffects(p, opt));
      const gold = opt.effects.reduce(function (g, fx) { return g + (fx.treasury || 0); }, 0);
      if (s.treasury + gold < 5) v -= 10;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return { type: 'respond', uid: p.uid, optionIndex: best };
  }
  if (s.ap >= 2) {
    for (let i = 0; i < BUILD.length; i++) {
      const t = BUILD[i][0], dom = BUILD[i][1];
      if (!s.edicts.some(function (e) { return e.template === t && e.domain === dom; })) {
        return { type: 'draft', template: t, domain: dom };
      }
    }
  }
  const count = D.FACTION_IDS.filter(function (f) { return s.factions[f].endorsed; }).length;
  if (s.ap >= 2 && count >= 3 && s.legitimacy >= 50 && E.contradictions(s).length === 0) {
    return { type: 'ratify' };
  }
  if (s.ap >= 2 && s.turn >= 8) {
    for (let i = 0; i < COALITION.length; i++) {
      const f = COALITION[i];
      if (!s.factions[f].endorsed && s.factions[f].standing >= 18 && E.priceMet(s, f)) {
        return { type: 'endorse', faction: f };
      }
    }
    const lagging = COALITION.some(function (f) { return !s.factions[f].endorsed && s.factions[f].standing < 18; });
    if (lagging && s.festivalCooldown === 0 && s.treasury > 20) return { type: 'festival' };
  }
  return { type: 'endSeason' };
}

const N = 40;
let wins = 0;
const winTurns = [];
for (let seed = 1; seed <= N; seed++) {
  const s = E.newGame(seed * 7919 + 3);
  let guard = 0;
  while (s.phase === 'playing' && guard < 500) {
    guard += 1;
    E.act(s, policy(s));
  }
  assert.ok(s.phase !== 'playing', 'seed ' + seed + ' must reach an ending');
  if (s.phase === 'won') { wins += 1; winTurns.push(s.turn); }
}

assert.ok(wins >= 8, 'a competent policy should ratify sometimes; won ' + wins + '/' + N);
assert.ok(wins <= 32, 'ratification should not be routine; won ' + wins + '/' + N);
winTurns.forEach(function (t) {
  assert.ok(t >= 12, 'wins should come from the late game, not an early stroll (won at season ' + t + ')');
});

console.log('  ok — winnability: ' + wins + '/' + N + ' regencies ratified, at seasons ' + winTurns.join(', '));
console.log('\n1 test passed.');
