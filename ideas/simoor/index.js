// index.js — The Night of the Simoor
//
// A bawdy farce of mistaken identity on a hex grid. Find the masked Sovereign among
// the impostors and woo them before the Vicomte de Vavoom does — without piling up so
// much Scandal that the Veil-Wardens throw you out. See DYNAMICS.md.
//
// Re-skin of the hex-and-counter base game. The input architecture (modal stack:
// overlay -> selection, phase-gated) and rendering scaffold are inherited from it; the
// domain (figures, the reveler crowd, Scandal, the rival) is new. The Vicomte uses the base
// game's A* (findPath) per the "rivals need global pathfinding" rule in UI_CONTROLS.

import {
    HEX_SIZE, ZONE, ZONE_COST, ZONE_SCANDAL, ZONE_GLAMOUR,
    POISE, RIVAL_POISE, MAX_TURNS, FIGURE_COUNT, GOSSIP_COUNT, FAVOR_COUNT, SCANDAL_CAP, WOO_SCANDAL,
    REVELER_COUNT, MAP_COLS, MAP_ROWS, COUNTER_SIZE,
    ZONE_COLORS, ZONE_NAMES, PLAYER_COLOR, RIVAL_COLOR, FIGURE_COLOR,
    UNMASKED_COLOR, INFORMANT_COLOR
} from './config.js';
import { Hex, bfsHexes, drawHexPath, findPath } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';

// ---- Botched-woo flavor ----
// A botched woo is the game's prime comedy crack. Two pools combine: an exclamation (the
// court's horrified delight, drawn for the player's scandal panel) and the saucy lesser
// aristocrat you actually threw yourself at. The Sapphire Court has no commoners — every
// blank veil hides a titled flirt — so the wrong target is always nobility, gendered to
// match the Sovereign you were hunting (SOUGHT, picked at the intro). PG-13 ribald.
const BOTCH_EXCLAMATIONS = [
    'Zounds!', 'Not again!', 'It cannot be!', 'Oh, the mortification!',
    'Heavens preserve us!', 'A scandal for the ages!', 'Gasps ripple to the rafters!',
    'Perish the thought — too late!', 'By the Sapphire Throne!', 'Sweet simoor, no!',
    'The whole court swoons!', 'Monocles drop into martinis!', 'Egad, the wrong veil!',
    'Tittering breaks out in three languages!', 'Somewhere a dowager faints!',
    'Disaster, darling — utter disaster!', 'The orchestra stumbles a note!',
    'Oh, you absolute calamity!', 'The fan-flutter heard round the hall!',
    'A thousand pardons will not cover this!'
];
const SAUCY_ARISTOCRATS = {
    M: [
        'a baronet who has been winking at everyone all night',
        'the notoriously over-perfumed Margrave of Lower Vant',
        'a viscount three goblets into the spiced wine',
        'a blushing young earl who quite forgets his own name',
        'the Sapphire Court’s most enthusiastic bachelor',
        'a lordling whose codpiece is, frankly, ambitious',
        'the Marquess of Quivering Repute',
        'a chevalier who returns the kiss with alarming gusto',
        'a count famous for losing his trousers at galas',
        'a dashing rake of no fixed estate',
        'the youngest baron, still giddy from his first masque',
        'a duke’s idle nephew — all hands and no title',
        'a velvet-clad fop fanning himself faster than the ladies',
        'the Knight of the Wandering Eye',
        'a smouldering envoy from the dune-courts',
        'a portly seneschal who takes it as a marriage proposal',
        'a poet-prince who at once composes an ode to your blunder',
        'the Vidame de Vexin, who has frankly been hoping for this',
        'a moustachioed cavalier mid-flirtation with a statue',
        'a giggling lord who faints clean into the topiary'
    ],
    F: [
        'a baroness who has been fluttering her lashes all night',
        'the notoriously scandalous Marchioness of Lower Vant',
        'a viscountess three goblets into the spiced wine',
        'a blushing young countess who quite forgets her own name',
        'the Sapphire Court’s most pursued widow',
        'a duchess whose neckline is, frankly, ambitious',
        'the Marquise of Quivering Repute',
        'a chevalière who returns the kiss with alarming gusto',
        'a contessa famous for losing her slippers at galas',
        'a notorious heartbreaker of no fixed estate',
        'the youngest baroness, still giddy from her first masque',
        'a duchess’s idle niece — all fan and no title',
        'a silk-draped coquette fanning herself faster than the lords',
        'the Lady of the Wandering Eye',
        'a smouldering envoy from the dune-courts',
        'a grand chatelaine who takes it as a marriage proposal',
        'a poet-princess who at once composes an ode to your blunder',
        'the Damoiselle de Vexin, who has frankly been hoping for this',
        'a feathered cavalière mid-flirtation with a statue',
        'a giggling lady who faints clean into the topiary'
    ]
};
// The saucy aristocrat you mistook for the Sovereign — always of the gender you sought.
function wrongAristocrat() { return Rando.choice(SAUCY_ARISTOCRATS[soughtGender]); }

