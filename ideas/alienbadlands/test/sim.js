// test/sim.js — headless verification sim for Dustrunner
//
// Loads the DOM-free half of the game (artifacts, libs, state, engine) into a vm
// context and drives it like a reckless player for many in-game days, checking
// invariants every day. Persistent harness: rerun with `node test/sim.js` after any
// engine change. No test framework — throws on the first violated invariant.
//
// Checks:
//   - world generation succeeds and places all locations inside the foot region
//   - a random-walk player survives N days without NaN/negative credits, cargo
//     overflow, or anyone standing on impassable terrain
//   - save/load roundtrip preserves the world and can keep simulating
//   - same seed -> identical world (determinism)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['artifacts.js', 'displayartifacts.js', 'rando.js', 'hex.js',
    'gamestate.js', 'gameengine.js'];

function makeContext() {
    const ctx = { Math, console, JSON, Infinity, NaN };
    vm.createContext(ctx);
    for (const f of FILES)
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    // Top-level consts live in the context's lexical scope, not on the object — lift them.
    return vm.runInContext(
        '({ GameArtifacts, GameState, GameEngine, Rando, Hex })', ctx);
}

function assert(cond, msg) {
    if (!cond) throw new Error('INVARIANT: ' + msg);
}

function checkInvariants(ctx, engine, day) {
    const s = engine.state;
    const { FOOT_COST, BIKE_COST } = ctx.GameArtifacts;
    const at = (p) => s.hexes.get(`${p.q},${p.r}`);

    assert(Number.isFinite(s.player.credits) && s.player.credits >= 0,
        `credits bad on day ${day}: ${s.player.credits}`);
    const st = engine.stats();
    const total = Object.values(s.player.cargo).reduce((a, n) => a + n, 0);
    assert(total <= st.cargo, `cargo overflow on day ${day}: ${total}/${st.cargo}`);
    assert(s.player.hp > 0 && s.player.hp <= st.maxHp, `player hp bad on day ${day}: ${s.player.hp}`);

    const pcost = s.player.mounted ? BIKE_COST : FOOT_COST;
    assert(pcost[at(s.player).terrain] !== Infinity,
        `player on impassable terrain on day ${day} (mounted=${s.player.mounted})`);
    if (s.player.mounted) assert(s.bike && s.bike.q === s.player.q && s.bike.r === s.player.r,
        `mounted but bike elsewhere on day ${day}`);
    if (s.bike) assert(BIKE_COST[at(s.bike).terrain] !== Infinity, `bike on impassable terrain day ${day}`);

    for (const b of s.bandits)
        assert(FOOT_COST[at(b).terrain] !== Infinity, `bandit on impassable terrain day ${day}`);
    for (const p of s.predators) {
        const K = ctx.GameArtifacts.PREDATOR_KINDS[p.kind];
        const t = at(p).terrain;
        const okTerrain = t === ctx.GameArtifacts.TERRAIN.ACID
            ? K.crossesAcid : FOOT_COST[t] !== Infinity;
        assert(okTerrain, `${p.kind} on bad terrain day ${day}`);
        assert(!engine.inFence(p), `${p.kind} inside a sonic fence day ${day}`);
    }
    for (const loc of s.settlements)
        assert(loc.wealth >= 0 && Number.isFinite(loc.wealth), `wealth bad at ${loc.name} day ${day}`);
}

// A reckless random player: rides/walks around, harvests when standing on a node,
// attacks anything in reach, sells everything at any market, ends the day.
function playDay(ctx, engine) {
    const s = engine.state;
    const R = () => Math.random();

    for (let acts = 0; acts < 12 && s.mp > 0; acts++) {
        // Sell out at a market, and occasionally toggle mount
        const loc = engine.locationAt(s.player);
        if (loc) for (const mat of Object.keys(s.player.cargo)) engine.sell(mat, 999);
        if (R() < 0.15) engine.toggleMount();

        if (engine.nodeAt(s.player) && !s.player.mounted && s.mp >= 2 && R() < 0.8) {
            const res = engine.harvest();
            if (res.ok) continue;
        }
        const attackable = [...engine.computeAttackable()];
        if (attackable.length && R() < 0.7) {
            const [q, r] = attackable[0].split(',').map(Number);
            const res = engine.attack(q, r);
            if (res.ok) continue;
        }
        const reachable = [...engine.computeReachable().keys()];
        if (!reachable.length) break;
        const key = reachable[Math.floor(R() * reachable.length)];
        const [q, r] = key.split(',').map(Number);
        const res = engine.movePlayer(q, r);
        assert(res.ok, 'engine rejected a hex it reported reachable');
    }
    engine.campAt(s.player) && engine.raidCamp();
    return engine.endTurn();
}

