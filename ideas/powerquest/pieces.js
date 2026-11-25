// pieces.js — Hero, Creature, Village, Ruin, Lair
//
// The Power Quest tokens, each a Piece subclass holding plain serializable fields and no rules
// (ONTOLOGY.md §1). Rules live in GameEngine. Also home of hexDist, the one distance helper the
// engine modules share. Depends only on Piece; plain-script globals for file:// launch.

function hexDist(a, b) {
    const dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

class Hero extends Piece {
    constructor(q, r) {
        super(q, r, null, 'P');
        this.level = 1;
        this.xp = 0;
        this.hp = 0;
        this.charge = 0;
        this.shield = 0;
        this.perks = {};            // perkId -> rank
        this.sockets = [];          // moduleId | null per socket
        this.blueprints = [];       // moduleIds learned from ruins
        this.pack = { scrap: 0, cells: 0 };
        this.sheltered = false;     // convalescing in a village after a shutdown: enemies cannot attack
        this.away = false;          // true only while a shutdown is being resolved
    }
}

class Creature extends Piece {
    constructor(q, r, id, kind, name, hpMax, speed) {
        super(q, r, null, name[0]);
        this.id = id;
        this.kind = kind;           // key of GameArtifacts.ENEMY_KINDS
        this.name = name;
        this.hp = hpMax;
        this.hpMax = hpMax;
        this.speed = speed;         // hexes per world phase, rolled at spawn
        this.home = null;           // lair id (leash anchor and offspring count) or null
        this.aq = q;                // leash anchor
        this.ar = r;
        this.guardian = false;      // holds a lair hex
        this.slayer = false;        // has shut the hero down
    }
}

class Site extends Piece {
    constructor(q, r, id, label) {
        super(q, r, null, label);
        this.id = id;
        this.discovered = false;
    }
}

class Village extends Site {
    constructor(q, r, id, name) {
        super(q, r, id, 'V');
        this.name = name;
        this.tier = 0;
        this.stock = 0;
        this.trust = 0;
        this.hp = 0;
        this.giftBucket = GameArtifacts.GIFT_CAP;
        this.home = false;
        this.ruined = false;
    }
}

class Ruin extends Site {
    constructor(q, r, id, blueprint) {
        super(q, r, id, 'R');
        this.blueprint = blueprint;  // moduleId or null
        this.looted = false;
    }
}

class Lair extends Site {
    constructor(q, r, id, kind, tier) {
        super(q, r, id, 'L');
        this.kind = kind;            // 'camp' | 'den'
        this.tier = tier;            // siteTier at placement
        this.active = true;
        this.timer = 0;
    }
}
