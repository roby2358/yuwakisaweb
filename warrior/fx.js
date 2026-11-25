'use strict';
// fx.js — transient, purely visual motion: token slides and floating numbers.
// DOM-free and state-only; index.js draws what this reports and never waits on
// it, so game state and input stay ahead of the animation.

const SLIDE_MS = 90;     // a token's glide between hexes
const FLOAT_MS = 420;    // a damage number's life

class Fx {
    constructor() {
        this.tokens = new WeakMap();   // entity -> { tx, ty, frame, slide }
        this.floats = [];
        this.frame = 0;
        this.now = 0;
        this.sliding = 0;
    }

    beginFrame(now) {
        this.frame++;
        this.now = now;
        this.sliding = 0;
        this.floats = this.floats.filter(f => now - f.start < FLOAT_MS);
    }

    // Where to draw a token whose logical spot is world-pixel `target`. A token
    // that was drawn last frame somewhere else glides from there; one that was
    // not drawn last frame, or jumped further than maxJump pixels, just appears.
    tokenPos(entity, target, maxJump) {
        const rec = this.tokens.get(entity);
        if (!rec || rec.frame !== this.frame - 1) {
            this.tokens.set(entity, { tx: target.x, ty: target.y, frame: this.frame, slide: null });
            return target;
        }
        rec.frame = this.frame;
        if (rec.tx !== target.x || rec.ty !== target.y) {
            const from = this.slidePos(rec);
            const jump = Math.hypot(target.x - from.x, target.y - from.y);
            rec.slide = jump <= maxJump ? { fx: from.x, fy: from.y, start: this.now } : null;
            rec.tx = target.x;
            rec.ty = target.y;
        }
        const pos = this.slidePos(rec);
        if (rec.slide) this.sliding++;
        return pos;
    }

    slidePos(rec) {
        if (!rec.slide) return { x: rec.tx, y: rec.ty };
        const t = (this.now - rec.slide.start) / SLIDE_MS;
        if (t >= 1) { rec.slide = null; return { x: rec.tx, y: rec.ty }; }
        const k = 1 - (1 - t) * (1 - t);   // ease-out: fast off the mark, soft landing
        return { x: rec.slide.fx + (rec.tx - rec.slide.fx) * k, y: rec.slide.fy + (rec.ty - rec.slide.fy) * k };
    }

    floatText(q, r, text, color, dx, now) {
        this.floats.push({ q, r, text, color, dx, start: now });
    }

    // Live floats with their progress t in 0..1.
    liveFloats() {
        return this.floats.map(f => ({ ...f, t: (this.now - f.start) / FLOAT_MS }));
    }

    get busy() { return this.sliding > 0 || this.floats.length > 0; }
}