// The triumphant "WOOED!" line — when you find the real Veiled Sovereign. Gendered to the
// Sovereign you sought (soughtGender), and just as ribald as the blunders. PG-13.
const WOOED_LINES = {
    M: [
        'You sweep the veil aside and the Sovereign himself blushes crimson — the court erupts.',
        'He takes your hand, and three duchesses faint from sheer envy.',
        'The masked lord melts at your bow — half the hall reaches for its smelling salts.',
        'You found him, you charmer — and the orchestra strikes up something indecent.',
        'The Veiled Sovereign lifts his mask and winks. The night, and quite a lot else, is yours.',
        'He whispers something unrepeatable behind his fan; you simply grin.',
        'You kneel, he laughs, and the whole Sapphire Court swoons as one.',
        'The Sovereign abandons all dignity and kisses your glove. Scandalous. Magnificent.',
        'He was hiding in plain sight, and now hides behind you. The gossips will dine out for a month.',
        'You unmask the right lord at last — and he had been hoping it would be you.',
        'The hall gasps as the Sovereign himself loosens his collar in your direction.',
        'He drops his goblet, drops his guard, and rather drops himself into your arms.',
        'You wooed the Veiled Sovereign and he forgot every line of protocol on the spot.',
        'The masked lord goes weak at the knees — the Veil-Wardens politely look away.',
        'He declares the masque a triumph and you its only worthy prize.',
        'You found him first; the Vicomte de Vavoom is left clutching the wrong elbow.',
        'The Sovereign tears off his mask, mutters “finally,” and the room dissolves into applause.',
        'He fans himself, flustered, and announces the next dance is entirely yours.',
        'You sweep him onto the floor; the dowagers clutch their pearls in delight.',
        'The Veiled Sovereign is yours, and the desert wind itself seems to sigh approvingly.'
    ],
    F: [
        'You sweep the veil aside and the Sovereign herself blushes crimson — the court erupts.',
        'She takes your hand, and three dukes faint from sheer envy.',
        'The masked lady melts at your bow — half the hall reaches for its smelling salts.',
        'You found her, you charmer — and the orchestra strikes up something indecent.',
        'The Veiled Sovereign lifts her mask and winks. The night, and quite a lot else, is yours.',
        'She whispers something unrepeatable behind her fan; you simply grin.',
        'You kneel, she laughs, and the whole Sapphire Court swoons as one.',
        'The Sovereign abandons all dignity and kisses your glove. Scandalous. Magnificent.',
        'She was hiding in plain sight, and now hides behind you. The gossips will dine out for a month.',
        'You unmask the right lady at last — and she had been hoping it would be you.',
        'The hall gasps as the Sovereign herself lets her fan slip in your direction.',
        'She drops her goblet, drops her guard, and rather drops herself into your arms.',
        'You wooed the Veiled Sovereign and she forgot every line of protocol on the spot.',
        'The masked lady goes weak at the knees — the Veil-Wardens politely look away.',
        'She declares the masque a triumph and you its only worthy prize.',
        'You found her first; the Vicomte de Vavoom is left clutching the wrong elbow.',
        'The Sovereign tears off her mask, mutters “finally,” and the room dissolves into applause.',
        'She fans herself, flustered, and announces the next dance is entirely yours.',
        'You sweep her onto the floor; the dowagers clutch their pearls in delight.',
        'The Veiled Sovereign is yours, and the desert wind itself seems to sigh approvingly.'
    ]
};
// The triumphant line for the Sovereign you actually sought.
function wooedLine() { return Rando.choice(WOOED_LINES[soughtGender]); }

// ---- Reveler state machine ----
// Every reveler wanders and blocks identically; the only thing that varies is what it
// carries. Claiming is the single transition. Claimability, the claim effect, and the
// rendered badge are all dispatched on `state` (see CLAIM and BADGE) — no scattered
// "if carries === ..." conditionals.
//
//   PLAIN                 (terminal — empty hands)
//   GOSSIP  --claim-->  GOSSIP_SPENT   (effect: claimer unmasks one impostor)
//   FAVOR   --claim-->  FAVOR_SPENT    (effect: first claim flushes the Sovereign)
const REV = {
    PLAIN: 'plain',
    GOSSIP: 'gossip', GOSSIP_SPENT: 'gossip-spent',
    FAVOR: 'favor', FAVOR_SPENT: 'favor-spent'
};

// Gender is pure flavor (it changes no mechanics): playerGender is your own presentation,
// soughtGender picks the Sovereign's pronouns and what the masked suspects look like.
const SOUGHT = {
    M: { subj: 'he', obj: 'him', one: 'masked lord' },
    F: { subj: 'she', obj: 'her', one: 'veiled lady' }
};
let playerGender = null;   // chosen on the intro panel before the night can begin
let soughtGender = null;

// ---- Game state ----
let hexes = null;
let player = null;          // { q, r, poise, scandal }
let rival = null;           // { q, r, poise, scandal, out }
let figures = [];           // [{ id, q, r, isSovereign, wooedBy, disguise }]
let revelers = [];          // [{ q, r, color, state, eliminates }] crowd: wander + block
let zoneColors = {};        // zone id -> hex color, regenerated each night (ColorTheory)
let lightPalette = [];      // lightened scheme, hex strings, for tinting revelers
let sovereignRevealed = false;  // flips true the first time any Favor is claimed
// Knowledge is private, per-agent: player.known / rival.known hold the figure ids each
// has personally unmasked. Claiming a Gossip informs only its claimer.
let turn = 1;
let banner = '';            // latest court happening, drawn center-top
let gameOver = null;        // { won, title, sub } or null

// ---- Input-layer state (see UI_CONTROLS.md) ----
let phase = 'player';       // L1.1 map input acts only on the player's turn
let selection = null;       // L1.2 { reachable, wooable, claimable } — each a Map<key, step|null>
let overlay = null;         // L5 input-capturing layer: 'intro' | 'scandal' | null
let scandalMsg = null;      // { exclaim, body } shown by the 'scandal' overlay
let hoveredHex = null;      // L1.3 hex under the cursor

// ---- View state ----
let panX = 0, panY = 0;
let panning = false;
let panStartX = 0, panStartY = 0;
let panOrigX = 0, panOrigY = 0;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}
window.addEventListener('resize', resize);

// ---- Coordinate helpers ----
function hexToScreen(q, r) {
    const p = new Hex(q, r).toPixel();
    return { x: p.x + panX, y: p.y + panY };
}

function screenToHex(sx, sy) {
    return Hex.fromPixel(sx - panX, sy - panY);
}

// ---- Zone passability (single source of truth) ----
function zoneCost(hex) {
    return ZONE_COST[hex.zone] ?? Infinity;
}

function zoneCostAt(q, r) {
    const hex = hexes.get(Hex.key(q, r));
    return hex ? zoneCost(hex) : Infinity;
}