function run() {
    // --- Determinism: same seed, same world ---
    const ctxA = makeContext();
    const a = new ctxA.GameEngine(new ctxA.GameState());
    a.newGame(1234);
    const ctxB = makeContext();
    const b = new ctxB.GameEngine(new ctxB.GameState());
    b.newGame(1234);
    assert(JSON.stringify(a.state.toJSON()) === JSON.stringify(b.state.toJSON()),
        'same seed produced different worlds');
    console.log('determinism: ok');

    // --- Generation sanity across seeds ---
    for (const seed of [1, 42, 999, 31337, 271828]) {
        const ctx = makeContext();
        const engine = new ctx.GameEngine(new ctx.GameState());
        engine.newGame(seed);
        const s = engine.state;
        assert(s.settlements.length === 1 + 3 + 6, `seed ${seed}: settlement count ${s.settlements.length}`);
        assert(s.camps.length === 4, `seed ${seed}: camp count`);
        assert(s.predators.length === 5, `seed ${seed}: predator count`);
        for (const loc of [...s.settlements, ...s.camps])
            assert(engine.region().has(`${loc.q},${loc.r}`), `seed ${seed}: location off-region`);
        const nodes = [...s.hexes.values()].filter(h => ctx.GameArtifacts.NODES[h.terrain]);
        assert(nodes.length >= 30, `seed ${seed}: only ${nodes.length} nodes placed`);
        assert(nodes.every(h => h.yield > 0), `seed ${seed}: node without yield`);
    }
    console.log('generation: ok (5 seeds)');

    // --- Long random-walk sim + mid-run save/load roundtrip ---
    const ctx = makeContext();
    let engine = new ctx.GameEngine(new ctx.GameState());
    engine.newGame(777);
    let allEvents = 0;
    for (let day = 1; day <= 150; day++) {
        const events = playDay(ctx, engine);
        allEvents += events.length;
        checkInvariants(ctx, engine, day);

        if (day === 75) {
            const snap = JSON.stringify(engine.state.toJSON());
            const restored = ctx.GameState.fromJSON(JSON.parse(snap));
            assert(JSON.stringify(restored.toJSON()) === snap, 'save/load roundtrip drifted');
            engine = new ctx.GameEngine(restored);
            console.log('save/load roundtrip at day 75: ok');
        }
    }
    const s = engine.state;
    console.log(`sim: 150 days ok — day ${s.day}, ${s.player.credits} cr, ` +
        `${s.bandits.length} bandits, ${s.predators.length} predators, ` +
        `${s.camps.length} camps, ${s.caches.length} caches, ${allEvents} events, ` +
        `bike ${s.bike ? 'alive' : 'lost'}, seen ${s.seen.size} hexes`);

    // --- Scenarios: the signature moments, staged deterministically ---
    {
        const c = makeContext();
        const e = new c.GameEngine(new c.GameState());
        e.newGame(9); // eslint-disable-line
        const s = e.state;
        const far = [...e.region().keys()]
            .map(k => s.hexes.get(k))
            .find(h => !e.inFence(h) &&
                new c.Hex(h.q, h.r).distance(new c.Hex(s.settlements[0].q, s.settlements[0].r)) > 10 &&
                new c.Hex(h.q, h.r).neighbors().some(n => {
                    const nh = s.hexes.get(n.key());
                    return nh && !e.inFence(nh) && c.GameArtifacts.FOOT_COST[nh.terrain] !== Infinity;
                }));
        const nb = new c.Hex(far.q, far.r).neighbors().map(n => s.hexes.get(n.key()))
            .find(h => h && !e.inFence(h) && c.GameArtifacts.FOOT_COST[h.terrain] !== Infinity);

        // Gravemaw vs. mounted player: bike swallowed whole, rider dismounted alive.
        s.player.q = far.q; s.player.r = far.r; s.player.mounted = true;
        s.bike = { q: far.q, r: far.r, hp: 4 };
        s.bandits = [];
        s.predators = [{ q: nb.q, r: nb.r, kind: 'gravemaw', hp: 16 }];
        let ev = e.endTurn();
        assert(ev.some(x => x.type === 'bike-eaten'), 'gravemaw did not eat the bike');
        assert(s.bike === null && !s.player.mounted && s.player.hp > 0,
            'bike-eaten aftermath wrong');

        // Death is a corpse run: cache holds cargo + half credits, player at starport.
        s.predators = [{ q: nb.q, r: nb.r, kind: 'gravemaw', hp: 16 }];
        s.player.q = far.q; s.player.r = far.r;
        s.player.hp = 1; s.player.credits = 100; s.player.cargo = { ore: 3 };
        ev = e.endTurn();
        assert(ev.some(x => x.type === 'death'), 'staged death did not happen');
        const sp = s.settlements[0];
        assert(s.player.q === sp.q && s.player.r === sp.r, 'no respawn at starport');
        assert(s.player.credits === 50, `half credits kept, got ${s.player.credits}`);
        const cache = s.caches.find(x => x.q === far.q && x.r === far.r);
        assert(cache && cache.credits === 50 && cache.cargo.ore === 3, 'corpse cache wrong');

        // Harvest to depletion reverts the node terrain.
        s.predators = [];
        const node = [...s.hexes.values()].find(h => c.GameArtifacts.NODES[h.terrain]);
        const base = c.GameArtifacts.NODES[node.terrain].base;
        s.player.q = node.q; s.player.r = node.r; s.player.mounted = false;
        s.player.cargo = {};
        while (node.yield > 0) { s.mp = 5; assert(e.harvest().ok, 'harvest refused'); }
        assert(node.terrain === base && node.yield === null, 'depleted node did not revert');

        // Camp raid: guards block, empty camp pays its bank.
        const camp = s.camps[0];
        s.player.q = camp.q; s.player.r = camp.r; s.player.cargo = {};
        s.bandits = [{ q: nb.q, r: nb.r, hp: 3, gang: camp.gang, loot: 0, target: null }];
        s.bandits[0].q = camp.q; s.bandits[0].r = camp.r + 1;
        assert(e.raidCamp().reason === 'guards', 'guarded camp was raidable');
        s.bandits = [];
        const bank = camp.bank, before = s.player.credits;
        assert(e.raidCamp().ok, 'raid failed on empty camp');
        assert(s.player.credits === before + bank, 'camp bank not paid');
        assert((s.player.cargo.tag || 0) === 2, 'camp raid tags missing');

        // Wealth and demand move the price.
        const town = s.settlements.find(l => l.kind === 'town');
        town.demand.ore = 1.5; town.wealth = 100;
        const rich = e.price('ore', town);
        town.wealth = 20;
        assert(e.price('ore', town) < rich, 'wealth does not affect price');
        console.log('scenarios: ok');
    }

    // --- Economy smoke: crafting works when funded ---
    const ctx2 = makeContext();
    const e2 = new ctx2.GameEngine(new ctx2.GameState());
    e2.newGame(55);
    const s2 = e2.state;
    s2.player.credits = 5000;
    s2.player.cargo = { ore: 3 };
    const res = e2.craft('engine1');
    assert(res.ok, 'craft engine1 failed at starport with funds');
    assert(e2.stats().bikeMp === 12, 'engine1 did not raise bike MP');
    assert(!e2.craft('engine1').ok, 'crafted the same upgrade twice');
    assert(!e2.craft('engine3').ok, 'tier gate ignored');
    const t = e2.buyTicket();
    assert(t.ok && s2.gameWon, 'ticket purchase failed');
    console.log('economy: ok');

    console.log('ALL CHECKS PASSED');
}

run();
