// index.js — Super (superhero tactics) main game controller.

import { HEX_SIZE, TRACKS, START_DOWNTIME } from './config.js';
import {
    hexKey, hexToPixel, pixelToHex, hexDistance,
    hexNeighbors, drawHexPath, hexesInRange, bfsHexes
} from './hex.js';
import { generateMap, moveCostOf, coverOf } from './terrain.js';
import { POWERS } from './powers.js';
import { newCampaign, saveCampaign, loadCampaign, addXp } from './campaign.js';
import { runAttack } from './resolve.js';
import { Rando } from './rando.js';

// ------------------------------------------------------------------
// DOM references
// ------------------------------------------------------------------
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const heroNameEl = document.getElementById('heroName');
const hpValEl = document.getElementById('hpVal');
const hpMaxEl = document.getElementById('hpMax');
const apValEl = document.getElementById('apVal');
const apMaxEl = document.getElementById('apMax');
const statusValEl = document.getElementById('statusVal');
const turnPhaseEl = document.getElementById('turnPhase');
const missionNameEl = document.getElementById('missionName');
const powerListEl = document.getElementById('powerList');
const targetInfoEl = document.getElementById('targetInfo');
const logContentEl = document.getElementById('logContent');
const endTurnBtn = document.getElementById('endTurnBtn');
const sheetBtn = document.getElementById('sheetBtn');
const goalsBtn = document.getElementById('goalsBtn');
const newCampaignBtn = document.getElementById('newCampaignBtn');
const modalEl = document.getElementById('modal');
const modalBodyEl = document.getElementById('modalBody');
const modalCloseBtn = document.getElementById('modalClose');

// ------------------------------------------------------------------
// Game state
// ------------------------------------------------------------------
const state = {
    campaign: null,
    mission: null, // { map, enemies, hero, objective, turn, selectedPower, hoverHex }
    view: { offsetX: 60, offsetY: 40 }
};

// ------------------------------------------------------------------
// Logging
// ------------------------------------------------------------------
const log = (text, cls = '') => {
    const div = document.createElement('div');
    div.className = 'line' + (cls ? ' ' + cls : '');
    div.textContent = text;
    logContentEl.appendChild(div);
    logContentEl.scrollTop = logContentEl.scrollHeight;
    if (state.campaign) {
        state.campaign.log.push(text);
        if (state.campaign.log.length > 200) state.campaign.log.shift();
    }
};

// ------------------------------------------------------------------
// Mission setup
// ------------------------------------------------------------------
const MISSION_OFFERS = [
    { id: 'bankHeist',  name: 'Bank Heist',        archetype: 'city',  objective: 'defeat', enemies: 5, xp: { Popularity: 3, Underworld: 2 } },
    { id: 'fieldRiot',  name: 'Park Riot',         archetype: 'field', objective: 'defeat', enemies: 4, xp: { Popularity: 2, Media: 2 } },
    { id: 'lairRaid',   name: 'Raid the Lair',     archetype: 'lair',  objective: 'reach',  enemies: 3, xp: { Military: 3, Underworld: 1 } }
];

