// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no rules behavior, no
// view/interaction state. What a server would own and ship to clients.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;            // reproducibility anchor
            this.hexes = null;        // Map<"q,r", hex>
            this.source = null;       // {q, r} — crates appear here
            this.target = null;       // {q, r} — crates are delivered here
            this.pieces = [];         // [Piece] crates and gremlins, in creation order
            this.things = [];         // [{kind, q, r, facing}] in placement order (= action order)
            this.hand = [];           // [ThingKind], length HAND_SIZE
            this.turn = 1;
            this.delivered = 0;
            this.lost = 0;            // crates sunk
            this.spawnTimer = 0;      // ticks since the source last spawned
            this.nextId = 1;
            this.gameWon = false;
            this.phase = 'player';    // 'player' | 'tick'
        }
    }

    return GameState;
})();
