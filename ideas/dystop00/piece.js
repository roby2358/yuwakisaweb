// piece.js — Piece, Rig, Sweeper
//
// A counter on the board: a coordinate plus display identity. Piece is the base type for
// every positioned token; Rig (a pirate transmitter) and Sweeper (a regime unit) extend it
// with the fields their rules need. Kept light records — position + identity + plain data,
// no game rules — so GameState stays a snapshot-able data bag. Depends only on Hex.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
class Piece {
    constructor(q, r, color, label) {
        this.q = q;
        this.r = r;
        this.color = color;   // intrinsic color; null when drawn with a display constant
        this.label = label;   // single-glyph counter label
    }

    // Map/Set key for this piece's hex.
    key() {
        return Hex.key(this.q, this.r);
    }

    isAt(q, r) {
        return this.q === q && this.r === r;
    }

    moveTo(q, r) {
        this.q = q;
        this.r = r;
    }
}

// A pirate transmitter. Carried rigs have no position (q = r = null).
class Rig extends Piece {
    constructor(id, name) {
        super(null, null, null, name[0]);
        this.id = id;
        this.name = name;
        this.status = 'carried';   // 'carried' | 'planted' | 'smashed'
        this.airtime = 0;          // unjammed broadcasts since planted; widens its range
    }
}

// A regime unit. `kind` is a row of GameArtifacts.SWEEPER_KINDS; label shows its MP like a
// wargame movement factor. `target` is the commitment: { kind, key } or null.
class Sweeper extends Piece {
    constructor(id, q, r, kind) {
        super(q, r, null, String(kind.mp));
        this.id = id;
        this.kind = kind.name;
        this.mp = kind.mp;
        this.prefers = kind.prefers;   // 'frontier' | 'rig'
        this.target = null;            // { kind: 'player'|'rig'|'frontier'|'patrol', key }
    }
}
