// test/creatures.js — every wildlife tier gets a melee creature and a ranged
// counterpart; ranged ones are marked by enemyIsRanged, reach 2/3/4 by tier
// band, and hold well under half the spawn weight at any peak tier. Every
// ranged def (wildlife and ENEMY_DEFS) carries a numeric rangedAttack.
'use strict';

const assert = require('assert');
const { load } = require('./load');

const { EnemyManager, enemyIsRanged, spawnTierWeights, NUM_CREATURE_TIERS, ENEMY_DEFS } = load(
    ['rando.js', 'colortheory.js', 'config.js', 'hex.js', 'enemies.js'],
    ['EnemyManager', 'enemyIsRanged', 'spawnTierWeights', 'NUM_CREATURE_TIERS', 'ENEMY_DEFS']);

const em = new EnemyManager();
em.generateCreatureTypes();
const defs = em.creatureDefs;

for (let i = 0; i < NUM_CREATURE_TIERS; i++) {
    const melee = defs['creature_' + i];
    const ranged = defs['ranged_creature_' + i];
    assert.ok(!enemyIsRanged(melee), 'melee tier ' + i + ' is not ranged');
    assert.ok(enemyIsRanged(ranged), 'ranged tier ' + i + ' is ranged');
    assert.strictEqual(ranged.range, [2, 3, 4][Math.floor(i / 4)], 'range by band, tier ' + i);
    assert.ok(ranged.attack < melee.attack || melee.attack <= 2, 'ranged hits softer, tier ' + i);
    assert.strictEqual(ranged.behavior, melee.behavior, 'shared behavior, tier ' + i);
}
// Every ranged def, wildlife or chaos, carries its shot strength explicitly.
for (const def of [...Object.values(defs), ...Object.values(ENEMY_DEFS)].filter(enemyIsRanged)) {
    assert.strictEqual(typeof def.rangedAttack, 'number', def.name + ' carries a numeric rangedAttack');
}
assert.strictEqual(new Set(Object.values(defs).map(d => d.name)).size, 2 * NUM_CREATURE_TIERS, 'unique names');

for (let peak = 0; peak < NUM_CREATURE_TIERS; peak++) {
    const weights = spawnTierWeights(defs, peak);
    const total = weights.reduce((s, w) => s + w.weight, 0);
    const rangedShare = weights.filter(w => enemyIsRanged(defs[w.item])).reduce((s, w) => s + w.weight, 0) / total;
    assert.ok(rangedShare > 0.15 && rangedShare < 0.3, 'ranged share ' + rangedShare.toFixed(2) + ' at peak ' + peak);
}

console.log('creatures ok');
