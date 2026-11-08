// test/sim.js — the tuning harness:  node test/sim.js [games] [--maps] [--pull-early]
//
// Not a rule test (it isn't run by test/run.js). Two measurements, both seeded and DOM-free:
//
//  --maps   Wake geometry. For each map, the best single-rig result with no Sweepers, as a
//           fraction of all blocks, under three ways of using the rig: pulled after one
//           broadcast, pulled once it reaches TX_RANGE_MAX, and left on air for good. Each
//           runs the real Wake (growth + fading) until it settles. The anti-strategy "one
//           cluster wins alone" needs even "left on air" well under WIN_FRAC; the gaps
//           between the three are what leaving a rig on air is worth.
//  (games)  A greedy bot plays N games: outcome mix, turns to finish, peak awake, rigs lost.
//           The bot is deliberately simple (plan one cascade target at a time, avoid ending
//           in Sweeper reach); it measures whether the ecology is winnable, not optimal play.
'use strict';

const { newGame } = require('./helpers/load');

const args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) || 40);
const MAPS = args.includes('--maps');
const VERBOSE = args.includes('-v');
// --pull-early: the bot treats a rig as spent as soon as nothing is left to
// wake within TX_RANGE (the strike-and-pull habit), instead of waiting for it to grow to TX_RANGE_MAX.
const PULL_EARLY = args.includes('--pull-early');
const TRACE = args.includes('-t');   // per-turn log (use with a game count of 1 and --seed)
const SEED0 = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 9000;
// --set NAME=value,NAME=value overrides GameArtifacts numbers for a sweep.
const setArg = args[args.indexOf('--set') + 1];
const OVR = {};
if (args.includes('--set')) for (const kv of setArg.split(',')) { const [k, v] = kv.split('='); OVR[k] = Number(v); }

// Run the Wake to a fixed point with one extra rig at `extraKey` and no jamming.
// Returns the number of blocks that would end up awake (including those already awake).
// Frontier propagation over block indices precomputed once per engine (blocks never change).
function cascade(g, engine, extraKey, jam = new Set()) {
    const { TX_RANGE, WAKE_THRESHOLD } = g.GameArtifacts;
    const board = engine.board;
    if (!engine._idx) {
        const blocks = board.blocks();
        const index = new Map(blocks.map((h, i) => [g.Hex.key(h.q, h.r), i]));
        const keys = blocks.map(h => g.Hex.key(h.q, h.r));
        const nbrs = blocks.map(h => board.neighbors(h.q, h.r)
            .map(n => index.get(g.Hex.key(n.q, n.r))).filter(i => i !== undefined));
        engine._idx = { blocks, index, nbrs, keys };
    }
    const { blocks, index, nbrs, keys } = engine._idx;
    const awake = new Uint8Array(blocks.length);
    const count = new Uint8Array(blocks.length);
    const queue = [];
    const wake = i => { if (!awake[i] && !jam.has(keys[i])) { awake[i] = 1; queue.push(i); } };
    blocks.forEach((h, i) => { if (h.awake) { awake[i] = 1; queue.push(i); } });
    const rigs = engine.plantedRigs().map(r => r.key());
    if (extraKey) rigs.push(extraKey);
    for (const rk of rigs) {
        const { q, r } = g.Hex.fromKey(rk);
        for (const h of board.within(q, r, TX_RANGE)) {
            const i = index.get(g.Hex.key(h.q, h.r));
            if (i !== undefined) wake(i);
        }
    }
    let total = 0;
    while (queue.length) {
        const i = queue.pop();
        total++;
        for (const j of nbrs[i]) if (!awake[j] && ++count[j] >= WAKE_THRESHOLD) wake(j);
    }
    return total;
}

// One rig at `key` on an otherwise quiet map, run broadcast by broadcast until it settles.
// The rig is on air for the first `onAir` broadcasts (Infinity = never pulled); its range grows
// from TX_RANGE by one per broadcast up to TX_RANGE_MAX. Same synchronous wake/fade rule as the
// engine. Returns the settled awake count.
function settle(g, engine, key, onAir) {
    const A = g.GameArtifacts;
    if (!engine._idx) cascade(g, engine, null);   // builds the block index
    const { blocks, index, nbrs } = engine._idx;
    const { q, r } = g.Hex.fromKey(key);
    const ring = [];   // ring[d] = block indices exactly d away, d ≤ TX_RANGE_MAX
    for (let d = 0; d <= A.TX_RANGE_MAX; d++) ring.push([]);
    for (const h of engine.board.within(q, r, A.TX_RANGE_MAX)) {
        const i = index.get(g.Hex.key(h.q, h.r));
        if (i !== undefined) ring[new g.Hex(h.q, h.r).distance({ q, r })].push(i);
    }
    let awake = new Uint8Array(blocks.length);
    const held = new Uint8Array(blocks.length);
    const stopAfter = Math.min(onAir, A.TX_RANGE_MAX - A.TX_RANGE + 1);
    for (let t = 0; t < 400; t++) {
        const live = t < onAir;
        const range = Math.min(A.TX_RANGE + t, A.TX_RANGE_MAX);
        held.fill(0);
        if (live) for (let d = 0; d <= range; d++) for (const i of ring[d]) held[i] = 1;
        const next = new Uint8Array(blocks.length);
        let changed = false;
        for (let i = 0; i < blocks.length; i++) {
            let n = 0;
            for (const j of nbrs[i]) n += awake[j];
            next[i] = held[i] || (awake[i] ? n >= A.FADE_THRESHOLD : n >= A.WAKE_THRESHOLD) ? 1 : 0;
            if (next[i] !== awake[i]) changed = true;
        }
        awake = next;
        if (!changed && t >= stopAfter) break;   // settled, and the rig is pulled or fully grown
    }
    return awake.reduce((a, b) => a + b, 0);
}

