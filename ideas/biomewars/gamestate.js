// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no
// rules behavior, no view/interaction state (pan, hover, selection, overlays all
// belong to GameUI). This is exactly what a server would own and ship to clients:
// keep it a plain data bag so it stays trivially snapshot-able.
//
// toJSON/loadJSON are the (de)serialization seam: the only non-plain field is the
// hexes Map, which round-trips through an array. GameUI persists the JSON to
// localStorage each turn so a world survives the browser closing.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;                 // reproducibility anchor for the whole world
            this.hexes = null;             // Map<"q,r", {q,r,col,row,elevation,isEdge,biome,vitality}>
            this.hero = null;              // { q, r, hp, essence, talents: {key: level} }
            this.creatures = [];           // [{ biome, q, r, hp }]
            this.anchors = [];             // [{ kind:'settlement'|'blight', biome, name, q, r, prosperity, hp, besieged }]
            this.names = null;             // { biomes: {biome: name|null}, creatures: {biome: name} } — generated per world
            this.turn = 1;
            this.mp = GameArtifacts.RULES.HERO_MP;
            this.phase = 'player';         // 'player' | 'world' — whose half of the turn is resolving
            this.gameOver = false;         // true once the last settlement is gone
            this.eruptions = 0;            // how many times the planet has convulsed
            this.goldenAge = 0;            // countdown to the next eruption; 0 = no golden age
            this.log = [];                 // [{ turn, msg }] — the event journal, capped
        }

        toJSON() {
            return {
                seed: this.seed,
                hexes: [...this.hexes.values()],
                hero: this.hero,
                creatures: this.creatures,
                anchors: this.anchors,
                names: this.names,
                turn: this.turn,
                mp: this.mp,
                phase: this.phase,
                gameOver: this.gameOver,
                eruptions: this.eruptions,
                goldenAge: this.goldenAge,
                log: this.log
            };
        }

        loadJSON(o) {
            this.seed = o.seed;
            this.hexes = new Map(o.hexes.map(h => [Hex.key(h.q, h.r), h]));
            this.hero = o.hero;
            this.creatures = o.creatures;
            this.anchors = o.anchors;
            this.names = o.names;
            this.turn = o.turn;
            this.mp = o.mp;
            this.phase = o.phase;
            this.gameOver = o.gameOver;
            this.eruptions = o.eruptions;
            this.goldenAge = o.goldenAge;
            this.log = o.log;
        }
    }

    return GameState;
})();
