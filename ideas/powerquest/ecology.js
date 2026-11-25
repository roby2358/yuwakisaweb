// ecology.js — Ecology
//
// The world phase's non-hero actors (ONTOLOGY.md §5): enemy movement and attacks, raids on
// villages, and lair spawning. Simple probabilistic rules, no scripted encounters. Operates on a
// GameEngine; DOM-free; all randomness through Rando.
const Ecology = (function () {
    const A = GameArtifacts;
    const { TERRAIN, ENEMY_KINDS } = A;

    // Can creature c step onto hex h? Passable, free, not a site, not the hero, mesa only for guardians.
    function canEnter(e, c, h, occ) {
        const s = e.state;
        if (!e.board.isPassable(h)) return false;
        if (h.terrain === TERRAIN.MESA && !c.guardian && !ENEMY_KINDS[c.kind].climber) return false;
        const k = Hex.key(h.q, h.r);
        if (occ.has(k)) return false;
        if (s.hero.isAt(h.q, h.r)) return false;
        if (s.villages.some(v => v.isAt(h.q, h.r))) return false;
        if (s.ruins.some(r => r.isAt(h.q, h.r))) return false;
        const lair = s.lairs.find(l => l.isAt(h.q, h.r));
        if (lair && !(c.guardian && c.home === lair.id)) return false;
        return true;
    }

    function heroPresent(e) {
        const h = e.state.hero;
        return !h.away && !h.sheltered && !e.downedBy;
    }

    function canHit(e, c) {
        return heroPresent(e) && hexDist(c, e.state.hero) <= ENEMY_KINDS[c.kind].range;
    }

    function raidTarget(e, c) {
        let best = null, bd = Infinity;
        for (const v of e.state.villages) {
            if (v.ruined) continue;
            const dd = hexDist(c, v);
            if (dd <= 1 && dd < bd) { bd = dd; best = v; }
        }
        return best;
    }

    function move(e, c, to, occ) {
        const from = { q: c.q, r: c.r };
        occ.delete(c.key());
        c.moveTo(to.q, to.r);
        occ.add(c.key());
        if (e.isVisible(from.q, from.r) || e.isVisible(to.q, to.r))
            e.emit('enemyMove', { id: c.id, from, to: { q: c.q, r: c.r } });
    }

    // Best free neighbor by score (lower is better); null if none beats staying put when requireBetter.
    function bestStep(e, c, occ, score, requireBetter) {
        const here = score(c);
        let best = null, bs = requireBetter ? here : Infinity;
        const ties = [];
        for (const h of e.board.neighbors(c.q, c.r)) {
            if (!canEnter(e, c, h, occ)) continue;
            const sc = score(h);
            if (sc < bs) { bs = sc; best = h; ties.length = 0; ties.push(h); }
            else if (sc === bs && best) ties.push(h);
        }
        return ties.length > 1 ? Rando.choice(ties) : best;
    }

    function step(e, c, occ) {
        const s = e.state, kind = ENEMY_KINDS[c.kind];
        const anchor = { q: c.aq, r: c.ar };
        const hero = s.hero;
        const near = heroPresent(e) && hexDist(c, hero) <= A.AGGRO;
        if (c.guardian) {
            const leash = A.GUARD_LEASH;
            if (near) {
                const t = bestStep(e, c, occ, h => hexDist(h, hero) + (hexDist(h, anchor) > leash ? 99 : 0), true);
                if (t) return move(e, c, t, occ);
            }
            if (hexDist(c, anchor) > 0) {
                const t = bestStep(e, c, occ, h => hexDist(h, anchor), true);
                if (t) move(e, c, t, occ);
            }
            return;
        }
        if (kind.group === 'raider') {
            const field = e.nearestVillageField(c);
            if (field) {
                const t = bestStep(e, c, occ, h => field.get(Hex.key(h.q, h.r)) ?? Infinity, true);
                if (t) return move(e, c, t, occ);
                return;
            }
        }
        if (near && hexDist(hero, anchor) <= A.ROAM_LEASH + A.AGGRO) {
            const t = bestStep(e, c, occ, h => hexDist(h, hero), true);
            if (t) return move(e, c, t, occ);
            return;
        }
        // Wander within the leash; drift back if outside it.
        if (hexDist(c, anchor) > A.ROAM_LEASH) {
            const t = bestStep(e, c, occ, h => hexDist(h, anchor), true);
            if (t) move(e, c, t, occ);
            return;
        }
        const opts = e.board.neighbors(c.q, c.r).filter(h => canEnter(e, c, h, occ) && hexDist(h, anchor) <= A.ROAM_LEASH);
        const t = Rando.choice(opts);
        if (t) move(e, c, t, occ);
    }

    function enemiesAct(e) {
        const s = e.state;
        const occ = new Set(s.enemies.map(c => c.key()));
        for (const c of s.enemies.slice().sort((a, b) => a.id - b.id)) {
            if (!s.enemies.includes(c)) continue;
            const kind = ENEMY_KINDS[c.kind];
            let acted = false;
            for (let i = 0; i < c.speed && !acted; i++) {
                if (canHit(e, c)) { e.enemyAttack(c); acted = true; break; }
                if (kind.group === 'raider') {
                    const v = raidTarget(e, c);
                    if (v) { e.raidVillage(c, v); acted = true; break; }
                }
                step(e, c, occ);
            }
            if (acted) continue;
            if (canHit(e, c)) e.enemyAttack(c);
            else if (kind.group === 'raider') {
                const v = raidTarget(e, c);
                if (v) e.raidVillage(c, v);
            }
        }
    }

    function lairsSpawn(e) {
        const s = e.state;
        for (const lair of s.lairs) {
            if (!lair.active) {
                // A cleared lair stirs again after LAIR_REARM turns, with a fresh guardian one tier up.
                lair.timer++;
                const hero = s.hero;
                if (lair.timer >= A.LAIR_REARM && !s.enemies.some(c => c.isAt(lair.q, lair.r)) && hexDist(lair, hero) > A.AGGRO) {
                    const group = lair.kind === 'camp' ? 'raider' : Rando.choice(['beast', 'relic']);
                    const kind = e.kindAtTier(group, Math.min(A.MAX_ENEMY_TIER, e.tierFor(lair) + 1));
                    s.enemies.push(e.makeCreature(kind, lair.q, lair.r, { home: lair.id, guardian: true }));
                    lair.active = true;
                    lair.timer = 0;
                }
                continue;
            }
            lair.timer++;
            if (lair.timer < A.LAIR_SPAWN_PERIOD) continue;
            const kids = s.enemies.filter(c => c.home === lair.id && !c.guardian).length;
            if (kids >= A.LAIR_CAP || s.enemies.length >= A.ENEMY_CAP) continue;
            const occ = new Set(s.enemies.map(c => c.key()));
            const dummy = new Creature(lair.q, lair.r, 0, 'jackal', 'X', 1, 1);
            const free = e.board.neighbors(lair.q, lair.r).filter(h => canEnter(e, dummy, h, occ));
            const h = Rando.choice(free);
            if (!h) continue;
            const groups = lair.kind === 'camp' ? ['raider'] : ['beast', 'relic'];
            const kind = e.pickKind(groups, e.tierFor(lair));
            const c = e.makeCreature(kind, h.q, h.r, { home: lair.id, anchor: lair });
            s.enemies.push(c);
            lair.timer = 0;
            if (e.isVisible(h.q, h.r)) e.emit('spawn', { id: c.id, kind, lairId: lair.id });
        }
    }

    // Keep the wilds from emptying out: while under ROAMER_FLOOR, a wild creature may appear out of the hero's reach.
    function wildRespawn(e) {
        const s = e.state;
        const wild = s.enemies.filter(c => !c.guardian && c.home === null).length;
        if (wild >= A.ROAMER_FLOOR || s.enemies.length >= A.ENEMY_CAP || !Rando.bool(A.ROAMER_SPAWN_CHANCE)) return;
        const occ = new Set(s.enemies.map(c => c.key()));
        const dummy = new Creature(0, 0, 0, 'jackal', 'X', 1, 1);
        for (let tries = 0; tries < 12; tries++) {
            const h = Rando.choice(e.groundHexes());
            if (!h || hexDist(h, s.hero) < A.ROAMER_SPAWN_MIN_DIST || !canEnter(e, dummy, h, occ)) continue;
            const kind = e.pickKind(['beast', 'relic'], e.tierFor(h));
            s.enemies.push(e.makeCreature(kind, h.q, h.r, {}));
            return;
        }
    }

    return { enemiesAct, lairsSpawn, wildRespawn, canEnter };
})();
