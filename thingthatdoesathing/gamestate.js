// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no rules behavior, no
// view/interaction state.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;            // reproducibility anchor
            this.size = null;         // key of GameArtifacts.MAP_SIZES
            this.hexes = null;        // Map<"q,r", hex>
            this.sources = [];        // [{q, r, colors}] — crates of these colors appear here
            this.targets = [];        // [{q, r, color, delivered}] — takes only `color` crates; one per open color
            this.pieces = [];         // [Piece] crates and gremlins, in creation order
            this.things = [];         // [{kind, color, q, r, facing}] in placement order (= action order)
            this.hand = [];           // [{kind, color}] cards, length HAND_SIZE
            this.unlocks = 0;         // how many UNLOCKS steps are open (a new game opens 1)
            this.turn = 1;
            this.delivered = 0;
            this.lost = 0;            // crates sunk
            this.exGremlins = 0;      // gremlins sunk, splatted, or killed on a target
            this.trapped = 0;         // gremlins a Trap caught
            this.idleTicks = 0;       // ticks in a row with no card used (place, discard)
            this.spawnTimer = 0;      // ticks since the last spawn chance (one every SPAWN_INTERVAL)
            this.nextId = 1;
            this.phase = 'player';    // 'player' | 'tick'
        }
    }

    return GameState;
})();
