// LOAD BEARING — Flourish: a deck of variations on one idea.
//
// Draws WITHOUT replacement and reshuffles only once exhausted, so the player
// sees every variant before any repeat — the failure mode of a plain random
// pick is hearing the same line twice in a row, which kills the joke.
//
// Decks are per-game (built in Engine.createState) so two runs of the same
// seed draw identically.

// `var`, not a bare `class` declaration: a class declaration creates a LEXICAL
// global, which collides with engine.js's `var Flourish` require-guard when
// both load as classic scripts. Same reason content.js uses `var Content`.
var Flourish = class Flourish {
  constructor(variants) {
    if (!Array.isArray(variants) || variants.length === 0) {
      throw new Error('Flourish needs a non-empty list of variants');
    }
    this.variants = variants;
    this.remaining = [];
  }

  size() {
    return this.variants.length;
  }

  // roll: a float in [0,1) — the caller owns the RNG, so runs stay seeded.
  draw(roll) {
    if (this.remaining.length === 0) {
      this.remaining = this.variants.map((_, i) => i);
    }
    const at = Math.min(this.remaining.length - 1, Math.floor(roll * this.remaining.length));
    const [index] = this.remaining.splice(at, 1);
    return this.variants[index];
  }

  map(fn) {
    return new Flourish(this.variants.map(fn));
  }

  concat(other) {
    return new Flourish(this.variants.concat(other.variants));
  }
};

if (typeof module !== 'undefined') module.exports = Flourish;