function isPassable(hex) {
    return zoneCost(hex) !== Infinity;
}

function passableHexes() {
    const out = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) continue;
        if (!isPassable(hex)) continue;
        out.push(hex);
    }
    return out;
}

// ---- Occupancy lookups ----
function figureAt(q, r) {
    return figures.find(f => !f.wooedBy && f.q === q && f.r === r) ?? null;
}

function revelerAt(q, r) {
    return revelers.find(v => v.q === q && v.r === r) ?? null;
}

function figureByKey(key) {
    return figures.find(f => Hex.key(f.q, f.r) === key) ?? null;
}

function revelerByKey(key) {
    return revelers.find(v => Hex.key(v.q, v.r) === key) ?? null;
}

function isAdjacent(a, b) {
    return new Hex(a.q, a.r).distance(new Hex(b.q, b.r)) === 1;
}

// The Sovereign is disguised as a blank reveler until the first Favor is claimed.
function isHidden(f) {
    return f.isSovereign && !sovereignRevealed;
}

// Visible candidates for `agent`: not yet wooed, not personally unmasked. Until a Favor
// is claimed the whole court is masked — nobody is readable, so there are no woo targets
// at all (the only thing that can happen to a figure pre-Favor is the Sovereign trap).
function suspectFigures(agent) {
    if (!sovereignRevealed) return [];
    return figures.filter(f => !f.wooedBy && !agent.known.has(f.id));
}

// Revelers whose carried token can still be claimed. Favors are always claimable (claiming
// one is what opens the court); Gossips lie dormant until that first Favor reveals them.
function isClaimable(v) {
    if (v.state === REV.GOSSIP) return sovereignRevealed;
    return Boolean(CLAIM[v.state]);
}

function claimableRevelers() {
    return revelers.filter(isClaimable);
}

function carriersInState(state) {
    return revelers.filter(v => v.state === state);
}

// ---- Heightmap generation (diamond-square) ----
function diamondSquare(size, roughness) {
    const grid = new Float64Array(size * size);
    const get = (x, y) => grid[y * size + x];
    const set = (x, y, v) => { grid[y * size + x] = v; };

    set(0, 0, Math.random());
    set(size - 1, 0, Math.random());
    set(0, size - 1, Math.random());
    set(size - 1, size - 1, Math.random());

    let step = size - 1;
    let scale = roughness;
    while (step > 1) {
        const half = step / 2;
        for (let y = half; y < size - 1; y += step)
            for (let x = half; x < size - 1; x += step)
                set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                    get(x - half, y + half) + get(x + half, y + half)) / 4 +
                    (Math.random() - 0.5) * scale);
        for (let y = 0; y < size; y += half)
            for (let x = (y + half) % step; x < size; x += step) {
                let sum = 0, cnt = 0;
                if (x >= half) { sum += get(x - half, y); cnt++; }
                if (x + half < size) { sum += get(x + half, y); cnt++; }
                if (y >= half) { sum += get(x, y - half); cnt++; }
                if (y + half < size) { sum += get(x, y + half); cnt++; }
                set(x, y, sum / cnt + (Math.random() - 0.5) * scale);
            }
        step = half;
        scale *= roughness;
    }

    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
    for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
    return grid;
}

// ---- Court generation ----
function generateRectGrid() {
    const grid = new Map();
    const hm = diamondSquare(129, 0.55);

    for (let row = 0; row < MAP_ROWS; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col + qOffset;
            const r = row;
            const gx = Math.round(col / (MAP_COLS - 1) * 128);
            const gy = Math.round(row / (MAP_ROWS - 1) * 128);
            const elevation = hm[gy * 129 + gx];
            const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
            grid.set(Hex.key(q, r), { q, r, col, row, elevation, isEdge, zone: null });
        }
    }
    return grid;
}

// Elevation percentile sets the structural zones (walls + the watched colonnade); the
// social variety (ballroom/garden/alcove) is then scattered across the open floor.
function assignCourt() {
    const inner = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) { hex.zone = ZONE.POOL; continue; }
        inner.push(hex);
    }
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;

    for (let i = 0; i < n; i++) {
        const pct = i / n;
        if (pct < 0.06) inner[i].zone = ZONE.POOL;
        else if (pct < 0.90) inner[i].zone = ZONE.PROMENADE;
        else if (pct < 0.96) inner[i].zone = ZONE.COLONNADE;
        else inner[i].zone = ZONE.FOUNTAIN;
    }

    const floor = inner.filter(h => h.zone === ZONE.PROMENADE);
    Rando.shuffle(floor);
    const counts = [
        [ZONE.BALLROOM, Math.round(n * 0.14)],
        [ZONE.GARDEN, Math.round(n * 0.10)],
        [ZONE.ALCOVE, Math.round(n * 0.08)]
    ];
    let idx = 0;
    for (const [zone, count] of counts)
        for (let i = 0; i < count && idx < floor.length; i++, idx++) floor[idx].zone = zone;
}

// Choose `count` hexes from `pool`, spread at least `minDist` apart and away from `avoid`.
function pickSpread(pool, count, minDist, avoid) {
    const chosen = [];
    const taken = avoid.slice();
    for (const h of Rando.shuffle(pool.slice())) {
        if (chosen.length >= count) break;
        if (taken.every(o => new Hex(o.q, o.r).distance(new Hex(h.q, h.r)) >= minDist)) {
            chosen.push(h);
            taken.push(h);
        }
    }
    // Relax the spacing if a sparse map couldn't satisfy it.
    for (const h of pool) {
        if (chosen.length >= count) break;
        if (!chosen.includes(h)) chosen.push(h);
    }
    return chosen;
}

// Both rivals arrive together at the same end of the hall — the player and the Vicomte
// start on the same side, two distinct hexes in the left edge cluster, and race inward.
function placeAgents() {
    const passable = passableHexes().sort((a, b) => a.col - b.col);
    const edge = Math.max(4, Math.floor(passable.length * 0.04));
    const [start, near] = Rando.shuffle(passable.slice(0, edge)).slice(0, 2);
    player = { q: start.q, r: start.r, poise: POISE, scandal: 0, known: new Set() };
    rival = { q: near.q, r: near.r, poise: RIVAL_POISE, scandal: 0, out: false, known: new Set() };
}

