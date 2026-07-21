// gameengine.js — GameEngine
//
// Rules + world generation over a GameState. DOM-free and render-free: methods mutate
// state and return an outcome object ({ ok:false } illegal | { ok:true, ... }); the UI
// inspects the outcome and decides what to redraw. Legality is always re-derived here
// (never trust the client's cached highlight sets). All randomness flows through Rando,
// seeded from state.seed, so a world reproduces from its save.
//
// The three verbs live here: acquisition (harvest/hunt/bank/craft), prestige (renown,
// the dawn tax, ranks and privileges, monuments), destruction (toppling dooms, sacking
// holdings — and the Reckoning that answers).
const GameEngine = (function () {
    const {
        TERRAIN, TERRAIN_RULES, RING_TERRAIN, NODES, RING_YIELD, FOES, WILD_BY_RING,
        RAIDERS_BY_TIER, SKILLS, RANKS, MONUMENT_FORMS, DOOM_EPITHETS, RULES
    } = GameArtifacts;

    const SKILL_DEFS = Object.fromEntries(SKILLS.map(s => [s.key, s]));

    // Everything rolls, costs never roll: every payout is a gaussian around its rule
    // value. Never below 1 — a windfall can disappoint but not vanish.
    function roll(value) {
        return Math.max(1, Math.round(Rando.around(value, value * RULES.ROLL_SPREAD)));
    }

    // Use-based leveling: xp to climb out of `level` is polynomial — early levels
    // tumble in, later ones are a life's work.
    function xpNeeded(level) {
        return Math.round(15 * Math.pow(level + 1, 1.6));
    }

    class GameEngine {
        constructor(state) {
            this.state = state;
            this.hexList = [];   // cached array of hex objects for random draws
        }

        // ---- Lifecycle ----

        newGame() {
            // The only raw random in the game: picking the seed itself.
            const seed = Math.floor(Math.random() * 0x7fffffff);
            Rando.seed(seed);
            this.state.loadJSON(this.freshWorld(seed));
            this.cacheHexes();
            this.log(`${this.state.hero.name} ${this.rank().title} takes up the road.`);
            this.log('Fame melts each dawn. Feed it.');
        }

        loadGame(json) {
            this.state.loadJSON(json);
            // Continue the stream deterministically without replaying the world's history.
            Rando.seed(this.state.seed + this.state.turn * 7919);
            this.cacheHexes();
        }

        cacheHexes() {
            this.hexList = [...this.state.hexes.values()];
        }

        // ---- World generation ----

        freshWorld(seed) {
            const hexes = new Map();
            const hallHex = this.centerAxial();
            for (let row = 0; row < RULES.MAP_ROWS; row++) {
                for (let col = 0; col < RULES.MAP_COLS; col++) {
                    const q = col - Math.floor(row / 2);
                    const r = row;
                    const ring = Math.min(RULES.RING_MAX,
                        Math.floor(new Hex(q, r).distance(hallHex) / RULES.RING_WIDTH));
                    let terrain = Rando.weighted(RING_TERRAIN[ring]);
                    if (Rando.bool(RULES.CRAG_SPRINKLE)) terrain = TERRAIN.CRAG;
                    hexes.set(Hex.key(q, r), { q, r, terrain, ring, node: null });
                }
            }
            this.carveMeres(hexes, hallHex);
            this.clearAround(hexes, hallHex);
            this.seedNodes(hexes);

            const used = new Set();
            const anchors = [{ kind: 'hall', name: 'the Hall', q: hallHex.q, r: hallHex.r }];
            this.hexList = [...hexes.values()];
            this.placeHoldings(hexes, anchors, used);
            for (const tier of RULES.DOOM_START) this.placeDoom(hexes, anchors, used, tier);
            for (const a of anchors) hexes.get(Hex.key(a.q, a.r)).node = null;

            const hero = {
                name: NameGen.uniqueWord('heroic', used),
                q: hallHex.q, r: hallHex.r,
                hp: RULES.HERO_HP,
                wealth: 0, renown: 0, rankIdx: 0,
                pack: [],
                skills: Object.fromEntries(SKILLS.map(s => [s.key, { level: 0, xp: 0 }])),
                sacks: 0, deaths: 0
            };

            const world = {
                seed, hexes: [...hexes.values()], hero, foes: [], anchors,
                turn: 1, mp: RULES.HERO_MP, phase: 'player',
                reckoning: 0, doomClock: 0, monumentsBuilt: 0, log: []
            };
            // Populate the wilds through the state the spawner expects.
            this.state.loadJSON(world);
            this.cacheHexes();
            for (let i = 0; i < 12; i++) this.spawnWild();
            return this.state.toJSON();
        }

        centerAxial() {
            const row = Math.floor(RULES.MAP_ROWS / 2);
            const col = Math.floor(RULES.MAP_COLS / 2);
            return new Hex(col - Math.floor(row / 2), row);
        }

        carveMeres(hexes, hallHex) {
            const all = [...hexes.values()];
            for (let b = 0; b < RULES.MERE_BLOBS; b++) {
                let at = Rando.choice(all);
                if (new Hex(at.q, at.r).distance(hallHex) < 8) continue;
                for (let i = 0; i < RULES.MERE_SIZE; i++) {
                    at.terrain = TERRAIN.MERE;
                    const next = Rando.choice(new Hex(at.q, at.r).neighbors()
                        .map(n => hexes.get(n.key())).filter(Boolean));
                    if (!next || new Hex(next.q, next.r).distance(hallHex) < 8) break;
                    at = next;
                }
            }
        }

        // The hearth itself is always open ground.
        clearAround(hexes, hallHex) {
            for (const h of hallHex.inRange(1)) {
                const hex = hexes.get(h.key());
                if (hex) hex.terrain = TERRAIN.MEADOW;
            }
        }

        seedNodes(hexes) {
            for (const hex of hexes.values()) {
                const rules = TERRAIN_RULES[hex.terrain];
                if (!rules.nodeKind || !Rando.bool(rules.nodeChance)) continue;
                const stock = Rando.int(RULES.NODE_STOCK_MIN, RULES.NODE_STOCK_MAX);
                hex.node = { kind: rules.nodeKind, stock, maxStock: stock, mult: RING_YIELD[hex.ring] };
            }
        }

        // Try random passable hexes until one satisfies the predicate.
        findSpot(predicate) {
            for (let i = 0; i < 300; i++) {
                const hex = Rando.choice(this.hexList);
                if (this.passable(hex) && predicate(hex)) return hex;
            }
            return null;
        }

        minAnchorDist(anchors, hex) {
            if (anchors.length === 0) return Infinity;
            return Math.min(...anchors.map(a => new Hex(a.q, a.r).distance(new Hex(hex.q, hex.r))));
        }

        placeHoldings(hexes, anchors, used) {
            for (let i = 0; i < RULES.HOLDING_COUNT; i++) {
                const spot = this.findSpot(hex =>
                    hex.ring <= RULES.HOLDING_MAX_RING && hex.ring >= 1 &&
                    this.minAnchorDist(anchors, hex) >= RULES.HOLDING_MIN_DIST);
                if (!spot) continue;
                anchors.push({
                    kind: 'holding', name: NameGen.uniqueWord('homely', used),
                    q: spot.q, r: spot.r, hp: RULES.HOLDING_HP, maxHp: RULES.HOLDING_HP
                });
            }
        }

        placeDoom(hexes, anchors, used, tier) {
            const hall = anchors[0];
            const spot = this.findSpot(hex =>
                new Hex(hex.q, hex.r).distance(new Hex(hall.q, hall.r)) >= RULES.DOOM_MIN_DIST_HALL &&
                this.minAnchorDist(anchors.filter(a => a.kind === 'doom'), hex) >= RULES.DOOM_MIN_DIST &&
                this.minAnchorDist(anchors, hex) >= 3 &&
                !this.foeAt(hex.q, hex.r) &&
                !(this.state.hero && hex.q === this.state.hero.q && hex.r === this.state.hero.r));
            if (!spot) return;
            const style = tier >= 3 ? 'eldritch' : 'dread';
            const name = `${NameGen.uniqueWord(style, used)}, ${Rando.choice(DOOM_EPITHETS[tier])}`;
            const hp = RULES.DOOM_HP_PER_TIER * tier;
            spot.node = null;
            anchors.push({ kind: 'doom', name, q: spot.q, r: spot.r, tier, hp, maxHp: hp, fester: 0 });
        }

        // ---- Lookups ----

        hexAt(q, r) {
            return this.state.hexes.get(Hex.key(q, r));
        }

        passable(hex) {
            return TERRAIN_RULES[hex.terrain].moveCost !== Infinity;
        }

        anchorAt(q, r) {
            return this.state.anchors.find(a => a.q === q && a.r === r);
        }

        foeAt(q, r) {
            return this.state.foes.find(f => f.q === q && f.r === r);
        }

        heroHex() {
            return this.hexAt(this.state.hero.q, this.state.hero.r);
        }

        holdings() {
            return this.state.anchors.filter(a => a.kind === 'holding');
        }

        dooms() {
            return this.state.anchors.filter(a => a.kind === 'doom');
        }

        monuments() {
            return this.state.anchors.filter(a => a.kind === 'monument');
        }

        // ---- Derived stats: skills ----

        skillLevel(key) {
            return this.state.hero.skills[key].level;
        }

        // 1 + per*level for pct skills — the uniform multiplier template.
        skillMult(key) {
            return 1 + SKILL_DEFS[key].per * this.skillLevel(key);
        }

        gainXp(key, amount) {
            const skill = this.state.hero.skills[key];
            skill.xp += Math.max(1, Math.round(amount));
            while (skill.xp >= xpNeeded(skill.level)) {
                skill.xp -= xpNeeded(skill.level);
                skill.level += 1;
                this.log(`${SKILL_DEFS[key].name} rises to ${skill.level}.`);
            }
        }

        // For the skills panel: how far along the current level is.
        xpProgress(key) {
            const skill = this.state.hero.skills[key];
            return { level: skill.level, xp: skill.xp, need: xpNeeded(skill.level) };
        }

        heroAttack() {
            const base = RULES.HERO_ATTACK + this.skillLevel('combat');
            return this.hasPriv('heroic') ? Math.round(base * 1.5) : base;
        }

        packCap() {
            return RULES.PACK_CAP + (this.hasPriv('carry') ? RULES.CARRY_PRIV : 0);
        }

        packValue() {
            return this.state.hero.pack.reduce((sum, s) => sum + s.value, 0);
        }

        // ---- Derived stats: prestige ----

        rankIndex() {
            return this.state.hero.rankIdx;
        }

        // Every renown change flows through here so rank ratchets in one place.
        // Hysteresis: a title is won at its threshold but held down to RANK_HOLD of
        // it — grace, then the fall — so titles don't flap at the boundary.
        addRenown(delta) {
            const hero = this.state.hero;
            hero.renown = Math.max(0, hero.renown + Math.round(delta));
            while (hero.rankIdx < RANKS.length - 1 && hero.renown >= RANKS[hero.rankIdx + 1].at) {
                hero.rankIdx += 1;
            }
            while (hero.rankIdx > 0 && hero.renown < RANKS[hero.rankIdx].at * RULES.RANK_HOLD) {
                hero.rankIdx -= 1;
            }
        }

        rank() {
            return RANKS[this.rankIndex()];
        }

        title() {
            return `${this.state.hero.name} ${this.rank().title}`;
        }

        // Privileges are cumulative: held if any rank at or below the current one grants it.
        hasPriv(key) {
            const idx = this.rankIndex();
            return RANKS.some((r, i) => i <= idx && r.priv === key);
        }

        renownMult() {
            return this.skillMult('presence') * (this.hasPriv('watched') ? 1.5 : 1);
        }

        // A deed: presence amplifies it and learns from it.
        gainDeedRenown(base) {
            const gained = Math.max(1, Math.round(base * this.renownMult()));
            this.addRenown(gained);
            this.gainXp('presence', gained / 2);
            return gained;
        }

        // Passive income (monuments): a floor against the dawn tax, deliberately
        // outside the deed multipliers — stone doesn't get louder because you do.
        gainPassiveRenown(base) {
            const gained = Math.max(1, Math.round(base));
            this.addRenown(gained);
            return gained;
        }

        decayAmount() {
            const renown = this.state.hero.renown;
            if (renown <= RULES.DECAY_FLOOR) return 0;
            return Math.floor(renown / RULES.DECAY_DIVISOR);
        }

        // ---- Legal-move sets (the UI's highlight source, re-derived on action) ----

        moveCost(hex) {
            if (this.foeAt(hex.q, hex.r)) return Infinity;
            const anchor = this.anchorAt(hex.q, hex.r);
            if (anchor && anchor.kind === 'doom') return Infinity;
            return TERRAIN_RULES[hex.terrain].moveCost;
        }

        computeReachable() {
            const s = this.state;
            const costs = bfsHexes(s.hero, s.hexes, hex => this.moveCost(hex), s.mp);
            costs.delete(Hex.key(s.hero.q, s.hero.r));
            return costs;
        }

        computeAttackable() {
            const s = this.state;
            if (s.mp < RULES.ATTACK_MP) return new Set();
            const out = new Set();
            for (const n of new Hex(s.hero.q, s.hero.r).neighbors()) {
                if (!this.state.hexes.has(n.key())) continue;
                const anchor = this.anchorAt(n.q, n.r);
                if (this.foeAt(n.q, n.r) || (anchor && anchor.kind === 'doom')) out.add(n.key());
            }
            return out;
        }

        // ---- Player actions ----

        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };
            s.hero.q = q;
            s.hero.r = r;
            s.mp -= cost;
            return { ok: true };
        }

        // Rank spikes happen mid-action (a toppling can mint a title on the spot).
        withRank(fn) {
            const prev = this.rankIndex();
            const res = fn();
            if (res.ok && this.rankIndex() > prev) res.rankUp = this.title();
            return res;
        }

        attack(q, r) {
            return this.withRank(() => {
                const s = this.state;
                if (s.mp < RULES.ATTACK_MP) return { ok: false };
                if (new Hex(q, r).distance(new Hex(s.hero.q, s.hero.r)) !== 1) return { ok: false };
                const foe = this.foeAt(q, r);
                const anchor = this.anchorAt(q, r);
                if (foe) return this.strikeFoe(foe);
                if (anchor && anchor.kind === 'doom') return this.strikeDoom(anchor);
                return { ok: false };
            });
        }

        strikeFoe(foe) {
            const s = this.state;
            s.mp -= RULES.ATTACK_MP;
            const dmg = roll(this.heroAttack());
            foe.hp -= dmg;
            this.gainXp('combat', dmg);
            if (foe.hp > 0) return { ok: true };

            s.foes.splice(s.foes.indexOf(foe), 1);
            const def = FOES[foe.kind];
            const spoils = roll(def.spoils * this.skillMult('hunting'));
            this.gainXp('hunting', spoils);
            this.takeSpoil({ kind: 'spoils', value: spoils });
            const base = def.role === 'champion' ? RULES.CHAMPION_RENOWN : def.tier * RULES.KILL_RENOWN_PER_TIER;
            const renown = this.gainDeedRenown(base);
            const name = foe.name ? foe.name : `the ${def.label}`;
            this.log(`${name} falls. Spoils ${spoils}, renown +${renown}.`);
            return { ok: true };
        }

        strikeDoom(doom) {
            const s = this.state;
            s.mp -= RULES.ATTACK_MP;
            const dmg = roll(this.heroAttack());
            doom.hp -= dmg;
            this.gainXp('combat', dmg);
            if (doom.hp > 0) return { ok: true };

            s.anchors.splice(s.anchors.indexOf(doom), 1);
            for (let i = 0; i < RULES.DOOM_SPOILS_PER_TIER * doom.tier; i++) {
                this.takeSpoil({ kind: 'relic', value: roll(NODES.relic.base * doom.tier) });
            }
            const renown = this.gainDeedRenown(RULES.DOOM_REWARD_PER_TIER * doom.tier);
            s.reckoning += 1;
            s.doomClock = RULES.DOOMRISE_TURNS;
            this.log(`${doom.name} is TOPPLED. Renown +${renown}. The Reckoning stirs.`);
            return { ok: true };
        }

        // Spoils go to the pack if there's room; a full pack leaves them to rot.
        takeSpoil(spoil) {
            if (this.state.hero.pack.length >= this.packCap()) {
                this.log(`Your pack is full — ${spoil.value} in spoils left to rot.`);
                return;
            }
            this.state.hero.pack.push(spoil);
        }

        canHarvest() {
            const s = this.state;
            const hex = this.heroHex();
            return s.mp >= 1 && hex.node !== null && hex.node.stock > 0 &&
                s.hero.pack.length < this.packCap();
        }

        // Harvesting roots you: it takes the rest of your turn.
        harvest() {
            if (!this.canHarvest()) return { ok: false };
            const s = this.state;
            const node = this.heroHex().node;
            const def = NODES[node.kind];
            const value = roll(def.base * node.mult * this.skillMult(def.skill));
            node.stock -= 1;
            s.mp = 0;
            this.gainXp(def.skill, value);
            s.hero.pack.push({ kind: node.kind, value });
            this.log(`You take ${value} in ${def.label}${node.stock === 0 ? ' — the node is spent' : ''}.`);
            return { ok: true };
        }

        // Banking works at the Hall or any holding — home is where the wealth is.
        bankAnchor() {
            const anchor = this.anchorAt(this.state.hero.q, this.state.hero.r);
            if (!anchor) return null;
            return (anchor.kind === 'hall' || anchor.kind === 'holding') ? anchor : null;
        }

        canBank() {
            return this.state.mp >= RULES.BANK_MP && this.state.hero.pack.length > 0 &&
                this.bankAnchor() !== null;
        }

        bank() {
            return this.withRank(() => {
                if (!this.canBank()) return { ok: false };
                const s = this.state;
                const total = this.packValue();
                const wealth = Math.round(total * this.skillMult('trading'));
                const renown = this.gainDeedRenown(Math.ceil(total / RULES.BANK_RENOWN_DIVISOR));
                s.hero.wealth += wealth;
                s.hero.pack = [];
                s.mp -= RULES.BANK_MP;
                this.gainXp('trading', total);
                this.log(`You bank ${total} in spoils at ${this.bankAnchor().name}: wealth +${wealth}, renown +${renown}.`);
                return { ok: true };
            });
        }

        rawSpoils() {
            return this.state.hero.pack.filter(sp => sp.kind !== 'treasure');
        }

        canCraft() {
            const anchor = this.anchorAt(this.state.hero.q, this.state.hero.r);
            return this.state.mp >= RULES.CRAFT_MP && anchor !== undefined &&
                anchor !== null && anchor.kind === 'hall' &&
                this.rawSpoils().length >= RULES.CRAFT_BATCH;
        }

        // Fuse the three humblest raw spoils into one treasure worth more than their
        // sum. Treasures are final — no re-fusing treasures into greater treasures,
        // or crafting becomes a risk-free exponential mint.
        craft() {
            if (!this.canCraft()) return { ok: false };
            const s = this.state;
            const raw = this.rawSpoils().sort((a, b) => a.value - b.value);
            const parts = raw.slice(0, RULES.CRAFT_BATCH);
            const rest = s.hero.pack.filter(sp => !parts.includes(sp));
            const sum = parts.reduce((t, p) => t + p.value, 0);
            const factor = RULES.CRAFT_MULT + SKILL_DEFS.crafting.per * this.skillLevel('crafting');
            const value = roll(sum * factor);
            s.hero.pack = [...rest, { kind: 'treasure', value }];
            s.mp -= RULES.CRAFT_MP;
            this.gainXp('crafting', value);
            this.log(`You craft a treasure worth ${value} from ${sum} in raw spoils.`);
            return { ok: true };
        }

        // The next of the six works: the humblest form not currently standing.
        nextFormIdx() {
            const standing = new Set(this.monuments().map(m => m.formIdx));
            for (let i = 0; i < MONUMENT_FORMS.length; i++) {
                if (!standing.has(i)) return i;
            }
            return -1;
        }

        monumentCost() {
            const idx = this.nextFormIdx();
            if (idx < 0) return 0;
            const discount = Math.min(RULES.BUILD_DISCOUNT_MAX,
                SKILL_DEFS.building.per * this.skillLevel('building'));
            return Math.round(RULES.MONUMENT_BASE_COST * (idx + 1) * (1 - discount));
        }

        canBuild() {
            const s = this.state;
            const hex = this.heroHex();
            return s.mp >= RULES.BUILD_MP && this.nextFormIdx() >= 0 &&
                s.hero.wealth >= this.monumentCost() &&
                this.anchorAt(s.hero.q, s.hero.r) === undefined &&
                this.minAnchorDist(s.anchors, hex) >= RULES.MONUMENT_MIN_DIST;
        }

        // Raise the next of the six works: the only passive answer to the dawn tax —
        // and a target.
        buildMonument() {
            if (!this.canBuild()) return { ok: false };
            const s = this.state;
            const cost = this.monumentCost();
            const idx = this.nextFormIdx();
            const form = MONUMENT_FORMS[idx];
            const hp = RULES.MONUMENT_HP + RULES.MONUMENT_HP_PER * idx;
            const name = `the ${form.form} of ${s.hero.name}`;
            s.hero.wealth -= cost;
            s.monumentsBuilt += 1;
            s.mp -= RULES.BUILD_MP;
            s.anchors.push({
                kind: 'monument', name, q: s.hero.q, r: s.hero.r,
                hp, maxHp: hp, income: form.income, formIdx: idx
            });
            this.heroHex().node = null;
            this.gainXp('building', cost / 2);
            this.log(`You raise ${name} — renown +${form.income} each dawn. Defiance draws the Reckoning's eye.`);
            return { ok: true };
        }

        canSack() {
            const anchor = this.bankAnchor();
            return this.state.mp >= 1 && anchor !== null && anchor.kind === 'holding';
        }

        // The dark mirror of banking: burn the bank, take the plunder, wear the name.
        sack() {
            return this.withRank(() => {
                if (!this.canSack()) return { ok: false };
                const s = this.state;
                const holding = this.bankAnchor();
                s.anchors.splice(s.anchors.indexOf(holding), 1);
                for (let i = 0; i < RULES.SACK_SPOILS; i++) {
                    this.takeSpoil({ kind: 'plunder', value: roll(RULES.SACK_SPOIL_VALUE) });
                }
                const renown = this.gainDeedRenown(RULES.SACK_RENOWN);
                s.reckoning += RULES.SACK_RECKONING;
                s.hero.sacks += 1;
                s.mp = 0;
                this.log(`You put ${holding.name} to the torch. Renown +${renown}. The bards sing; the small folk weep.`);
                return { ok: true };
            });
        }

        // ---- The world phase ----

        endTurn() {
            const s = this.state;
            const prevRank = this.rankIndex();
            s.phase = 'world';
            const flags = { fell: false, doomrise: false, lost: [] };

            this.restHeal();
            this.foesAct(flags);
            this.militiaDefense();
            this.decayRaiders();
            this.spawnFoes();
            this.regrowNodes();
            this.repairStructures();
            this.dawnIncome();
            this.dawnDecay();
            this.tickDooms(flags);

            const idx = this.rankIndex();
            if (idx > prevRank) flags.rankUp = this.title();
            if (idx < prevRank) {
                flags.rankDown = this.title();
                this.log(`The bards move on. You are ${this.title()} now.`);
            }

            s.phase = 'player';
            s.turn += 1;
            s.mp = RULES.HERO_MP;
            return flags;
        }

        restHeal() {
            const s = this.state;
            const anchor = this.bankAnchor();
            const heal = anchor ? RULES.REST_HEAL : 1;
            s.hero.hp = Math.min(RULES.HERO_HP, s.hero.hp + heal);
        }

        // ---- Foes: ecology + role dispatch ----

        foesAct(flags) {
            // Flow fields give chasers global vision (no local-horizon stuck-on-crags).
            const fields = new Map();
            for (const foe of [...this.state.foes]) {
                if (!this.state.foes.includes(foe)) continue;
                const def = FOES[foe.kind];
                this.ROLE_ACTS[def.role].call(this, foe, def, fields, flags);
            }
        }

        // Dijkstra field of costs toward a target; cached per target per world phase.
        flowField(q, r, fields) {
            const key = Hex.key(q, r);
            if (fields.has(key)) return fields.get(key);
            const field = bfsHexes({ q, r }, this.state.hexes, hex => {
                const anchor = this.anchorAt(hex.q, hex.r);
                if (anchor && !(anchor.q === q && anchor.r === r)) return Infinity;
                return TERRAIN_RULES[hex.terrain].moveCost === Infinity ? Infinity : 1;
            }, 40);
            fields.set(key, field);
            return field;
        }

        heroDist(foe) {
            return new Hex(foe.q, foe.r).distance(new Hex(this.state.hero.q, this.state.hero.r));
        }

        // One step down the field's gradient; blocked hexes just aren't options.
        stepAlong(foe, field) {
            const here = field.get(Hex.key(foe.q, foe.r));
            let best = null;
            for (const n of new Hex(foe.q, foe.r).neighbors()) {
                const cost = field.get(n.key());
                if (cost === undefined) continue;
                if (here !== undefined && cost >= here) continue;
                if (this.foeAt(n.q, n.r) || this.anchorAt(n.q, n.r)) continue;
                if (n.q === this.state.hero.q && n.r === this.state.hero.r) continue;
                if (best === null || cost < best.cost) best = { hex: n, cost };
            }
            if (!best) return false;
            foe.q = best.hex.q;
            foe.r = best.hex.r;
            return true;
        }

        wander(foe) {
            if (!Rando.bool(RULES.WANDER_CHANCE)) return;
            const open = new Hex(foe.q, foe.r).neighbors().filter(n => {
                const hex = this.state.hexes.get(n.key());
                return hex && this.passable(hex) && !this.foeAt(n.q, n.r) &&
                    !this.anchorAt(n.q, n.r) &&
                    !(n.q === this.state.hero.q && n.r === this.state.hero.r);
            });
            const to = Rando.choice(open);
            if (to) { foe.q = to.q; foe.r = to.r; }
        }

        fleeHero(foe) {
            const heroHex = new Hex(this.state.hero.q, this.state.hero.r);
            const open = new Hex(foe.q, foe.r).neighbors().filter(n => {
                const hex = this.state.hexes.get(n.key());
                return hex && this.passable(hex) && !this.foeAt(n.q, n.r) && !this.anchorAt(n.q, n.r);
            });
            if (open.length === 0) return;
            const away = open.reduce((a, b) => a.distance(heroHex) >= b.distance(heroHex) ? a : b);
            foe.q = away.q;
            foe.r = away.r;
        }

        strikeHero(foe, def, flags) {
            const s = this.state;
            if (this.hasPriv('falter') && Rando.bool(RULES.FALTER_CHANCE)) {
                this.log(`The ${def.label} falters before ${this.title()}.`);
                return;
            }
            const raw = roll(foe.dmg);
            const dmg = Math.max(RULES.MIN_DAMAGE, raw - this.skillLevel('warding'));
            s.hero.hp -= dmg;
            this.gainXp('warding', raw);
            const name = foe.name ? foe.name : `the ${def.label}`;
            this.log(`${name} ${def.atkVerb} you for ${dmg}.`);
            if (s.hero.hp <= 0) this.handleFall(flags);
        }

        strikeStructure(foe, def, target, flags) {
            target.hp -= roll(foe.dmg);
            if (target.hp > 0) return;
            this.state.anchors.splice(this.state.anchors.indexOf(target), 1);
            const name = foe.name ? foe.name : `a ${def.label}`;
            if (target.kind === 'monument') {
                const loss = Math.min(this.state.hero.renown, RULES.MONUMENT_LOSS_RENOWN);
                this.addRenown(-loss);
                this.log(`${name} tears down ${target.name}. Renown -${loss}.`);
            } else {
                this.log(`${name} razes ${target.name}. The small folk are scattered.`);
            }
            flags.lost.push(target.name);
            // A champion is sated by one razing: it carries its trophy home. The time
            // to avenge it is while it rides out — after, only the doom remains.
            if (def.role === 'champion') {
                this.state.foes.splice(this.state.foes.indexOf(foe), 1);
                this.log(`${name} carries its trophy back into the dark.`);
            }
        }

        // Champions besiege your works; raiders join in once the Reckoning is high.
        adjacentStructure(foe) {
            for (const n of new Hex(foe.q, foe.r).neighbors()) {
                const anchor = this.anchorAt(n.q, n.r);
                if (anchor && (anchor.kind === 'monument' || anchor.kind === 'holding')) return anchor;
            }
            return null;
        }

        chaseHero(foe, def, fields, flags) {
            for (let step = 0; step < foe.speed; step++) {
                if (this.heroDist(foe) === 1) {
                    this.strikeHero(foe, def, flags);
                    return;
                }
                if (!this.stepAlong(foe, this.flowField(this.state.hero.q, this.state.hero.r, fields))) {
                    this.wander(foe);
                    return;
                }
            }
            if (this.heroDist(foe) === 1) this.strikeHero(foe, def, flags);
        }

        actPrey(foe, def, fields, flags) {
            if (this.heroDist(foe) <= 2 && Rando.bool(RULES.PREY_FLEE)) {
                this.fleeHero(foe);
                return;
            }
            this.wander(foe);
        }

        actStalker(foe, def, fields, flags) {
            if (def.tier === 1 && this.hasPriv('dread')) {
                if (this.heroDist(foe) <= 3) { this.fleeHero(foe); return; }
                this.wander(foe);
                return;
            }
            if (this.heroDist(foe) <= def.aggro) {
                this.chaseHero(foe, def, fields, flags);
                return;
            }
            this.wander(foe);
        }

        actRaider(foe, def, fields, flags) {
            const target = this.adjacentStructure(foe);
            if (target && this.state.reckoning >= RULES.SIEGE_RECKONING) {
                this.strikeStructure(foe, def, target, flags);
                return;
            }
            this.actStalker(foe, def, fields, flags);
        }

        actChampion(foe, def, fields, flags) {
            const structures = [...this.monuments(), ...this.holdings()];
            if (structures.length === 0) {
                this.chaseHero(foe, def, fields, flags);
                return;
            }
            const from = new Hex(foe.q, foe.r);
            const target = structures.reduce((a, b) =>
                from.distance(new Hex(a.q, a.r)) <= from.distance(new Hex(b.q, b.r)) ? a : b);
            for (let step = 0; step < foe.speed; step++) {
                if (new Hex(foe.q, foe.r).distance(new Hex(target.q, target.r)) === 1) {
                    this.strikeStructure(foe, def, target, flags);
                    return;
                }
                if (!this.stepAlong(foe, this.flowField(target.q, target.r, fields))) return;
            }
        }

        handleFall(flags) {
            const s = this.state;
            const hall = s.anchors[0];
            s.hero.pack = s.hero.pack.filter(() => Rando.bool(0.5));
            this.addRenown(Math.floor(s.hero.renown * RULES.DEATH_RENOWN_KEPT) - s.hero.renown);
            s.hero.q = hall.q;
            s.hero.r = hall.r;
            s.hero.hp = RULES.HERO_HP;
            s.hero.deaths += 1;
            flags.fell = true;
            this.log('You fall. The small folk carry you home; half your pack is scattered.');
        }

        // ---- Spawning ----

        wildFoes() {
            return this.state.foes.filter(f => FOES[f.kind].role === 'prey' || FOES[f.kind].role === 'stalker');
        }

        spawnAt(kind, hex, name, doomName) {
            const def = FOES[kind];
            const scale = 1 + RULES.RECKONING_HP_SCALE * this.state.reckoning;
            const boosted = doomName !== null;
            const hp = Math.round(def.hp * (boosted ? scale : 1));
            const dmg = Math.round(def.dmg * (boosted ? scale : 1));
            const speed = def.speed + (Rando.bool(RULES.FAST_SPEED_CHANCE) ? 1 : 0);
            this.state.foes.push({ kind, q: hex.q, r: hex.r, hp, maxHp: hp, dmg, speed, name, doomName });
        }

        openSpot(hex) {
            return this.passable(hex) && !this.foeAt(hex.q, hex.r) && !this.anchorAt(hex.q, hex.r) &&
                !(hex.q === this.state.hero.q && hex.r === this.state.hero.r);
        }

        spawnWild() {
            const spot = this.findSpot(hex => this.openSpot(hex) &&
                new Hex(hex.q, hex.r).distance(new Hex(this.state.hero.q, this.state.hero.r)) >= RULES.SPAWN_MIN_DIST);
            if (!spot) return;
            this.spawnAt(Rando.weighted(WILD_BY_RING[spot.ring]), spot, null, null);
        }

        spawnFoes() {
            if (this.wildFoes().length < RULES.WILD_CAP && Rando.bool(RULES.WILD_SPAWN_CHANCE)) {
                this.spawnWild();
            }
            for (const doom of this.dooms()) this.spawnFromDoom(doom);
        }

        spawnFromDoom(doom) {
            const mine = this.state.foes.filter(f => f.doomName === doom.name);
            const cap = RULES.DOOM_RAIDER_CAP + doom.tier;
            const chance = RULES.DOOM_SPAWN_CHANCE + doom.fester * RULES.DOOM_FESTER_SPAWN;
            if (mine.length < cap && Rando.bool(chance)) {
                const spot = this.findNear(doom, 2);
                if (spot) this.spawnAt(RAIDERS_BY_TIER[doom.tier], spot, null, doom.name);
            }
            const hasChampion = mine.some(f => FOES[f.kind].role === 'champion');
            if (doom.fester >= RULES.CHAMPION_FESTER && !hasChampion && Rando.bool(RULES.CHAMPION_CHANCE)) {
                const spot = this.findNear(doom, 2);
                if (!spot) return;
                const name = `${NameGen.word('eldritch')} of ${doom.name.split(',')[0]}`;
                this.spawnAt('herald', spot, name, doom.name);
                doom.fester = 0;
                this.log(`${name} rides out. It hunts your works.`);
            }
        }

        findNear(anchor, radius) {
            const open = new Hex(anchor.q, anchor.r).inRange(radius)
                .map(h => this.state.hexes.get(h.key()))
                .filter(hex => hex && this.openSpot(hex));
            return Rando.choice(open);
        }

        // ---- Dawn upkeep ----

        regrowNodes() {
            for (const hex of this.hexList) {
                if (!hex.node || hex.node.stock > 0) continue;
                if (Rando.bool(RULES.NODE_REGROW)) hex.node.stock = hex.node.maxStock;
            }
        }

        dawnIncome() {
            let income = 0;
            for (const m of this.monuments()) {
                income += this.gainPassiveRenown(this.hasPriv('chorus') ? m.income * 2 : m.income);
            }
            if (this.hasPriv('tithes')) {
                this.state.hero.wealth += RULES.TITHE_WEALTH * this.holdings().length;
            }
            return income;
        }

        dawnDecay() {
            this.addRenown(-this.decayAmount());
        }

        // Ecology needs decay: raiders don't roam the world forever. Far from both
        // their doom and the hero they slink home; orphans of a toppled doom scatter.
        // Champions are exempt — they are on a mission.
        decayRaiders() {
            const s = this.state;
            s.foes = s.foes.filter(f => {
                const def = FOES[f.kind];
                if (def.role !== 'raider') return true;
                if (!Rando.bool(RULES.RAIDER_DECAY)) return true;
                const doom = this.dooms().find(d => d.name === f.doomName);
                if (!doom) return false;
                const far = new Hex(f.q, f.r).distance(new Hex(doom.q, doom.r)) > RULES.RAIDER_LEASH &&
                    this.heroDist(f) > RULES.RAIDER_LEASH;
                return !far;
            });
        }

        // The small folk man the walls: each holding strikes one adjacent hostile per
        // dawn. Their kills are their own — no spoils, no renown for you.
        militiaDefense() {
            for (const holding of this.holdings()) {
                const foe = new Hex(holding.q, holding.r).neighbors()
                    .map(n => this.foeAt(n.q, n.r))
                    .find(f => f && FOES[f.kind].role !== 'prey');
                if (!foe) continue;
                foe.hp -= roll(RULES.HOLDING_MILITIA);
                if (foe.hp > 0) continue;
                this.state.foes.splice(this.state.foes.indexOf(foe), 1);
                this.log(`The folk of ${holding.name} slay a ${FOES[foe.kind].label} at their walls.`);
            }
        }

        // The masons and the small folk mend what still stands.
        repairStructures() {
            for (const a of this.state.anchors) {
                if (a.kind !== 'holding' && a.kind !== 'monument') continue;
                a.hp = Math.min(a.maxHp, a.hp + RULES.STRUCTURE_REGEN);
            }
        }

        tickDooms(flags) {
            const s = this.state;
            for (const doom of this.dooms()) doom.fester += 1;
            // The world always answers: a toppling starts the clock, and an empty
            // sky starts it too — there is no cleansed world, only a quiet one.
            if (s.doomClock === 0 && this.dooms().length === 0) s.doomClock = RULES.DOOMRISE_TURNS;
            if (s.doomClock === 0) return;
            s.doomClock -= 1;
            if (s.doomClock > 0) return;
            flags.doomrise = this.doomrise();
        }

        doomrise() {
            const s = this.state;
            const room = RULES.DOOM_MAX - this.dooms().length;
            const count = Math.min(room, 1 + Math.min(2, Math.floor(s.reckoning / 2)));
            if (count <= 0) return false;
            const tier = Math.min(3, 1 + Math.floor(s.reckoning / 3));
            const used = new Set(s.anchors.map(a => a.name));
            for (let i = 0; i < count; i++) {
                this.placeDoom(s.hexes, s.anchors, used, tier);
            }
            this.log(`DOOMRISE: ${count} new ${count === 1 ? 'doom rises' : 'dooms rise'}. The Reckoning answers your glory.`);
            return true;
        }

        // ---- Log ----

        log(msg) {
            this.state.log.push({ turn: this.state.turn, msg });
            if (this.state.log.length > RULES.LOG_LIMIT) {
                this.state.log.splice(0, this.state.log.length - RULES.LOG_LIMIT);
            }
        }
    }

    // Role dispatch: one behavior per foe role, no kind-conditionals in the loop.
    GameEngine.prototype.ROLE_ACTS = {
        prey: GameEngine.prototype.actPrey,
        stalker: GameEngine.prototype.actStalker,
        raider: GameEngine.prototype.actRaider,
        champion: GameEngine.prototype.actChampion
    };

    return GameEngine;
})();
