// piece.js — Piece
//
// A counter on the board: a coordinate plus display identity. In Thing Factory every piece is
// a crate or a gremlin; the engine sets `id` and `kind` (a key of GameArtifacts.PIECES).
//
// Kept a light record — position + identity with pure convenience methods, no game rules —
// so GameState stays a snapshot-able data bag. Depends only on Hex, so the engine can use
// it server-side; no display artifacts here. A piece's color is state and lives here: a
// gremlin's seeded hue, or a crate's CRATE_COLORS name.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
class Piece {
    constructor(q, r, color, label) {
        this.q = q;
        this.r = r;
        this.color = color;   // gremlin '#rrggbb' or crate CRATE_COLORS name
        this.label = label;   // PIECES[kind].label ('📦', '👹')
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