// The 5 impostors show as `?` from the start; the Sovereign hides as a blank reveler
// (its `disguise` tint comes from the same lightened palette the crowd wears).
function placeFigures() {
    const pool = passableHexes();
    const spots = pickSpread(pool, FIGURE_COUNT, 3, [player, rival]);
    const sovereign = Rando.int(0, FIGURE_COUNT - 1);
    figures = spots.map((h, i) => ({
        id: i, q: h.q, r: h.r, isSovereign: i === sovereign, wooedBy: null,
        disguise: Rando.choice(lightPalette),
        strategy: 'random', target: null   // only the hidden Sovereign uses these (it wanders with the crowd)
    }));
}

// Pool stays blue and Fountain white; ColorTheory paints the five walkable zones afresh
// each night, squeezed into a muted mid-value band so the floor reads as traversable and
// the saturated counters pop against it (see squeezePalette). The squeeze keeps the
// luminance sort, so darkest -> Alcove (shadow) and brightest -> Ballroom (glamour) still
// falls out for free. Revelers tint off the un-squeezed scheme, so they stay vivid.
function lighten([r, g, b], amount) {
    return [r + (1 - r) * amount, g + (1 - g) * amount, b + (1 - b) * amount];
}

function generatePalette() {
    zoneColors = {
        [ZONE.POOL]: ZONE_COLORS[ZONE.POOL],
        [ZONE.FOUNTAIN]: ZONE_COLORS[ZONE.FOUNTAIN]
    };
    const scheme = ColorTheory.randomScheme(Math.random);
    const floor = ColorTheory.squeezePalette(scheme);   // muted, mid-value -> reads walkable
    const order = [ZONE.ALCOVE, ZONE.COLONNADE, ZONE.GARDEN, ZONE.PROMENADE, ZONE.BALLROOM];
    order.forEach((zone, i) => { zoneColors[zone] = ColorTheory.rgbToHex(...floor[i]); });
    lightPalette = scheme.map(c => ColorTheory.rgbToHex(...lighten(c, 0.5)));   // revelers stay vivid
}

// 12 revelers: the first GOSSIP_COUNT carry a Gossip (each the secret of one impostor),
// the next FAVOR_COUNT carry a Favor, the rest are plain. Gossips (4) < impostors (5),
// so you can never claim your way to certainty — the night always ends on a daring woo.
function placeRevelers() {
    const impostors = figures.filter(f => !f.isSovereign);
    const pool = passableHexes();
    const spots = pickSpread(pool, REVELER_COUNT, 1, [player, rival, ...figures]);
    revelers = spots.map((h, i) => {
        const rev = { q: h.q, r: h.r, color: Rando.choice(lightPalette), state: REV.PLAIN,
            eliminates: null, strategy: 'random', target: null };
        if (i < GOSSIP_COUNT) { rev.state = REV.GOSSIP; rev.eliminates = impostors[i].id; }
        else if (i < GOSSIP_COUNT + FAVOR_COUNT) { rev.state = REV.FAVOR; }
        return rev;
    });
}

function initGame() {
    let attempts = 0;
    do {
        hexes = generateRectGrid();
        assignCourt();
        placeAgents();
        attempts++;
    } while (!mapWellConnected(player) && attempts < 20);

    generatePalette();
    placeFigures();
    placeRevelers();
    turn = 1;
    sovereignRevealed = false;
    banner = '';
    gameOver = null;
    phase = 'player';
    selection = null;
    hoveredHex = null;
    centerOn(player);
    showOverlay('intro');
    resize();
}

// Both agents now start on the same side, so the old player<->rival path no longer
// guarantees the floor is traversable end to end. Instead require that one connected
// region (the player's) covers most of the open floor, so the Favors and figures scattered
// across the whole map are reachable rather than stranded behind a moat.
function mapWellConnected(from) {
    if (!from) return false;
    const costs = bfsHexes(from, hexes, zoneCost, Infinity);
    return costs.size >= passableHexes().length * 0.8;
}