function mapStudy() {
    const A = require('./helpers/load').newGame(1, OVR).g.GameArtifacts;
    const modes = [
        ['pulled after 1 broadcast', 1],
        ['pulled at TX_RANGE_MAX', A.TX_RANGE_MAX - A.TX_RANGE + 1],
        ['left on air', Infinity],
    ];
    const fracs = modes.map(() => []);
    for (let i = 0; i < N; i++) {
        const { g, engine } = newGame(5000 + i * 101, OVR);
        const blocks = engine.blockCount();
        const best = modes.map(() => 0);
        for (const h of engine.board.passableHexes()) {
            if ((h.q + 2 * h.r) % 3) continue;   // sample a third of the hexes; ranges overlap heavily
            const k = g.Hex.key(h.q, h.r);
            modes.forEach(([, onAir], m) => { best[m] = Math.max(best[m], settle(g, engine, k, onAir)); });
        }
        best.forEach((b, m) => fracs[m].push(b / blocks));
        if (VERBOSE) console.log(`map ${i}: blocks ${blocks}, ` + modes.map(([name], m) => `${name} ${(100 * best[m] / blocks).toFixed(1)}%`).join(', '));
    }
    console.log(`best single rig over ${N} maps (WIN_FRAC ${100 * A.WIN_FRAC}%):`);
    modes.forEach(([name], m) => {
        const f = fracs[m].sort((a, b) => a - b);
        const pct = p => (100 * f[Math.floor(p * (f.length - 1))]).toFixed(1) + '%';
        console.log(`  ${name.padEnd(26)} min ${pct(0)} median ${pct(0.5)} p90 ${pct(0.9)} max ${pct(1)}`);
    });
}

