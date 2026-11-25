'use strict';
const { newGame, snapshot, terrainSignature, load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// R-30: same seed + same commands = same state; the engine never touches the DOM, display artifacts or Math.random.
const fs = require('fs'), path = require('path');
const { ROOT, ENGINE_MODULES } = require('../helpers/load');
function play() {
    const { engine, state, g } = newGame(31);
    for (let i = 0; i < 40; i++) {
        const reach = [...engine.computeReachable().keys()];
        if (reach.length) { const [q, r] = reach[(i * 7) % reach.length].split(',').map(Number); engine.move(q, r); }
        for (const k of engine.attackable()) { const [q, r] = k.split(',').map(Number); engine.attack(q, r); }
        while (state.perkOffers.length) engine.pickPerk(0);
        engine.endTurn();
    }
    return snapshot(state);
}
check('two identical command runs end identical', play() === play());
// hex.js holds the client pixel helpers (they read GameDisplayArtifacts); the engine never calls them.
for (const f of ENGINE_MODULES.filter(f => f !== 'hex.js')) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    check(f + ' has no DOM or display references', !/\b(document|window|canvas|GameDisplayArtifacts|localStorage)\b/.test(src));
}
const eng = ['gameengine.js', 'ecology.js', 'worldgen.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
check('the only Math.random in the engine is the unseeded newGame seed draw', (eng.match(/Math\.random/g) || []).length === 1);
done();
