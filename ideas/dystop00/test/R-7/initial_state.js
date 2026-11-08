// R-7: after newGame: one Rig per RIG_NAMES entry, in order, all carried, labeled by first
// letter; BASE_SWEEPERS Sweepers, each adjacent to a station; nothing awake; turn 1,
// mp = PLAYER_MP, phase 'player', outcome null; @ is a Piece labeled '@'.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');
for (const seed of SEEDS.slice(0, 4)) {
    const { g, state } = newGame(seed);
    const A = g.GameArtifacts;
    check(`seed ${seed}: roster`, state.rigs.length === A.RIG_NAMES.length &&
        state.rigs.every((r, i) => r instanceof g.Rig && r.name === A.RIG_NAMES[i] && r.label === r.name[0] && r.status === 'carried' && r.q === null));
    check(`seed ${seed}: BASE_SWEEPERS on the street`, state.sweepers.length === A.BASE_SWEEPERS);
    check(`seed ${seed}: each next to a station`, state.sweepers.every(sw =>
        state.stations.some(st => new g.Hex(st.q, st.r).distance(sw) === 1)));
    check(`seed ${seed}: nothing awake`, [...state.hexes.values()].every(h => !h.awake));
    check(`seed ${seed}: turn/mp/phase/outcome`, state.turn === 1 && state.mp === A.PLAYER_MP && state.phase === 'player' && state.outcome === null);
    check(`seed ${seed}: @`, state.player instanceof g.Piece && state.player.label === '@');
}
done();
