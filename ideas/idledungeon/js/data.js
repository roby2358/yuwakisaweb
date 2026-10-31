// Numbers, hero base stats, and the upgrade catalog. ONTOLOGY "Numbers" mirrors this file.
(function (ID) {
  const N = ID.N = {
    COST_MULT: 1.6,          // × price per purchase
    EFFECT_MULT: 1.25,       // × effect per purchase
    SPEED_TAPER: 0.6,        // speed upgrades grow as EFFECT_MULT^(level^SPEED_TAPER)
    DEPTH_MULT: 1.4,         // × monster HP, damage, kill XP per depth
    NEXT_LEVEL_BASE: 500,
    NEXT_LEVEL_MULT: 2,
    FOE_MULT: 1.1,           // × monster HP and damage per XP-per-kill upgrade, across all depths

    TICK: 1 / 30,
    MAX_STEPS_PER_FRAME: 10,
    AWAY_THRESHOLD: 2,       // s; a frame gap longer than this is credited as time away

    CELL: 32,
    MAP_W: 72, MAP_H: 48,
    ROOM_COUNT: 9, ROOM_MIN: 8, ROOM_MAX: 16, ROOM_MARGIN: 2,
    CORRIDOR_W: 3, EXTRA_LINKS: 2,
    VIEW_CELLS: 16,          // cells visible along the shorter screen side
    WALL_PX: 11,             // wall line width in screen pixels
    CAM_LAG: 2,              // cells the smoothed camera may trail the leader

    MONSTER_HP: 60, MONSTER_DMG: 6, MONSTER_INTERVAL: 1.2,
    MONSTER_SPEED: 50, MONSTER_XP: 5,
    SPECIES_MIN: 0.6, SPECIES_MAX: 1.8,
    MONSTER_CAP: 20, RESPAWN_INTERVAL: 3, SPAWN_MIN_DIST: 12,
    MONSTER_AGGRO: 6, TANK_AGGRO: 8,

    HERO_R: 10, MELEE_PAD: 6,
    FACING_MIN: 4,           // units; shorter moves keep the current facing
    FORMATION_DIST: 1.5, KITE_DIST: 2,
    ARROW_SPEED: 400, BOLT_SPEED: 250, HEAL_SPEED: 300,
    STUCK_TIME: 4,           // s without progress before the leader picks a new room
    WIPE_DELAY: 3, REVIVE_RANGE: 1, REVIVE_HP_FRAC: 0.5,

    ROSTER_SIZE: 100,
    ROSTER_ABILITIES: { beast: 4, leviathan: 1 },   // how many roster names carry each ability
    SAVE_INTERVAL: 10, SAVE_KEY: 'idledungeon.save',
  };

  // Base value of every stat the rules read. Ranges and radii are in cells.
  N.BASE = {
    'warrior.hp': 120, 'warrior.damage': 8, 'warrior.interval': 1.0, 'warrior.armor': 1, 'warrior.taunt': 3,
    'archer.hp': 60, 'archer.damage': 6, 'archer.interval': 0.8, 'archer.range': 7, 'archer.pierce': 0, 'archer.armor': 0,
    'mage.hp': 50, 'mage.damage': 10, 'mage.interval': 1.6, 'mage.range': 6, 'mage.radius': 1.5, 'mage.armor': 0,
    'priest.hp': 60, 'priest.heal': 8, 'priest.interval': 1.2, 'priest.range': 6, 'priest.revive': 30, 'priest.armor': 0,
    'party.xpRate': 1, 'party.xpKill': 1, 'party.move': 80,
  };

  // How an upgrade's level transforms its stat. Speed effects taper: super fast is possible, just very expensive.
  ID.EFFECTS = {
    mul: (b, L) => b * Math.pow(N.EFFECT_MULT, L),
    div: (b, L) => b / Math.pow(N.EFFECT_MULT, L),
    add: (b, L) => b + L,
    faster: (b, L) => b * Math.pow(N.EFFECT_MULT, Math.pow(L, N.SPEED_TAPER)),
    quicker: (b, L) => b / Math.pow(N.EFFECT_MULT, Math.pow(L, N.SPEED_TAPER)),
  };

  const up = (id, label, owner, baseCost, effect, stat) =>
    ({ id, label, owner, baseCost, effect, stat, costMult: N.COST_MULT, action: null, foeMult: 1 });

  ID.CATALOG = [
    up('warrior.hp', 'Max HP', 'warrior', 10, 'mul', 'warrior.hp'),
    up('warrior.armor', 'Armor', 'warrior', 25, 'mul', 'warrior.armor'),
    up('warrior.taunt', 'Taunt radius', 'warrior', 40, 'mul', 'warrior.taunt'),
    up('archer.damage', 'Damage', 'archer', 10, 'mul', 'archer.damage'),
    up('archer.speed', 'Attack speed', 'archer', 20, 'quicker', 'archer.interval'),
    up('archer.pierce', 'Pierce', 'archer', 60, 'add', 'archer.pierce'),
    up('mage.damage', 'Damage', 'mage', 10, 'mul', 'mage.damage'),
    up('mage.radius', 'Blast radius', 'mage', 30, 'mul', 'mage.radius'),
    up('mage.speed', 'Cast speed', 'mage', 20, 'quicker', 'mage.interval'),
    up('priest.heal', 'Heal power', 'priest', 15, 'mul', 'priest.heal'),
    up('priest.healSpeed', 'Heal speed', 'priest', 20, 'quicker', 'priest.interval'),
    up('priest.revive', 'Revive cooldown', 'priest', 50, 'div', 'priest.revive'),
    up('party.xpRate', 'XP per second', 'party', 15, 'mul', 'party.xpRate'),
    Object.assign(up('party.xpKill', 'XP per kill', 'party', 25, 'mul', 'party.xpKill'), { foeMult: N.FOE_MULT }),
    up('party.move', 'Move speed', 'party', 40, 'faster', 'party.move'),
    Object.assign(up('nextLevel', 'Next Level', 'dungeon', N.NEXT_LEVEL_BASE, null, null),
      { costMult: N.NEXT_LEVEL_MULT, action: 'descend' }),
  ];

  // Monster abilities: multipliers applied to a species, plus the title appended to its name.
  ID.ABILITIES = {
    beast: { title: 'the Beast', hp: 2, dmg: 2, size: 1.5, xp: 2, labelColor: '#d9a066' },
    leviathan: { title: 'the Leviathan', hp: 3, dmg: 3, size: 2, xp: 3, labelColor: '#e06a6a' },
  };

  N.START_QUEUE = ['warrior.hp', 'archer.damage', 'mage.damage', 'priest.heal'];

  // Big-number formatting: separators below a million, then suffixes, then e-notation.
  const SUFFIX = ['', 'K', 'M', 'B', 'T'];
  ID.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    const e = Math.floor(Math.log10(n) / 3);
    if (e < SUFFIX.length) return (n / Math.pow(1000, e)).toFixed(2) + SUFFIX[e];
    return n.toExponential(2).replace('+', '');
  };

  ID.CATALOG_BY_ID = {};
  ID.STAT_UPGRADES = {};
  for (const def of ID.CATALOG) {
    ID.CATALOG_BY_ID[def.id] = def;
    if (def.stat) (ID.STAT_UPGRADES[def.stat] = ID.STAT_UPGRADES[def.stat] || []).push(def);
  }
})(this.ID = this.ID || {});