const startMission = (offer) => {
    const map = generateMap(offer.archetype, Math.random());
    const hero = {
        kind: 'hero',
        q: map.spawnHero.q,
        r: map.spawnHero.r,
        hp: state.campaign.attrs.hp,
        maxHp: state.campaign.attrs.maxHp,
        ap: state.campaign.attrs.maxAp,
        maxAp: state.campaign.attrs.maxAp,
        status: [],
        focused: 0
    };

    // Spawn enemies scattered around the map away from hero.
    const enemies = [];
    const hexKeys = Array.from(map.hexes.keys());
    let tries = 0;
    while (enemies.length < offer.enemies && tries < 400) {
        tries++;
        const key = hexKeys[Math.floor(Math.random() * hexKeys.length)];
        const h = map.hexes.get(key);
        if (!h) continue;
        if (h.terrain === 'wall' || h.terrain === 'water') continue;
        const d = hexDistance(h.q, h.r, hero.q, hero.r);
        if (d < 8) continue;
        if (enemies.find(e => e.q === h.q && e.r === h.r)) continue;
        const isLt = enemies.length === 0 && Math.random() < 0.5;
        enemies.push({
            kind: 'enemy',
            tier: isLt ? 'lieutenant' : 'minion',
            name: isLt ? 'Lieutenant' : 'Minion',
            q: h.q, r: h.r,
            hp: isLt ? 18 : 8,
            maxHp: isLt ? 18 : 8,
            ap: isLt ? 5 : 4,
            atk: isLt ? 3 : 1,
            def: isLt ? 2 : 0,
            dmg: isLt ? 5 : 3,
            range: isLt ? 4 : 1
        });
    }

    // For reach missions, pick a goal hex far from the hero.
    let goalHex = null;
    if (offer.objective === 'reach') {
        for (const key of Rando.shuffle(Array.from(map.hexes.keys()))) {
            const h = map.hexes.get(key);
            if (!h || h.terrain === 'wall' || h.terrain === 'water') continue;
            if (hexDistance(h.q, h.r, hero.q, hero.r) >= 15) {
                goalHex = { q: h.q, r: h.r };
                break;
            }
        }
    }

    // Reset per-mission power charges.
    for (const key in state.campaign.powers) {
        const entry = state.campaign.powers[key];
        const def = POWERS[key];
        if (def && def.charges != null) entry.charges = def.charges;
    }

    state.mission = {
        offer,
        map,
        hero,
        enemies,
        turn: 1,
        phase: 'player',
        selectedPower: null,
        hoverHex: null,
        reachable: null,
        goalHex,
        over: false
    };

    missionNameEl.textContent = offer.name;
    centerOnHero();
    recomputeReachable();
    log(`Mission start: ${offer.name}`, 'system');
    renderAll();
};

// ------------------------------------------------------------------
// Helpers: occupants, line of sight, reachable
// ------------------------------------------------------------------
const occupantAt = (q, r) => {
    const m = state.mission;
    if (!m) return null;
    if (m.hero.hp > 0 && m.hero.q === q && m.hero.r === r) return m.hero;
    return m.enemies.find(e => e.hp > 0 && e.q === q && e.r === r) || null;
};

// Simple LOS: distance only, plus wall check at endpoints (TODO: proper Bresenham).
const hasLineOfSight = (a, b) => {
    const m = state.mission;
    if (!m) return false;
    // Sample along a straight line.
    const steps = Math.max(1, hexDistance(a.q, a.r, b.q, b.r));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const q = a.q + (b.q - a.q) * t;
        const r = a.r + (b.r - a.r) * t;
        const rq = Math.round(q);
        const rr = Math.round(r);
        const h = m.map.hexes.get(hexKey(rq, rr));
        if (h && h.terrain === 'wall') return false;
    }
    return true;
};

const recomputeReachable = () => {
    const m = state.mission;
    if (!m || m.hero.hp <= 0) { if (m) m.reachable = new Map(); return; }
    const costs = bfsHexes(
        { q: m.hero.q, r: m.hero.r },
        m.map.hexes,
        (hex) => {
            if (occupantAt(hex.q, hex.r)) return Infinity;
            return moveCostOf(hex.terrain);
        },
        m.hero.ap
    );
    m.reachable = costs;
};

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
const centerOnHero = () => {
    const m = state.mission;
    if (!m) return;
    const p = hexToPixel(m.hero.q, m.hero.r);
    state.view.offsetX = canvas.width / 2 - p.x;
    state.view.offsetY = canvas.height / 2 - p.y;
};

const fillHex = (h, color) => {
    const p = hexToPixel(h.q, h.r);
    drawHexPath(ctx, p.x + state.view.offsetX, p.y + state.view.offsetY, HEX_SIZE - 1);
    ctx.fillStyle = color;
    ctx.fill();
};

