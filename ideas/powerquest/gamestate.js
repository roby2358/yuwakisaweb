// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else (ONTOLOGY.md §1). No DOM, no rules,
// no view state (pan, hover, selection, overlays belong to GameUI). A server would own and
// ship exactly this.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;
            this.hexes = null;             // Map<"q,r", hex>
            this.hero = null;              // Hero
            this.villages = [];            // [Village]
            this.ruins = [];               // [Ruin]
            this.lairs = [];               // [Lair]
            this.enemies = [];             // [Creature]
            this.nemeses = [];             // ids of living enemies that shut the hero down
            this.explored = {};            // "q,r" -> 1, hexes whose terrain the hero has seen
            this.turn = 1;
            this.mp = 0;
            this.phase = 'hero';           // 'hero' | 'world'
            this.perkOffers = [];          // [[perkId]]; the first blocks other hero commands
            this.nextId = 1;
            this.log = [];                 // recent messages
            this.stats = { kills: 0, shutdowns: 0, founded: 0, crafted: 0, deposited: 0 };
        }
    }

    return GameState;
})();
