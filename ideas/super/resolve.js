// resolve.js — Bell-curve resolution.
// Produces a single integer score per test. Modifiers SHIFT the curve center;
// they do not add flat bonuses to a die. Difference between attacker and
// defender scores maps to a graded outcome band.

import { Rando } from './rando.js';

// Sample an integer near `center` with standard deviation ~3.
export const sampleCurve = (center) => {
    const g = Rando.gaussian() * 3;
    return Math.round(center + g);
};

// Map delta -> outcome band.
export const outcomeOf = (delta) => {
    if (delta <= -8) return 'crit-fail';
    if (delta <= -3) return 'fail';
    if (delta < 3)   return 'partial';
    if (delta < 8)   return 'success';
    return 'crit-success';
};

// Run an attack check. Returns { outcome, delta, damage, atk, def }.
export const runAttack = ({ attackerCenter, defenderCenter, baseDamage }) => {
    const atk = sampleCurve(attackerCenter);
    const def = sampleCurve(defenderCenter);
    const delta = atk - def;
    const outcome = outcomeOf(delta);

    let damage = 0;
    if (baseDamage != null) {
        const mult = {
            'crit-fail': 0,
            'fail':      0,
            'partial':   0.5,
            'success':   1,
            'crit-success': 1.75
        }[outcome];
        // Scale a little by delta magnitude inside the success bands.
        const curveDmg = sampleCurve(baseDamage);
        damage = Math.max(0, Math.round(curveDmg * mult));
    }

    return { outcome, delta, damage, atk, def };
};
