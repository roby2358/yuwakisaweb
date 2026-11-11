// test/sim.js — tuning harness:  node test/sim.js <games> <size> <milestones>   (size: a MAP_SIZES key)
//
// A greedy builder bot: lay belts along the shortest land path from source to target,
// facing each one at the next hex. A spring stands in for a belt on a straight run of 3.
// Every other card (Puller, Rocket, Wall, Bridge, Slide, and a Spring off a straight run) is
// thrown away with discard() (the bot doesn't plan pulls or flights). Reports turns to the first
// milestone (FIRST_MILESTONE crates), or with <milestones> above 1 plays on to that many
// milestones (still building only the first color's path) and reports turns to each one and
// the big crates spawned per game (D-34). Before then only the first UNLOCKS step is dealt (Belt,
// Bridge, Wall, Trap; D-30), so in practice the bot builds from Belts alone. Not a test (no pass/fail); it's the evidence behind
// FIRST_MILESTONE, SPAWN_INTERVAL, CRATE_HEXES_PER_CAP and friends. Also prints the mean and peak crates on the board.
'use strict';

const { newGame } = require('./helpers/load');

const GAMES = Number(process.argv[2]);
const SIZE = process.argv[3];
const MILESTONES = Number(process.argv[4]);
if (!(GAMES > 0) || !SIZE || !(MILESTONES >= 1)) { console.error('usage: node test/sim.js <games> <size> <milestones>'); process.exit(2); }
const CAP = 400 * MILESTONES;   // turns before a game is called off

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
let crateTicks = 0, ticks = 0, peak = 0, bigTotal = 0;
const reachedAt = [...Array(MILESTONES)].map(() => []);   // per milestone: the turn each game reached it
for (let i = 0; i < GAMES; i++) {
    const { g, state, engine } = newGame(5000 + i, SIZE);
    const { PIECES, nextMilestone, milestonesReached } = g.GameArtifacts;
    const cratesOn = st => st.pieces.filter(p => PIECES[p.kind].cargo).length;
    let goal = 0;
    for (let k = 0; k < MILESTONES; k++) goal = nextMilestone(goal);
    const seen = new Set();
    let marked = 0;
    const path = shortestPath(engine, g, state.sources[0], state.targets[0]);
    let res = { ok: true };
    while (state.delivered < goal && state.turn < CAP) {
        for (const p of state.pieces) if (p.kind === 'bigcrate' && !seen.has(p.id)) { seen.add(p.id); bigTotal++; }
        for (; marked < Math.min(MILESTONES, milestonesReached(state.delivered)); marked++) reachedAt[marked].push(state.turn);
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
            if (legal) { res = engine.place(slot, h.q, h.r, f, g.GameArtifacts.WHITE); continue; }
            // A spring only on a straight run of 3 (it flings 3 hexes).
            const straight = todo + 3 < path.length &&
                [1, 2].every(k => dirTo(g, path[todo + k], path[todo + k + 1]) === f);
            const any = state.hand.findIndex(card => card.kind === 'SPRING' && straight);
            if (any >= 0 && engine.legalPlacements(state.hand[any].kind).has(g.Hex.key(h.q, h.r))) {
                res = engine.place(any, h.q, h.r, f, g.GameArtifacts.WHITE); continue;
            }
        }
        // While building, discard a card the path can't use; otherwise wait.
        const slot = todo >= 0 ? state.hand.findIndex(card => card.kind !== 'BELT') : -1;
        res = slot >= 0 ? engine.discard(slot) : engine.wait();
    }
    for (; marked < Math.min(MILESTONES, milestonesReached(state.delivered)); marked++) reachedAt[marked].push(state.turn);
    results.push(state.delivered >= goal ? state.turn : CAP);
    lostTotal += state.lost;
}

results.sort((a, b) => a - b);
const q = p => results[Math.floor(p * (results.length - 1))];
const wins = results.filter(t => t < CAP).length;
const label = MILESTONES === 1 ? 'first milestone' : `milestone ${MILESTONES}`;
console.log(`${SIZE}  games ${GAMES}  reached ${label} ${wins}  turns p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  ` +
    `crates lost/game ${(lostTotal / GAMES).toFixed(2)}  crates on board mean ${(crateTicks / ticks).toFixed(1)} peak ${peak}`);
if (MILESTONES > 1) {
    const median = a => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
    console.log('  median turn per milestone: ' + reachedAt.map((a, k) => `#${k + 1} ${a.length ? median(a) : '-'} (${a.length})`).join('  ') +
        `  big crates spawned/game ${(bigTotal / GAMES).toFixed(1)}`);
}
