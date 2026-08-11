// test/sim.js — headless engine simulation
//
// Verifies the DOM-free half of the game (artifacts, libs, state, engine) in Node:
// concatenates the plain-script globals into one vm context (top-level class/const
// declarations are lexical, so they must share a single script), then drives a greedy
// bot through whole games and asserts invariants every turn.
//
// Run:  node test/sim.js              # stat matrix over seeds x escape thresholds
//       node test/sim.js <seed> [n]   # replay one game verbosely (escape after n relics)
//
// The bot: head for the nearest known untaken tomb; with none known, head for the
// nearest unexplored passable hex (it routes with an omniscient cost field, but every
// move still goes through engine.movePlayer, so fog and hunter legality are enforced
// by the rules under test); once it carries its escape quota, run for the boat.
// It plays greedily, not well — the point is that the rules never crash, never break
// their invariants, and produce the difficulty gradient DYNAMICS.md asks for:
// escape-with-1 mostly wins, escape-with-5 is near-miss territory.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['artifacts.js', 'displayartifacts.js', 'rando.js', 'hex.js',
    'gamestate.js', 'gameengine.js'];
const source = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

const driver = `
const TURN_CAP = 150;

function assert(cond, msg) {
    if (!cond) throw new Error('INVARIANT: ' + msg);
}

function checkInvariants(engine) {
    const s = engine.state;
    const H = GameArtifacts.HUNTER;

    const playerHex = s.hexes.get(Hex.key(s.player.q, s.player.r));
    assert(playerHex && engine.isPassable(playerHex), 'player on impassable hex');
    assert(playerHex.explored, 'player on unexplored hex');
    assert(s.mp >= 0, 'player MP negative: ' + s.mp);

    assert(s.hunters.length <= H.MAX, 'hunter cap exceeded: ' + s.hunters.length);
    const seen = new Set();
    for (const h of s.hunters) {
        const key = Hex.key(h.q, h.r);
        const hex = s.hexes.get(key);
        assert(hex && engine.isPassable(hex), 'hunter on impassable hex ' + key);
        assert(!seen.has(key), 'hunters stacked at ' + key);
        seen.add(key);
        assert([2, 3, 4].includes(h.speed), 'bad hunter speed: ' + h.speed);
        if (!s.gameLost)
            assert(key !== Hex.key(s.player.q, s.player.r), 'hunter on player without loss');
    }

    assert(s.carried === s.relics.filter(t => t.taken).length, 'carried != tombs taken');
    if (s.gameWon) {
        assert(s.player.q === s.boat.q && s.player.r === s.boat.r, 'won away from boat');
        assert(s.carried > 0, 'won empty-handed');
    }
}

// Binary-heap Dijkstra over the whole map, ignoring fog — the bot's omniscient
// routing field. extraCost(hex) lets a caller make hexes near hunters expensive so
// routes bend around the pack. Legality is still the engine's job.
function dijkstraFrom(start, engine, extraCost) {
    const s = engine.state;
    const dist = new Map([[Hex.key(start.q, start.r), 0]]);
    const heap = [[0, start.q, start.r]];
    const push = (e) => {
        heap.push(e);
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]];
                i = m;
            }
        }
        return top;
    };
    while (heap.length) {
        const [d, q, r] = pop();
        if (d > (dist.get(Hex.key(q, r)) ?? Infinity)) continue;
        for (const n of new Hex(q, r).neighbors()) {
            const hex = engine.state.hexes.get(n.key());
            if (!hex) continue;
            const c = engine.moveCost(hex);
            if (c === Infinity) continue;
            const nd = d + c + extraCost(hex);
            if (nd < (dist.get(n.key()) ?? Infinity)) {
                dist.set(n.key(), nd);
                push([nd, n.q, n.r]);
            }
        }
    }
    return dist;
}

// Where the bot wants to be, given how greedy this run is.
function botGoal(engine, escapeAt, fromPlayer) {
    const s = engine.state;
    if (s.carried >= escapeAt) return s.boat;

    const known = s.relics.filter(t =>
        !t.taken && s.hexes.get(Hex.key(t.q, t.r)).explored);
    const reachCost = t => fromPlayer.get(Hex.key(t.q, t.r)) ?? Infinity;
    const nearest = list => list.reduce((a, b) => reachCost(b) < reachCost(a) ? b : a);
    if (known.length) return nearest(known);

    const frontier = engine.passableHexes().filter(h =>
        !h.explored && fromPlayer.has(Hex.key(h.q, h.r)));
    if (frontier.length) return nearest(frontier);
    return s.boat;   // nothing left to find — leave with what we have
}

// One player phase: repeatedly move toward the goal until MP, progress, or the game
// runs out. Returns whatever ended the phase.
function takeTurn(engine, escapeAt, verbose) {
    const s = engine.state;
    // Hunters stand still during the player phase, so a hunter-avoiding cost field
    // computed here is valid for the whole turn: hexes near a hunter cost extra,
    // and routes bend around the pack the way a person's would.
    const danger = hex => {
        const h = new Hex(hex.q, hex.r);
        let worst = 0;
        for (const hunter of s.hunters) {
            const d = h.distance(hunter);
            if (d <= 2) worst = Math.max(worst, 25);
            else if (d <= 4) worst = Math.max(worst, 8);
        }
        return worst;
    };
    const flat = () => 0;

    let goalKey = null, fromGoal = null;
    let guard = 0;
    while (s.phase === 'player' && !s.gameWon && !s.gameLost && guard++ < 20) {
        const fromPlayer = dijkstraFrom(s.player, engine, flat);
        const goal = botGoal(engine, escapeAt, fromPlayer);
        if (Hex.key(goal.q, goal.r) !== goalKey) {
            goalKey = Hex.key(goal.q, goal.r);
            fromGoal = dijkstraFrom(goal, engine, danger);
        }

        // Hunter fear: the chosen hex is usually where the turn ends, so landing
        // inside a hunter's kill reach (its MP budget, axially — conservative) is
        // near-suicide and scored accordingly; merely close costs a detour's worth.
        const reach = hunter => hunter.speed + (s.night ? 1 : 0);
        const fear = key => {
            const h = Hex.fromKey(key);
            let worst = 0;
            for (const hunter of s.hunters) {
                const d = h.distance(hunter);
                if (d <= reach(hunter)) worst = Math.max(worst, 5000);
                else if (d <= reach(hunter) + 2) worst = Math.max(worst, 250);
            }
            return worst;
        };

        const reachable = engine.computeReachable();
        let bestKey = null, bestScore = Infinity;
        for (const [key, mpCost] of reachable) {
            const g = fromGoal.get(key);
            if (g === undefined) continue;
            const score = g * 100 + mpCost + fear(key);
            if (score < bestScore) { bestScore = score; bestKey = key; }
        }
        const here = fromGoal.get(Hex.key(s.player.q, s.player.r)) ?? Infinity;
        if (bestKey === null || (fromGoal.get(bestKey) ?? Infinity) >= here) {
            // Progress is blocked. Standing still with hunters closing is suicide —
            // flee: maximize distance to the nearest hunter, tie-break toward the goal.
            const p = new Hex(s.player.q, s.player.r);
            const nearestHunter = hs => Math.min(Infinity,
                ...s.hunters.map(h => hs.distance(h)));
            if (s.hunters.length === 0 || nearestHunter(p) > 4) break;
            let fleeKey = null, fleeScore = -Infinity;
            for (const [key] of reachable) {
                const h = Hex.fromKey(key);
                const score = nearestHunter(h) * 1000 - (fromGoal.get(key) ?? 500);
                if (score > fleeScore) { fleeScore = score; fleeKey = key; }
            }
            if (fleeKey === null) break;
            const f = Hex.fromKey(fleeKey);
            if (nearestHunter(f) <= nearestHunter(p)) break;   // cornered — nothing helps
            const fled = engine.movePlayer(f.q, f.r);
            assert(fled.ok, 'bot chose an illegal flee to ' + fleeKey);
            if (fled.won || fled.caught || fled.endedTurn) return fled;
            continue;
        }

        const dest = Hex.fromKey(bestKey);
        const res = engine.movePlayer(dest.q, dest.r);
        assert(res.ok, 'bot chose an illegal move to ' + bestKey);
        if (verbose && res.relic)
            console.log('  turn ' + s.turn + ': relic taken (' + s.carried + ' carried, '
                + s.hunters.length + ' hunters)');
        if (res.won || res.caught || res.endedTurn) return res;
    }
    engine.endTurn();
    return {};
}

function playGame(seed, escapeAt, verbose) {
    const state = new GameState();
    const engine = new GameEngine(state);
    engine.newGame(seed);
    const ocean = engine.oceanKeys();
    assert(new Hex(state.boat.q, state.boat.r).neighbors().some(n => ocean.has(n.key())),
        'boat not on an ocean waterfront');
    checkInvariants(engine);

    while (!state.gameWon && !state.gameLost && state.turn <= TURN_CAP) {
        takeTurn(engine, escapeAt, verbose);
        checkInvariants(engine);
        if (verbose) {
            const p = new Hex(state.player.q, state.player.r);
            const dists = state.hunters.map(h => p.distance(h)).sort((a, b) => a - b);
            console.log('  turn ' + state.turn + ': P(' + p.q + ',' + p.r + ') mp reset,'
                + ' carried ' + state.carried
                + ', hunter dists [' + dists.join(',') + ']');
        }
    }

    const result = state.gameWon ? 'win' : state.gameLost ? 'caught' : 'timeout';
    if (verbose)
        console.log('  ' + result + ' on turn ' + state.turn + ' with '
            + state.carried + '/' + GameArtifacts.RELIC.COUNT + ' relics, '
            + state.hunters.length + ' hunters afield');
    return { result, turns: state.turn, carried: state.carried };
}

function runMatrix(seeds, thresholds) {
    console.log('seeds 1..' + seeds + ', escape thresholds ' + thresholds.join('/'));
    for (const escapeAt of thresholds) {
        const tally = { win: 0, caught: 0, timeout: 0, turns: 0, carried: 0 };
        for (let seed = 1; seed <= seeds; seed++) {
            const g = playGame(seed, escapeAt, false);
            tally[g.result]++;
            tally.turns += g.turns;
            tally.carried += g.carried;
        }
        console.log('escape@' + escapeAt
            + '  wins ' + tally.win + '/' + seeds
            + '  caught ' + tally.caught
            + '  timeout ' + tally.timeout
            + '  avg turns ' + (tally.turns / seeds).toFixed(1)
            + '  avg relics ' + (tally.carried / seeds).toFixed(1));
    }
}

if (ARGS.length > 0) {
    const seed = Number(ARGS[0]);
    const escapeAt = ARGS.length > 1 ? Number(ARGS[1]) : GameArtifacts.RELIC.COUNT;
    console.log('seed ' + seed + ', escape@' + escapeAt);
    playGame(seed, escapeAt, true);
} else {
    runMatrix(30, [1, 3, 5]);
}
console.log('OK: all invariants held');
`;

const context = { console, ARGS: process.argv.slice(2), Math };
vm.createContext(context);
try {
    vm.runInContext(source + '\n' + driver, context);
} catch (err) {
    console.error('SIM FAILURE: ' + err.message);
    process.exit(1);
}
