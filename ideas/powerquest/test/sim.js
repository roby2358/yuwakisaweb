// test/sim.js — headless bot playthrough for tuning:  node test/sim.js [turns=600] [seeds=6]
//
// A simple hunter-crafter bot plays full games on the DOM-free engine and prints the numbers
// the design cares about (level pace, shutdowns, village health). Not a test; a harness.
// Modeled numbers from here are first-guess evidence only (see RATIONALE).
'use strict';
const { load } = require('./helpers/load');

const TURNS = Number(process.argv[2] || 600);
const SEEDS = Number(process.argv[3] || 6);
const PERK_ORDER = ['tough', 'hardened', 'brutal', 'wired', 'fleet', 'tuned', 'keen', 'scavenger'];

function playGame(seed) {
    const g = load();
    const { GameState, GameEngine, GameArtifacts: A, hexDist } = g;
    const state = new GameState();
    const e = new GameEngine(state);
    e.newGame(seed);
    const h = state.hero;
    const milestones = {};
    const dist = (a, b) => hexDist(a, b);

    function nearestOpenVillage() {
        let best = null, bd = Infinity;
        for (const v of state.villages) { if (!e.isOpen(v)) continue; const d = dist(v, h); if (d < bd) { bd = d; best = v; } }
        return best;
    }
    function stepToward(p) {
        for (let guard = 0; guard < 12 && state.mp > 0; guard++) {
            const reach = e.computeReachable();
            let best = null, bd = dist(h, p);
            for (const [k] of reach) {
                const [q, r] = k.split(',').map(Number);
                const d = dist({ q, r }, p);
                if (d < bd) { bd = d; best = { q, r }; }
            }
            if (!best) return;
            if (!e.move(best.q, best.r).ok) return;
        }
    }
    function perks() {
        while (state.perkOffers.length) {
            const offer = state.perkOffers[0];
            let pick = 0, rank = 99;
            offer.forEach((id, i) => { const r = PERK_ORDER.indexOf(id); if (r < rank) { rank = r; pick = i; } });
            e.pickPerk(pick);
        }
    }
    function services() {
        const v = e.villageAt(h);
        if (!v) return;
        // craft the best affordable blueprint into a free or weakest socket, then bank the rest
        const order = h.blueprints.slice().sort((a, b) => A.MODULES[b].tier - A.MODULES[a].tier);
        for (const id of order) {
            if (h.sockets.includes(id) && A.MODULES[id].template !== 'passive') continue;
            if (h.sockets.includes(id)) continue;
            let slot = h.sockets.indexOf(null);
            if (slot < 0) {
                let worst = 0, wt = 99;
                h.sockets.forEach((sid, i) => { const t = A.MODULES[sid].tier; if (t < wt) { wt = t; worst = i; } });
                if (wt >= A.MODULES[id].tier) continue;
                slot = worst;
            }
            if (!e.canCraft(id)) e.craft(id, slot);
        }
        if (h.pack.scrap + h.pack.cells > 0) e.deposit(h.pack.scrap, h.pack.cells);
    }
    function fight() {
        const st = e.heroStats();
        for (let n = 0; n < 40; n++) {
            const adj = [...e.attackable()];
            let did = false;
            // ranged first
            for (let slot = 0; slot < h.sockets.length && !did; slot++) {
                const ids = e.shootable(slot);
                const w = A.MODULES[h.sockets[slot]];
                if (ids.length && h.charge >= w.cost && h.charge > 1) {
                    ids.sort((a, b) => a.hp - b.hp);
                    did = e.shoot(slot, ids[0].q, ids[0].r).ok;
                }
            }
            if (!did && adj.length && state.mp > 0) {
                const [q, r] = adj[0].split(',').map(Number);
                did = e.attack(q, r).ok;
            }
            if (!did) break;
        }
    }
    function maybeHeal() {
        for (let slot = 0; slot < h.sockets.length; slot++) {
            const m = A.MODULES[h.sockets[slot]];
            if (m && m.template === 'active' && m.effect === 'heal' && h.hp < e.heroStats().hpMax * 0.5 && h.charge >= m.cost) e.activate(slot);
        }
    }

    let explored = 0;
    for (let t = 0; t < TURNS; t++) {
        perks();
        services();
        const st = e.heroStats();
        const hurt = h.hp < st.hpMax * 0.45;
        const heavy = h.pack.scrap + h.pack.cells >= 12 + 3 * h.level;
        const home = nearestOpenVillage();
        if ((hurt || heavy) && home && dist(h, home) > 0) {
            stepToward(home);
        } else if (!(hurt && !home)) {
            // hunt: nearest visible enemy not too far above us
            const foes = state.enemies.filter(c => dist(c, h) <= 14 && g.GameArtifacts.ENEMY_KINDS[c.kind].tier <= 1 + Math.floor(h.level / 2))
                .sort((a, b) => dist(a, h) - dist(b, h));
            if (foes.length) {
                fight();
                if (dist(foes[0], h) > 1) stepToward(foes[0]);
                fight();
            } else {
                // explore toward unlooted ruins, else the nearest unseen lair, else a village
                const ru = state.ruins.filter(r => !r.looted).sort((a, b) => dist(a, h) - dist(b, h))[0]
                    || state.villages.filter(v => !e.isOpen(v) && !v.ruined).sort((a, b) => dist(a, h) - dist(b, h))[0];
                if (ru) stepToward(ru);
            }
        }
        perks();
        maybeHeal();
        e.endTurn();
        if (t === 99 || t === 299 || t === 599 || t === 999) milestones[t + 1] = h.level;
    }
    const live = state.villages.filter(v => !v.ruined);
    return {
        seed, level: h.level, turn: state.turn, kills: state.stats.kills, shutdowns: state.stats.shutdowns,
        villages: live.length + '/' + state.villages.length, tiers: live.map(v => v.tier).join(','), opened: live.filter(v => e.isOpen(v)).length,
        crafted: state.stats.crafted, sockets: h.sockets.filter(Boolean).length + '/' + h.sockets.length,
        enemies: state.enemies.length, milestones: JSON.stringify(milestones)
    };
}

const rows = [];
for (let i = 0; i < SEEDS; i++) rows.push(playGame(100 + i * 17));
console.table(rows);
