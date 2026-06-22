// ai/partyai.js — Friendly party strategy (the heroes the player can't command).
//
// Answers, for one party member each turn: where does it want to go (`goal`) and how far
// may it travel (`budget`). The animated party phase in GameEngine feeds those to
// Movement.walkToward and resolves the attack. Every method takes the live GameState
// explicitly — it reads `state.party / healer / enemies / objectiveHex` and the state's
// query helpers (`state.hexAt`, `state.isPassable`, `state.nearest`). There is no per-member
// instance state, so the methods are static.
class PartyAI {
    // Follower formation slots: distinct neighbor directions around the anchor so members
    // don't all path onto the same hex and block each other.
    static FORMATION_DIRS = [0, 2, 4, 1, 3, 5];

    // Toughness ranking for "who's the meat shield this turn". Armor is flat per-hit
    // reduction (applyDamage subtracts it from every blow), so it's worth far more than a
    // like amount of HP — weight it heavily. Recomputed each turn, so the ranking shifts as
    // the front line takes damage.
    static ARMOR_WEIGHT = 8;
    static SHIELD_STANDOFF = 2;    // hexes the archer keeps behind the toughest ally
    static toughness(unit) {
        return unit.armor * PartyAI.ARMOR_WEIGHT + unit.hp;
    }

    // The leader is whoever is toughest *right now*, not a fixed class. Recomputed every
    // turn, so if the Warden falls the next-sturdiest member takes point automatically — and
    // an all-archer party still has a leader (the one with the most left in the tank). The
    // leader is the only one pathing to the objective; everyone else forms up around it.
    static leader(state) {
        const living = state.party.filter(p => p.alive && !p.gone);
        if (!living.length) return null;
        return living.reduce((a, b) => PartyAI.toughness(b) > PartyAI.toughness(a) ? b : a);
    }

    // Threats first: a member diverts to the nearest enemy within engage range and fights
    // it rather than running past. Ranged units use a larger reach so they react before a
    // foe closes. Only when nothing is near does the leader pursue the objective and everyone
    // else pursue their formation slot around the leader.
    static goal(member, state) {
        const here = new Hex(member.q, member.r);
        const reach = Math.max(PARTY_ENGAGE_RANGE, member.attackRange + 1);
        const threats = state.enemies.filter(e => here.distance(e) <= reach);
        if (threats.length) return PartyAI.engageGoal(member, threats, state);
        const leader = PartyAI.leader(state);
        if (member === leader) return state.objectiveHex;
        return PartyAI.formationSlot(member, leader ?? state.healer, state);
    }

    // The leash slows the leader as it gets ahead of the healer instead of yanking it back:
    // budget shrinks to zero at the leash radius, so a stationary healer makes the leader
    // creep to the edge and hold (no oscillation). Followers always move at full speed.
    static budget(member, state) {
        if (member !== PartyAI.leader(state)) return PARTY_MP;
        const lead = LEADER_LEASH - new Hex(member.q, member.r).distance(state.healer);
        return Math.max(0, Math.min(PARTY_MP, lead));
    }

    // Melee charges the nearest threat; ranged kites — keeps a frontliner between itself
    // and the enemies.
    static engageGoal(member, threats, state) {
        if (member.attackRange <= 1) {
            const foe = state.nearest(member, threats);
            return { q: foe.q, r: foe.r };
        }
        return PartyAI.kiteGoal(member, threats, state);
    }

    // Ranged kite: rank every other living party member by toughness (no class bias — a
    // member just can't shelter behind itself), then tuck in SHIELD_STANDOFF hexes behind the
    // toughest — the meat shield — on the side away from the enemies. From there its long
    // range still reaches well over the front line. With no ally left to hide behind, it
    // shelters by the healer.
    static kiteGoal(member, threats, state) {
        const shields = state.party.filter(p => p !== member && p.alive && !p.gone);
        const tank = shields.length
            ? shields.reduce((a, b) => PartyAI.toughness(b) > PartyAI.toughness(a) ? b : a)
            : state.healer;
        return PartyAI.behindHex(tank, threats, PartyAI.SHIELD_STANDOFF, state);
    }

    // A passable hex within `dist` of `anchor` that maximizes the minimum distance to the
    // threats — i.e., the spot `dist` hexes behind the anchor, on the side away from the
    // enemy group.
    static behindHex(anchor, threats, dist, state) {
        const clearance = cell => Math.min(...threats.map(e => cell.distance(e)));
        let best = { q: anchor.q, r: anchor.r };
        let bestClear = -Infinity;
        for (const c of new Hex(anchor.q, anchor.r).inRange(dist)) {
            const h = state.hexAt(c.q, c.r);
            if (!h || !state.isPassable(h)) continue;
            const score = clearance(c);
            if (score > bestClear) { bestClear = score; best = { q: c.q, r: c.r }; }
        }
        return best;
    }

    static formationSlot(member, anchor, state) {
        const leader = PartyAI.leader(state);
        const followers = state.party.filter(p => p !== leader);
        const dir = PartyAI.FORMATION_DIRS[followers.indexOf(member) % PartyAI.FORMATION_DIRS.length];
        const cell = new Hex(anchor.q, anchor.r).neighbors()[dir];
        const h = state.hexAt(cell.q, cell.r);
        if (h && state.isPassable(h)) return { q: cell.q, r: cell.r };
        return { q: anchor.q, r: anchor.r };
    }
}
