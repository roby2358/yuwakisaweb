// mglad.js — Monster Gladiators constants, data, and utilities
// All symbols are globals (loaded via script tags)

const PALETTE = [
    '#000000','#0000AA','#00AA00','#00AAAA',
    '#AA0000','#AA00AA','#AA5500','#AAAAAA',
    '#555555','#5555FF','#55FF55','#55FFFF',
    '#FF5555','#FF55FF','#FFFF55','#FFFFFF'
];

// CP437 character equivalents
 const BLOCK   = '\u2588'; // █
 const LTBLOCK = '\u2591'; // ░
 const MDBLOCK = '\u2592'; // ▒
 const DKBLOCK = '\u2593'; // ▓
 const LHALF   = '\u2584'; // ▄
 const SQUARE  = '\u25A0'; // ■
 const SPADE   = '\u2660'; // ♠
 const SUN     = '\u263C'; // ☼

// Attribute helpers
 const BACKGR = 7 << 4;   // 0x70 light-gray background
 const BLUEBK = 1 << 4;   // 0x10 blue background

// Game constants
 const PT_COST     = 100;
 const POP_REWARD  = 40;
 const ATT_SLOW    = 10;
 const KILL_TIMEOUT = 1200;
 const NUM_GUYS    = 8;

// Terrain enum
 const T_CLEAR  = 0, T_SAND   = 1, T_TREE  = 2, T_BUSH   = 3, T_ROCK = 4;
 const T_POOL   = 5, T_COLUMN = 6, T_LTWALL= 7, T_DKWALL = 8, T_BLOOD= 9;
 const NUM_TERRAIN = 10;

// Terrain flags
 const FL_NOMOVE = 1, FL_TERR = 2, FL_BLOOD = 4;

// Guy states
 const GUY_DEAD = 0, GUY_OK = 1, GUY_MOVE = 2, GUY_ATTACK = 3;
 const GUY_DEFEND = 4, GUY_REST = 5, GUY_HIT = 6;

// Arena results
 const AR_OK = 0, AR_QUIT = 1, AR_PASSAGE = 2, AR_PROMOTE = 3, AR_DEMOTE = 4;

// Border styles
 const BD_NONE = 0, BD_IN = 1, BD_OUT = 2, BD_FILL = 0x80;

// Stat costs
 const STAT_COST = { skill:1, str:2, health:1, weapon:2, armor:3 };

// Numpad direction deltas (index 1-9)
 const DIR_DX = [0, -1, 0, 1, -1, 0, 1, -1, 0, 1];
 const DIR_DY = [0,  1, 1, 1,  0, 0, 0, -1,-1,-1];

// Keyboard → direction (QWEASDZXC layout)
 const KEY_DIR = {
    'q':7,'w':8,'e':9,
    'a':4,'s':5,'d':6,
    'z':1,'x':2,'c':3,
    'ArrowUp':8,'ArrowDown':2,'ArrowLeft':4,'ArrowRight':6,
    ' ':5
};

// Archetypes
 const ARCHETYPES = [
    { name:'Standard',  skill:20, str:10, health:12, weapon: 9, armor: 6 },
    { name:'Rock',      skill:14, str:14, health:15, weapon:14, armor: 3 },
    { name:'Brick',     skill:15, str:14, health:15, weapon: 4, armor: 9 },
    { name:'Speedster', skill:31, str: 6, health: 8, weapon: 7, armor: 0 },
    { name:'Master',    skill:33, str: 6, health:20, weapon:18, armor: 0 },
    { name:'Wall',      skill:12, str:12, health:18, weapon: 4, armor:12 },
    { name:'Slasher',   skill:10, str: 8, health:10, weapon:24, armor: 0 },
    { name:'Specialist',skill:64, str: 4, health:10, weapon: 4, armor: 0 },
    { name:'Monster',   skill:15, str:15, health:17, weapon:14, armor: 3 },
    { name:'Strongman', skill:25, str:24, health:15, weapon: 6, armor: 0 },
];

// Terrain display data
 const TERRAIN = [
    { ch:'.',     attr: BACKGR|8,     flags: FL_BLOOD },                  // CLEAR
    { ch:BLOCK,   attr: 14,           flags: FL_TERR|FL_BLOOD },          // SAND
    { ch:SPADE,   attr: BACKGR|2,     flags: FL_TERR|FL_NOMOVE },         // TREE
    { ch:'*',     attr: BACKGR|2,     flags: FL_TERR },                   // BUSH
    { ch:LHALF,   attr: BACKGR|6,     flags: FL_TERR|FL_NOMOVE },         // ROCK
    { ch:BLOCK,   attr: 9,            flags: FL_TERR|FL_NOMOVE },         // POOL
    { ch:SQUARE,  attr: BACKGR|8,     flags: FL_TERR|FL_NOMOVE },         // COLUMN
    { ch:LTBLOCK, attr: (7<<4)|8,     flags: FL_TERR|FL_NOMOVE },         // LTWALL
    { ch:BLOCK,   attr: 8,            flags: FL_TERR|FL_NOMOVE },         // DKWALL
    { ch:SUN,     attr: 4|BACKGR,     flags: FL_TERR },                   // BLOOD
];

// ---- Utility functions ----

 function R(min, max) {
    if (min > max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

 function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

 function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

 function dirFromDelta(dx, dy) {
    const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    return (1 - sy) * 3 + (sx + 2);
}

// sprintf-style helpers
 const lpad = (v, w) => String(v).padStart(w);
 const rpad = (v, w) => String(v).padEnd(w);

// ---- Sound (PC speaker emulation via Web Audio) ----

class SoundEngine {
    constructor() { this.ctx = null; this.enabled = true; this.vol = 0.06; }

    init() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch(e) { this.enabled = false; }
    }

    play(freq, ms) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.value = this.vol;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + ms / 1000);
    }
}

 const sound = new SoundEngine();
