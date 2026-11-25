// test/numbers.js — prints ONTOLOGY.md's §6 numbers table from artifacts.js:  node test/numbers.js
'use strict';
const { load } = require('./helpers/load');
const A = load().GameArtifacts;
const skip = ['TERRAIN', 'MOVEMENT_COST', 'MODULES', 'PERKS', 'ENEMY_KINDS', 'STAT_KEYS', 'STARTER_MODULE'];
console.log(Object.keys(A).filter(k => !skip.includes(k)).map(k => '| `' + k + '` | ' + JSON.stringify(A[k]) + ' |').join('\n'));