function centerOn(hex) {
    const p = new Hex(hex.q, hex.r).toPixel();
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

function say(message) { banner = message; }

// ---- L1.2 Selection: compute legal sets up front; dispatch is then a pure lookup ----
function selectPlayer() {
    const reachable = computeReachable();
    selection = {
        reachable,
        wooable: computeApproach(reachable, suspectFigures(player)),
        claimable: computeApproach(reachable, claimableRevelers())
    };
}

function deselect() { selection = null; }

// Poise-bounded flood fill. Figures and the rival are walls — you woo from adjacent,
// you don't walk through people.
function computeReachable() {
    if (player.poise <= 0) return new Map();
    const blocked = new Set(figures.filter(f => !f.wooedBy).map(f => Hex.key(f.q, f.r)));
    for (const v of revelers) blocked.add(Hex.key(v.q, v.r));
    blocked.add(Hex.key(rival.q, rival.r));
    const costs = bfsHexes(player, hexes, hex => {
        if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
        return zoneCost(hex);
    }, player.poise);
    costs.delete(Hex.key(player.q, player.r));
    return costs;
}

// For each blocking target, the cheapest reachable hex adjacent to it (the "step"), or
// null if we're already adjacent. Targets we can't reach adjacency to are omitted. Used
// for both wooing figures and claiming from carrier revelers — you approach, you don't
// walk onto people.
function computeApproach(reachable, items) {
    const out = new Map();
    for (const it of items) {
        const key = Hex.key(it.q, it.r);
        if (isAdjacent(player, it)) { out.set(key, null); continue; }
        let best = null, bestCost = Infinity;
        for (const n of new Hex(it.q, it.r).neighbors()) {
            const cost = reachable.get(n.key());
            if (cost !== undefined && cost < bestCost) { bestCost = cost; best = { q: n.q, r: n.r }; }
        }
        if (best) out.set(key, best);
    }
    return out;
}

// Move the player onto (q, r), paying `cost`. (Claiming is a separate, deliberate click.)
function stepTo(q, r, cost) {
    player.q = q;
    player.r = r;
    player.poise -= cost;
}

function movePlayer(q, r) {
    const cost = selection.reachable.get(Hex.key(q, r));
    if (cost === undefined) return;
    stepTo(q, r, cost);
    if (gameOver) return;
    if (player.poise > 0) { selectPlayer(); render(); }
    else endTurn();
}

// ---- Claiming from a carrier reveler: the state-machine transition ----
// CLAIM is the single source of truth — claimableRevelers() reads it to know what can be
// claimed, claimReveler() reads it to advance state and fire the effect.
const CLAIM = {
    [REV.GOSSIP]: { next: REV.GOSSIP_SPENT, effect: claimGossip },
    [REV.FAVOR]: { next: REV.FAVOR_SPENT, effect: claimFavor }
};

function claimReveler(rev, agent) {
    const transition = CLAIM[rev.state];
    if (!transition) return;              // plain or already spent — nothing to claim
    rev.state = transition.next;
    transition.effect(rev, agent);
}

// A Gossip privately unmasks one impostor for the claimer only — and it's now spent, so
// whoever reaches it second gets nothing.
function claimGossip(rev, agent) {
    agent.known.add(rev.eliminates);
    say(agent === player
        ? `You charm a secret loose — one ${SOUGHT[soughtGender].one} is exposed! (${suspectFigures(player).length} still veiled to you)`
        : `The Vicomte charms a gossip first — a whispered secret you'll never hear.`);
}

// The first Favor claimed by anyone flushes the disguised Sovereign into view (a `?`).
function claimFavor(rev, agent) {
    if (sovereignRevealed) { say('Another rose claimed — but the Sovereign is already in play.'); return; }
    sovereignRevealed = true;
    const by = agent === player ? 'You claim' : 'The Vicomte claims';
    say(`${by} a favor — the Veiled Sovereign slips into view! Find ${SOUGHT[soughtGender].obj} among the ?'s.`);
}

// Player action: approach an adjacent carrier (move if needed) and claim what it holds.
// A claim is a commitment — it spends the rest of your Poise and ends the turn, the same
// shape as a woo. Leaning in to charm a token off someone costs you the night's tempo.
function claimFromReveler(key) {
    const rev = revelerByKey(key);
    if (!rev) return;
    const step = selection.claimable.get(key);
    if (step) stepTo(step.q, step.r, selection.reachable.get(Hex.key(step.q, step.r)));
    claimReveler(rev, player);
    player.poise = 0;
    endTurn();
}

// ---- The Sovereign trap: approaching royalty without an invitation (a Favor) ----
// Pre-Favor the Sovereign hides as a blank in the crowd. Lay hands on that blank — click
// it while adjacent — and the Veil-Wardens throw you out. A claimed Favor is your
// invitation: once the court is open the Sovereign becomes a `?` you may safely woo.
function isAdjacentHiddenSovereign(key) {
    const f = figureByKey(key);
    return Boolean(f && isHidden(f) && isAdjacent(player, f));
}

function breachSovereign() {
    deselect();
    setGameOver(false, 'EXPELLED',
        'You laid hands on the Veiled Sovereign uninvited! The Veil-Wardens hurl you into the dunes. Earn a favor first.');
}

// ---- Woo: the commit. Always ends the turn. ----
function wooFigure(key) {
    const step = selection.wooable.get(key);
    const figure = figureByKey(key);
    if (!figure) return;
    if (step) stepTo(step.q, step.r, selection.reachable.get(Hex.key(step.q, step.r)));
    deselect();
    resolveWoo(figure, player, () => {
        const s = SOUGHT[soughtGender];
        say(`You found ${s.obj} — the Veiled Sovereign! The night is yours.`);
        setGameOver(true, 'WOOED!', wooedLine());
    }, () => {
        // Too much scandal is the end of the night; otherwise the blunder gets its own
        // modal panel (exclamation + who you actually wooed) before the turn passes.
        if (player.scandal >= SCANDAL_CAP) {
            setGameOver(false, 'THROWN OUT', 'The Veil-Wardens escort you to the gutter. Too much scandal.');
            return;
        }
        showScandal(Rando.choice(BOTCH_EXCLAMATIONS),
            `You sink to one knee before… ${wrongAristocrat()}. The court gasps.`);
        endTurn();
    });
}

// Shared woo resolution for both agents. onWin / onBotch differ per agent: the player gets
// the scandal panel, the rival a banner — so each supplies its own botch presenter.
function resolveWoo(figure, agent, onWin, onBotch) {
    if (figure.isSovereign) {
        figure.wooedBy = (agent === player) ? 'player' : 'rival';
        onWin();
        return;
    }
    agent.scandal += Math.round(WOO_SCANDAL * ZONE_SCANDAL[hexes.get(Hex.key(agent.q, agent.r)).zone]);
    agent.known.add(figure.id);   // the rejected wooer learns who it wasn't — privately
    flounce(figure);
    onBotch();
}

function setGameOver(won, title, sub) {
    gameOver = { won, title, sub };
    deselect();
    render();
}

// ---- Turn flow ----
function endTurn() {
    if (gameOver) return;
    deselect();
    phase = 'enemy';
    moveRevelers();
    moveFigures();
    rivalTurn();
    if (gameOver) { render(); return; }
    turn++;
    if (turn > MAX_TURNS) {
        setGameOver(false, 'DAWN', 'The simoor fades, the masks come off, and you never found them. Next year.');
        return;
    }
    player.poise = POISE;
    phase = 'player';
    render();
}

// L2.1 the one context-sensitive primary action (the "Wait" button + Space/Enter).
function primaryAction() {
    if (overlay || gameOver || phase !== 'player') return;
    endTurn();
}

// ---- Masked figures drift, biased toward glamour ----
// Everything solid the wanderers route around: agents, figures (incl. the disguised
// Sovereign), and revelers.
function crowdedKeys() {
    const occupied = new Set([Hex.key(player.q, player.r), Hex.key(rival.q, rival.r)]);
    for (const f of figures) if (!f.wooedBy) occupied.add(Hex.key(f.q, f.r));
    for (const v of revelers) occupied.add(Hex.key(v.q, v.r));
    return occupied;
}

function moveFigures() {
    const occupied = crowdedKeys();

    for (const f of figures) {
        if (f.wooedBy || isHidden(f)) continue;   // the hidden Sovereign drifts with the crowd
        const options = [{ item: f, weight: ZONE_GLAMOUR[hexes.get(Hex.key(f.q, f.r)).zone] + 1 }];
        for (const n of new Hex(f.q, f.r).neighbors()) {
            const hex = hexes.get(n.key());
            if (!hex || !isPassable(hex) || occupied.has(n.key())) continue;
            options.push({ item: n, weight: ZONE_GLAMOUR[hex.zone] + 1 });
        }
        const dest = Rando.weighted(options);
        if (dest === f) continue;
        occupied.delete(Hex.key(f.q, f.r));
        f.q = dest.q;
        f.r = dest.r;
        occupied.add(Hex.key(f.q, f.r));
    }
}

// The ambient crowd has a little inertia. Each reveler keeps a wandering `strategy`; most
// turns it sticks with it, but 25% of turns it re-rolls (rerollStrategy) into one of three
// equally-likely modes — hold position, drift toward some other counter, or step to a
// random free neighbor. The modes are a dispatch table (REVELER_MOVE) keyed on `strategy`;
// each returns a destination hex or null, and a null (including any move it can't legally
// make this turn) means hold. Revelers block movement, so the open corridors shift each
// turn. While disguised, the Sovereign wanders with the crowd, indistinguishable from it.
const REVELER_RESTRATEGIZE = 0.25;

const REVELER_MOVE = {
    still: () => null,
    toward: (v, occupied) => stepToward(v, occupied),
    random: (v, occupied) => Rando.choice(freeNeighbors(v, occupied))
};

function rerollStrategy(v) {
    const roll = Rando.int(0, 2);
    if (roll === 0) { v.strategy = 'still'; v.target = null; }
    else if (roll === 1) { v.strategy = 'toward'; v.target = Rando.choice(otherCounters(v)); }
    else { v.strategy = 'random'; v.target = null; }
}

// Every other piece on the board a reveler could decide to drift toward.
function otherCounters(v) {
    const out = [player];
    if (!rival.out) out.push(rival);
    for (const f of figures) if (!f.wooedBy && f !== v) out.push(f);
    for (const u of revelers) if (u !== v) out.push(u);
    return out;
}

function freeNeighbors(v, occupied) {
    return new Hex(v.q, v.r).neighbors().filter(n => {
        const hex = hexes.get(n.key());
        return hex && isPassable(hex) && !occupied.has(n.key());
    });
}

// One greedy step toward the chosen counter: the free neighbor that strictly shortens the
// distance. No such neighbor (boxed in, target gone) -> null, i.e. hold position.
function stepToward(v, occupied) {
    const target = v.target;
    if (!target || target.wooedBy) return null;
    const goal = new Hex(target.q, target.r);
    let best = null, bestDist = new Hex(v.q, v.r).distance(goal);
    for (const n of freeNeighbors(v, occupied)) {
        const d = new Hex(n.q, n.r).distance(goal);
        if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
}

function moveRevelers() {
    const occupied = crowdedKeys();
    const crowd = sovereignRevealed ? revelers : [...revelers, figures.find(f => f.isSovereign)];
    for (const v of crowd) {
        if (Rando.bool(REVELER_RESTRATEGIZE)) rerollStrategy(v);
        const dest = REVELER_MOVE[v.strategy](v, occupied);
        if (!dest) continue;
        occupied.delete(Hex.key(v.q, v.r));
        v.q = dest.q;
        v.r = dest.r;
        occupied.add(Hex.key(v.q, v.r));
    }
}

// A botched woo sends the figure flouncing off to a distant, glamorous spot.
function flounce(figure) {
    const occupied = crowdedKeys();
    const far = passableHexes().filter(h =>
        !occupied.has(Hex.key(h.q, h.r)) &&
        ZONE_GLAMOUR[h.zone] >= 3 &&
        new Hex(h.q, h.r).distance(new Hex(figure.q, figure.r)) > 4);
    const dest = Rando.choice(far.length ? far : passableHexes());
    figure.q = dest.q;
    figure.r = dest.r;
}

// ---- The Vicomte de Vavoom (rival NPC) ----
// He plays by the same rules: only knows the gossips he claimed, pays the same zone costs
// at half Poise, and commits to a goal each turn. Plan -> walk (A*) -> act.
function rivalTurn() {
    if (gameOver || rival.out) return;
    rival.poise = RIVAL_POISE;
    const plan = rivalPlan();
    if (!plan) return;
    rivalWalkToward(plan);
    rivalAct(plan);
}

// Every plan is { kind: 'claim' | 'woo', target } — a blocking counter to approach.
// Before the reveal the Vicomte can't woo (the Sovereign is hidden), so he rushes a Favor.
function rivalPlan() {
    if (!sovereignRevealed) {
        const favor = nearestTo(rival, carriersInState(REV.FAVOR));
        if (favor) return { kind: 'claim', target: favor };
    }
    const suspects = suspectFigures(rival);
    if (suspects.length === 0) return null;
    const gossips = carriersInState(REV.GOSSIP);
    const turnsLeft = MAX_TURNS - turn;
    const gamble = suspects.length <= 2 || turnsLeft <= 3 || gossips.length === 0;
    if (!gamble) {
        const gossip = nearestTo(rival, gossips);
        if (gossip) return { kind: 'claim', target: gossip };
    }
    const figure = nearestTo(rival, suspects);
    return figure ? { kind: 'woo', target: figure } : null;
}

function nearestTo(from, items) {
    let best = null, bestDist = Infinity;
    for (const it of items) {
        const d = new Hex(from.q, from.r).distance(new Hex(it.q, it.r));
        if (d < bestDist) { bestDist = d; best = it; }
    }
    return best;
}

// A hex the rival may stand on (zones it can afford, nobody already there).
function rivalCanStand(q, r) {
    const hex = hexes.get(Hex.key(q, r));
    if (!hex || !isPassable(hex)) return false;
    if (player.q === q && player.r === r) return false;
    if (figureAt(q, r)) return false;
    if (revelerAt(q, r)) return false;
    return true;
}

// Targets all block their hex, so the Vicomte paths to the cheapest standable hex next
// to the target and acts from there.
function rivalWalkToward(plan) {
    const t = plan.target;
    const end = nearestTo(rival, new Hex(t.q, t.r).neighbors().filter(n => rivalCanStand(n.q, n.r)));
    if (!end || (rival.q === end.q && rival.r === end.r)) return;

    const path = findPath(
        { q: rival.q, r: rival.r }, end,
        (q, r) => rivalCanStand(q, r),
        (q, r) => zoneCostAt(q, r),
        9999);
    if (!path) return;

    let spent = 0;
    for (let i = 1; i < path.length; i++) {
        const h = path[i];
        if (!rivalCanStand(h.q, h.r)) break;
        const cost = zoneCostAt(h.q, h.r);
        if (spent + cost > rival.poise) break;
        rival.q = h.q;
        rival.r = h.r;
        spent += cost;
    }
}

function rivalAct(plan) {
    if (!isAdjacent(rival, plan.target)) return;   // didn't reach it this turn
    if (plan.kind === 'claim') { claimReveler(plan.target, rival); return; }
    resolveWoo(plan.target, rival, () => {
        setGameOver(false, 'OUT-CHARMED', 'The Vicomte de Vavoom finds the Sovereign first. Insufferable.');
    }, () => {
        if (rival.scandal >= SCANDAL_CAP) {
            rival.out = true;
            say('The Vicomte de Vavoom is thrown out in disgrace! The field is yours.');
            return;
        }
        say(`The Vicomte de Vavoom flings himself at ${wrongAristocrat()}. ${Rando.choice(BOTCH_EXCLAMATIONS)}`);
    });
}

// ---- Rendering ----
function onScreen(x, y) {
    return x >= -HEX_SIZE * 2 && x <= canvas.width + HEX_SIZE * 2 &&
        y >= -HEX_SIZE * 2 && y <= canvas.height + HEX_SIZE * 2;
}

function render() {
    ctx.fillStyle = '#0c0a10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const [, hex] of hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = zoneColors[hex.zone] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    if (selection) {
        for (const key of selection.reachable.keys()) tintHex(key, 'rgba(255, 235, 120, 0.28)');
        for (const key of selection.claimable.keys()) tintHex(key, 'rgba(120, 220, 255, 0.45)');
        for (const key of selection.wooable.keys()) tintHex(key, 'rgba(255, 90, 170, 0.4)');
    }

    for (const v of revelers) drawReveler(v);
    for (const f of figures) if (!f.wooedBy) drawFigure(f);

    if (!rival.out) {
        const { x, y } = hexToScreen(rival.q, rival.r);
        drawCounter(x, y, RIVAL_COLOR, 'V');
    }

    const p = hexToScreen(player.q, player.r);
    drawCounter(p.x, p.y, PLAYER_COLOR, 'You');
    if (selection) {
        const s = COUNTER_SIZE + 4;
        roundRect(ctx, p.x - s / 2, p.y - s / 2, s, s, 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawBanner();
    if (gameOver) drawGameOver();
    updateHUD();
}

function tintHex(key, color) {
    const { q, r } = Hex.fromKey(key);
    const { x, y } = hexToScreen(q, r);
    if (!onScreen(x, y)) return;
    drawHexPath(ctx, x, y, HEX_SIZE);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawFigure(f) {
    const { x, y } = hexToScreen(f.q, f.r);
    if (!onScreen(x, y)) return;
    // Until a Favor opens the court, every figure (impostors and the Sovereign alike)
    // wears a reveler's disguise and shows no `?` — indistinguishable from the crowd.
    if (!sovereignRevealed) { drawCounter(x, y, f.disguise, ''); return; }
    const known = player.known.has(f.id);   // you only see what you yourself have unmasked
    // Same stylized serif treatment as the reveler tokens (drawCenterGlyph): a blank
    // counter with the glyph laid on top, rather than drawCounter's plain monospace label.
    drawCounter(x, y, known ? UNMASKED_COLOR : FIGURE_COLOR, '');
    drawCenterGlyph(x, y, known ? { glyph: '✕', color: '#cfcfd8' } : { glyph: '?', color: '#f5e9c8' });
}

// BADGE dispatches the glyph drawn in the center of a reveler for each carry state. PLAIN
// has no entry, so plain revelers (and the disguised Sovereign) show as bare counters.
const BADGE = {
    [REV.GOSSIP]: { glyph: 'G', color: INFORMANT_COLOR },
    [REV.GOSSIP_SPENT]: { glyph: 'G', color: '#3a3a44' },
    [REV.FAVOR]: { glyph: '❀', color: '#ff5a8a' },
    [REV.FAVOR_SPENT]: { glyph: '❀', color: '#3a3a44' }
};

// Gossip glyphs stay hidden until the court opens (the first Favor); Favor glyphs always
// show — claiming one is how you open it.
function badgeFor(v) {
    if ((v.state === REV.GOSSIP || v.state === REV.GOSSIP_SPENT) && !sovereignRevealed) return null;
    return BADGE[v.state];
}

function drawReveler(v) {
    const { x, y } = hexToScreen(v.q, v.r);
    if (!onScreen(x, y)) return;
    drawCounter(x, y, v.color, '');
    const badge = badgeFor(v);
    if (badge) drawCenterGlyph(x, y, badge);
}

// The carried token, drawn large and centered on the counter with a dark halo so the
// color-coded glyph stays legible over any reveler tint.
function drawCenterGlyph(cx, cy, badge) {
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1620';
    ctx.strokeText(badge.glyph, cx, cy + 1);
    ctx.fillStyle = badge.color;
    ctx.fillText(badge.glyph, cx, cy + 1);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function contrastText(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.4 ? '#000' : '#fff';
}

function drawCounter(cx, cy, color, label) {
    const s = COUNTER_SIZE;
    const x = cx - s / 2, y = cy - s / 2;
    const r = 4;

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + r + i, y + s + 1 + i);
        ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
        ctx.lineTo(x + s + 1 + i, y + r + i);
        ctx.stroke();
    }

    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = contrastText(color);
    ctx.font = 'bold ' + Math.floor(s * (label.length > 1 ? 0.32 : 0.55)) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
}

function drawBanner() {
    if (!banner) return;
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(banner).width + 32;
    const cx = canvas.width / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    roundRect(ctx, cx - w / 2, 56, w, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#f0e0c0';
    ctx.fillText(banner, cx, 72);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = gameOver.won ? '#f0c850' : '#d06868';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gameOver.title, canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = '#eee';
    ctx.font = '18px monospace';
    ctx.fillText(gameOver.sub, canvas.width / 2, canvas.height / 2 + 8);
    ctx.fillStyle = '#aaa';
    ctx.font = '15px monospace';
    ctx.fillText('— click "New Night" to play again —', canvas.width / 2, canvas.height / 2 + 44);
}

function updateHUD() {
    document.getElementById('turn-info').textContent = MAX_TURNS - turn + 1;
    document.getElementById('poise-info').textContent = Math.max(0, player.poise) + '/' + POISE;
    document.getElementById('scandal-info').textContent = player.scandal + '/' + SCANDAL_CAP;
    document.getElementById('suspect-info').textContent =
        sovereignRevealed ? suspectFigures(player).length : '?';
    const h = hoveredHex && hexes.get(Hex.key(hoveredHex.q, hoveredHex.r));
    document.getElementById('hover-info').textContent = h ? (ZONE_NAMES[h.zone] ?? '—') : '—';
}

// ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panOrigX = panX;
        panOrigY = panY;
        e.preventDefault();
        return;
    }
    if (e.button !== 0) return;

    if (overlay) { dismissOverlay(); return; }   // L5 overlay captures & consumes the click
    if (gameOver) return;
    if (phase !== 'player') return;              // L1.1 map input is live only on the player's turn

    const hex = screenToHex(e.clientX, e.clientY);
    const key = Hex.key(hex.q, hex.r);

    if (!selection) {
        if (hex.q === player.q && hex.r === player.r) selectPlayer();
    } else if (hex.q === player.q && hex.r === player.r) {
        deselect();
    } else if (selection.wooable.has(key)) {
        wooFigure(key);
        return;   // wooFigure resolves and re-renders
    } else if (selection.claimable.has(key)) {
        claimFromReveler(key);
        return;   // claimFromReveler has already re-rendered
    } else if (selection.reachable.has(key)) {
        movePlayer(hex.q, hex.r);
        return;   // movePlayer has already re-rendered
    } else if (isAdjacentHiddenSovereign(key)) {
        breachSovereign();
        return;   // setGameOver re-renders
    } else {
        deselect();
    }
    render();
});

canvas.addEventListener('mousemove', e => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
        return;
    }
    const hex = screenToHex(e.clientX, e.clientY);
    const next = hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
    if (next?.q !== hoveredHex?.q || next?.r !== hoveredHex?.r) {
        hoveredHex = next;
        updateHUD();
    }
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 2) panning = false;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', primaryAction);
document.getElementById('new-game').addEventListener('click', initGame);
document.getElementById('begin-btn').addEventListener('click', dismissOverlay);
document.getElementById('scandal-ok').addEventListener('click', dismissOverlay);

