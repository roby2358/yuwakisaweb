// mglad.js — Monster Gladiators constants, hex math, utilities, sound

// ---- EGA palette (for gladiator colors) ----
const PALETTE = [
    '#000000','#0000AA','#00AA00','#00AAAA',
    '#AA0000','#AA00AA','#AA5500','#AAAAAA',
    '#555555','#5555FF','#55FF55','#55FFFF',
    '#FF5555','#FF55FF','#FFFF55','#FFFFFF'
];

// ---- Game constants ----
const PT_COST     = 100;
const POP_REWARD  = 120;
const ATT_SLOW    = 10;
const KILL_TIMEOUT = 1200;
const NUM_GUYS    = 8;
const ROSTER_SIZE = 40;

// ---- Terrain ----
const T_CLEAR = 0, T_SAND = 1, T_TREE = 2, T_BUSH = 3, T_ROCK = 4;
const T_POOL  = 5, T_COLUMN = 6, T_LTWALL = 7, T_DKWALL = 8, T_BLOOD = 9;
const NUM_TERRAIN = 10;
const FL_NOMOVE = 1, FL_TERR = 2, FL_BLOOD = 4;

const TERRAIN = [
    { flags: FL_BLOOD },                  // CLEAR
    { flags: FL_TERR | FL_BLOOD },        // SAND
    { flags: FL_TERR | FL_NOMOVE },       // TREE
    { flags: FL_TERR },                   // BUSH
    { flags: FL_TERR | FL_NOMOVE },       // ROCK
    { flags: FL_TERR | FL_NOMOVE },       // POOL
    { flags: FL_TERR | FL_NOMOVE },       // COLUMN
    { flags: FL_TERR | FL_NOMOVE },       // LTWALL
    { flags: FL_TERR | FL_NOMOVE },       // DKWALL
    { flags: FL_TERR },                   // BLOOD
];

// Terrain type → sprite sheet row in terrain.png
// terrain.png rows: Blood, Sand, Brush, Tree, Rock, Pool, LargeCol, Columns, LtBlock, DkBlock
const TERRAIN_SPRITE_ROW = [1, 1, 3, 2, 4, 5, 6, 8, 9, 0];
//                         Clear Sand Tree Bush Rock Pool Col  LtW  DkW  Blood

// ---- Guy states ----
const GUY_DEAD = 0, GUY_OK = 1, GUY_MOVE = 2, GUY_ATTACK = 3;
const GUY_DEFEND = 4, GUY_REST = 5, GUY_HIT = 6;

// ---- Arena results ----
const AR_OK = 0, AR_QUIT = 1, AR_PASSAGE = 2, AR_PROMOTE = 3, AR_DEMOTE = 4;

// ---- Stat costs ----
const STAT_COST = { skill: 1, str: 2, health: 1, weapon: 3, armor: 3 };

// ---- Archetypes ----
//  - Standard — Secutor: balanced pursuit fighter, decent weapon and shield, no glaring weakness
//  - Rock — Murmillo: heavy hitter with str emphasis, like the classic legionary-style gladiator with a big sword
//  - Brick — Provocator: endurance fighter with armor and health, wears you down while absorbing punishment
//  - Speedster — Retiarius: unarmored speed fighter, relies on agility and quick strikes, dies fast if caught
//  - Master — Dimachaerus: dual-wielding expert, extremely high skill and weapon but fragile body, a technical showman
//  - Wall — Samnite: tower shield and heavy armor, barely attacks but almost impossible to damage, wins by exhausting opponents
//  - Slasher — Thraex: curved sword specialist, all about weapon damage with enough skill to land hits
//  - Specialist — Sagittarius: precise and methodical, high skill with moderate gear, consistent rather than flashy
//  - Monster — Bestiarius: the beast-fighter archetype, tough and durable with decent weapon, survives through sheer bulk
//  - Strongman — Scissor: raw brute power with heavy health, overwhelms through strength rather than finesse
const ARCHETYPES = [
    { name: 'Standard',   skill: 20, str: 10, health: 20, weapon:  7, armor: 6,  sprite: 0 },
    { name: 'Rock',       skill: 10, str: 20, health: 20, weapon:  6, armor: 4,  sprite: 1 },
    { name: 'Brick',      skill: 10, str: 15, health: 30, weapon:  3, armor: 7,  sprite: 2 },
    { name: 'Speedster',  skill: 25, str: 25, health: 10, weapon:  5, armor: 0,  sprite: 3 },
    { name: 'Master',     skill: 35, str:  5, health: 20, weapon: 12, armor: 0,  sprite: 4 },
    { name: 'Wall',       skill: 15, str: 10, health: 30, weapon:  3, armor: 9,  sprite: 5 },
    { name: 'Slasher',    skill: 20, str: 15, health: 15, weapon: 12, armor: 0,  sprite: 6 },
    { name: 'Specialist', skill: 30, str: 10, health: 20, weapon:  7, armor: 3,  sprite: 7 },
    { name: 'Monster',    skill: 10, str: 15, health: 25, weapon:  9, armor: 3,  sprite: 8 },
    { name: 'Strongman',  skill: 10, str: 21, health: 30, weapon:  3, armor: 3,  sprite: 9 },
];

