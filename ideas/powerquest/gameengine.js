// gameengine.js — GameEngine
//
// All Power Quest rules over a GameState (ONTOLOGY.md §4, §7). DOM-free and render-free: every
// command re-checks its own legality, mutates state, and returns { ok, events }. World generation
// lives in WorldGen and the non-hero actors in Ecology; both operate on this engine.
const GameEngine = (function () {
    const A = GameArtifacts;
    const { TERRAIN, MODULES, PERKS, ENEMY_KINDS } = A;

    const SYLLABLES = ['ka', 'ro', 'vi', 'shu', 'tem', 'dra', 'gul', 'ba', 'nor', 'zek', 'mo', 'tha', 'ul', 'sen', 'ix', 'bo'];

    class GameEngine {
        constructor(state) {
            this.state = state;
            this.board = null;
            this.fields = new Map();   // village id -> Map<key,cost>, raider route cache (rebuilt with the board)
            this.events = [];
            this.downedBy = null;      // creature that reduced the hero to 0 this world phase
        }

        adoptBoard() {
            this.board = new Board(this.state.hexes);
            this.fields = new Map();
            this.groundCache = null;
        }

        // ---- plumbing ----
        emit(type, data) {
            this.events.push(Object.assign({ type }, data));
        }

        say(msg) {
            const log = this.state.log;
            log.push(msg);
            if (log.length > A.LOG_MAX) log.shift();
        }

        begin() { this.events = []; }
        ok(extra) { return Object.assign({ ok: true, events: this.events }, extra); }
        fail(reason) { return { ok: false, reason, events: [] }; }

        makeName() {
            let n = '';
            const parts = Rando.int(2, 3);
            for (let i = 0; i < parts; i++) n += Rando.choice(SYLLABLES);
            return n[0].toUpperCase() + n.slice(1);
        }

        // Passable non-mesa inner hexes: where wild creatures may appear. Cached per board.
        groundHexes() {
            if (!this.groundCache) this.groundCache = this.board.passableHexes().filter(h => h.terrain !== TERRAIN.MESA);
            return this.groundCache;
        }

        // ---- queries ----
        heroStats() {
            const h = this.state.hero;
            const s = { hpMax: A.BASE_HP, mp: A.BASE_MP, chargeMax: A.BASE_CHARGE, chargeRegen: A.CHARGE_REGEN_WILD,
                sight: A.BASE_SIGHT, melee: A.MELEE_BASE, armor: 0, loot: 0 };
            for (const [id, rank] of Object.entries(h.perks)) s[PERKS[id].stat] += rank * PERKS[id].amount;
            for (const id of h.sockets) {
                const m = id && MODULES[id];
                if (m && m.template === 'passive') s[m.stat] += m.amount;
            }
            return s;
        }

        xpToNext() { return A.XP_STEP * this.state.hero.level; }

        socketCount() {
            return Math.min(A.MAX_SOCKETS, A.BASE_SOCKETS + Math.floor((this.state.hero.level - 1) / A.SOCKET_LEVEL_STEP));
        }

        terrainAt(p) {
            const h = this.board.get(p.q, p.r);
            return h ? h.terrain : null;
        }

        sightRadius() {
            const t = this.terrainAt(this.state.hero);
            const bonus = t === TERRAIN.MESA ? A.MESA_SIGHT_BONUS : t === TERRAIN.JUNGLE ? -A.JUNGLE_SIGHT_PENALTY : 0;
            return Math.max(A.MIN_SIGHT, this.heroStats().sight + bonus);
        }

        isVisible(q, r) {
            return hexDist(this.state.hero, { q, r }) <= this.sightRadius();
        }

        visibleEnemies() {
            return this.state.enemies.filter(c => this.isVisible(c.q, c.r));
        }

        isOpen(v) { return !v.ruined && (v.home || v.trust >= A.OPEN_TRUST); }

        villageAt(p) { return this.state.villages.find(v => !v.ruined && v.isAt(p.q, p.r)) || null; }

        villageHpMax(v) { return A.VILLAGE_HP_BASE + A.VILLAGE_HP_PER_TIER * v.tier; }

        enemyAt(q, r) { return this.state.enemies.find(c => c.isAt(q, r)) || null; }

        minVillageDist(p) {
            let best = Infinity;
            for (const v of this.state.villages) if (!v.ruined) best = Math.min(best, hexDist(v, p));
            return best;
        }

        siteTier(p) {
            const d = this.minVillageDist(p);
            if (d === Infinity) return 1;
            return Math.min(A.MAX_ENEMY_TIER, 1 + Math.floor(d / A.TIER_DIST));
        }

        tierFor(p) {
            return Math.min(A.MAX_ENEMY_TIER, this.siteTier(p) + Math.floor((this.state.hero.level - 1) / A.TIER_LEVELS));
        }

        // Weighted kind of any listed group with tier <= cap (1 at cap, 0.5 one below, 0.25 lower).
        pickKind(groups, cap) {
            const cand = Object.keys(ENEMY_KINDS).filter(k => groups.includes(ENEMY_KINDS[k].group) && ENEMY_KINDS[k].tier <= cap);
            const list = cand.length ? cand : Object.keys(ENEMY_KINDS).filter(k => groups.includes(ENEMY_KINDS[k].group) && ENEMY_KINDS[k].tier === 1);
            const top = Math.max(...list.map(k => ENEMY_KINDS[k].tier));
            return Rando.weighted(list.map(k => ({ item: k, weight: [1, 0.5, 0.25, 0.25][Math.min(3, top - ENEMY_KINDS[k].tier)] })));
        }

        // The kind of a group whose tier is closest to `tier` (ties go higher).
        kindAtTier(group, tier) {
            const cand = Object.keys(ENEMY_KINDS).filter(k => ENEMY_KINDS[k].group === group);
            cand.sort((a, b) => Math.abs(ENEMY_KINDS[a].tier - tier) - Math.abs(ENEMY_KINDS[b].tier - tier) || ENEMY_KINDS[b].tier - ENEMY_KINDS[a].tier);
            return cand[0];
        }

        makeCreature(kindId, q, r, opts) {
            const s = this.state, k = ENEMY_KINDS[kindId];
            const hpMax = Math.round(k.hp * (opts.guardian ? A.GUARDIAN_HP_MULT : 1));
            const c = new Creature(q, r, s.nextId++, kindId, this.makeName(), hpMax, Rando.int(k.speed[0], k.speed[1]));
            c.home = opts.home ?? null;
            c.guardian = !!opts.guardian;
            const anchor = opts.anchor || { q, r };
            c.aq = anchor.q; c.ar = anchor.r;
            return c;
        }

        // Cached cost field from the village nearest to c, for raider routing (mesa closed to raiders).
        nearestVillageField(c) {
            let best = null, bd = Infinity;
            for (const v of this.state.villages) {
                if (v.ruined) continue;
                const dd = hexDist(v, c);
                if (dd < bd) { bd = dd; best = v; }
            }
            if (!best) return null;
            let f = this.fields.get(best.id);
            if (!f) {
                f = bfsHexes(best, this.state.hexes, h => h.terrain === TERRAIN.MESA ? Infinity : this.board.moveCost(h), Infinity);
                this.fields.set(best.id, f);
            }
            return f;
        }

        // Hexes the hero can reach with the mp left; enemy hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const occ = new Set(s.enemies.map(c => c.key()));
            const costs = bfsHexes(s.hero, s.hexes, h => occ.has(Hex.key(h.q, h.r)) ? Infinity : this.board.moveCost(h), s.mp);
            costs.delete(s.hero.key());
            return costs;
        }

        attackable() {
            const s = this.state;
            const out = new Set();
            for (const c of s.enemies) if (hexDist(c, s.hero) === 1) out.add(c.key());
            return out;
        }

        weaponRange(w) {
            return w.range + (this.terrainAt(this.state.hero) === TERRAIN.MESA ? A.MESA_RANGE_BONUS : 0);
        }

        shootable(slot) {
            const s = this.state;
            const w = MODULES[s.hero.sockets[slot]];
            if (!w || w.template !== 'weapon') return [];
            return s.enemies.filter(c => hexDist(c, s.hero) <= this.weaponRange(w));
        }

        canCraft(id) {
            const s = this.state, h = s.hero, m = MODULES[id];
            const v = this.villageAt(h);
            if (!m) return 'no such module';
            if (!v) return 'not at a village';
            if (!this.isOpen(v)) return 'village does not trust you yet';
            if (!h.blueprints.includes(id)) return 'blueprint unknown';
            if (v.tier < m.tier - 1) return 'village tier too low';
            if (h.pack.scrap < m.price.scrap || h.pack.cells < m.price.cells) return 'not enough parts';
            return null;
        }

        canFound() {
            const s = this.state, h = s.hero;
            if (this.terrainAt(h) !== TERRAIN.PLAINS) return 'must be on plains';
            if (s.villages.some(v => v.isAt(h.q, h.r)) || s.ruins.some(r => r.isAt(h.q, h.r)) || s.lairs.some(l => l.isAt(h.q, h.r))) return 'a site is here';
            if (h.pack.scrap < A.FOUND_SCRAP || h.pack.cells < A.FOUND_CELLS) return 'not enough parts';
            if (s.villages.some(v => !v.ruined && hexDist(v, h) < A.FOUND_MIN_DIST)) return 'too close to a village';
            const open = s.villages.filter(v => this.isOpen(v));
            if (open.length && !open.some(v => v.trust >= A.FOUND_TRUST && hexDist(v, h) <= A.FOUND_RADIUS)) return 'no trusted village near enough';
            return null;
        }

        // ---- new game ----
        newGame(seed) {
            const s = this.state;
            this.begin();
            s.seed = (seed === undefined || seed === null) ? Math.floor(Math.random() * 0x100000000) : (seed >>> 0);
            Rando.seed(s.seed);
            if (!WorldGen.build(this, A.GEN_MAX_ATTEMPTS)) {
                s.seed = A.KNOWN_GOOD_SEED;
                Rando.seed(s.seed);
                WorldGen.build(this, A.GEN_MAX_ATTEMPTS);
            }
            s.turn = 1;
            s.phase = 'hero';
            s.mp = this.heroStats().mp;
            this.downedBy = null;
            this.say('You wake the old armor. The village is behind you.');
            return this.ok();
        }

        // ---- fog and arrival ----
        reveal(initial) {
            const s = this.state, h = s.hero;
            const radius = this.sightRadius();
            for (const hx of new Hex(h.q, h.r).inRange(radius)) {
                const k = hx.key();
                if (this.state.hexes.has(k)) s.explored[k] = 1;
            }
            const lists = [['village', s.villages], ['ruin', s.ruins], ['lair', s.lairs]];
            for (const [kind, list] of lists) {
                for (const site of list) {
                    if (site.discovered) continue;
                    const jungle = this.terrainAt(site) === TERRAIN.JUNGLE;
                    const reach = jungle ? Math.min(radius, A.JUNGLE_HIDE_RADIUS) : radius;
                    if (hexDist(site, h) > reach) continue;
                    site.discovered = true;
                    if (initial) continue;
                    let xp = 0;
                    if (kind === 'village') xp = A.VILLAGE_DISCOVERY_XP;
                    this.emit('discover', { kind, id: site.id, xp });
                    this.say('Discovered ' + (kind === 'village' ? 'the village of ' + site.name : kind === 'ruin' ? 'a ruin' : 'a ' + site.kind) + '.');
                    if (xp) this.gainXp(xp);
                }
            }
        }

        arrival() {
            const s = this.state, h = s.hero;
            const ru = s.ruins.find(r => r.isAt(h.q, h.r));
            if (!ru || ru.looted) return;
            ru.looted = true;
            let bp = ru.blueprint;
            if (bp && h.blueprints.includes(bp)) { h.pack.cells += A.RUIN_CELLS; bp = null; }
            else if (bp) h.blueprints.push(bp);
            h.pack.cells += A.RUIN_CELLS;
            this.emit('loot', { blueprint: bp, cells: A.RUIN_CELLS });
            this.say(bp ? 'Ruin looted: blueprint for ' + MODULES[bp].name + ', ' + A.RUIN_CELLS + ' cells.' : 'Ruin looted: cells.');
            this.gainXp(A.DISCOVERY_XP);
        }

        // ---- xp, levels, perks ----
        gainXp(n) {
            const h = this.state.hero;
            h.xp += n;
            while (h.xp >= this.xpToNext()) {
                const before = this.heroStats();
                h.xp -= this.xpToNext();
                h.level++;
                const want = this.socketCount();
                while (h.sockets.length < want) h.sockets.push(null);
                this.state.perkOffers.push(Rando.shuffle(Object.keys(PERKS)).slice(0, A.PERK_OFFER));
                this.growResources(before);
                this.emit('levelUp', { level: h.level, sockets: h.sockets.length });
                this.say('Level ' + h.level + '!');
            }
        }

        // Raise hp and charge by the change in their maxima (no free refill); clamp to the new max.
        growResources(before) {
            const h = this.state.hero, now = this.heroStats();
            h.hp = Math.min(now.hpMax, h.hp + Math.max(0, now.hpMax - before.hpMax));
            h.charge = Math.min(now.chargeMax, h.charge + Math.max(0, now.chargeMax - before.chargeMax));
        }

        pickPerk(i) {
            this.begin();
            const s = this.state, offer = s.perkOffers[0];
            if (!offer || !Number.isInteger(i) || i < 0 || i >= offer.length) return this.fail('no such perk offer');
            const before = this.heroStats();
            const id = offer[i];
            s.hero.perks[id] = (s.hero.perks[id] || 0) + 1;
            s.perkOffers.shift();
            this.growResources(before);
            this.emit('perk', { perkId: id, rank: s.hero.perks[id] });
            this.say(PERKS[id].name + ' rank ' + s.hero.perks[id] + '.');
            return this.ok();
        }

        gate() {
            const s = this.state;
            if (s.phase !== 'hero') return 'not the hero phase';
            if (s.perkOffers.length) return 'choose a perk first';
            return null;
        }

        // ---- hero commands ----
        move(q, r) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const s = this.state;
            const cost = this.computeReachable().get(Hex.key(q, r));
            if (cost === undefined) return this.fail('unreachable');
            const from = { q: s.hero.q, r: s.hero.r };
            s.hero.moveTo(q, r);
            s.hero.sheltered = false;
            s.mp -= cost;
            this.emit('move', { from, to: { q, r } });
            this.reveal();
            this.arrival();
            return this.ok({ cost });
        }

        attack(q, r) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const s = this.state, c = this.enemyAt(q, r);
            if (!c || hexDist(c, s.hero) !== 1) return this.fail('no adjacent enemy');
            if (s.mp < A.MELEE_MP) return this.fail('no movement left');
            s.mp -= A.MELEE_MP;
            this.strike(c, this.heroStats().melee + Rando.int(0, A.DMG_SPREAD));
            return this.ok();
        }

        shoot(slot, q, r) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const s = this.state, w = MODULES[s.hero.sockets[slot]], c = this.enemyAt(q, r);
            if (!w || w.template !== 'weapon') return this.fail('no weapon in that socket');
            if (!c || hexDist(c, s.hero) > this.weaponRange(w)) return this.fail('out of range');
            if (s.hero.charge < w.cost) return this.fail('not enough charge');
            s.hero.charge -= w.cost;
            this.strike(c, w.dmg + Rando.int(0, A.DMG_SPREAD));
            return this.ok();
        }

        activate(slot) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const h = this.state.hero, m = MODULES[h.sockets[slot]];
            if (!m || m.template !== 'active') return this.fail('no active module in that socket');
            if (h.charge < m.cost) return this.fail('not enough charge');
            h.charge -= m.cost;
            if (m.effect === 'heal') h.hp = Math.min(this.heroStats().hpMax, h.hp + m.amount);
            else h.shield += m.amount;
            this.say(m.name + ' engaged.');
            return this.ok();
        }

        boost(n) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const s = this.state;
            if (!Number.isInteger(n) || n < 1 || n > s.hero.charge) return this.fail('bad boost');
            s.hero.charge -= n;
            s.mp += n * A.BOOST_MP_PER_CHARGE;
            return this.ok();
        }

        strike(c, dmg) {
            c.hp -= dmg;
            this.emit('hit', { by: 'hero', target: c.id, dmg, absorbed: 0 });
            this.say('You hit ' + c.name + ' the ' + ENEMY_KINDS[c.kind].name + ' for ' + dmg + '.');
            if (c.hp <= 0) this.kill(c);
        }

        kill(c) {
            const s = this.state, h = s.hero, k = ENEMY_KINDS[c.kind];
            s.enemies.splice(s.enemies.indexOf(c), 1);
            s.nemeses = s.nemeses.filter(id => id !== c.id);
            s.stats.kills++;
            let mult = c.slayer ? A.REVENGE_XP_MULT : 1;
            if (s.villages.some(v => this.isOpen(v) && hexDist(v, c) <= A.HOME_RADIUS)) mult *= A.HOME_XP_MULT;
            const xp = Math.round(k.xp * mult);
            const loot = { scrap: k.drop.scrap, cells: k.drop.cells };
            if (c.guardian) { loot.scrap += k.drop.scrap; loot.cells += k.drop.cells; }
            for (const t of ['scrap', 'cells']) if (loot[t] > 0) loot[t] += this.heroStats().loot;
            h.pack.scrap += loot.scrap; h.pack.cells += loot.cells;
            for (const v of s.villages) {
                if (v.ruined || hexDist(v, c) > A.TRUST_RADIUS) continue;
                const d = A.KILL_TRUST_PER_TIER * k.tier;
                v.trust = Math.min(A.TRUST_MAX, v.trust + d);
                this.emit('trust', { villageId: v.id, delta: d });
            }
            if (c.guardian) {
                const lair = s.lairs.find(l => l.id === c.home);
                if (lair) lair.active = false;
            }
            this.emit('kill', { enemyId: c.id, name: c.name, xp, loot, revenge: c.slayer });
            this.say(c.name + (c.slayer ? ' (your nemesis)' : '') + ' falls: +' + xp + ' xp, ' + loot.scrap + ' scrap, ' + loot.cells + ' cells.');
            this.gainXp(xp + (c.guardian ? A.DISCOVERY_XP : 0));
        }

        deposit(scrap, cells) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const h = this.state.hero, v = this.villageAt(h);
            if (!v) return this.fail('not at a village');
            if (!Number.isInteger(scrap) || !Number.isInteger(cells) || scrap < 0 || cells < 0 || scrap + cells === 0) return this.fail('bad amounts');
            if (scrap > h.pack.scrap || cells > h.pack.cells) return this.fail('not carrying that much');
            h.pack.scrap -= scrap; h.pack.cells -= cells;
            const value = scrap + A.CELL_VALUE * cells;
            v.stock += value;
            this.state.stats.deposited += value;
            const gift = Math.min(value / A.GIFT_VALUE_PER_TRUST, v.giftBucket);
            v.giftBucket -= gift;
            v.trust = Math.min(A.TRUST_MAX, v.trust + gift);
            if (gift > 0) this.emit('trust', { villageId: v.id, delta: gift });
            this.retier(v);
            this.say(v.name + ' accepts ' + value + ' of salvage.');
            return this.ok();
        }

        retier(v) {
            let t = v.tier;
            while (t < A.MAX_TIER && v.stock >= A.TIER_COSTS[t + 1]) t++;
            if (t > v.tier) {
                v.tier = t;
                v.hp = Math.min(this.villageHpMax(v), v.hp + A.VILLAGE_HP_PER_TIER);
                this.emit('tier', { villageId: v.id, tier: t });
                this.say(v.name + ' rises to tier ' + t + '.');
            }
        }

        craft(id, slot) {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const h = this.state.hero;
            const why = this.canCraft(id);
            if (why) return this.fail(why);
            if (!Number.isInteger(slot) || slot < 0 || slot >= h.sockets.length) return this.fail('no such socket');
            const m = MODULES[id], before = this.heroStats();
            h.pack.scrap -= m.price.scrap; h.pack.cells -= m.price.cells;
            h.sockets[slot] = id;
            this.state.stats.crafted++;
            const now = this.heroStats();
            h.hp = Math.min(h.hp, now.hpMax); h.charge = Math.min(h.charge, now.chargeMax);
            this.growResources(before);
            this.emit('craft', { moduleId: id, slot });
            this.say('Crafted ' + m.name + '.');
            return this.ok();
        }

        found() {
            this.begin();
            const g = this.gate(); if (g) return this.fail(g);
            const s = this.state, h = s.hero;
            const why = this.canFound();
            if (why) return this.fail(why);
            h.pack.scrap -= A.FOUND_SCRAP; h.pack.cells -= A.FOUND_CELLS;
            const v = new Village(h.q, h.r, s.nextId++, this.makeName());
            v.trust = A.FOUNDER_TRUST; v.discovered = true; v.hp = this.villageHpMax(v);
            s.villages.push(v);
            s.stats.founded++;
            this.emit('found', { villageId: v.id });
            this.say('You found the village of ' + v.name + '.');
            return this.ok();
        }

        endTurn() {
            this.begin();
            if (this.state.perkOffers.length) return this.fail('choose a perk first');
            if (this.state.phase !== 'hero') return this.fail('not the hero phase');
            const s = this.state;
            s.phase = 'world';
            this.worldPhase();
            s.phase = 'hero';
            s.turn++;
            s.mp = this.heroStats().mp;
            s.hero.shield = 0;
            return this.ok();
        }

        // ---- world phase ----
        worldPhase() {
            this.downedBy = null;
            this.runWorld();
            if (this.downedBy) this.shutdown(this.downedBy);
        }

        runWorld() {
            Ecology.enemiesAct(this);
            Ecology.lairsSpawn(this);
            Ecology.wildRespawn(this);
            this.villagesTick();
            if (!this.state.hero.away) this.heroRecover();
        }

        villagesTick() {
            const s = this.state;
            for (const v of s.villages) {
                if (v.ruined) continue;
                v.hp = Math.min(this.villageHpMax(v), v.hp + A.VILLAGE_HP_REGEN + A.VILLAGE_REGEN_PER_TIER * v.tier);
                v.giftBucket = Math.min(A.GIFT_CAP, v.giftBucket + A.GIFT_REFILL);
                if (s.turn % A.DECAY_PERIOD === 0 && v.trust > 0 && hexDist(v, s.hero) > A.NEGLECT_RADIUS) {
                    v.trust -= 1;
                    this.emit('trust', { villageId: v.id, delta: -1 });
                }
            }
        }

        heroRecover() {
            const s = this.state, h = s.hero, st = this.heroStats();
            h.charge = Math.min(st.chargeMax, h.charge + st.chargeRegen);
            const v = this.villageAt(h);
            if (v && this.isOpen(v)) {
                h.hp = Math.min(st.hpMax, h.hp + A.HEAL_BASE + A.HEAL_PER_TIER * v.tier);
                h.charge = st.chargeMax;
            }
            if (s.ruins.some(r => r.isAt(h.q, h.r))) h.charge = st.chargeMax;
            if (h.sheltered && h.hp >= Math.ceil(st.hpMax / 2)) h.sheltered = false;
        }

        enemyAttack(c) {
            const k = ENEMY_KINDS[c.kind], h = this.state.hero;
            let d = Math.max(A.MIN_DMG, k.dmg - this.heroStats().armor);
            const absorbed = Math.min(h.shield, d);
            h.shield -= absorbed;
            d -= absorbed;
            h.hp -= d;
            this.emit('hit', { by: c.id, target: 'hero', dmg: d, absorbed });
            this.say(c.name + ' the ' + k.name + ' hits you for ' + d + (absorbed ? ' (' + absorbed + ' absorbed)' : '') + '.');
            if (h.hp <= 0) { h.hp = 0; this.downedBy = c; }
        }

        raidVillage(c, v) {
            const k = ENEMY_KINDS[c.kind];
            const d = Math.max(A.MIN_DMG, Math.round(k.dmg * A.RAID_DAMAGE_PER_HIT) - v.tier);
            v.hp -= d;
            this.emit('raid', { villageId: v.id, dmg: d });
            if (this.isVisible(v.q, v.r) || this.isVisible(c.q, c.r)) this.say(c.name + ' raids ' + v.name + ' (' + Math.max(0, v.hp) + ' hp left).');
            if (v.hp > 0) return;
            if (v.tier > 0) {
                v.tier--;
                v.stock = A.TIER_COSTS[v.tier];
                v.hp = Math.floor(this.villageHpMax(v) / 2);
                this.emit('villageFell', { villageId: v.id, ruined: false });
                this.say(v.name + ' is battered down to tier ' + v.tier + '.');
            } else {
                v.ruined = true;
                v.hp = 0;
                this.emit('villageFell', { villageId: v.id, ruined: true });
                this.say(v.name + ' has fallen.');
            }
        }

        shutdown(by) {
            const s = this.state, h = s.hero;
            by.slayer = true;
            if (!s.nemeses.includes(by.id)) s.nemeses.push(by.id);
            s.stats.shutdowns++;
            h.away = true;
            for (let i = 0; i < A.SHUTDOWN_DAYS; i++) { s.turn++; this.runWorld(); }
            h.away = false;
            const lostPack = { scrap: Math.ceil(h.pack.scrap * A.LOSE_PACK_FRAC), cells: Math.ceil(h.pack.cells * A.LOSE_PACK_FRAC) };
            h.pack.scrap -= lostPack.scrap; h.pack.cells -= lostPack.cells;
            const lostXp = Math.ceil(h.xp * A.LOSE_XP_FRAC);
            h.xp -= lostXp;
            const live = s.villages.filter(v => !v.ruined);
            const open = live.filter(v => this.isOpen(v));
            let shelter = WorldGen.nearest(open.length ? open : live, h);
            if (shelter) {
                // The village that carried you in never closes its door over it.
                shelter.trust = this.isOpen(shelter) ? Math.max(A.OPEN_TRUST, shelter.trust - A.SHUTDOWN_TRUST) : shelter.trust - A.SHUTDOWN_TRUST;
                h.moveTo(shelter.q, shelter.r);
            } else {
                // Every village has fallen: survivors gather where you fell and raise a new one.
                const spot = WorldGen.nearest(this.groundHexes().filter(x => x.terrain === TERRAIN.PLAINS && !s.ruins.some(r => r.isAt(x.q, x.r)) && !s.lairs.some(l => l.isAt(x.q, x.r)) && !this.enemyAt(x.q, x.r)), h);
                if (spot) {
                    const nv = new Village(spot.q, spot.r, s.nextId++, this.makeName());
                    nv.trust = A.FOUNDER_TRUST; nv.discovered = true; nv.hp = this.villageHpMax(nv);
                    s.villages.push(nv);
                    h.moveTo(spot.q, spot.r);
                    shelter = nv;
                    this.emit('found', { villageId: nv.id });
                }
            }
            h.hp = A.SHUTDOWN_HP; h.charge = 0; h.shield = 0;
            h.sheltered = !!shelter;
            this.reveal();
            this.emit('shutdown', { byId: by.id, shelterId: shelter ? shelter.id : null, lostPack, lostXp });
            this.say('Armor shutdown! ' + by.name + ' the ' + ENEMY_KINDS[by.kind].name + ' got you. You wake at ' + (shelter ? shelter.name : 'where you fell') + ', depleted.');
        }
    }

    return GameEngine;
})();
