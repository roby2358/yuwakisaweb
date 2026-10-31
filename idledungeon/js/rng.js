// Seeded randomness and string hashing. Everything random in the engine flows through here.
(function (ID) {
  // FNV-1a, 32-bit
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hash(...parts) { return hashStr(parts.join('|')); }

  // mulberry32
  function Rng(seed) { this.s = (seed >>> 0) || 1; }
  Rng.prototype.next = function () {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); };
  Rng.prototype.range = function (lo, hi) { return lo + this.next() * (hi - lo); };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };

  ID.hashStr = hashStr;
  ID.hash = hash;
  ID.Rng = Rng;
})(this.ID = this.ID || {});
