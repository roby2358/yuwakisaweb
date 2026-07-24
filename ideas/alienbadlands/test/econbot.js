// test/econbot.js — greedy prospector bot for economy pacing
//
// Plays the intended loop headlessly: ride to the nearest live node, dismount,
// harvest until the bags are full, ride home, sell at the best of the known markets,
// craft a priority list at the starport, buy the ticket when affordable. Reports the
// day the ticket lands (DYNAMICS.md targets roughly day 40–60 for competent play) and
// what killed the run's tempo (deaths, bikes lost).
//
// Persistent harness: rerun with `node test/econbot.js` after tuning numbers.

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
    return vm.runInContext('({ GameArtifacts, GameState, GameEngine, Rando, Hex, bfsHexes })', ctx);
}

const CRAFT_ORDER = ['rack1', 'blaster1', 'engine1', 'harv1', 'vest', 'rack2',
    'engine2', 'blaster2', 'plate1', 'harv2', 'cloak'];

function runSeed(seed, maxDays, log) {
    const ctx = makeContext();
    const engine = new ctx.GameEngine(new ctx.GameState());
    const { NODES } = ctx.GameArtifacts;
    engine.newGame(seed);
    const s = engine.state;
    const hexDist = (a, b) => new ctx.Hex(a.q, a.r).distance(new ctx.Hex(b.q, b.r));
    let deaths = 0, bikesLost = 0, kills = 0;

    const cargoTotal = () => Object.values(s.player.cargo).reduce((a, n) => a + n, 0);

    const nearestNode = (from) => {
        let best = null, bestD = Infinity;
        for (const h of s.hexes.values()) {
            if (!NODES[h.terrain] || !(h.yield > 0)) continue;
            const d = hexDist(from, h);
            if (d < bestD) { bestD = d; best = h; }
        }
        return best;
    };

    const bestMarket = () => {
        // Rough value of the current bags at each settlement; pick value minus a
        // per-hex travel discount so nearby weak markets can still win.
        let best = null, bestV = -Infinity;
        for (const loc of s.settlements) {
            let v = 0;
            for (const [mat, n] of Object.entries(s.player.cargo))
                v += n * engine.price(mat, loc);
            v -= hexDist(s.player, loc) * 2;
            if (v > bestV) { bestV = v; best = loc; }
        }
        return best;
    };

    for (let day = 1; day <= maxDays; day++) {
        let hadBike = !!s.bike;
        for (let acts = 0; acts < 20 && s.mp > 0; acts++) {
            const loc = engine.locationAt(s.player);
            const full = cargoTotal() >= engine.stats().cargo;

            // At the starport: craft from the bags first, then sell the rest.
            if (loc && loc.kind === 'starport') {
                for (const id of CRAFT_ORDER) {
                    const u = ctx.GameArtifacts.UPGRADES.find(u => u.id === id);
                    if (!s.upgrades.includes(id) && engine.canCraft(u)) engine.craft(id);
                }
                if (!s.bike && s.player.credits >= ctx.GameArtifacts.ECON.BIKE + 200)
                    engine.buyBike();
                if (engine.buyTicket().ok)
                    return { day, deaths, bikesLost, kills, credits: s.player.credits };
            }
            if (loc && cargoTotal() > 0)
                for (const mat of Object.keys({ ...s.player.cargo })) engine.sell(mat, 999);
            if (loc && s.bike && s.bike.q === s.player.q && s.bike.r === s.player.r)
                engine.repairBike();

            // Standing on a live node: dismount if needed, then harvest.
            if (!full && engine.nodeAt(s.player) && s.player.mounted && s.mp >= 1) {
                if (engine.toggleMount().ok) continue;
            }
            if (!full && engine.nodeAt(s.player) && !s.player.mounted && s.mp >= 2) {
                if (engine.harvest().ok) continue;
            }

            // Take free swings at anything in reach (bounty income).
            const attackable = [...engine.computeAttackable()];
            if (attackable.length) {
                const [q, r] = attackable[0].split(',').map(Number);
                const before = s.bandits.length + s.predators.length;
                if (engine.attack(q, r).ok) {
                    if (s.bandits.length + s.predators.length < before) kills++;
                    continue;
                }
            }

            // Pick a goal: starport when the next craft is funded and bagged, market
            // when full (or nothing left to gather), else the nearest live node.
            const nextCraft = CRAFT_ORDER.map(id => ctx.GameArtifacts.UPGRADES.find(u => u.id === id))
                .find(u => !s.upgrades.includes(u.id));
            const craftReady = nextCraft && s.player.credits >= nextCraft.credits &&
                Object.entries(nextCraft.mats).every(([m, n]) => (s.player.cargo[m] || 0) >= n);
            const ticketReady = s.player.credits >= ctx.GameArtifacts.ECON.TICKET;
            const node = (full || craftReady || ticketReady) ? null : nearestNode(s.player);
            const goal = (craftReady || ticketReady) ? s.settlements[0] : (node ?? bestMarket());
            if (!goal) break;
            const goalD = hexDist(s.player, goal);
            if (goalD === 0) break;   // standing on a spent goal; wait for tomorrow

            // Mount for long hauls, dismount when the node is close.
            if (!s.player.mounted && s.bike && s.bike.q === s.player.q &&
                s.bike.r === s.player.r && goalD > 4 && s.mp >= 1)
                engine.toggleMount();
            if (s.player.mounted && node && goalD <= 1 && s.mp >= 1)
                engine.toggleMount();

            // Step: reachable hex nearest the goal along real foot paths (a BFS
            // distance field avoids straight-line local minima behind crags/acid).
            const { FOOT_COST } = ctx.GameArtifacts;
            const field = ctx.bfsHexes(goal, s.hexes,
                h => FOOT_COST[h.terrain] ?? Infinity, Infinity);
            const reachable = engine.computeReachable();
            const myD = field.get(`${s.player.q},${s.player.r}`) ?? Infinity;
            let step = null, stepD = myD;
            for (const key of reachable.keys()) {
                const d = field.get(key) ?? Infinity;
                if (d < stepD) { stepD = d; step = key.split(',').map(Number); }
            }
            if (!step) break;
            engine.movePlayer(step[0], step[1]);
        }
        const events = engine.endTurn();
        deaths += events.filter(e => e.type === 'death').length;
        if (hadBike && !s.bike) bikesLost++;
        if (log && day % 10 === 0) {
            const nodes = [...s.hexes.values()].filter(h => NODES[h.terrain] && h.yield > 0).length;
            const wealth = Math.round(s.settlements.reduce((a, l) => a + l.wealth, 0) / s.settlements.length);
            console.log(`  day ${day}: ${s.player.credits} cr, nodes ${nodes}, avg wealth ${wealth}, ` +
                `upgrades [${s.upgrades.join(',')}], deaths ${deaths}, kills ${kills}`);
        }
    }
    return { day: null, deaths, bikesLost, kills, credits: s.player.credits };
}

const seeds = process.argv[2] ? [Number(process.argv[2])] : [7, 21, 99, 555, 1234, 8080];
const results = [];
for (const seed of seeds) {
    const r = runSeed(seed, 150, seeds.length === 1);
    results.push(r);
    console.log(`seed ${seed}: ` + (r.day
        ? `TICKET on day ${r.day}`
        : `no ticket by day 150 (${r.credits} cr)`) +
        ` — deaths ${r.deaths}, bikes lost ${r.bikesLost}, kills ${r.kills}`);
}
const done = results.filter(r => r.day);
if (done.length)
    console.log(`ticket days: [${done.map(r => r.day).join(', ')}] ` +
        `avg ${(done.reduce((a, r) => a + r.day, 0) / done.length).toFixed(1)}`);
