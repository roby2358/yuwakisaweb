// Static game data: tuning constants, heroes, items, slaver captains.
// Pure data — no DOM, no logic beyond weighted-pick helpers.

var Data = (function () {
  const CONFIG = {
    COLS: 15,
    ROWS: 130,
    STRETCH_ROWS: 26,      // 5 stretches; stretch 5 (rows 0-25) is the polar ice
    GONG_PERIOD: 12,       // turns between grailstone firings
    STARVE_AT: 24,         // famine threshold — you can skip exactly one gong
    FAMISH_MP: 1,          // movement lost while famished (floor of 1 — never stuck)
    FAMISH_ATK: 1,         // attack lost while famished (floor of 1)
    PARTY_CAP: 4,
    RAFT_BAMBOO: 4,        // bamboo bundles to build a raft
    FREE_MEALS: 2,         // meals per stretch before the local state notices you
    GUARD_LEASH: 7,        // guards give up chasing beyond this range from home stone
    GUARD_SIGHT: 5,
    JOE_DREAD: 0.5,        // chance an enemy adjacent to Joe loses its action
    KAZZ_FLINT: 0.5,       // chance Kazz's kill yields a flint edge
    RIVER_GIVES_BACK: 0.35, // chance a wanderer is a lost companion returned
  };

  // Roles are mechanical exceptions, not stat deltas — each hero breaks one rule.
  const HEROES = {
    burton: { name: 'Richard Burton', glyph: '🧭', hp: 8, atk: 2, mp: 3, sight: 7,
      role: 'Explorer — sees far; only the leader may ride the Suicide Express.' },
    alice: { name: 'Alice Hargreaves', glyph: '👒', hp: 5, atk: 1, mp: 3, sight: 4,
      role: 'Grace — at the gong, allies within 2 hexes of her eat if she does.' },
    kazz: { name: 'Kazz', glyph: '🪨', hp: 7, atk: 3, mp: 3, sight: 4,
      role: 'Flint-finder — his kills often yield a flint edge.' },
    cyrano: { name: 'Cyrano de Bergerac', glyph: '🤺', hp: 6, atk: 3, mp: 3, sight: 4,
      role: 'Fencer — enemies never strike back at him.' },
    joe: { name: 'Joe Miller', glyph: '🦣', hp: 12, atk: 4, mp: 2, sight: 4,
      role: 'Titanthrop — adjacent enemies may freeze in dread.' },
    sam: { name: 'Sam Clemens', glyph: '🚬', hp: 5, atk: 1, mp: 3, sight: 4,
      role: 'Riverman — raft moves +1 and never drifts while he is aboard.' },
  };

  const RECRUIT_POOL = ['alice', 'kazz', 'cyrano', 'joe', 'sam'];

  // Three templates: consume (use on the selected unit), equip (permanent, consumed),
  // trade (spent on the world). Effects live in Game.ITEM_EFFECTS — one dispatch point.
  const ITEMS = {
    ration: { name: 'Ration', glyph: '🍖', weight: 30,
      desc: 'Eat anywhere: hunger resets. Hoard these for the ice.' },
    whiskey: { name: 'Whiskey', glyph: '🥃', weight: 15,
      desc: 'Drink: heal 2 HP.' },
    dreamgum: { name: 'Dreamgum', glyph: '🍬', weight: 15,
      desc: 'Chew: +2 attack this turn, then stagger to a random hex.' },
    flint: { name: 'Flint Edge', glyph: '🔪', weight: 14,
      desc: 'Equip: +1 attack, permanent.' },
    cloth: { name: 'Woven Cloth', glyph: '🧣', weight: 14,
      desc: 'Equip: +2 max HP, permanent.' },
    cigars: { name: 'Cigars', glyph: '💨', weight: 12,
      desc: 'Bribe: up to two adjacent guards desert.' },
  };

  const CAPTAINS = [
    'Hermann Göring', 'Tullius Hostilius', 'King John Lackland',
    'Kramer the Hammer', 'Arpad of the Magyars', 'Iyeyasu',
  ];

  const TERRAIN = {
    grass: { cost: 1, walk: true },
    bamboo: { cost: 2, walk: true },
    trees: { cost: 2, walk: true },
    stone: { cost: 1, walk: true },   // a grailstone's hex
    ice: { cost: 1, walk: true },
    tower: { cost: 1, walk: true },
    water: { cost: Infinity, walk: false }, // raft only
    mountain: { cost: Infinity, walk: false },
  };

  function pickWeighted(table, roll) {
    // roll in [0,1). Deterministic given roll — testable.
    const entries = Object.entries(table);
    const total = entries.reduce((sum, e) => sum + e[1].weight, 0);
    let mark = roll * total;
    for (const [id, item] of entries) {
      mark -= item.weight;
      if (mark < 0) return id;
    }
    return entries[entries.length - 1][0];
  }

  return { CONFIG, HEROES, RECRUIT_POOL, ITEMS, CAPTAINS, TERRAIN, pickWeighted };
})();
