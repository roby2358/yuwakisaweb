// test/sim.js — tuning harness:  node test/sim.js <games> <size>   (size: a MAP_SIZES key)
//
// A greedy builder bot: lay belts along the shortest land path from source to target,
// facing each one at the next hex. A spring stands in for a belt on a straight run of 3.
// Every other card (Puller, Rocket, Wall, Bridge, Slide, and a Spring off a straight run) is
// thrown away with discard() (the bot doesn't plan pulls or flights). Reports turns to the first
// milestone (FIRST_MILESTONE crates). Before then only the first UNLOCKS step is dealt (Belt,
// Bridge, Wall, Trap; D-30), so in practice the bot builds from Belts alone. Not a test (no pass/fail); it's the evidence behind
// FIRST_MILESTONE, SPAWN_INTERVAL, CRATE_HEXES_PER_CAP and friends. Also prints the mean and peak crates on the board.
'use strict';

const { newGame } = require('./helpers/load');

const GAMES = Number(process.argv[2]);
const SIZE = process.argv[3];
if (!(GAMES > 0) || !SIZE) { console.error('usage: node test/sim.js <games> <size>'); process.exit(2); }
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
let crateTicks = 0, ticks = 0, peak = 0;
const cratesOn = state => state.pieces.filter(p => p.kind === 'crate').length;
for (let i = 0; i < GAMES; i++) {
    const { g, state, engine } = newGame(5000 + i, SIZE);
    const goal = g.GameArtifacts.FIRST_MILESTONE;
    const path = shortestPath(engine, g, state.sources[0], state.targets[0]);
    let res = { ok: true };
    while (state.delivered < goal && state.turn < CAP) {
        const n = cratesOn(state);
        crateTicks += n; ticks++; peak = Math.max(peak, n);
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
            const slot = state.hand.findIndex(card => card.kind === 'BELT');
            const legal = slot >= 0 && engine.legalPlacements('BELT').has(g.Hex.key(h.q, h.r));
            if (legal) { res = engine.place(slot, h.q, h.r, f); continue; }
            // A spring only on a straight run of 3 (it flings 3 hexes).
            const straight = todo + 3 < path.length &&
                [1, 2].every(k => dirTo(g, path[todo + k], path[todo + k + 1]) === f);
            const any = state.hand.findIndex(card => card.kind === 'SPRING' && straight);
            if (any >= 0 && engine.legalPlacements(state.hand[any].kind).has(g.Hex.key(h.q, h.r))) {
                res = engine.place(any, h.q, h.r, f); continue;
            }
        }
        // While building, discard a card the path can't use; otherwise wait.
        const slot = todo >= 0 ? state.hand.findIndex(card => card.kind !== 'BELT') : -1;
        res = slot >= 0 ? engine.discard(slot) : engine.wait();
    }
    results.push(state.delivered >= goal ? state.turn : CAP);
    lostTotal += state.lost;
}

results.sort((a, b) => a - b);
const q = p => results[Math.floor(p * (results.length - 1))];
const wins = results.filter(t => t < CAP).length;
console.log(`${SIZE}  games ${GAMES}  reached first milestone ${wins}  turns p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  ` +
    `crates lost/game ${(lostTotal / GAMES).toFixed(2)}  crates on board mean ${(crateTicks / ticks).toFixed(1)} peak ${peak}`);
