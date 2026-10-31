// Headless sim: loads the DOM-free scripts into a vm context and runs real-time minutes in
// fast-forward under a few fixed queue strategies.
//   node test/sim.js [minutes=30] [seed=1]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGame() {
  const ctx = vm.createContext({ console, Math });
  for (const f of ['rng', 'data', 'names', 'map', 'engine']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return ctx.ID;
}

const ID = loadGame();
const E = ID.Engine;
const minutes = +process.argv[2] || 30;
const seed = +process.argv[3] || 1;
const only = process.argv[4] ? process.argv[4].split(',') : null;
const set = (name, v) => { if (name in ID.N) ID.N[name] = v; else throw new Error('unknown constant ' + name); };
// Override constants for tuning experiments: node test/sim.js 30 1 all MONSTER_DMG=7,MONSTER_HP=40
if (process.argv[5]) for (const kv of process.argv[5].split(',')) { const [k, v] = kv.split('='); set(k, +v); }

// Each strategy sets the queue once at the start.
const STRATEGIES = {
  starter: () => {},
  everything: g => { for (const id of g.available.slice()) E.queue(g, id, g.purchase.length); },
  nextFirst: g => {
    for (const id of g.available.slice()) E.queue(g, id, g.purchase.length);
    E.reorder(g, 'nextLevel', 0);
  },
  diveOnly: g => {
    for (const id of g.purchase.slice()) E.unqueue(g, id);
    E.queue(g, 'nextLevel', 0);
  },
  combatOnly: g => {
    for (const id of ['archer.speed', 'mage.radius', 'priest.healSpeed', 'warrior.armor', 'party.xpKill', 'nextLevel'])
      E.queue(g, id, g.purchase.length);
  },
};

function run(name) {
  const g = E.newGame(seed);
  STRATEGIES[name](g);
  const rows = [];
  let deaths = 0, stuckReported = false, last = { x: 0, y: 0, kills: -1 };
  const steps = Math.round(minutes * 60 / ID.N.TICK);
  const report = Math.round(Math.max(1, minutes / 6) * 60 / ID.N.TICK);
  for (let i = 1; i <= steps; i++) {
    E.step(g);
    for (const e of g.events) if (e.type === 'heroDied') deaths++;
    g.events = [];
    // Stuck detector: a full minute with no kills and the leader barely moving.
    if (i % Math.round(60 / ID.N.TICK) === 0) {
      const lead = E.leader(g);
      if (!stuckReported && g.kills === last.kills && Math.hypot(lead.x - last.x, lead.y - last.y) < ID.N.CELL) {
        stuckReported = true;
        console.log(`  STUCK at ${(i * ID.N.TICK / 60).toFixed(1)}m: ` + g.heroes.map(h =>
          `${h.cls}(${(h.x / ID.N.CELL).toFixed(2)},${(h.y / ID.N.CELL).toFixed(2)})${h.alive ? '' : ' dead'}`).join(' ') +
          ` goalRoom ${g.level.goalRoom} wipeTimer ${g.wipeTimer} target ${lead.targetId}`);
      }
      last = { x: lead.x, y: lead.y, kills: g.kills };
    }
    if (i % report === 0) {
      rows.push(`  ${String(Math.round(i * ID.N.TICK / 60)).padStart(3)}m depth ${g.depth} (best ${g.best})  ` +
        `xp ${g.xp.toFixed(0).padStart(7)}  earned ${g.earned.toFixed(0).padStart(8)}  kills ${g.kills}  deaths ${deaths}  wipes ${g.wipes}`);
    }
  }
  const lv = Object.entries(g.upgrades).filter(([, u]) => u.level).map(([id, u]) => `${id}:${u.level}`).join(' ');
  console.log(`== ${name}\n${rows.join('\n')}\n  levels: ${lv}`);
}

const t0 = Date.now();
for (const name of Object.keys(STRATEGIES)) if (!only || only.includes(name) || only[0] === 'all') run(name);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s wall)`);