// ---- The bot ----
function playGame(seed) {
    const { g, state, engine } = newGame(seed, OVR);
    const { Hex, GameArtifacts: A } = g;
    if (TRACE) {
        const orig = engine.endTurn.bind(engine);
        engine.endTurn = () => {
            const res = orig();
            const p = state.player;
            console.log(`T${state.turn} @${p.key()} awake ${engine.awakeCount()}/${engine.winTarget()} rigs ${state.rigs.map(x => x.status[0]).join('')} ` +
                state.sweepers.map(w => `${w.kind[0]}${w.mp}:d${new Hex(w.q, w.r).distance(p)}:${w.target ? w.target.kind : '-'}`).join(' ') +
                ' ' + res.events.filter(e => e.type !== 'woke' && e.type !== 'moved').map(e => e.type).join(','));
            return res;
        };
    }
    let goal = null;   // committed hex key
    let mode = null;   // 'plant' | 'retrieve'
    let peak = 0;

    const playerCost = () => {
        const walls = engine.sweeperKeys();
        for (const k of engine.stationKeys()) walls.add(k);
        return hex => walls.has(Hex.key(hex.q, hex.r)) ? Infinity : engine.board.moveCost(hex);
    };
    // Danger of ending on a hex: Sweepers that could walk onto it next regime phase
    // (hex distance ≤ MP, a cheap upper bound on path reach), doubled if they'd see @ there.
    const danger = (key) => {
        const h = state.hexes.get(key);
        let d = 0;
        for (const sw of state.sweepers) {
            const dd = new Hex(sw.q, sw.r).distance(h);
            if (dd <= sw.mp) d += (!h.awake && dd <= A.SWEEPER_SIGHT + sw.mp) ? 2 : 1;
            else if (!h.awake && dd <= A.SWEEPER_SIGHT) d += 1;
        }
        return d;
    };
    const chooseGoal = () => {
        const jam = engine.jammedKeys();
        const base = cascade(g, engine, null, jam);
        const plan = dijkstraFromPlayer();
        let best = null, bestScore = 0;
        for (const [k, c] of plan.cost) {
            const { q, r } = Hex.fromKey(k);
            if (c > 8 * A.PLAYER_MP || engine.rigAt(q, r) || jam.has(k) || danger(k) > 0) continue;
            if (c > 2 * A.PLAYER_MP && (q + 2 * r) % 3) continue;   // sample the far field
            const gain = cascade(g, engine, k, jam) - base;
            const score = gain / (1 + c / A.PLAYER_MP);   // discount travel turns
            if (score > bestScore) { bestScore = score; best = k; }
        }
        if (TRACE) console.log(`  goal ${best} score ${bestScore.toFixed(1)}`);
        return best;
    };
    const reachableBy = k => state.sweepers.some(w => new Hex(w.q, w.r).distance(Hex.fromKey(k)) <= w.mp);
    const dijkstraFromPlayer = () => g.dijkstraHexes(state.player, state.hexes, playerCost());

    for (let guard = 0; guard < 400 && !state.outcome; guard++) {
        // Goal priority: rescue a rig a Sweeper has locked onto (if within two turns);
        // else, with nothing carried, fetch the nearest spent rig (nothing left to wake);
        // else plant toward the best cascade.
        const plan = dijkstraFromPlayer();
        const near = (rigs, maxCost) => rigs
            .filter(r => (plan.cost.get(r.key()) ?? Infinity) <= maxCost)
            .sort((a, b) => plan.cost.get(a.key()) - plan.cost.get(b.key()))[0];
        const hunted = new Set(state.sweepers.filter(w => w.target && w.target.kind === 'rig').map(w => w.target.key));
        // Only rescues we can finish: reach it and still have PLANT_MP this turn, before its hunter arrives.
        const rescue = near(engine.plantedRigs().filter(r => hunted.has(r.key()) && !reachableBy(r.key())),
            A.PLAYER_MP - A.PLANT_MP);
        // Spent: grown to full range with nothing left in it to wake.
        const jam = engine.jammedKeys();
        const spent = engine.plantedRigs().filter(r => PULL_EARLY
            ? engine.rigWakeSet(r.q, r.r, jam, A.TX_RANGE).length === 0   // base TX_RANGE, ignoring growth
            : engine.rigRange(r) === A.TX_RANGE_MAX && engine.rigWakeSet(r.q, r.r, jam, A.TX_RANGE_MAX).length === 0);
        if (rescue) { goal = rescue.key(); mode = 'retrieve'; }
        else if (engine.carriedRigs().length === 0) {
            const r = near(spent, Infinity);
            goal = r ? r.key() : null; mode = 'retrieve';
        } else if (mode !== 'plant' || !goal || engine.rigAt(...Object.values(Hex.fromKey(goal))) ||
                   (goal === state.player.key() && danger(goal) > 0)) {   // re-plan when the spot turned hot
            goal = chooseGoal(); mode = 'plant';
        }

        // Move toward the goal, ending on the closest safe reachable hex.
        if (goal && goal !== state.player.key()) {
            const { q: gq, r: gr } = Hex.fromKey(goal);
            const toGoal = g.dijkstraHexes({ q: gq, r: gr }, state.hexes, playerCost()).cost;
            const reach = engine.computeReachable();
            reach.set(state.player.key(), 0);
            let best = null, bestScore = Infinity;
            for (const [k, c] of reach) {
                const d = toGoal.get(k) ?? 1e6;
                const onHunted = hunted.has(k) && k !== goal ? 1 : 0;
                const camping = hunted.has(k) && reachableBy(k) ? 1 : 0;   // never wait on a rig a Sweeper will enter
                const score = d + (danger(k) + 3 * (onHunted + camping)) * 1000;   // safety first, then progress
                if (score < bestScore) { bestScore = score; best = k; }
            }
            if (best && best !== state.player.key()) {
                const { q, r } = Hex.fromKey(best);
                const res = engine.movePlayer(q, r);
                if (res.endedTurn) { peak = Math.max(peak, engine.awakeCount()); continue; }
            }
        }
        // Plant only where nothing threatens; retrieve unless a Sweeper can reach us this phase.
        if (goal === state.player.key()) {
            if (mode === 'plant' && engine.canPlant() && danger(goal) === 0) {
                const res = engine.plant(); goal = null;
                if (res.endedTurn) { peak = Math.max(peak, engine.awakeCount()); continue; }
            } else if (mode === 'retrieve' && engine.canRetrieve() && !reachableBy(goal)) {
                const res = engine.retrieve(); goal = null;
                if (res.endedTurn) { peak = Math.max(peak, engine.awakeCount()); continue; }
            }
        }
        if (!state.outcome) engine.endTurn();
        peak = Math.max(peak, engine.awakeCount());
    }
    return {
        outcome: state.outcome || 'timeout', turn: state.turn,
        peak: peak / engine.blockCount(),
        lost: state.rigs.filter(r => r.status === 'smashed').length,
        sweepers: state.sweepers.length
    };
}

if (MAPS) mapStudy();
else {
    const tally = {};
    const turns = [], peaks = [], lost = [];
    for (let i = 0; i < N; i++) {
        const r = playGame(SEED0 + i * 37);
        tally[r.outcome] = (tally[r.outcome] || 0) + 1;
        turns.push(r.turn); peaks.push(r.peak); lost.push(r.lost);
        if (VERBOSE) console.log(`game ${i}: ${r.outcome} turn ${r.turn} peak ${(100 * r.peak).toFixed(0)}% rigs lost ${r.lost} sweepers ${r.sweepers}`);
    }
    const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    console.log(`${N} bot games:`, JSON.stringify(tally));
    console.log(`median turn ${med(turns)}, median peak awake ${(100 * med(peaks)).toFixed(0)}%, median rigs lost ${med(lost)}`);
}
