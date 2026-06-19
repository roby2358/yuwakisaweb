// combat.js — pure combat resolution. No game state, no mutation: every function takes
// plain values and returns a concrete result object. (DYNAMICS.md §8.)


// Is there a clear firing lane from `from` to `to`? Intermediate mountains/forests block.
// Endpoints never block (you can fire out of, and into, cover).
function lineOfSight(from, to, hexes) {
    const line = Hex.line(new Hex(from.q, from.r), new Hex(to.q, to.r));
    for (let i = 1; i < line.length - 1; i++) {
        const h = hexes.get(line[i].key());
        if (h && LOS_BLOCKERS.has(h.terrain)) return false;
    }
    return true;
}

// Resolve one shot against a defender. Returns { dmg, newShield } — the caller applies them.
//   incoming = power, reduced by forest cover when the target stands in forest
//   absorb   = shield pool scaled by the matchup multiplier, capped at the incoming hit
//   shield depletes by incoming/multiplier (a strong shield ablates slower per point of hit)
function resolveFire(power, damageType, target, targetTerrain) {
    const cover = targetTerrain === TERRAIN.FOREST ? FOREST_COVER : 0;
    const incoming = Math.max(0, power - cover);
    const mult = MATCHUP[damageType][target.shieldType];
    const absorb = Math.min(target.shieldLeft * mult, incoming);
    const newShield = mult > 0 ? Math.max(0, target.shieldLeft - incoming / mult) : target.shieldLeft;
    const dmg = Math.max(0, incoming - absorb);
    return { dmg, newShield };
}