const strokeHex = (h, color, width = 2) => {
    const p = hexToPixel(h.q, h.r);
    drawHexPath(ctx, p.x + state.view.offsetX, p.y + state.view.offsetY, HEX_SIZE - 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
};

const renderMap = () => {
    const m = state.mission;
    if (!m) return;
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const hex of m.map.hexes.values()) {
        const color = m.map.archetype.palette[hex.terrain] ?? '#333';
        fillHex(hex, color);
        strokeHex(hex, 'rgba(255,255,255,0.06)', 0.5);
    }

    // Reachable overlay.
    if (m.reachable && !m.selectedPower) {
        for (const key of m.reachable.keys()) {
            const [q, r] = key.split(',').map(Number);
            strokeHex({ q, r }, 'rgba(138,176,216,0.45)', 1);
        }
    }

    // Selected power range preview.
    if (m.selectedPower) {
        const def = POWERS[m.selectedPower];
        if (def.targeting === 'self' || def.targeting === 'self-aoe') {
            strokeHex({ q: m.hero.q, r: m.hero.r }, '#6bf', 3);
            if (def.area > 0) {
                for (const h of hexesInRange(m.hero.q, m.hero.r, def.area)) {
                    strokeHex(h, 'rgba(107,150,255,0.4)', 1);
                }
            }
        } else {
            for (const h of hexesInRange(m.hero.q, m.hero.r, def.range)) {
                if (m.map.hexes.has(hexKey(h.q, h.r))) {
                    strokeHex(h, 'rgba(107,150,255,0.5)', 1);
                }
            }
        }
    }

    // Goal hex highlight.
    if (m.goalHex) {
        strokeHex(m.goalHex, '#7fff7f', 3);
    }

    // Hover highlight and AOE preview.
    if (m.hoverHex) {
        strokeHex(m.hoverHex, '#fff', 2);
        if (m.selectedPower) {
            const def = POWERS[m.selectedPower];
            if (def.area > 0 && def.targeting === 'hex') {
                for (const h of hexesInRange(m.hoverHex.q, m.hoverHex.r, def.area)) {
                    strokeHex(h, 'rgba(255,107,107,0.6)', 1);
                }
            }
        }
    }

    // Hero marker.
    const hp = hexToPixel(m.hero.q, m.hero.r);
    ctx.fillStyle = '#cdd6e3';
    ctx.beginPath();
    ctx.arc(hp.x + state.view.offsetX, hp.y + state.view.offsetY, HEX_SIZE * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#1a1d27';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', hp.x + state.view.offsetX, hp.y + state.view.offsetY);

    // Enemies.
    for (const e of m.enemies) {
        if (e.hp <= 0) continue;
        const ep = hexToPixel(e.q, e.r);
        ctx.fillStyle = e.tier === 'lieutenant' ? '#8a4555' : '#6a3535';
        ctx.beginPath();
        ctx.arc(ep.x + state.view.offsetX, ep.y + state.view.offsetY, HEX_SIZE * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#e8e6df';
        ctx.fillText(e.tier === 'lieutenant' ? 'L' : 'm', ep.x + state.view.offsetX, ep.y + state.view.offsetY);
    }
};

const renderTopBar = () => {
    const c = state.campaign;
    const m = state.mission;
    if (!c) return;
    heroNameEl.textContent = c.heroName;
    if (m) {
        hpValEl.textContent = m.hero.hp;
        hpMaxEl.textContent = m.hero.maxHp;
        apValEl.textContent = m.hero.ap;
        apMaxEl.textContent = m.hero.maxAp;
        statusValEl.textContent = m.hero.focused > 0 ? `Focused (${m.hero.focused})` : '';
        turnPhaseEl.textContent = m.phase === 'player' ? `Turn ${m.turn} — Player` : `Turn ${m.turn} — Enemy`;
    } else {
        hpValEl.textContent = c.attrs.hp;
        hpMaxEl.textContent = c.attrs.maxHp;
        apValEl.textContent = '-';
        apMaxEl.textContent = c.attrs.maxAp;
        statusValEl.textContent = 'Between missions';
        turnPhaseEl.textContent = `Downtime: ${c.downtime}`;
        missionNameEl.textContent = '';
    }
};

const renderPowerList = () => {
    powerListEl.innerHTML = '';
    const c = state.campaign;
    const m = state.mission;
    if (!c) return;
    for (const key in c.powers) {
        const def = POWERS[key];
        if (!def) continue;
        const entry = c.powers[key];
        const li = document.createElement('li');
        const canUse = !!m && m.phase === 'player' && m.hero.ap >= def.apCost &&
                       (entry.charges == null || entry.charges > 0);
        if (!canUse) li.classList.add('disabled');
        if (m && m.selectedPower === key) li.classList.add('selected');
        const chargesStr = entry.charges != null ? ` [${entry.charges}]` : '';
        li.innerHTML = `<span class="pname">${def.name}${chargesStr}</span>
            <span class="pmeta">${def.apCost} AP · rng ${def.range}${def.area ? ' · aoe ' + def.area : ''}</span>
            <span class="pmeta">${def.desc}</span>`;
        const handler = () => onPowerClick(key);
        li.addEventListener('click', handler);
        powerListEl.appendChild(li);
    }
};

const renderTargetInfo = () => {
    const m = state.mission;
    if (!m || !m.hoverHex) { targetInfoEl.textContent = 'Click the map to inspect.'; return; }
    const h = m.map.hexes.get(hexKey(m.hoverHex.q, m.hoverHex.r));
    if (!h) { targetInfoEl.textContent = 'Off-map.'; return; }
    const occ = occupantAt(h.q, h.r);
    const dist = hexDistance(m.hero.q, m.hero.r, h.q, h.r);
    let txt = `(${h.q},${h.r}) terrain: ${h.terrain} · dist ${dist}`;
    if (occ) {
        txt += `\n${occ.kind === 'hero' ? 'Hero' : occ.name} HP ${occ.hp}/${occ.maxHp}`;
    }
    if (m.selectedPower) {
        const def = POWERS[m.selectedPower];
        const prev = previewAttack(def, h);
        if (prev) txt += `\n${def.name}: ${prev}`;
    }
    targetInfoEl.textContent = txt;
};

const renderAll = () => {
    renderMap();
    renderTopBar();
    renderPowerList();
    renderTargetInfo();
};

// ------------------------------------------------------------------
// Attack preview + resolution
// ------------------------------------------------------------------
const attackerCenter = (def) => {
    const c = state.campaign;
    const m = state.mission;
    const base = c.attrs.focus;
    const focusBonus = m.hero.focused > 0 ? 2 : 0;
    return base + focusBonus + (def.accuracy ?? 0);
};

const defenderCenter = (defender, def) => {
    const m = state.mission;
    if (!defender) return 0;
    if (defender.kind === 'enemy') {
        const hex = m.map.hexes.get(hexKey(defender.q, defender.r));
        const cov = hex ? coverOf(hex.terrain) : 0;
        const toughness = def && def.mental ? 0 : (defender.def ?? 0);
        return toughness + cov;
    }
    // Hero as defender.
    return state.campaign.attrs.toughness;
};

const previewAttack = (def, targetHex) => {
    if (!def.damage) return null;
    const occ = occupantAt(targetHex.q, targetHex.r);
    const target = occ && occ.kind === 'enemy' ? occ : null;
    const atk = attackerCenter(def);
    const dfn = defenderCenter(target, def);
    return `atk~${atk} vs def~${dfn}, dmg~${def.damage}${target ? '' : ' (no target)'}`;
};

// ------------------------------------------------------------------
// Input: map click + hover
// ------------------------------------------------------------------
const canvasToHex = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left - state.view.offsetX;
    const y = ev.clientY - rect.top - state.view.offsetY;
    return pixelToHex(x, y);
};

const onCanvasMove = (ev) => {
    const m = state.mission;
    if (!m) return;
    const h = canvasToHex(ev);
    m.hoverHex = h;
    renderAll();
};

const onCanvasClick = (ev) => {
    const m = state.mission;
    if (!m || m.over || m.phase !== 'player') return;
    const h = canvasToHex(ev);
    if (!m.map.hexes.has(hexKey(h.q, h.r))) return;

    if (m.selectedPower) {
        tryUsePower(m.selectedPower, h);
        return;
    }

    // Click-to-move via reachable costs.
    const cost = m.reachable ? m.reachable.get(hexKey(h.q, h.r)) : null;
    if (cost != null && cost > 0) {
        m.hero.q = h.q;
        m.hero.r = h.r;
        m.hero.ap -= cost;
        log(`Move to (${h.q},${h.r}) — ${cost} AP`);
        recomputeReachable();
        checkMissionObjective();
        renderAll();
    }
};

// ------------------------------------------------------------------
// Power usage
// ------------------------------------------------------------------
const onPowerClick = (key) => {
    const m = state.mission;
    if (!m || m.phase !== 'player' || m.over) return;
    const def = POWERS[key];
    const entry = state.campaign.powers[key];
    if (m.hero.ap < def.apCost) { log('Not enough AP.', 'fail'); return; }
    if (entry.charges != null && entry.charges <= 0) { log('Out of charges.', 'fail'); return; }

    // Self-targeted powers resolve immediately.
    if (def.targeting === 'self' || def.targeting === 'self-aoe') {
        tryUsePower(key, { q: m.hero.q, r: m.hero.r });
        return;
    }

    m.selectedPower = m.selectedPower === key ? null : key;
    renderAll();
};

const spendPower = (key) => {
    const def = POWERS[key];
    const m = state.mission;
    const entry = state.campaign.powers[key];
    m.hero.ap -= def.apCost;
    if (entry.charges != null) entry.charges -= 1;
    if (m.hero.focused > 0) m.hero.focused -= 1;
};

const tryUsePower = (key, targetHex) => {
    const def = POWERS[key];
    const m = state.mission;
    const dist = hexDistance(m.hero.q, m.hero.r, targetHex.q, targetHex.r);

    if (def.targeting === 'self') {
        if (def.heal) {
            m.hero.hp = Math.min(m.hero.maxHp, m.hero.hp + def.heal);
            log(`${def.name}: heal ${def.heal}`, 'success');
        }
        if (def.effect === 'focused') {
            m.hero.focused = 2;
            log(`${def.name}: focused`, 'success');
        }
        spendPower(key);
        m.selectedPower = null;
        recomputeReachable();
        renderAll();
        return;
    }

    if (def.targeting === 'self-move') {
        // Require empty hex within range, clear of walls.
        if (dist === 0 || dist > def.range) { log('Out of range.', 'fail'); return; }
        const hex = m.map.hexes.get(hexKey(targetHex.q, targetHex.r));
        if (!hex || hex.terrain === 'wall') { log('Blocked.', 'fail'); return; }
        if (occupantAt(targetHex.q, targetHex.r)) { log('Hex occupied.', 'fail'); return; }
        m.hero.q = targetHex.q;
        m.hero.r = targetHex.r;
        log(`${def.name}: moved`, 'success');
        spendPower(key);
        m.selectedPower = null;
        recomputeReachable();
        renderAll();
        return;
    }

    if (def.targeting === 'self-aoe') {
        spendPower(key);
        resolveAoE(def, { q: m.hero.q, r: m.hero.r });
        m.selectedPower = null;
        renderAll();
        return;
    }

    // hex / enemy targeting
    if (dist > def.range) { log('Out of range.', 'fail'); return; }
    if (!hasLineOfSight({ q: m.hero.q, r: m.hero.r }, targetHex)) { log('No line of sight.', 'fail'); return; }

    if (def.targeting === 'enemy') {
        const target = occupantAt(targetHex.q, targetHex.r);
        if (!target || target.kind !== 'enemy') { log('No valid target.', 'fail'); return; }
        spendPower(key);
        resolveAttack(def, target);
        m.selectedPower = null;
        renderAll();
        return;
    }

    if (def.targeting === 'hex') {
        spendPower(key);
        resolveAoE(def, targetHex);
        m.selectedPower = null;
        renderAll();
        return;
    }
};

const resolveAttack = (def, target) => {
    const result = runAttack({
        attackerCenter: attackerCenter(def),
        defenderCenter: defenderCenter(target, def),
        baseDamage: def.damage
    });
    const msg = `${def.name} → ${target.name}: ${result.outcome} (Δ${result.delta}) dmg ${result.damage}`;
    log(msg, result.outcome);
    target.hp -= result.damage;
    if (def.effect === 'stun' && (result.outcome === 'success' || result.outcome === 'crit-success')) {
        target.stunned = 1;
        log(`${target.name} stunned!`, 'success');
    }
    if (target.hp <= 0) {
        log(`${target.name} defeated`, 'crit-success');
    }
    checkMissionObjective();
};

const resolveAoE = (def, centerHex) => {
    const area = hexesInRange(centerHex.q, centerHex.r, def.area);
    for (const h of area) {
        const occ = occupantAt(h.q, h.r);
        if (occ && occ.kind === 'enemy') {
            resolveAttack(def, occ);
        }
    }
};

// ------------------------------------------------------------------
// Enemy AI — utility-scored approach + attack.
// ------------------------------------------------------------------
const enemyTurn = () => {
    const m = state.mission;
    if (!m) return;
    m.phase = 'enemy';
    renderAll();

    for (const e of m.enemies) {
        if (e.hp <= 0) continue;
        if (e.stunned) { e.stunned = 0; log(`${e.name} is stunned and loses its turn.`); continue; }
        if (m.hero.hp <= 0) break;

        let ap = e.ap;
        let guard = 20;
        while (ap > 0 && guard-- > 0 && m.hero.hp > 0) {
            const dist = hexDistance(e.q, e.r, m.hero.q, m.hero.r);
            if (dist <= e.range) {
                // Attack.
                if (ap < 2) break;
                ap -= 2;
                const result = runAttack({
                    attackerCenter: e.atk,
                    defenderCenter: state.campaign.attrs.toughness,
                    baseDamage: e.dmg
                });
                log(`${e.name} attacks: ${result.outcome} (Δ${result.delta}) dmg ${result.damage}`, result.outcome);
                m.hero.hp -= result.damage;
                if (m.hero.hp <= 0) break;
            } else {
                // Approach one step toward hero via best neighbor.
                const neighbors = hexNeighbors(e.q, e.r)
                    .map(n => ({ n, h: m.map.hexes.get(hexKey(n.q, n.r)) }))
                    .filter(x => x.h && x.h.terrain !== 'wall' && x.h.terrain !== 'water' && !occupantAt(x.n.q, x.n.r))
                    .map(x => ({
                        n: x.n,
                        score: -hexDistance(x.n.q, x.n.r, m.hero.q, m.hero.r) - moveCostOf(x.h.terrain) * 0.1
                    }))
                    .sort((a, b) => b.score - a.score);
                if (!neighbors.length) break;
                const step = neighbors[0].n;
                const stepHex = m.map.hexes.get(hexKey(step.q, step.r));
                const cost = moveCostOf(stepHex.terrain);
                if (cost > ap) break;
                ap -= cost;
                e.q = step.q;
                e.r = step.r;
            }
        }
    }

    if (m.hero.hp <= 0) {
        missionFail();
        return;
    }

    // Start player turn.
    m.phase = 'player';
    m.turn += 1;
    m.hero.ap = m.hero.maxAp;
    recomputeReachable();
    renderAll();
};

// ------------------------------------------------------------------
// Mission end / objective checks
// ------------------------------------------------------------------
const checkMissionObjective = () => {
    const m = state.mission;
    if (!m || m.over) return;
    const offer = m.offer;
    if (offer.objective === 'defeat') {
        if (m.enemies.every(e => e.hp <= 0)) missionSuccess();
    } else if (offer.objective === 'reach') {
        if (m.goalHex && m.hero.q === m.goalHex.q && m.hero.r === m.goalHex.r) missionSuccess();
    }
};

const missionSuccess = () => {
    const m = state.mission;
    if (!m || m.over) return;
    m.over = true;
    log('Mission success!', 'crit-success');
    const c = state.campaign;
    c.attrs.hp = Math.max(1, m.hero.hp);
    c.missionCount += 1;
    for (const track in m.offer.xp) addXp(c, track, m.offer.xp[track]);
    saveCampaign(c);
    setTimeout(openBetweenMission, 400);
};

const missionFail = () => {
    const m = state.mission;
    if (!m || m.over) return;
    m.over = true;
    log('Hero down. Waking in the hospital...', 'crit-fail');
    const c = state.campaign;
    c.attrs.hp = c.attrs.maxHp;
    c.downtime = Math.max(0, c.downtime - 1);
    c.missionCount += 1;
    saveCampaign(c);
    setTimeout(openBetweenMission, 400);
};

// ------------------------------------------------------------------
// Between-mission phase
// ------------------------------------------------------------------
const ACTIVITIES = [
    { id: 'train',    name: 'Train',    desc: '+1 Focus XP, +1 Military XP', apply: (c) => { addXp(c, 'Academic', 2); addXp(c, 'Military', 1); } },
    { id: 'network',  name: 'Network',  desc: '+2 Popularity, +1 Media',     apply: (c) => { addXp(c, 'Popularity', 2); addXp(c, 'Media', 1); } },
    { id: 'research', name: 'Research', desc: '+2 Science, +1 Academic',     apply: (c) => { addXp(c, 'Science', 2); addXp(c, 'Academic', 1); } },
    { id: 'patrol',   name: 'Patrol',   desc: '+2 Underworld, risk hit',     apply: (c) => { addXp(c, 'Underworld', 2); if (Math.random() < 0.3) { c.attrs.hp = Math.max(1, c.attrs.hp - 4); } } },
    { id: 'rest',     name: 'Rest',     desc: 'Recover HP + Personal',       apply: (c) => { c.attrs.hp = c.attrs.maxHp; addXp(c, 'Personal', 1); } }
];

const openBetweenMission = () => {
    state.mission = null;
    if (!state.campaign) return;
    state.campaign.downtime = START_DOWNTIME;
    renderAll();
    showBetweenModal();
};

const showBetweenModal = () => {
    const c = state.campaign;
    modalBodyEl.innerHTML = '';
    const h = document.createElement('h2');
    h.textContent = 'Between Missions';
    modalBodyEl.appendChild(h);

    const status = document.createElement('p');
    status.innerHTML = `HP ${c.attrs.hp}/${c.attrs.maxHp} · Downtime actions: <b id="dtCount">${c.downtime}</b>`;
    modalBodyEl.appendChild(status);

    const actSection = document.createElement('div');
    const actH = document.createElement('h3');
    actH.textContent = 'Downtime Activities';
    actSection.appendChild(actH);
    for (const act of ACTIVITIES) {
        const btn = document.createElement('button');
        btn.className = 'activity';
        btn.textContent = `${act.name} — ${act.desc}`;
        const handler = () => onActivityClick(act);
        btn.addEventListener('click', handler);
        actSection.appendChild(btn);
    }
    modalBodyEl.appendChild(actSection);

    const missionH = document.createElement('h3');
    missionH.textContent = 'Next Mission';
    modalBodyEl.appendChild(missionH);

    const offers = Rando.shuffle(MISSION_OFFERS.slice()).slice(0, 3);
    for (const offer of offers) {
        const btn = document.createElement('button');
        btn.className = 'activity';
        btn.textContent = `${offer.name} — ${offer.archetype} / ${offer.objective}`;
        const handler = () => {
            closeModal();
            saveCampaign(state.campaign);
            startMission(offer);
        };
        btn.addEventListener('click', handler);
        modalBodyEl.appendChild(btn);
    }

    openModal();
};

const onActivityClick = (act) => {
    const c = state.campaign;
    if (c.downtime <= 0) { log('No downtime left.', 'fail'); return; }
    act.apply(c);
    c.downtime -= 1;
    log(`Downtime: ${act.name}`, 'system');
    saveCampaign(c);
    showBetweenModal(); // refresh
};

// ------------------------------------------------------------------
// Modals
// ------------------------------------------------------------------
const openModal = () => { modalEl.classList.remove('hidden'); };
const closeModal = () => { modalEl.classList.add('hidden'); };

const showCharacterSheet = () => {
    const c = state.campaign;
    if (!c) return;
    modalBodyEl.innerHTML = '';
    const h = document.createElement('h2');
    h.textContent = `${c.heroName} — Character Sheet`;
    modalBodyEl.appendChild(h);

    const attrs = document.createElement('p');
    attrs.textContent = `HP ${c.attrs.hp}/${c.attrs.maxHp} · AP ${c.attrs.maxAp} · Speed ${c.attrs.speed} · Toughness ${c.attrs.toughness} · Will ${c.attrs.willpower} · Focus ${c.attrs.focus}`;
    modalBodyEl.appendChild(attrs);

    const ph = document.createElement('h3');
    ph.textContent = 'Powers';
    modalBodyEl.appendChild(ph);
    const pul = document.createElement('ul');
    for (const key in c.powers) {
        const def = POWERS[key];
        if (!def) continue;
        const li = document.createElement('li');
        li.textContent = `${def.name} — ${def.apCost} AP · ${def.desc}`;
        pul.appendChild(li);
    }
    modalBodyEl.appendChild(pul);

    const th = document.createElement('h3');
    th.textContent = 'Advancement Tracks';
    modalBodyEl.appendChild(th);
    const grid = document.createElement('div');
    grid.className = 'tracks-grid';
    for (const name of TRACKS) {
        const t = c.tracks[name];
        const row = document.createElement('div');
        row.className = 'track-row';
        row.innerHTML = `<span>${name}</span><span>R${t.rank} (${t.xp}/10)</span>`;
        grid.appendChild(row);
    }
    modalBodyEl.appendChild(grid);

    const ah = document.createElement('h3');
    ah.textContent = 'Arc Goals';
    modalBodyEl.appendChild(ah);
    const aul = document.createElement('ul');
    for (const arc of c.arcs) {
        const li = document.createElement('li');
        li.textContent = `${arc.done ? '[x]' : '[ ]'} ${arc.name}`;
        aul.appendChild(li);
    }
    modalBodyEl.appendChild(aul);

    openModal();
};

const showGoals = () => {
    const m = state.mission;
    modalBodyEl.innerHTML = '';
    const h = document.createElement('h2');
    h.textContent = 'Mission Goals';
    modalBodyEl.appendChild(h);
    const p = document.createElement('p');
    if (m) {
        const obj = m.offer.objective === 'defeat' ? 'Defeat all enemies' : 'Reach the marked hex';
        p.textContent = `${m.offer.name}: ${obj}`;
    } else {
        p.textContent = 'No active mission.';
    }
    modalBodyEl.appendChild(p);
    openModal();
};

// ------------------------------------------------------------------
// Button handlers
// ------------------------------------------------------------------
const onEndTurn = () => {
    const m = state.mission;
    if (!m || m.over || m.phase !== 'player') return;
    log('End turn', 'system');
    enemyTurn();
};

const onSheetBtn = () => showCharacterSheet();
const onGoalsBtn = () => showGoals();
const onModalClose = () => closeModal();

const onNewCampaign = () => {
    if (!confirm('Start a new campaign? Current save will be lost.')) return;
    state.campaign = newCampaign('Nova');
    saveCampaign(state.campaign);
    log('New campaign started.', 'system');
    openBetweenMission();
};

endTurnBtn.addEventListener('click', onEndTurn);
sheetBtn.addEventListener('click', onSheetBtn);
goalsBtn.addEventListener('click', onGoalsBtn);
modalCloseBtn.addEventListener('click', onModalClose);
newCampaignBtn.addEventListener('click', onNewCampaign);
canvas.addEventListener('mousemove', onCanvasMove);
canvas.addEventListener('click', onCanvasClick);

// ------------------------------------------------------------------
// Resize
// ------------------------------------------------------------------
const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
    if (state.mission) centerOnHero();
    renderAll();
};
window.addEventListener('resize', resizeCanvas);

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
const boot = () => {
    const existing = loadCampaign();
    if (existing && existing.attrs && existing.powers) {
        state.campaign = existing;
        log('Campaign loaded.', 'system');
    } else {
        state.campaign = newCampaign('Nova');
        saveCampaign(state.campaign);
        log('New campaign started.', 'system');
    }
    resizeCanvas();
    openBetweenMission();
};

boot();

// TODO (post-MVP): destructible terrain, elevation, proper Bresenham LOS,
// full enemy tier roster (Low-Grade Super / Supervillain / Epic Threat),
// multi-phase boss AI, save export/import, keyboard accessibility.
