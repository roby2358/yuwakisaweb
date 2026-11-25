'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-25: an active lair breeds one creature per LAIR_SPAWN_PERIOD, at most LAIR_CAP living offspring.
const { engine, state, A, hero, lair, enemy, phases } = arena({ w: 60, h: 40, hero: [55, 35] });
const L = lair(20, 20, 'den', 1);
enemy('jackal', 20, 20, { home: L.id, guardian: true, hp: 999 });
const kids = () => state.enemies.filter(c => c.home === L.id && !c.guardian);
phases(A.LAIR_SPAWN_PERIOD - 1);
check('nothing is bred before the period', kids().length === 0);
phases(1);
check('one offspring at the period, homed to the lair, next to it', kids().length === 1 && kids()[0].home === L.id && engine.state.enemies.length >= 2);
phases(A.LAIR_SPAWN_PERIOD * (A.LAIR_CAP + 3));
check('offspring never exceed LAIR_CAP', kids().length <= A.LAIR_CAP);
const camp = arena({ w: 60, h: 40, hero: [55, 35] });
const C = camp.lair(20, 20, 'camp', 1);
camp.enemy('scavenger', 20, 20, { home: C.id, guardian: true, hp: 999 });
camp.phases(A.LAIR_SPAWN_PERIOD);
check('a camp breeds raiders', camp.state.enemies.filter(c => !c.guardian && c.home === C.id).every(c => A.ENEMY_KINDS[c.kind].group === 'raider') && camp.state.enemies.length >= 2);
C.active = false; 
const n = camp.state.enemies.length;
camp.phases(A.LAIR_SPAWN_PERIOD - 1);
check('an inactive lair does not breed', camp.state.enemies.filter(c => !c.guardian && c.home === C.id).length <= n);
done();
