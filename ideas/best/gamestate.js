// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no
// rules behavior, no view/interaction state (pan, hover, selection, overlays all
// belong to GameUI). Keep it a plain data bag so it stays trivially snapshot-able.
//
// toJSON/loadJSON are the (de)serialization seam: the only non-plain field is the
// hexes Map, which round-trips through an array. GameUI persists the JSON to
// localStorage each turn so a life's work survives the browser closing.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;              // reproducibility anchor for the whole world
            this.hexes = null;          // Map<"q,r", {q,r,terrain,ring,node:{kind,stock,maxStock,mult}|null}>
            this.hero = null;           // { name, q, r, hp, wealth, renown, rankIdx,
                                        //   pack: [{kind,value}], skills: {key: {level, xp}},
                                        //   sacks, deaths }
            this.foes = [];             // [{ kind, q, r, hp, maxHp, dmg, speed, name|null, doomName|null }]
            this.anchors = [];          // [{ kind:'hall'|'holding'|'monument'|'doom', name, q, r, hp, maxHp, ... }]
                                        //   monument: + income; doom: + tier, fester, reward
            this.turn = 1;
            this.mp = GameArtifacts.RULES.HERO_MP;
            this.phase = 'player';      // 'player' | 'world' — whose half of the turn is resolving
            this.reckoning = 0;         // the world's answer to everything destroyed
            this.doomClock = 0;         // countdown to the next doomrise; 0 = none pending
            this.monumentsBuilt = 0;    // lifetime count — drives cost and grandeur
            this.log = [];              // [{ turn, msg }] — the event journal, capped
        }

        toJSON() {
            return {
                seed: this.seed,
                hexes: [...this.hexes.values()],
                hero: this.hero,
                foes: this.foes,
                anchors: this.anchors,
                turn: this.turn,
                mp: this.mp,
                phase: this.phase,
                reckoning: this.reckoning,
                doomClock: this.doomClock,
                monumentsBuilt: this.monumentsBuilt,
                log: this.log
            };
        }

        loadJSON(o) {
            this.seed = o.seed;
            this.hexes = new Map(o.hexes.map(h => [Hex.key(h.q, h.r), h]));
            this.hero = o.hero;
            this.foes = o.foes;
            this.anchors = o.anchors;
            this.turn = o.turn;
            this.mp = o.mp;
            this.phase = o.phase;
            this.reckoning = o.reckoning;
            this.doomClock = o.doomClock;
            this.monumentsBuilt = o.monumentsBuilt;
            this.log = o.log;
        }
    }

    return GameState;
})();
