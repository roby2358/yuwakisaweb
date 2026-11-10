// test/sim.js — tuning harness:  node test/sim.js [games]
//
// A greedy builder bot: lay belts along the shortest land path from source to target,
// facing each one at the next hex. A spring stands in for a belt on a straight run of 3.
// Pullers, walls and bridges are discarded (the bot doesn't plan pulls).
// Walls and bridges are dumped somewhere harmless (a discard). Reports turns to win.
// Not a test (no pass/fail); it's the evidence behind DELIVER_GOAL and friends.
'use strict';

const { newGame } = require('./helpers/load');

const GAMES = Number(process.argv[2]) || 200;
const CAP = 400;

function shortestPath(engine, g, from, to) {
    const { state, board } = engine;
    const prev = new Map([[g.Hex.key(from.q, from.r), null]]);
    const queue = [from];
    while (queue.length) {
        const cur = queue.shift();
        if (cur.q === to.q && cur.r === to.r) break;
        for (const n of board.neighbors(cur.q, cur.r)) {
            const k = g.Hex.key(n.q, n.r);
            if (prev.has(k) || !board.isPassable(n)) continue;
            prev.set(k, cur);
            queue.push(n);
        }
    }
    const path = [];
    for (let c = to; c; c = prev.get(g.Hex.key(c.q, c.r))) path.unshift({ q: c.q, r: c.r });
    return path;
}

function dirTo(g, a, b) {
    return g.Hex ? [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
        .findIndex(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r) : -1;
}

const results = [];
let lostTotal = 0;
for (let i = 0; i < GAMES; i++) {
    const { g, state, engine } = newGame(5000 + i);
    const path = shortestPath(engine, g, state.source, state.target);
    let res = { ok: true };
    while (!state.gameWon && state.turn < CAP) {
        // Next path hex (excluding the target) that has no mover facing the right way.
        let todo = -1;
        for (let j = 0; j < path.length - 1; j++) {
            const t = engine.thingAt(path[j].q, path[j].r);
            if (!t || (t.facing !== null && t.facing !== dirTo(g, path[j], path[j + 1]))) { todo = j; break; }
        }
        if (todo >= 0) {
            const h = path[todo], f = dirTo(g, h, path[todo + 1]);
            const t = engine.thingAt(h.q, h.r);
            if (t) { res = engine.rotate(h.q, h.r); continue; }
            const slot = state.hand.findIndex(k => k === 'BELT');
            const legal = slot >= 0 && engine.legalPlacements('BELT').has(g.Hex.key(h.q, h.r));
            if (legal) { res = engine.place(slot, h.q, h.r, f); continue; }
            // A spring only on a straight run of 3 (it flings 3 hexes).
            const straight = todo + 3 < path.length &&
                [1, 2].every(k => dirTo(g, path[todo + k], path[todo + k + 1]) === f);
            const any = state.hand.findIndex(k => k === 'SPRING' && straight);
            if (any >= 0 && engine.legalPlacements(state.hand[any]).has(g.Hex.key(h.q, h.r))) {
                res = engine.place(any, h.q, h.r, f); continue;
            }
        }
        // Discard: a bridge on far water, a wall/other off-path, else wait.
        const onPath = new Set(path.map(p => g.Hex.key(p.q, p.r)));
        let done = false;
        for (let slot = 0; slot < state.hand.length && !done; slot++) {
            const kind = state.hand[slot];
            if (kind === 'BELT' && todo >= 0) continue;   // keep belts for the path
            // A discarded puller must not reach the path: pick a spot and facing whose
            // near and far hexes are both off it.
            const reachesPath = (k, f) => {
                if (kind !== 'PULLER') return false;
                const { q, r } = g.Hex.fromKey(k), d = g.NEIGHBOR_DIRS[f];
                return onPath.has(g.Hex.key(q + d.q, r + d.r)) || onPath.has(g.Hex.key(q + 2 * d.q, r + 2 * d.r));
            };
            let pickSpot = null;
            for (const k of engine.legalPlacements(kind)) {
                if (onPath.has(k)) continue;
                const f = [0, 1, 2, 3, 4, 5].find(f => !reachesPath(k, f));
                if (f !== undefined) { pickSpot = { k, f }; break; }
            }
            if (!pickSpot) continue;
            const { q, r } = g.Hex.fromKey(pickSpot.k);
            res = engine.place(slot, q, r, pickSpot.f);
            done = res.ok;
        }
        if (!done) res = engine.wait();
    }
    results.push(state.gameWon ? state.turn : CAP);
    lostTotal += state.lost;
}

results.sort((a, b) => a - b);
const q = p => results[Math.floor(p * (results.length - 1))];
const wins = results.filter(t => t < CAP).length;
console.log(`games ${GAMES}  won ${wins}  turns p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  ` +
    `crates lost/game ${(lostTotal / GAMES).toFixed(2)}`);
