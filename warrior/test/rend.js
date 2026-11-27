// test/rend.js — Dimensional Rend's HP cost (executeDimensionalRend in actions.js),
// run through SkillAction.execute with a stub ctx: a player with more HP than the
// cost pays it and strikes for the full formula amount; a player short of it pays
// down to 1 HP and strikes for the formula amount scaled by the share paid; at
// 1 HP nothing is spent and nothing is struck. Run: node test/rend.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const { Player, SkillAction, SKILLS, SKILL_FORMULAS, effectiveSkill, rendHpCost, PLAYER_MP, TERRAIN } = load(
    scripts.slice(0, scripts.indexOf('actions.js') + 1),
    ['Player', 'SkillAction', 'SKILLS', 'SKILL_FORMULAS', 'effectiveSkill', 'rendHpCost', 'PLAYER_MP', 'TERRAIN']);

// Casts Rend at `rank` with `hp` HP; returns the player, the log and the base
// damage handed to dealDamageToEnemy (undefined when no strike was made).
function cast(rank, hp) {
    const player = new Player(0, 0);
    player.skillRanks.dimensional_rend = rank;
    player.hp = hp;
    const enemy = { q: 1, r: 0, hp: 1000, type: 'stub' };
    const out = { player, log: [] };
    const ctx = {
        player,
        world: { pois: [] },
        playerTerrain: () => TERRAIN.PLAINS,
        em: { enemyAt: () => enemy, enemies: [enemy], getDef: () => ({ name: 'Stub' }) },
        logCombat: line => out.log.push(line),
        setCombatAlerted: () => {},
        dealDamageToEnemy: (target, dmg) => { out.struck = dmg; return { dealt: dmg, killed: false, stunned: false }; },
    };
    new SkillAction(ctx, 'dimensional_rend', enemy.q, enemy.r).execute();
    return out;
}

const WEAPON_DAMAGE = new Player(0, 0).weapon().damage;
const ranks = SKILLS.dimensional_rend.tiers.length;
for (let rank = 1; rank <= ranks; rank++) {
    const skill = effectiveSkill(SKILLS.dimensional_rend, rank);
    const cost = rendHpCost(skill);
    const full = SKILL_FORMULAS.dimensional_rend(skill, new Player(0, 0).stats, WEAPON_DAMAGE);
    const at = 'rank ' + rank + ', HP ';

    // Every HP from 1 to past the cost: never below 1 HP, and the strike follows the share paid.
    for (let hp = 1; hp <= cost + 3; hp++) {
        const { player, log, struck } = cast(rank, hp);
        const paid = Math.min(cost, hp - 1);
        assert.equal(player.hp, hp - paid, at + hp + ': HP left');
        assert.ok(player.hp >= 1, at + hp + ': never below 1 HP');
        if (hp === 1) {
            assert.equal(struck, undefined, at + hp + ': no strike');
            assert.equal(player.mp, PLAYER_MP, at + hp + ': no MP spent');
            assert.deepEqual(log, [], at + hp + ': nothing logged');
            continue;
        }
        assert.equal(player.mp, 0, at + hp + ': all MP spent');
        assert.equal(struck, Math.round(full * paid / cost), at + hp + ': strike scaled by the share paid');
        assert.equal(log.length, paid < cost ? 2 : 1, at + hp + ': a weakened line only when short');
    }
    assert.equal(cast(rank, cost + 1).struck, full, 'rank ' + rank + ': full cost, full strike');
}

console.log('rend ok: ' + ranks + ' ranks');
