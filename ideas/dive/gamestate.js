// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no
// rules behavior, no view/interaction state (pan, hover, selection, overlays all
// belong to GameUI). This is exactly what a server would own and ship to clients:
// keep it a plain data bag so it stays trivially snapshot-able. (`seen` is a Set —
// serialize as an array when the day comes; no migrations while prototyping.)
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;             // reproducibility anchor for the whole game
            this.hexes = null;         // Map<"q,r", hex> — hex carries { node } too
            this.base = null;          // { q, r } Berth Station
            this.sub = null;           // { q, r }
            this.diver = null;         // { q, r } — meaningful only while diverOut
            this.diverOut = false;     // which counter is active
            this.subMoved = false;     // engine wake this turn (leviathan sense gate)

            this.o2 = 0;               // diver air remaining, in turns-of-drain
            this.hull = 0;             // sub integrity
            this.credits = 0;
            this.bag = {};             // { material: count } carried by the diver
            this.hold = {};            // { material: count } in the sub
            this.upgrades = { o2: 0, fins: 0, bag: 0, hold: 0, hull: 0, sonar: 0 };

            this.eels = [];            // [{ q, r, speed }]
            this.eelColors = [];       // ['#rrggbb'] parallel to eels (piece identity)
            this.leviathans = [];      // [{ q, r, name }]
            this.caches = [];          // [{ q, r, contents: { material: count } }]
            this.seen = new Set();     // hex keys whose node contents are known

            this.turn = 1;
            this.mp = 0;
            this.gameWon = false;
            this.phase = 'player';     // 'player' | 'enemy' — whose turn is resolving
        }
    }

    return GameState;
})();
