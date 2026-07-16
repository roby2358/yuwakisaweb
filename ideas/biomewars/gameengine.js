// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. Deliberately
// DOM-free and render-free: methods mutate state and *return outcomes*; the caller
// (GameUI today, a network handler tomorrow) decides what to redraw or broadcast.
// This is the half that would run server-side unchanged.
//
// Server-readiness notes:
//  - Generation, names, and AI route all randomness through the seeded Rando, so a
//    fresh world is reproducible from state.seed alone. (A resumed save reseeds from
//    seed+turn — mid-game determinism across reloads is explicitly not promised.)
//  - Player actions re-derive legality from the engine's own computed sets rather than
//    trusting caller-supplied costs — the "never trust the client" rule, baked in now
//    so a future command/network layer doesn't have to re-audit every action.
//
// The world phase (endTurn) is the heart of the game — see DYNAMICS.md "Turn Loop"
// for why each step exists and in what order.
const GameEngine = (function () {
    const {
        BIOMES, BIOME_RULES, SETTLED_BIOMES, BLIGHT_BIOMES, WARRING_BIOMES,
        CREATURES, TALENTS, RULES
    } = GameArtifacts;

    const TALENT_BY_KEY = new Map(TALENTS.map(t => [t.key, t]));

    // ---- Anchor kinds: the one dispatch point for the settlement/blight split ----
    // Everything that differs by anchor kind lives here — construction, the siege
    // announcement, home-ground growth, and what happens when prosperity starves to
    // zero. The engine looks up and calls; it never asks `kind === ...` beyond the
    // settlementAt/blightAt lookups.
    const ANCHOR_KINDS = {
        settlement: {
            make(engine, biome, spot) {
                return {
                    kind: 'settlement', biome,
                    name: NameGen.word(BIOME_RULES[biome].nameStyle),
                    q: spot.q, r: spot.r,
                    prosperity: RULES.SETTLEMENT_START, hp: 0, besieged: false
                };
            },
            announceSiege(engine, anchor, hex) {
                engine.log(`${anchor.name} is besieged by the ${engine.biomeName(hex.biome).toLowerCase()}!`);
            },
            // Natural growth plateaus at the self cap (golden ages excepted);
            // beyond it, prosperity is the hero's gift alone.
            grow(engine, anchor) {
                const s = engine.state;
                let growth = engine.ownFraction(anchor) >= RULES.SETTLEMENT_GROWTH_FRACTION ? 1 : 0;
                if (s.goldenAge > 0) growth += 1;
                const cap = s.goldenAge > 0 ? RULES.PROSPERITY_MAX : RULES.SETTLEMENT_SELF_CAP;
                if (anchor.prosperity < cap)
                    anchor.prosperity = Math.min(cap, anchor.prosperity + growth);
            },
            starve(engine, anchor, flags) {
                const s = engine.state;
                s.anchors.splice(s.anchors.indexOf(anchor), 1);
                flags.settlementLost = true;
                engine.log(`${anchor.name} has fallen.`);
                if (engine.settlements().length === 0) {
                    s.gameOver = true;
                    flags.defeat = true;
                    engine.log('The last settlement is gone. The war rolls on without you.');
                }
            }
        },
        blight: {
            make(engine, biome, spot) {
                const hp = RULES.BLIGHT_HP + RULES.BLIGHT_GROWTH_HP * engine.state.eruptions;
                return {
                    kind: 'blight', biome,
                    name: NameGen.word(BIOME_RULES[biome].nameStyle),
                    q: spot.q, r: spot.r,
                    prosperity: RULES.BLIGHT_START + RULES.BLIGHT_GROWTH_PROSPERITY * engine.state.eruptions,
                    hp, maxHp: hp, besieged: false
                };
            },
            announceSiege() { /* blights suffer their sieges in silence */ },
            // Uncapped: a blight left alone grows without limit, and its aura's
            // reach with it. The world *will* lose eventually — cleansing blights
            // is how the player resets the clock.
            grow(engine, anchor) {
                anchor.prosperity += RULES.BLIGHT_GROWTH;
            },
            starve(engine, anchor, flags) {
                flags.goldenAge = engine.destroyBlight(anchor, 'starved out') || flags.goldenAge;
            }
        }
    };

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Lookups (single sources of truth) ----
        hexAt(pos) {
            return this.state.hexes.get(Hex.key(pos.q, pos.r));
        }

        creatureAt(q, r) {
            return this.state.creatures.find(c => c.q === q && c.r === r);
        }

        anchorAt(q, r) {
            return this.state.anchors.find(a => a.q === q && a.r === r);
        }

        // Kind-filtered lookups: null when the hex holds nothing of that kind.
        settlementAt(q, r) {
            const a = this.anchorAt(q, r);
            return a && a.kind === 'settlement' ? a : null;
        }

        blightAt(q, r) {
            const a = this.anchorAt(q, r);
            return a && a.kind === 'blight' ? a : null;
        }

        settlements() {
            return this.state.anchors.filter(a => a.kind === 'settlement');
        }

        blights() {
            return this.state.anchors.filter(a => a.kind === 'blight');
        }

        // Display label for a biome: its generated proper name if this world gave it
        // one, else the archetype label. Used in log messages and by the UI hover.
        biomeName(biome) {
            return this.state.names.biomes[biome] || BIOME_RULES[biome].label;
        }

        // This world's species name for a biome's creature archetype.
        creatureName(biome) {
            return this.state.names.creatures[biome];
        }

        // ---- Hero derived stats (talents are levels; effects derive here) ----
        talentDef(key) {
            return TALENT_BY_KEY.get(key);
        }

        talentLevel(key) {
            return this.state.hero.talents[key];
        }

        talentCost(key) {
            return this.talentDef(key).base * (this.talentLevel(key) + 1);
        }

        // Total effect a talent contributes right now: level × per-level magnitude.
        talentBonus(key) {
            return this.talentLevel(key) * this.talentDef(key).per;
        }

        heroMaxHp() {
            return RULES.HERO_HP + this.talentBonus('vigor');
        }

        heroMp() {
            return RULES.HERO_MP + this.talentBonus('fleet');
        }

        heroAttack() {
            return RULES.HERO_ATTACK + this.talentBonus('strike');
        }

        // ---- Terrain passability ----
        // Cost to enter a hex; Strider shaves 1 off any finite cost above 1.
        moveCost(hex) {
            const cost = BIOME_RULES[hex.biome].moveCost;
            if (cost === Infinity) return Infinity;
            if (this.talentLevel('strider') > 0 && cost > 1) return cost - 1;
            return cost;
        }

        isPassable(hex) {
            return this.moveCost(hex) !== Infinity;
        }

        occupiedKeys() {
            const s = this.state;
            const out = new Set([Hex.key(s.hero.q, s.hero.r)]);
            for (const c of s.creatures) out.add(Hex.key(c.q, c.r));
            for (const a of s.anchors) out.add(Hex.key(a.q, a.r));
            return out;
        }

        // ---- New world generation ----

        // Draw a fresh seed and generate a world from it.
        newGame() {
            this.newGameFromSeed(Math.floor(Math.random() * 0x100000000));
        }

        // Generate a reproducible world from an explicit seed: regenerates (up to
        // 10 tries) until anchor placement succeeds.
        newGameFromSeed(seed) {
            const s = this.state;
            s.seed = seed >>> 0;
            Rando.seed(s.seed);

            let attempts = 0;
            let ok = false;
            do {
                s.hexes = this.generateRectGrid();
                ok = this.assignBiomes();
                attempts++;
            } while (!ok && attempts < 10);

            this.generateNames();

            const home = Rando.choice(this.settlements().filter(a => a.biome === BIOMES.MEADOW));
            s.hero = {
                q: home.q, r: home.r,
                hp: RULES.HERO_HP,
                essence: 0,
                talents: Object.fromEntries(TALENTS.map(t => [t.key, 0]))
            };

            s.creatures = [];
            for (const biome of WARRING_BIOMES)
                for (let i = 0; i < RULES.INITIAL_CREATURES; i++) this.spawnCreatureIn(biome);

            s.turn = 1;
            s.mp = this.heroMp();
            s.phase = 'player';
            s.gameOver = false;
            s.eruptions = 0;
            s.goldenAge = 0;
            s.log = [];
            this.log(`You wake in ${home.name}, beneath an alien sky at war.`);
        }

        // Diamond-square heightmap over a (size x size) grid, normalized to [0, 100].
        diamondSquare(size, roughness) {
            const grid = new Float64Array(size * size);
            const get = (x, y) => grid[y * size + x];
            const set = (x, y, v) => { grid[y * size + x] = v; };

            set(0, 0, Rando.random());
            set(size - 1, 0, Rando.random());
            set(0, size - 1, Rando.random());
            set(size - 1, size - 1, Rando.random());

            let step = size - 1;
            let scale = roughness;
            while (step > 1) {
                const half = step / 2;
                for (let y = half; y < size - 1; y += step)
                    for (let x = half; x < size - 1; x += step)
                        set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                            get(x - half, y + half) + get(x + half, y + half)) / 4 +
                            (Rando.random() - 0.5) * scale);
                for (let y = 0; y < size; y += half)
                    for (let x = (y + half) % step; x < size; x += step) {
                        let sum = 0, cnt = 0;
                        if (x >= half) { sum += get(x - half, y); cnt++; }
                        if (x + half < size) { sum += get(x + half, y); cnt++; }
                        if (y >= half) { sum += get(x, y - half); cnt++; }
                        if (y + half < size) { sum += get(x, y + half); cnt++; }
                        set(x, y, sum / cnt + (Rando.random() - 0.5) * scale);
                    }
                step = half;
                scale *= roughness;
            }

            let min = Infinity, max = -Infinity;
            for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
            for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
            return grid;
        }

        // Rectangle of MAP_COLS x MAP_ROWS axial hexes with a per-row q offset; edges
        // flagged. Elevation sampled from a fresh heightmap. Biomes filled in later.
        generateRectGrid() {
            const hexes = new Map();
            const hm = this.diamondSquare(129, 0.55);

            for (let row = 0; row < RULES.MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < RULES.MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (RULES.MAP_COLS - 1) * 128);
                    const gy = Math.round(row / (RULES.MAP_ROWS - 1) * 128);
                    const elevation = hm[gy * 129 + gx];
                    const isEdge = row === 0 || row === RULES.MAP_ROWS - 1 || col === 0 || col === RULES.MAP_COLS - 1;

                    hexes.set(Hex.key(q, r), {
                        q, r, col, row, elevation, isEdge,
                        biome: null, vitality: 100
                    });
                }
            }
            return hexes;
        }

        // Neutral terrain by elevation percentile (sea low, crag high; edges sea),
        // then anchors seeded on the remaining land and every warring hex assigned the
        // biome of its nearest anchor (jittered Voronoi): coherent homelands with
        // ragged, contestable borders. Returns false if anchors couldn't be placed.
        assignBiomes() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) { hex.biome = BIOMES.SEA; continue; }
                inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);

            const open = [];
            const n = inner.length;
            for (let i = 0; i < n; i++) {
                const pct = i / n;
                if (pct < 0.18) inner[i].biome = BIOMES.SEA;
                else if (pct > 0.94) inner[i].biome = BIOMES.CRAG;
                else open.push(inner[i]);
            }

            if (!this.placeAnchors(open)) return false;

            for (const hex of open) {
                let best = null, bestDist = Infinity;
                for (const a of this.state.anchors) {
                    const d = new Hex(hex.q, hex.r).distance(new Hex(a.q, a.r)) + Rando.float(0, 2.5);
                    if (d < bestDist) { bestDist = d; best = a; }
                }
                hex.biome = best.biome;
                hex.vitality = Rando.int(40, 80);
            }
            for (const a of this.state.anchors) {
                const hex = this.hexAt(a);
                hex.biome = a.biome;
                hex.vitality = 90;
            }
            return true;
        }

        // 2 settlements per settled biome plus 2 ash / 1 writhe blights, pairwise
        // ANCHOR_MIN_DIST apart. Names come later (generateNames), after all anchors
        // exist, so naming order is stable.
        placeAnchors(open) {
            const s = this.state;
            s.anchors = [];

            const wanted = [];
            for (const biome of SETTLED_BIOMES)
                for (let i = 0; i < RULES.SETTLEMENTS_PER_BIOME; i++)
                    wanted.push({ kind: 'settlement', biome });
            wanted.push({ kind: 'blight', biome: BIOMES.ASH });
            wanted.push({ kind: 'blight', biome: BIOMES.ASH });
            wanted.push({ kind: 'blight', biome: BIOMES.WRITHE });

            const spots = Rando.shuffle(open.slice());
            for (const w of wanted) {
                const spot = spots.find(h =>
                    s.anchors.every(a =>
                        new Hex(h.q, h.r).distance(new Hex(a.q, a.r)) >= RULES.ANCHOR_MIN_DIST));
                if (!spot) return false;
                s.anchors.push(this.makeAnchor(w.kind, w.biome, spot));
            }
            return true;
        }

        makeAnchor(kind, biome, hex) {
            return ANCHOR_KINDS[kind].make(this, biome, hex);
        }

        // Per-world proper names: every creature species, and each warring biome at
        // BIOME_NAME_CHANCE (the rest keep their archetype label). Anchor names are
        // drawn in makeAnchor; this pass dedupes nothing against them — collisions
        // across categories are harmless flavor.
        generateNames() {
            const used = new Set();
            const names = { biomes: {}, creatures: {} };
            for (const biome of WARRING_BIOMES) {
                const style = BIOME_RULES[biome].nameStyle;
                names.creatures[biome] = NameGen.uniqueWord(style, used);
                names.biomes[biome] = Rando.bool(RULES.BIOME_NAME_CHANCE)
                    ? NameGen.uniqueWord(style, used)
                    : null;
            }
            this.state.names = names;
        }

        spawnCreatureIn(biome) {
            const s = this.state;
            const occupied = this.occupiedKeys();
            const hero = new Hex(s.hero.q, s.hero.r);
            const candidates = [];
            for (const [key, hex] of s.hexes) {
                if (hex.biome !== biome) continue;
                if (occupied.has(key)) continue;
                if (new Hex(hex.q, hex.r).distance(hero) < RULES.SPAWN_MIN_DIST) continue;
                candidates.push(hex);
            }
            if (candidates.length === 0) return;
            const h = Rando.choice(candidates);
            s.creatures.push({ biome, q: h.q, r: h.r, hp: CREATURES[biome].hp });
        }

        // ---- Resuming a saved world ----
        // Mid-game determinism across reloads isn't promised; reseed off seed+turn so
        // resumed play still flows from the stored seed rather than Math.random.
        loadGame(json) {
            this.state.loadJSON(json);
            Rando.seed((this.state.seed + this.state.turn * 7919) >>> 0);
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by remaining MP; creatures and blights are
        // walls, settlements are open (you walk in to feed and rest).
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const blocked = new Set(s.creatures.map(c => Hex.key(c.q, c.r)));
            for (const a of this.blights()) blocked.add(Hex.key(a.q, a.r));
            const costs = bfsHexes(s.hero, s.hexes, hex => {
                if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.moveCost(hex);
            }, s.mp);
            costs.delete(Hex.key(s.hero.q, s.hero.r));
            return costs;
        }

        // L3 attackable set: adjacent creatures (friendly ones too — hunting is a
        // choice) and blights, when the hero can afford a strike.
        computeAttackable() {
            const s = this.state;
            const out = new Set();
            if (s.gameOver || s.mp < RULES.ATTACK_MP) return out;
            for (const n of new Hex(s.hero.q, s.hero.r).neighbors()) {
                if (this.creatureAt(n.q, n.r) || this.blightAt(n.q, n.r))
                    out.add(n.key());
            }
            return out;
        }

        // L2.1 extension point: an interactive location at this hex, or null.
        locationAt(/* p */) {
            return null;
        }

        // ---- Player actions (mutate state, return an outcome; no rendering) ----
        // Every action spends MP; spending the last point auto-ends the turn, so each
        // outcome may carry { endedTurn: true, flags } from the world phase.

        finishAction(res) {
            if (this.state.mp <= 0) {
                res.endedTurn = true;
                res.flags = this.endTurn();
            }
            return res;
        }

        // Move the hero to (q, r) if legal. Re-derives legality here rather than
        // trusting a caller-supplied cost.
        movePlayer(q, r) {
            const s = this.state;
            const cost = this.computeReachable().get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            s.hero.q = q;
            s.hero.r = r;
            s.mp -= cost;
            return this.finishAction({ ok: true });
        }

        // Strike an adjacent creature or blight for hero damage.
        attack(q, r) {
            const s = this.state;
            if (s.mp < RULES.ATTACK_MP) return { ok: false };
            if (new Hex(s.hero.q, s.hero.r).distance(new Hex(q, r)) !== 1) return { ok: false };

            const creature = this.creatureAt(q, r);
            const blight = this.blightAt(q, r);
            if (!creature && !blight) return { ok: false };

            s.mp -= RULES.ATTACK_MP;
            const res = creature ? this.strikeCreature(creature) : this.strikeBlight(blight);
            return this.finishAction(res);
        }

        strikeCreature(creature) {
            const s = this.state;
            creature.hp -= this.heroAttack();
            const def = CREATURES[creature.biome];
            const name = this.creatureName(creature.biome).toLowerCase();
            if (creature.hp > 0) {
                this.log(`You wound the ${name} (${creature.hp}/${def.hp}).`);
                return { ok: true };
            }
            s.creatures.splice(s.creatures.indexOf(creature), 1);
            s.hero.essence += def.essence;
            this.log(`You slay the ${name} (+${def.essence} essence).`);
            return { ok: true };
        }

        strikeBlight(blight) {
            blight.hp -= this.heroAttack();
            if (blight.hp > 0) {
                this.log(`You strike ${blight.name} (${blight.hp} HP left).`);
                return { ok: true };
            }
            return { ok: true, goldenAge: this.destroyBlight(blight, 'shattered') };
        }

        canGather() {
            const s = this.state;
            if (s.gameOver || s.mp <= 0) return false;
            if (this.anchorAt(s.hero.q, s.hero.r)) return false;
            const hex = this.hexAt(s.hero);
            if (!BIOME_RULES[hex.biome].warring) return false;
            return hex.vitality >= RULES.GATHER_MIN_VITALITY;
        }

        // Harvest essence from the hex underfoot, draining its vitality — the land
        // you feed on is land that flips easier. Gathering takes the rest of the
        // turn (all remaining MP): you root where you harvest, and you'll eat the
        // hex's hazard before you move again.
        gather() {
            if (!this.canGather()) return { ok: false };
            const s = this.state;
            const hex = this.hexAt(s.hero);
            const amount = BIOME_RULES[hex.biome].yield + this.talentBonus('harvest');
            s.hero.essence += amount;
            hex.vitality -= RULES.GATHER_DRAIN;
            s.mp = 0;
            this.log(`You harvest ${amount} essence from the ${this.biomeName(hex.biome).toLowerCase()}.`);
            return this.finishAction({ ok: true, amount });
        }

        canFeed() {
            const s = this.state;
            if (s.gameOver || s.mp < RULES.FEED_MP) return false;
            if (s.hero.essence < RULES.FEED_ESSENCE) return false;
            const settlement = this.settlementAt(s.hero.q, s.hero.r);
            return !!settlement && settlement.prosperity < RULES.PROSPERITY_MAX;
        }

        // Convert essence into a settlement's prosperity — a bigger aura pushing its
        // biome outward. The self-vs-world spend at the heart of the thriving loop.
        feed() {
            if (!this.canFeed()) return { ok: false };
            const s = this.state;
            const settlement = this.settlementAt(s.hero.q, s.hero.r);
            const gain = RULES.FEED_PROSPERITY + this.talentBonus('voice');
            settlement.prosperity = Math.min(RULES.PROSPERITY_MAX, settlement.prosperity + gain);
            s.hero.essence -= RULES.FEED_ESSENCE;
            s.mp -= RULES.FEED_MP;
            this.log(`You feed ${settlement.name} (+${gain} prosperity).`);
            return this.finishAction({ ok: true });
        }

        // Talents are learned at settlements — training is one more thing the
        // towns provide, and one more reason to keep them alive.
        canTrain() {
            const s = this.state;
            return !s.gameOver && !!this.settlementAt(s.hero.q, s.hero.r);
        }

        buyTalent(key) {
            if (!this.canTrain()) return { ok: false };
            const s = this.state;
            const def = this.talentDef(key);
            const level = this.talentLevel(key);
            if (level >= def.max) return { ok: false };
            const cost = this.talentCost(key);
            if (s.hero.essence < cost) return { ok: false };
            s.hero.essence -= cost;
            s.hero.talents[key] = level + 1;
            this.log(`${def.name} rises to level ${level + 1}.`);
            return { ok: true };
        }

        // ---- The world phase ----
        // Resolve everything that happens between the player's turns; returns a flags
        // object ({ fell, defeat, goldenAge, eruption, settlementLost, siege }) the UI
        // uses for overlays and camera moves. Order per DYNAMICS.md "Turn Loop".
        endTurn() {
            const s = this.state;
            if (s.gameOver) return {};
            const flags = {};
            s.phase = 'world';

            this.applyHazard();
            this.creaturesAct();
            this.resolveHeroFall(flags);
            if (!s.gameOver) {
                this.spawnCreatures();
                this.anchorsTick(flags);
                this.biomeTick();
                this.tickAge(flags);
                this.decayCreatures();   // after every land change, eruptions included
                this.settlementRest();
            }

            s.phase = 'player';
            s.turn++;
            s.mp = this.heroMp();
            return flags;
        }

        // The land itself bites: hostile-biome damage, softened by Warding.
        applyHazard() {
            const s = this.state;
            const hex = this.hexAt(s.hero);
            const rules = BIOME_RULES[hex.biome];
            const dmg = Math.max(0, rules.hazard - this.talentBonus('warding'));
            if (dmg <= 0) return;
            s.hero.hp -= dmg;
            this.log(`The ${this.biomeName(hex.biome).toLowerCase()} ${rules.hazardVerb} you (-${dmg} HP).`);
        }

        // Steps a creature may take: adjacent hexes of its own biome, unoccupied.
        // Creatures never cross a front line — they *are* the biome.
        validCreatureSteps(creature) {
            const occupied = this.occupiedKeys();
            return new Hex(creature.q, creature.r).neighbors().filter(n => {
                const hex = this.state.hexes.get(n.key());
                if (!hex) return false;
                if (hex.biome !== creature.biome) return false;
                return !occupied.has(n.key());
            });
        }

        wander(creature) {
            if (!Rando.bool(RULES.WANDER_CHANCE)) return;
            const steps = this.validCreatureSteps(creature);
            if (steps.length === 0) return;
            const dest = Rando.choice(steps);
            creature.q = dest.q;
            creature.r = dest.r;
        }

        creaturesAct() {
            for (const creature of [...this.state.creatures]) {
                const def = CREATURES[creature.biome];
                if (def.friendly) this.friendlyAct(creature);
                else this.hostileAct(creature, def);
            }
        }

        // Friendly wildlife wanders its biome and nuzzles an adjacent hero for +1 HP.
        friendlyAct(creature) {
            const s = this.state;
            const heroHex = new Hex(s.hero.q, s.hero.r);
            if (new Hex(creature.q, creature.r).distance(heroHex) === 1 && s.hero.hp < this.heroMaxHp()) {
                s.hero.hp += 1;
                this.log(`A ${this.creatureName(creature.biome).toLowerCase()} nuzzles you (+1 HP).`);
                return;
            }
            this.wander(creature);
        }

        // Hostile wildlife chases the hero (in-biome only) when he's inside its aggro
        // radius; attack happens at the start of a step, so a slow beast arriving
        // adjacent is telegraphed a turn ahead while a fast one can close and bite.
        hostileAct(creature, def) {
            const s = this.state;
            const heroHex = new Hex(s.hero.q, s.hero.r);
            if (new Hex(creature.q, creature.r).distance(heroHex) > def.aggro) {
                this.wander(creature);
                return;
            }
            for (let i = 0; i < def.speed; i++) {
                const pos = new Hex(creature.q, creature.r);
                if (pos.distance(heroHex) === 1) {
                    this.creatureAttack(creature, def);
                    return;
                }
                const steps = this.validCreatureSteps(creature);
                if (steps.length === 0) return;
                steps.sort((a, b) => a.distance(heroHex) - b.distance(heroHex));
                if (steps[0].distance(heroHex) >= pos.distance(heroHex)) return;
                creature.q = steps[0].q;
                creature.r = steps[0].r;
            }
        }

        creatureAttack(creature, def) {
            const s = this.state;
            const name = this.creatureName(creature.biome).toLowerCase();
            const dmg = Math.max(0, def.dmg - this.talentBonus('carapace'));
            if (dmg <= 0) {
                this.log(`The ${name} claws harmlessly at your carapace.`);
                return;
            }
            s.hero.hp -= dmg;
            this.log(`The ${name} ${def.atkVerb} you (-${dmg} HP).`);
        }

        // Falling isn't the end while a hearth remains: lose half your essence and
        // wake at the strongest settlement. With none left, the war is over.
        resolveHeroFall(flags) {
            const s = this.state;
            if (s.hero.hp > 0) return;
            const settlements = this.settlements();
            if (settlements.length === 0) {
                s.gameOver = true;
                flags.defeat = true;
                this.log('You fall — and no hearth remains to catch you.');
                return;
            }
            const best = settlements.reduce((a, b) => b.prosperity > a.prosperity ? b : a);
            const lost = Math.floor(s.hero.essence / 2);
            s.hero.essence -= lost;
            s.hero.q = best.q;
            s.hero.r = best.r;
            s.hero.hp = this.heroMaxHp();
            flags.fell = true;
            this.log(`You fall... and wake in ${best.name}, ${lost} essence poorer.`);
        }

        // Ecology, not choreography: each warring biome rolls a spawn while under cap.
        spawnCreatures() {
            for (const biome of WARRING_BIOMES) {
                const count = this.state.creatures.filter(c => c.biome === biome).length;
                if (count >= RULES.CREATURE_CAP) continue;
                if (!Rando.bool(RULES.SPAWN_CHANCE)) continue;
                this.spawnCreatureIn(biome);
            }
        }

        // Fraction of the warring land within radius 2 that is an anchor's own biome.
        ownFraction(anchor) {
            let own = 0, total = 0;
            for (const h of new Hex(anchor.q, anchor.r).inRange(2)) {
                const hex = this.state.hexes.get(h.key());
                if (!hex || !BIOME_RULES[hex.biome].warring) continue;
                total++;
                if (hex.biome === anchor.biome) own++;
            }
            return total === 0 ? 0 : own / total;
        }

        // One siege rule for both kinds: an anchor on a foreign biome bleeds
        // prosperity and dies at zero. Home-ground growth and starvation are the
        // kind-specific halves — ANCHOR_KINDS carries them.
        anchorsTick(flags) {
            for (const anchor of [...this.state.anchors]) {
                const kind = ANCHOR_KINDS[anchor.kind];
                const hex = this.hexAt(anchor);

                if (hex.biome !== anchor.biome) {
                    anchor.prosperity -= RULES.SIEGE_DRAIN;
                    if (!anchor.besieged) {
                        anchor.besieged = true;
                        flags.siege = true;
                        kind.announceSiege(this, anchor, hex);
                    }
                } else {
                    anchor.besieged = false;
                    kind.grow(this, anchor);
                }

                if (anchor.prosperity <= 0) kind.starve(this, anchor, flags);
            }
        }

        // Remove a blight (stormed or strangled), pay the windfall, and start a golden
        // age if it was the last one. Returns true when the golden age begins.
        destroyBlight(anchor, verb) {
            const s = this.state;
            s.anchors.splice(s.anchors.indexOf(anchor), 1);
            s.hero.essence += RULES.BLIGHT_REWARD;
            this.log(`${anchor.name} is ${verb}! (+${RULES.BLIGHT_REWARD} essence)`);
            if (this.blights().length > 0) return false;
            s.goldenAge = RULES.GOLDEN_AGE_TURNS;
            this.log('Every blight is cleansed. A golden age dawns.');
            return true;
        }

        // The war itself. Pressure on a hex = same-biome neighbors (+1 each) + anchor
        // auras (power 1 + prosperity/20, gentle falloff — prosperity buys *reach*,
        // which is what lets a fattening blight eventually threaten distant
        // settlements and a well-fed settlement push back). A deficit drains vitality;
        // at zero the hex flips to the winning biome. Flips are collected first and
        // applied after, so a turn's outcome doesn't depend on iteration order.
        biomeTick() {
            const aura = this.auraPressure();
            const flips = [];
            for (const [key, hex] of this.state.hexes) {
                if (!BIOME_RULES[hex.biome].warring) continue;

                const pressure = this.pressureOn(hex, aura.get(key));
                const own = pressure.get(hex.biome) || 0;
                const rival = this.strongestRival(pressure, hex.biome);

                if (rival && rival.pressure > own)
                    flips.push({ hex, drain: (rival.pressure - own) * RULES.PRESSURE_DRAIN, to: rival.biome });
                else
                    hex.vitality = Math.min(100, hex.vitality + RULES.VITALITY_REGROW);
            }
            this.applyFlips(flips);
        }

        // Sum every anchor's aura into Map<hexKey, Map<biome, pressure>>.
        auraPressure() {
            const s = this.state;
            const aura = new Map();
            for (const anchor of s.anchors) {
                const power = 1 + anchor.prosperity / RULES.AURA_PROSPERITY_DIV;
                const radius = Math.min(RULES.AURA_RADIUS_MAX, Math.ceil(power / RULES.AURA_FALLOFF));
                const center = new Hex(anchor.q, anchor.r);
                for (const h of center.inRange(radius)) {
                    const contribution = power - center.distance(h) * RULES.AURA_FALLOFF;
                    if (contribution <= 0) continue;
                    const key = h.key();
                    if (!s.hexes.has(key)) continue;
                    if (!aura.has(key)) aura.set(key, new Map());
                    const m = aura.get(key);
                    m.set(anchor.biome, (m.get(anchor.biome) || 0) + contribution);
                }
            }
            return aura;
        }

        // Total pressure on one hex by biome: warring neighbors + this hex's slice
        // of the aura map (may be undefined when no aura reaches it).
        pressureOn(hex, anchorPressure) {
            const pressure = new Map();
            for (const n of new Hex(hex.q, hex.r).neighbors()) {
                const nh = this.state.hexes.get(n.key());
                if (!nh || !BIOME_RULES[nh.biome].warring) continue;
                pressure.set(nh.biome, (pressure.get(nh.biome) || 0) + 1);
            }
            if (anchorPressure)
                for (const [biome, p] of anchorPressure)
                    pressure.set(biome, (pressure.get(biome) || 0) + p);
            return pressure;
        }

        // The strongest foreign biome pressing on a hex, or null if none press at all.
        strongestRival(pressure, ownBiome) {
            let rival = null;
            for (const [biome, p] of pressure) {
                if (biome === ownBiome) continue;
                if (!rival || p > rival.pressure) rival = { biome, pressure: p };
            }
            return rival;
        }

        // Drain the contested hexes; any bled to zero flip to the winner.
        applyFlips(flips) {
            for (const f of flips) {
                f.hex.vitality -= f.drain;
                if (f.hex.vitality <= 0) {
                    f.hex.biome = f.to;
                    f.hex.vitality = RULES.FLIP_VITALITY;
                }
            }
        }

        // A creature whose land was flipped out from under it perishes with the front.
        decayCreatures() {
            this.state.creatures = this.state.creatures.filter(c => this.hexAt(c).biome === c.biome);
        }

        // Golden-age countdown; at zero the planet convulses.
        tickAge(flags) {
            const s = this.state;
            if (s.goldenAge <= 0) return;
            s.goldenAge--;
            if (s.goldenAge === 0) this.erupt(flags);
        }

        // Escalation tied to progress: each eruption spawns more, stronger blights,
        // each converting a disk of land to its biome.
        erupt(flags) {
            const s = this.state;
            s.eruptions++;

            const sites = this.eruptionSites(RULES.ERUPTION_BASE + s.eruptions);
            sites.forEach((hex, i) => {
                const biome = i % 2 === 0 ? BIOMES.ASH : BIOMES.WRITHE;
                s.anchors.push(this.makeAnchor('blight', biome, hex));
                this.convertDisk(hex, biome);
            });

            if (sites.length > 0) {
                flags.eruption = true;
                this.log(`The planet convulses — ${sites.length} new blights erupt!`);
            } else {
                this.log('The planet shudders, but holds — for now.');
            }
        }

        // Up to `count` eruption sites: warring, unoccupied land clear of the hero
        // and every settlement, pairwise ERUPTION_SPREAD apart.
        eruptionSites(count) {
            const s = this.state;
            const hero = new Hex(s.hero.q, s.hero.r);
            const settlements = this.settlements();

            const candidates = [];
            for (const [, hex] of s.hexes) {
                if (!BIOME_RULES[hex.biome].warring) continue;
                if (this.anchorAt(hex.q, hex.r)) continue;
                const pos = new Hex(hex.q, hex.r);
                if (pos.distance(hero) < RULES.ERUPTION_MIN_DIST) continue;
                if (settlements.some(a => pos.distance(new Hex(a.q, a.r)) < RULES.ERUPTION_MIN_DIST)) continue;
                candidates.push(hex);
            }
            Rando.shuffle(candidates);

            const sites = [];
            for (const hex of candidates) {
                if (sites.length >= count) break;
                const pos = new Hex(hex.q, hex.r);
                if (sites.every(p => pos.distance(new Hex(p.q, p.r)) >= RULES.ERUPTION_SPREAD))
                    sites.push(hex);
            }
            return sites;
        }

        // Claim the warring land in a disk around a new blight for its biome.
        convertDisk(center, biome) {
            for (const h of new Hex(center.q, center.r).inRange(RULES.ERUPTION_DISK)) {
                const hex = this.state.hexes.get(h.key());
                if (!hex || !BIOME_RULES[hex.biome].warring) continue;
                hex.biome = biome;
                hex.vitality = 90;
            }
        }

        // Ending the turn at a settlement heals: home is where the hearth is.
        settlementRest() {
            const s = this.state;
            const settlement = this.settlementAt(s.hero.q, s.hero.r);
            if (!settlement) return;
            const heal = Math.min(RULES.SETTLEMENT_HEAL, this.heroMaxHp() - s.hero.hp);
            if (heal <= 0) return;
            s.hero.hp += heal;
            this.log(`You rest at ${settlement.name} (+${heal} HP).`);
        }

        log(msg) {
            const s = this.state;
            s.log.push({ turn: s.turn, msg });
            if (s.log.length > RULES.LOG_LIMIT) s.log.splice(0, s.log.length - RULES.LOG_LIMIT);
        }
    }

    return GameEngine;
})();
