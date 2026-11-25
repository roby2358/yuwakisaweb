'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-29: an illegal command returns ok:false with no events and changes nothing.
const { engine, state, A, hero, village, enemy, hex } = arena();
const { snapshot } = require('../helpers/load');
enemy('tusker', 20, 20);
const s0 = snapshot(state);
const far = hex(25, 25);
const tries = {
    move: () => engine.move(far.q, far.r), attack: () => engine.attack(far.q, far.r), shoot: () => engine.shoot(0, far.q, far.r),
    shootEmpty: () => engine.shoot(1, far.q, far.r), activate: () => engine.activate(0), boost: () => engine.boost(99),
    deposit: () => engine.deposit(1, 1), craft: () => engine.craft('plating', 0), found: () => engine.found(),
    pickPerk: () => engine.pickPerk(0)
};
for (const [name, fn] of Object.entries(tries)) {
    const res = fn();
    check(name + ': ok is false with no events', res.ok === false && res.events.length === 0);
}
check('nothing changed', snapshot(state) === s0);
done();
