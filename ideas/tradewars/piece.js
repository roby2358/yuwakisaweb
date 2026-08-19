// A positioned counter with intrinsic display identity and no game rules.
class Piece {
    constructor(q, r, color, label) {
        this.q = q;
        this.r = r;
        this.color = color;
        this.label = label;
    }

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
