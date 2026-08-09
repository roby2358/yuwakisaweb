// test/sim.js — headless engine simulation
//
// Verifies the DOM-free half of the game (artifacts, libs, state, engine) in Node:
// concatenates the plain-script globals into one vm context (top-level class/const
// declarations are lexical, so they must share a single script), then drives a greedy
// bot through whole games and asserts invariants every turn.
//
// Run:  node test/sim.js [seed ...]
//
// The bot: build any producer it's standing on, pay Monument stages, otherwise walk
// toward whatever the economy lacks (forest -> quarry -> gold vein -> Monument),
// recruiting when affordable. It plays badly but legally — the point is that the
// rules never crash, never go negative, and remain winnable.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['artifacts.js', 'displayartifacts.js', 'rando.js', 'colortheory.js',
    'hex.js', 'gamestate.js', 'gameengine.js'];
const source = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

const driver = `
function assert(cond, msg) {
    if (!cond) throw new Error('INVARIANT: ' + msg);
}

function checkInvariants(engine) {
    const s = engine.state;
    for (const [k, v] of Object.entries(s.resources))
        assert(v >= 0, k + ' went negative: ' + v);
    const seen = new Set();
    for (const w of s.workers) {
        const key = Hex.key(w.q, w.r);
        assert(!seen.has(key), 'workers stacked at ' + key);
        seen.add(key);
        assert(w.mp >= 0, 'worker MP negative');
    }
    assert(s.beasts.length <= GameArtifacts.BEAST.MAX, 'beast cap exceeded');
    for (const b of s.buildings) {
        const hex = s.hexes.get(Hex.key(b.q, b.r));
        assert(GameArtifacts.BUILDINGS[b.type].terrain.includes(hex.terrain),
            b.type + ' on illegal terrain');
    }
    const stages = GameArtifacts.MONUMENT_STAGES.length;
    assert(s.monument.stage >= 0 && s.monument.stage <= stages, 'monument stage out of range');
}

// The terrain the bot should claim next, given what the economy lacks.
function goalHex(engine) {
    const s = engine.state;
    const T = GameArtifacts.TERRAIN;
    const income = engine.incomePerTurn();
    const wants = [];
    if (income.wood < 4) wants.push(T.FOREST);
    if (income.stone < 4) wants.push(T.QUARRY);
    if (s.monument.stage >= 1 && income.gold < 1) wants.push(T.GOLD);
    for (const t of wants) {
        const open = [...s.hexes.values()]
            .filter(h => h.terrain === t && !engine.buildingAt(h.q, h.r));
        if (open.length > 0) return open;
    }
    return [s.monument];
}

// A* to the nearest goal, then step to the furthest path hex reachable this turn.
// Global vision, per the design notes: greedy strictly-closer movement wedges on
// coastline detours. Falls back to greedy if the planned path is blocked by beasts.
function stepToward(engine, worker, goals) {
    const here = new Hex(worker.q, worker.r);
    goals.sort((a, b) => here.distance(a) - here.distance(b));
    const goal = goals[0];
    const hexAt = (q, r) => engine.state.hexes.get(Hex.key(q, r));
    const path = findPath(here, new Hex(goal.q, goal.r),
        (q, r) => { const h = hexAt(q, r); return h !== undefined && engine.isPassable(h); },
        (q, r) => engine.moveCost(hexAt(q, r)),
        Infinity);

    const reachable = engine.computeReachable(worker);
    let dest = null;
    if (path) {
        for (const p of path) if (reachable.has(p.key())) dest = p;
    }
    if (!dest) {
        let bestDist = Math.min(...goals.map(g => here.distance(g)));
        for (const key of reachable.keys()) {
            const h = Hex.fromKey(key);
            const d = Math.min(...goals.map(g => h.distance(g)));
            if (d < bestDist) { dest = h; bestDist = d; }
        }
    }
    if (!dest) return false;
    assert(engine.moveWorker(worker.id, dest.q, dest.r).ok, 'reachable move refused');
    return true;
}

function actWorker(engine, worker) {
    while (worker.mp > 0) {
        const options = engine.buildOptions(worker);
        const monument = options.find(o => o.action === 'monument' && o.enabled);
        if (monument) {
            const res = engine.buildMonumentStage(worker.id);
            assert(res.ok, 'enabled monument build refused');
            if (res.won) return;
            continue;
        }
        const producer = options.find(o => o.action === 'building' && o.enabled &&
            GameArtifacts.BUILDINGS[o.type].produces);
        if (producer) {
            assert(engine.build(worker.id, producer.type).ok, 'enabled build refused');
            continue;
        }
        if (!stepToward(engine, worker, goalHex(engine))) return;
    }
}

function runSim(seed, maxTurns) {
    const state = new GameState();
    const engine = new GameEngine(state);
    engine.newGame(seed);
    checkInvariants(engine);

    let smashed = 0;
    while (!state.gameWon && state.turn <= maxTurns) {
        for (const worker of [...state.workers]) {
            actWorker(engine, worker);
            if (state.gameWon) break;
        }
        // Recruit only once wood income runs, so the bot can't bankrupt its economy.
        while (!state.gameWon && state.workers.length < 8 &&
               engine.incomePerTurn().wood >= 4 &&
               engine.canAfford(engine.recruitCost())) {
            if (!engine.recruit().ok) break;
        }
        if (!state.gameWon) smashed += engine.endTurn().events.length;
        checkInvariants(engine);
    }
    // A lost game must still be winnable in principle: the board can never
    // become disconnected (roads/buildings only ever lower movement costs).
    if (!state.gameWon)
        assert(engine.hasPath(state.workers[0], state.monument),
            'monument unreachable from worker 1');
    return {
        seed, won: state.gameWon, turns: state.turn,
        workers: state.workers.length, buildings: state.buildings.length,
        beasts: state.beasts.length, smashed,
        monumentStage: state.monument.stage, resources: { ...state.resources }
    };
}
`;

const seeds = process.argv.length > 2
    ? process.argv.slice(2).map(Number)
    : [1, 2, 3, 42, 1234];

let failed = false;
for (const seed of seeds) {
    try {
        // Fresh context per seed: the bundle's top-level declarations can't redeclare.
        const r = vm.runInNewContext(
            source + driver + `\nrunSim(${seed}, 400)`, { console },
            { filename: 'sim-bundle.js' });
        console.log(`seed ${r.seed}: ${r.won ? 'WON in ' + r.turns + ' turns' : 'not won by turn ' + (r.turns - 1)}` +
            ` | stage ${r.monumentStage}/3, ${r.workers} workers, ${r.buildings} buildings,` +
            ` ${r.beasts} beasts, ${r.smashed} smashed, stock w${r.resources.wood}/s${r.resources.stone}/g${r.resources.gold}`);
    } catch (err) {
        failed = true;
        console.error(`seed ${seed}: FAILED — ${err.message}`);
    }
}
process.exit(failed ? 1 : 0);
