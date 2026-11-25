// piece.js — Piece
//
// A counter on the board: a coordinate plus display identity. This is the base type for
// every positioned token — the player, the target marker, and enemies today; the units,
// objectives, and faction pieces of games built on this base tomorrow, which extend it
// (hp, faction, movement) by subclassing.
//
// Kept a light record — position + identity with pure convenience methods, no game rules —
// so GameState stays a snapshot-able data bag. Depends only on Hex, so the engine can use
// it server-side; no display artifacts here. A piece's *intrinsic* color (an enemy's seeded
// hue) is state and lives here; pieces drawn with a fixed display color leave it null.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
class Piece {
    constructor(q, r, color, label) {
        this.q = q;
        this.r = r;
        this.color = color;   // intrinsic color (enemies); null when drawn with a display constant
        this.label = label;   // single-glyph counter label ('P', 'E', '★')
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
