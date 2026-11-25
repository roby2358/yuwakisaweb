// test/helpers/arena.js — a small flat world for rule tests.
//
// `arena()` boots the DOM-free engine stack and builds a W x H all-plains map with a water edge
// ring, a full-health hero at (10,10) holding the starter module, and no sites or enemies. Tests
// add what they need. Coordinates are (col,row); `hex(col,row)` gives the axial {q,r}.
'use strict';
const { load } = require('./load');

function arena(o) {
    o = o || {};
    const g = load();
    const A = g.GameArtifacts;
    const state = new g.GameState();
    const engine = new g.GameEngine(state);
    g.Rando.seed(o.seed || 7);
    const W = o.w || 30, H = o.h || 30;
    const hexes = new Map();
    for (let row = 0; row < H; row++) {
        for (let col = 0; col < W; col++) {
            const q = col - Math.floor(row / 2), r = row;
            const isEdge = row === 0 || row === H - 1 || col === 0 || col === W - 1;
            hexes.set(g.Hex.key(q, r), { q, r, col, row, elevation: 50, moisture: 50, isEdge, terrain: isEdge ? A.TERRAIN.WATER : A.TERRAIN.PLAINS });
        }
    }
    state.hexes = hexes;
    engine.adoptBoard();
    const hex = (col, row) => ({ q: col - Math.floor(row / 2), r: row });
    const p = hex(o.hero ? o.hero[0] : 10, o.hero ? o.hero[1] : 10);
    const hero = new g.Hero(p.q, p.r);
    hero.sockets = [A.STARTER_MODULE, null];
    hero.blueprints = [A.STARTER_MODULE];
    state.hero = hero;
    const st = engine.heroStats();
    hero.hp = st.hpMax; hero.charge = st.chargeMax;
    state.mp = st.mp;

    const api = {
        g, A, state, engine, hex, hero,
        terrain(col, row, t) { const h = hex(col, row); hexes.get(g.Hex.key(h.q, h.r)).terrain = t; },
        village(col, row, v) {
            v = v || {};
            const h = hex(col, row);
            const x = new g.Village(h.q, h.r, state.nextId++, 'Vill' + state.nextId);
            x.tier = v.tier || 0; x.trust = v.trust === undefined ? A.HOME_TRUST : v.trust; x.home = !!v.home;
            x.stock = A.TIER_COSTS[x.tier]; x.hp = v.hp === undefined ? engine.villageHpMax(x) : v.hp; x.discovered = true;
            state.villages.push(x);
            return x;
        },
        ruin(col, row, bp) { const h = hex(col, row); const x = new g.Ruin(h.q, h.r, state.nextId++, bp || null); state.ruins.push(x); return x; },
        lair(col, row, kind, tier) { const h = hex(col, row); const x = new g.Lair(h.q, h.r, state.nextId++, kind || 'den', tier || 1); state.lairs.push(x); return x; },
        enemy(kind, col, row, e) {
            e = e || {};
            const h = hex(col, row);
            const c = engine.makeCreature(kind, h.q, h.r, e);
            if (e.hp !== undefined) { c.hp = e.hp; if (e.hp > c.hpMax) c.hpMax = e.hp; }
            if (e.speed !== undefined) c.speed = e.speed;
            state.enemies.push(c);
            return c;
        },
        moveHero(col, row) { const h = hex(col, row); hero.moveTo(h.q, h.r); },
        phases(n) { for (let i = 0; i < n; i++) engine.endTurn(); }
    };
    return api;
}

module.exports = { arena };
