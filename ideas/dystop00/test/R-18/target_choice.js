// R-18: a Sweeper's target: if it sees @ (distance ≤ SWEEPER_SIGHT and @ not on an awake
// block) → @; else keep a still-valid commitment; else the nearest (by its plan cost) of its
// preferred kind — 'frontier' (a sleeping block with an awake neighbor) or 'rig' (a planted
// rig) — else the other kind; else a patrol hex.
'use strict';
const { quiet, interiorBlock, addSweeper, stageRig, parkPlayerAway } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(1818);
const { g, state, engine } = ctx;
const A = g.GameArtifacts, b = engine.board, H = g.Hex;
const plan = sw => g.dijkstraHexes(sw, state.hexes, engine.sweeperCostFn(sw));

const c = interiorBlock(ctx, 1);
parkPlayerAway(ctx, c.q, c.r, 15);
const hound = addSweeper(ctx, c.q, c.r, 3);      // prefers 'rig'
const warden = addSweeper(ctx, ...(() => { const n = b.neighbors(c.q, c.r)[0]; return [n.q, n.r]; })(), 0);

// No rigs, nothing awake → patrol.
engine.pickTarget(hound, plan(hound));
check('nothing to chase → patrol', hound.target && hound.target.kind === 'patrol');

// A rig and a frontier exist: each picks its preference.
const far = b.within(c.q, c.r, 3).filter(h => new H(h.q, h.r).distance(c) === 3);
stageRig(ctx, 0, far[0].q, far[0].r);
far[1].awake = true;                              // makes its sleeping block neighbors frontier
hound.target = null; warden.target = null;
engine.pickTarget(hound, plan(hound));
engine.pickTarget(warden, plan(warden));
check('Hound goes for the rig', hound.target.kind === 'rig' && hound.target.key === state.rigs[0].key());
check('Warden goes for a frontier block', warden.target.kind === 'frontier' && engine.isFrontier(state.hexes.get(warden.target.key)));
const wp = plan(warden);
const nearest = Math.min(...b.blocks().filter(h => engine.isFrontier(h)).map(h => wp.cost.get(H.key(h.q, h.r)) ?? Infinity));
check('…the nearest by plan cost', wp.cost.get(warden.target.key) === nearest);

// Commitment holds while valid, even if something nearer appears.
const kept = warden.target.key;
const nearer = b.neighbors(warden.q, warden.r).find(h => b.isBlock(h) && !h.awake);
if (nearer) b.neighbors(nearer.q, nearer.r).find(n => n !== nearer && b.isBlock(n) && !n.isEdge).awake = true;
engine.pickTarget(warden, plan(warden));
check('keeps a valid commitment', warden.target.key === kept || !engine.targetValid({ ...warden, target: { kind: 'frontier', key: kept } }));

// Fallback: a Hound with no rigs takes a frontier.
state.rigs[0].status = 'carried'; state.rigs[0].moveTo(null, null);
hound.target = null;
engine.pickTarget(hound, plan(hound));
check('Hound with no rigs falls back to the frontier', hound.target.kind === 'frontier');

// Sight: @ within SWEEPER_SIGHT on non-awake ground is seen and overrides everything.
const spot = b.within(hound.q, hound.r, A.SWEEPER_SIGHT).find(h => b.isPassable(h) && !h.awake &&
    !engine.sweeperKeys().has(H.key(h.q, h.r)) && new H(h.q, h.r).distance(hound) === A.SWEEPER_SIGHT);
state.player.moveTo(spot.q, spot.r);
engine.pickTarget(hound, plan(hound));
check('seen @ overrides', engine.sees(hound) && hound.target.kind === 'player' && hound.target.key === state.player.key());
// Shelter: the same @ on an awake block is not seen.
state.hexes.get(state.player.key()).awake = true;
check('awake block shelters @', !engine.sees(hound));
state.hexes.get(state.player.key()).awake = false;
// Out of sight range.
const away = b.passableHexes().find(h => new H(h.q, h.r).distance(hound) === A.SWEEPER_SIGHT + 1);
state.player.moveTo(away.q, away.r);
check('beyond SWEEPER_SIGHT is not seen', !engine.sees(hound));
done();