// ---- Hex geometry (pointy-top, odd-r offset) ----
const HEX_R   = 26;
const HEX_W   = Math.round(Math.sqrt(3) * HEX_R); // ~45
const HEX_H   = HEX_R * 2;                        // 52
const COL_W   = HEX_W;                             // 45
const ROW_H   = Math.round(HEX_R * 1.5);           // 39
const ODD_X   = Math.round(HEX_W / 2);             // 17 or 18
const MAP_PAD = 6;

const MAP_W = 19, MAP_H = 19;

// Hex sprite source sizes (from sprite sheets)
// monsters.png & terrain.png: 10x10 grid of 32x32 sprites
const SPRITE_W = 32, SPRITE_H = 32;
const SPRITE_COLS = 10;
// effects.png: 192x192, 6x6 grid of 32x32 (6 rows: 2 miss, 2 hit, 2 rest)
const EFFECT_SPRITE_W = 32, EFFECT_SPRITE_H = 32;
const EFFECT_COLS = 6;
const EFFECT_ROWS_PER_TYPE = 2;

// ---- Hex directions: 0=NW(Q), 1=NE(E), 2=W(A), 3=E(D), 4=SW(Z), 5=SE(C) ----
// Neighbor offsets [dx, dy] for even rows and odd rows
const HEX_EVEN = [[-1,-1],[0,-1],[-1,0],[1,0],[-1,1],[0,1]];
const HEX_ODD  = [[0,-1],[1,-1],[-1,0],[1,0],[0,1],[1,1]];

// Cube direction vectors: NW, NE, W, E, SW, SE
const CUBE_DIRS = [
    { x: 0, y: 1, z:-1 }, { x: 1, y: 0, z:-1 },
    { x:-1, y: 1, z: 0 }, { x: 1, y:-1, z: 0 },
    { x:-1, y: 0, z: 1 }, { x: 0, y:-1, z: 1 },
];

// Keyboard → hex direction
const KEY_DIR = {
    'q':0,'Q':0, 'e':1,'E':1,
    'a':2,'A':2, 'd':3,'D':3,
    'z':4,'Z':4, 'c':5,'C':5,
    's':6,'S':6,
    'ArrowLeft':2, 'ArrowRight':3,
    ' ':6,
};

// ---- Hex utility functions ----

function hexNeighbor(col, row, dir) {
    const off = (row & 1) ? HEX_ODD : HEX_EVEN;
    return { x: col + off[dir][0], y: row + off[dir][1] };
}

function toCube(col, row) {
    const x = col - ((row - (row & 1)) >> 1);
    const z = row;
    return { x, y: -x - z, z };
}

function hexDist(c1, r1, c2, r2) {
    const a = toCube(c1, r1), b = toCube(c2, r2);
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

function hexAdjacent(x1, y1, x2, y2) {
    return hexDist(x1, y1, x2, y2) === 1;
}

function hexDirTo(c1, r1, c2, r2) {
    const a = toCube(c1, r1), b = toCube(c2, r2);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    if (dx === 0 && dy === 0 && dz === 0) return 3; // arbitrary
    let best = 0, bestDot = -Infinity;
    for (let i = 0; i < 6; i++) {
        const d = CUBE_DIRS[i];
        const dot = dx * d.x + dy * d.y + dz * d.z;
        if (dot > bestDot) { bestDot = dot; best = i; }
    }
    return best;
}

function hexCX(col, row) {
    return MAP_PAD + col * COL_W + (row & 1) * ODD_X + Math.floor(COL_W / 2);
}

function hexCY(col, row) {
    return MAP_PAD + row * ROW_H + HEX_R;
}

// ---- General utilities ----

function R(min, max) {
    if (min > max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const lpad = (v, w) => String(v).padStart(w);
const rpad = (v, w) => String(v).padEnd(w);

// ---- Input Manager ----

class InputManager {
    constructor() {
        this._resolve = null;
        this._queue = [];
        this._backtick = false;

        document.addEventListener('keydown', e => {
            if (e.key === 'Tab' || e.key === 'F5') return;
            e.preventDefault();
            if (e.key === '`') { this._backtick = true; return; }
            const ev = { key: e.key, code: e.code, debug: this._backtick };
            this._backtick = false;
            this._push(ev);
        });

        document.addEventListener('click', () => {
            this._push({ key: 'Enter', code: 'Enter', debug: false });
        });
    }

    _push(ev) {
        if (this._resolve) {
            const res = this._resolve;
            this._resolve = null;
            res(ev);
        } else {
            this._queue.push(ev);
        }
    }

    waitKey() {
        if (this._queue.length) return Promise.resolve(this._queue.shift());
        return new Promise(res => { this._resolve = res; });
    }

    flush() { this._queue.length = 0; }
}

const input = new InputManager();

// ---- Sound ----

class SoundEngine {
    constructor() { this.ctx = null; this.enabled = true; this.vol = 0.06; }

    init() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { this.enabled = false; }
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