// Gender toggles on the intro panel: one button stays active per axis.
function setGender(axis, val) {
    if (axis === 'player') playerGender = val;
    else soughtGender = val;
    for (const btn of document.querySelectorAll('.gsel'))
        if (btn.dataset.axis === axis) btn.classList.toggle('active', btn.dataset.val === val);
    document.getElementById('begin-btn').disabled = !genderChosen();
}
function genderChosen() { return Boolean(playerGender && soughtGender); }
for (const btn of document.querySelectorAll('.gsel'))
    btn.addEventListener('click', () => setGender(btn.dataset.axis, btn.dataset.val));

window.addEventListener('keydown', e => {
    if (overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        dismissOverlay();
        return;
    }
    if (e.key === 'Escape') { deselect(); render(); return; }
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        primaryAction();
    }
});

// ---- L5 Overlays ----
function showOverlay(name) {
    overlay = name;
    syncOverlayDom();
}

// Raise the scandal panel: an exclamation heading + the blunder it describes, dismissed
// with OK (or Space/Enter/Esc/click, like any overlay).
function showScandal(exclaim, body) {
    scandalMsg = { exclaim, body };
    showOverlay('scandal');
}

function dismissOverlay() {
    if (overlay === 'intro' && !genderChosen()) return;  // gate the night on the two choices
    overlay = null;
    syncOverlayDom();
    render();
}

function syncOverlayDom() {
    document.getElementById('intro-panel').classList.toggle('hidden', overlay !== 'intro');
    document.getElementById('scandal-panel').classList.toggle('hidden', overlay !== 'scandal');
    if (overlay === 'scandal' && scandalMsg) {
        document.getElementById('scandal-title').textContent = scandalMsg.exclaim;
        document.getElementById('scandal-body').textContent = scandalMsg.body;
    }
}

// ---- Start ----
initGame();
