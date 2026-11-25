'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-24: enemy movement rules: speed-bounded, passable only, no mesa, no sites, raiders head for villages, beasts chase within AGGRO, guardians keep their leash.
const { engine, state, A, hero, village, ruin, enemy, terrain, hex, lair, phases, g } = arena({ w: 50, h: 40, hero: [45, 35] });
const T = A.TERRAIN;
// raider routing
const v = village(10, 10, { trust: 0 });
const r = enemy('scavenger', 25, 10, { speed: 2 });
const d0 = g.hexDist(r, v);
engine.endTurn();
check('a raider moves toward the nearest village by at most its speed', g.hexDist(r, v) < d0 && d0 - g.hexDist(r, v) <= 2);
for (let i = 0; i < 40; i++) engine.endTurn();
check('it stops adjacent to the village, never on its hex', g.hexDist(r, v) === 1 && !r.isAt(v.q, v.r));
// mesa and water
const w = enemy('jackal', 30, 20, { speed: 3 });
for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) terrain(30 + dc, 20 + dr, T.MESA);
terrain(30, 20, T.PLAINS);
let ok = true;
for (let i = 0; i < 15; i++) { engine.endTurn(); if (engine.terrainAt(w) === T.MESA || engine.terrainAt(w) === T.WATER) ok = false; }
check('a non-guardian never enters mesa or water', ok);
// beast chase
const hb = arena({ w: 50, h: 40, hero: [20, 20] });
const b = hb.enemy('jackal', 20 + A.AGGRO, 20, { speed: 1 });
const bd0 = hb.g.hexDist(b, hb.hero);
hb.engine.endTurn();
check('a beast inside AGGRO closes on the hero', hb.g.hexDist(b, hb.hero) === bd0 - 1);
// leash
const lz = arena({ w: 60, h: 40, hero: [55, 35] });
const far = lz.enemy('jackal', 20, 20, { speed: 3 });
let maxd = 0;
for (let i = 0; i < 60; i++) { lz.engine.endTurn(); maxd = Math.max(maxd, lz.g.hexDist(far, { q: far.aq, r: far.ar })); }
check('a wanderer stays within ROAM_LEASH of its anchor', maxd <= A.ROAM_LEASH);
// guardian leash
const gz = arena({ w: 60, h: 40, hero: [30, 22] });
const L = gz.lair(30, 20, 'den', 1);
const gd = gz.enemy('tusker', 30, 20, { home: L.id, guardian: true, speed: 2 });
let gmax = 0;
for (let i = 0; i < 20; i++) { gz.engine.endTurn(); gmax = Math.max(gmax, gz.g.hexDist(gd, L)); gz.state.hero.hp = 999; }
check('a guardian never strays beyond GUARD_LEASH from its lair', gmax <= A.GUARD_LEASH);
done();
