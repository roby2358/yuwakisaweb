// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. Deliberately
// DOM-free and render-free: methods mutate state and *return outcomes*; the caller
// (GameUI today, a network handler tomorrow) decides what to redraw or broadcast.
// This is the half that would run server-side unchanged.
//
// Server-readiness notes:
//  - Generation and AI route all randomness through the seeded Rando, so a game is
//    reproducible from state.seed alone.
//  - movePlayer/attack re-derive legality from the engine's own computeReachable /
//    computeAttackable rather than trusting a caller-supplied cost — the "never trust
//    the client" rule, baked in now so a future command/network layer doesn't have to
//    re-audit every action.
//  - endTurn returns an ordered event list describing everything that happened in the
//    enemy and world phases; the UI replays it as animation, a server would broadcast it.
const GameEngine = (function () {
    const {
        TERRAIN, MOVEMENT_COST, PLAYER_MP, PLAYER_HP, MAP_COLS, MAP_ROWS,
        VILLAGE_MIN, VILLAGE_MAX, VILLAGE_MIN_DIST, VILLAGE_HP, VILLAGE_GROWTH_CHANCE,
        RAIDER_SPAWN_PER_FARM, RAIDER_WILD_DIST, RAIDER_SATED_FARMS, RAIDER_SPEED_DIE,
        PRESTIGE_KILL, PRESTIGE_DEFENSE_BONUS, PRESTIGE_DEFENSE_RADIUS,
        PRESTIGE_PLUNDER_BONUS, PRESTIGE_DECAY_DIVISOR, STATUS_PROMOTE_MULT,
        KNOCKOUT_PRESTIGE_DIVISOR, PRIVILEGES, PRIVILEGE_AURA_RADIUS
    } = GameArtifacts;

    const NAME_PREFIXES = ['Ash', 'Elm', 'Fen', 'Mor', 'Thorn', 'Wyn', 'Stan', 'Hazel',
        'Bre', 'Holt', 'Mere', 'Gled', 'Har', 'Wul', 'Dun', 'Kel'];
    const NAME_SUFFIXES = ['ford', 'stead', 'ton', 'wick', 'dale', 'field', 'brook',
        'marsh', 'holm', 'bury'];

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Terrain passability (single source of truth) ----
        // A hex is passable iff its terrain has a finite movement cost; water/mountain
        // are Infinity. Raider movement, spawning, and placement all route through here.
        moveCost(hex) {
            return MOVEMENT_COST[hex.terrain] ?? Infinity;
        }

        isPassable(hex) {
            return this.moveCost(hex) !== Infinity;
        }

        // All non-edge passable hexes, as a fresh array the caller may sort/filter.
        passableHexes() {
            const out = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) continue;
                if (!this.isPassable(hex)) continue;
                out.push(hex);
            }
            return out;
        }

        // ---- Privileges (the single dispatch point for every rank-dependent rule) ----
        privileges() {
            return PRIVILEGES[Math.min(this.state.status, PRIVILEGES.length - 1)];
        }

        // ---- New game / world generation ----
        // Regenerates (up to 20 tries) until the villages place successfully on one
        // connected region. A seed may be supplied for reproducibility; otherwise one is
        // drawn once and stored, so the game can always be reproduced from state.seed.
        newGame(seed) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            let attempts = 0;
            let placed = false;
            do {
                s.hexes = this.generateRectGrid();
                this.assignTerrain();
                placed = this.placeVillages();
                attempts++;
            } while (!placed && attempts < 20);

            const home = s.villages[0];
            s.player = { q: home.q, r: home.r, hp: PLAYER_HP };
            s.enemies = [];
            s.nextEnemyId = 1;
            s.prestige = 0;
            s.status = 0;
            s.turn = 1;
            s.mp = PLAYER_MP;
            s.phase = 'player';
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
        // flagged. Elevation sampled from a fresh heightmap. Terrain filled in later.
        generateRectGrid() {
            const hexes = new Map();
            const hm = this.diamondSquare(129, 0.55);

            for (let row = 0; row < MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (MAP_COLS - 1) * 128);
                    const gy = Math.round(row / (MAP_ROWS - 1) * 128);
                    const elevation = hm[gy * 129 + gx];
                    const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;

                    hexes.set(Hex.key(q, r), {
                        q, r, col, row, elevation, isEdge,
                        terrain: null, resource: null,
                        units: [], controlled: false
                    });
                }
            }
            return hexes;
        }

        // Base terrain by elevation percentile, then forests/gold on plains and quarries
        // on hills scattered in; edges forced to water.
        assignTerrain() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
                inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);
            const n = inner.length;

            // Base terrain by elevation percentile
            for (let i = 0; i < n; i++) {
                const pct = i / n;
                if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
                else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;
                else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;
                else inner[i].terrain = TERRAIN.MOUNTAIN;
            }

            // Scatter forests among plains (~10% of total)
            const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
            Rando.shuffle(plains);
            const forestCount = Math.round(n * 0.10);
            const goldCount = Math.max(3, Math.round(n * 0.01));
            let idx = 0;
            for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
                plains[idx].terrain = TERRAIN.FOREST;
            for (let i = 0; i < goldCount && idx < plains.length; i++, idx++)
                plains[idx].terrain = TERRAIN.GOLD;

            // Scatter quarries among hills (~2% of total)
            const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
            Rando.shuffle(hills);
            const quarryCount = Math.max(2, Math.round(n * 0.02));
            for (let i = 0; i < quarryCount && i < hills.length; i++)
                hills[i].terrain = TERRAIN.QUARRY;
        }

        // ---- Villages ----
        // 3–5 villages on plains hexes of one connected region, VILLAGE_MIN_DIST apart.
        // Returns false if the map can't host the minimum count (caller regenerates).
        placeVillages() {
            const s = this.state;
            s.villages = [];

            const plains = this.passableHexes().filter(h => h.terrain === TERRAIN.PLAINS);
            if (plains.length === 0) return false;

            const seedHex = Rando.choice(plains);
            const reach = bfsHexes(seedHex, s.hexes, hex => this.moveCost(hex), Infinity);
            const candidates = plains.filter(h => reach.has(Hex.key(h.q, h.r)));
            Rando.shuffle(candidates);

            const count = Rando.int(VILLAGE_MIN, VILLAGE_MAX);
            const sites = [seedHex];
            for (const c of candidates) {
                if (sites.length >= count) break;
                if (sites.every(v => new Hex(c.q, c.r).distance(new Hex(v.q, v.r)) >= VILLAGE_MIN_DIST))
                    sites.push(c);
            }
            if (sites.length < VILLAGE_MIN) return false;

            for (const site of sites) s.villages.push(this.foundVillage(site));
            return true;
        }

        // Turn a hex into a village with a name, full HP, and one starting farm.
        foundVillage(hex) {
            hex.terrain = TERRAIN.VILLAGE;
            const village = { q: hex.q, r: hex.r, hp: VILLAGE_HP, name: this.villageName(), farms: [] };
            this.growFarm(village);
            return village;
        }

        villageName() {
            const taken = new Set(this.state.villages.map(v => v.name));
            for (let i = 0; i < 50; i++) {
                const name = Rando.choice(NAME_PREFIXES) + Rando.choice(NAME_SUFFIXES);
                if (!taken.has(name)) return name;
            }
            return 'Newstead';
        }

        villageAt(q, r) {
            return this.state.villages.find(v => v.q === q && v.r === r) ?? null;
        }

        farmOwner(key) {
            return this.state.villages.find(v => v.farms.includes(key)) ?? null;
        }

        totalFarms() {
            return this.state.villages.reduce((sum, v) => sum + v.farms.length, 0);
        }

        // Nearest village whose hex is not in excludeKeys (pass an empty Set for "any").
        nearestVillage(q, r, excludeKeys) {
            const from = new Hex(q, r);
            let best = null, bestDist = Infinity;
            for (const v of this.state.villages) {
                if (excludeKeys.has(Hex.key(v.q, v.r))) continue;
                const d = from.distance(new Hex(v.q, v.r));
                if (d < bestDist) { bestDist = d; best = v; }
            }
            return best;
        }

        // Convert one random frontier hex (passable, adjacent to the village or its
        // farms, not already farm/village) into farmland. Returns the hex or null.
        growFarm(village) {
            const s = this.state;
            const cluster = [new Hex(village.q, village.r), ...village.farms.map(Hex.fromKey)];
            const frontier = new Map();
            for (const c of cluster) {
                for (const n of c.neighbors()) {
                    const key = n.key();
                    if (frontier.has(key)) continue;
                    const hex = s.hexes.get(key);
                    if (!hex || hex.isEdge) continue;
                    if (!this.isPassable(hex)) continue;
                    if (hex.terrain === TERRAIN.FARM || hex.terrain === TERRAIN.VILLAGE) continue;
                    frontier.set(key, hex);
                }
            }
            if (frontier.size === 0) return null;
            const hex = Rando.choice([...frontier.values()]);
            hex.terrain = TERRAIN.FARM;
            village.farms.push(Hex.key(hex.q, hex.r));
            return hex;
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by remaining MP; raider hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const enemyKeys = new Set(s.enemies.map(e => Hex.key(e.q, e.r)));
            const costs = bfsHexes(s.player, s.hexes, hex => {
                if (enemyKeys.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.moveCost(hex);
            }, s.mp);
            costs.delete(Hex.key(s.player.q, s.player.r));
            return costs;
        }

        // L3 attackable set: raiders adjacent to the player, when MP covers an attack.
        computeAttackable() {
            const s = this.state;
            if (s.mp < this.privileges().attackCost) return new Set();
            const adjacent = new Set(new Hex(s.player.q, s.player.r).neighbors().map(n => n.key()));
            const out = new Set();
            for (const e of s.enemies) {
                const key = Hex.key(e.q, e.r);
                if (adjacent.has(key)) out.add(key);
            }
            return out;
        }

        // L2.1 extension point: an interactive location at this hex, or null.
        locationAt(/* p */) {
            return null;
        }

        // ---- Actions (mutate state, return an outcome; no rendering) ----

        // Move the player to (q, r) if legal. Re-derives legality here rather than
        // trusting a caller-supplied cost. Returns:
        //   { ok:false }                          illegal, nothing changed
        //   { ok:true }                           moved, player's turn continues
        //   { ok:true, endedTurn:true, events }   moved and spent the last MP (turn auto-ended)
        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            s.player.q = q;
            s.player.r = r;
            s.mp -= cost;

            if (s.mp <= 0) return { ok: true, endedTurn: true, events: this.endTurn() };
            return { ok: true };
        }

        // Attack the raider at (q, r). Legality re-derived from computeAttackable.
        // Prestige: base for the kill, a defense bonus if witnessed near farmland or a
        // village, a plunder bonus if the raider was sated. Same outcome shape as movePlayer.
        attack(q, r) {
            const s = this.state;
            if (!this.computeAttackable().has(Hex.key(q, r))) return { ok: false };

            const idx = s.enemies.findIndex(e => e.q === q && e.r === r);
            const raider = s.enemies[idx];
            s.enemies.splice(idx, 1);

            let gained = PRESTIGE_KILL;
            if (this.nearFarmOrVillage(q, r, PRESTIGE_DEFENSE_RADIUS)) gained += PRESTIGE_DEFENSE_BONUS;
            if (raider.sated) gained += PRESTIGE_PLUNDER_BONUS;
            s.prestige += gained;

            s.mp -= this.privileges().attackCost;
            if (s.mp <= 0) return { ok: true, gained, endedTurn: true, events: this.endTurn() };
            return { ok: true, gained };
        }

        nearFarmOrVillage(q, r, radius) {
            const from = new Hex(q, r);
            for (const v of this.state.villages) {
                if (from.distance(new Hex(v.q, v.r)) <= radius) return true;
                for (const fk of v.farms) {
                    if (from.distance(Hex.fromKey(fk)) <= radius) return true;
                }
            }
            return false;
        }

        // ---- Turn resolution ----
        // Resolves the enemy phase then the world phase, advances to the player's next
        // turn, and returns the ordered event list for the client to replay.
        endTurn() {
            const s = this.state;
            const events = [{
                type: 'phaseStart',
                enemies: s.enemies.map(e => ({ id: e.id, q: e.q, r: e.r, color: e.color, sated: e.sated }))
            }];

            s.phase = 'enemy';
            this.raiderPhase(events);
            s.phase = 'world';
            this.worldPhase(events);
            s.phase = 'player';
            s.turn++;
            s.mp = PLAYER_MP + this.privileges().mpBonus;
            return events;
        }

        // ---- Enemy phase: each raider acts, then adjacent raiders strike the player ----
        raiderPhase(events) {
            const priv = this.privileges();
            for (const raider of [...this.state.enemies]) {
                this.raiderTurn(raider, events, priv);
            }
            this.raidersStrikePlayer(events);
        }

        raiderTurn(raider, events, priv) {
            // Lord's dread: a raider next to the player may hesitate for its whole turn.
            if (priv.dreadChance > 0 && this.adjacentToPlayer(raider) && Rando.bool(priv.dreadChance)) {
                events.push({ type: 'hesitate', id: raider.id });
                return;
            }
            for (let step = 0; step < raider.speed; step++) {
                if (!this.raiderStep(raider, events)) break;
            }
        }

        adjacentToPlayer(raider) {
            const p = this.state.player;
            return new Hex(raider.q, raider.r).distance(new Hex(p.q, p.r)) === 1;
        }

        // One hex of raider action. Returns false when the raider's turn is over
        // (struck a village, escaped, or has nowhere to go).
        raiderStep(raider, events) {
            const goal = raider.sated
                ? { q: raider.homeQ, r: raider.homeR }
                : this.nearestRaidTarget(raider);
            if (!goal) return false;

            // Strike a farmless village from an adjacent hex — never enter it.
            if (!raider.sated) {
                const village = this.villageAt(goal.q, goal.r);
                const dist = new Hex(raider.q, raider.r).distance(new Hex(goal.q, goal.r));
                if (village && dist === 1) {
                    this.strikeVillage(raider, village, events);
                    return false;
                }
            }

            const next = this.nextHexToward(raider, goal);
            if (!next) return false;

            events.push({ type: 'hop', id: raider.id, from: { q: raider.q, r: raider.r }, to: { q: next.q, r: next.r } });
            raider.q = next.q;
            raider.r = next.r;

            const hex = this.state.hexes.get(Hex.key(next.q, next.r));
            if (hex.terrain === TERRAIN.FARM) this.burnFarm(raider, hex, events);

            if (raider.sated && raider.q === raider.homeQ && raider.r === raider.homeR) {
                this.state.enemies = this.state.enemies.filter(e => e.id !== raider.id);
                events.push({ type: 'escaped', id: raider.id });
                return false;
            }
            return true;
        }

        // Raid targets: every farm hex, plus the hexes of villages stripped of farms.
        // A prosperous village shields itself with its own fields.
        nearestRaidTarget(raider) {
            const from = new Hex(raider.q, raider.r);
            let best = null, bestDist = Infinity;
            const consider = (q, r) => {
                const d = from.distance(new Hex(q, r));
                if (d < bestDist) { bestDist = d; best = { q, r }; }
            };
            for (const v of this.state.villages) {
                if (v.farms.length === 0) consider(v.q, v.r);
                for (const fk of v.farms) {
                    const f = Hex.fromKey(fk);
                    consider(f.q, f.r);
                }
            }
            return best;
        }

        // Next hop along an A* path to the goal. Raiders move in plain hex steps
        // (speed = hexes/turn — readable at a glance); terrain matters as passability.
        // The player's hex is pathable but never entered: a raider stalls in front of
        // the player rather than walking through, so the player can physically block
        // a road. Other raiders are walls.
        nextHexToward(raider, goal) {
            const s = this.state;
            const raiderKeys = new Set(s.enemies.filter(e => e.id !== raider.id).map(e => Hex.key(e.q, e.r)));
            const passable = (q, r) => {
                const hex = s.hexes.get(Hex.key(q, r));
                if (!hex || !this.isPassable(hex)) return false;
                if (raiderKeys.has(Hex.key(q, r))) return false;
                return true;
            };
            const path = findPath({ q: raider.q, r: raider.r }, goal, passable, () => 1, Infinity);
            if (!path || path.length < 2) return null;
            const next = path[1];
            if (next.q === s.player.q && next.r === s.player.r) return null;
            return next;
        }

        burnFarm(raider, hex, events) {
            const key = Hex.key(hex.q, hex.r);
            const owner = this.farmOwner(key);
            hex.terrain = TERRAIN.PLAINS;
            if (owner) owner.farms = owner.farms.filter(k => k !== key);
            raider.burned++;
            events.push({ type: 'burn', q: hex.q, r: hex.r, village: owner ? owner.name : null });

            if (raider.burned >= RAIDER_SATED_FARMS && !raider.sated) {
                raider.sated = true;
                events.push({ type: 'sated', id: raider.id });
            }
        }

        // A structural hit: the raider plunders (instantly sated) and will flee home.
        strikeVillage(raider, village, events) {
            village.hp--;
            raider.sated = true;
            events.push({ type: 'strike', q: village.q, r: village.r, name: village.name, hp: village.hp });
            events.push({ type: 'sated', id: raider.id });
            if (village.hp <= 0) this.villageFalls(village, events);
        }

        // The village is lost: hex reverts to plains and a new village founds itself
        // at a random valid spot. The world heals; the player's built position doesn't.
        villageFalls(village, events) {
            const s = this.state;
            s.villages = s.villages.filter(v => v !== village);
            s.hexes.get(Hex.key(village.q, village.r)).terrain = TERRAIN.PLAINS;
            events.push({ type: 'fell', q: village.q, r: village.r, name: village.name });

            const site = this.respawnSite();
            if (!site) return;
            const nv = this.foundVillage(site);
            s.villages.push(nv);
            events.push({ type: 'founded', q: nv.q, r: nv.r, name: nv.name });
        }

        // A plains hex reachable from the player, far from surviving villages —
        // relaxing the distance requirement rather than failing.
        respawnSite() {
            const s = this.state;
            const reach = bfsHexes(s.player, s.hexes, hex => this.moveCost(hex), Infinity);
            const plains = this.passableHexes().filter(h =>
                h.terrain === TERRAIN.PLAINS && reach.has(Hex.key(h.q, h.r)));
            for (const minDist of [VILLAGE_MIN_DIST, Math.floor(VILLAGE_MIN_DIST / 2), 0]) {
                const sites = plains.filter(h =>
                    s.villages.every(v => new Hex(h.q, h.r).distance(new Hex(v.q, v.r)) >= minDist));
                if (sites.length > 0) return Rando.choice(sites);
            }
            return null;
        }

        // Every raider adjacent to the player lands a hit — visible events, not a state
        // check. At 0 HP the player is carried to the nearest village and pays in fame.
        raidersStrikePlayer(events) {
            const s = this.state;
            for (const raider of s.enemies) {
                if (!this.adjacentToPlayer(raider)) continue;
                s.player.hp--;
                events.push({ type: 'playerHit', id: raider.id, hp: s.player.hp });
                if (s.player.hp > 0) continue;

                // Carried to the nearest village whose hex isn't held by a raider;
                // if raiders hold them all, the player comes to where they fell.
                const raiderKeys = new Set(s.enemies.map(e => Hex.key(e.q, e.r)));
                const refuge = this.nearestVillage(s.player.q, s.player.r, raiderKeys);
                if (refuge) {
                    s.player.q = refuge.q;
                    s.player.r = refuge.r;
                }
                s.player.hp = PLAYER_HP;
                s.prestige = Math.floor(s.prestige / KNOCKOUT_PRESTIGE_DIVISOR);
                events.push({
                    type: 'knockout', q: s.player.q, r: s.player.r,
                    name: refuge ? refuge.name : null
                });
                break;
            }
        }

        // ---- World phase: growth, regen, spawns, healing, decay, the status ladder ----
        worldPhase(events) {
            const s = this.state;
            const priv = this.privileges();

            // Village growth — Warden's inspiration grants extra rolls nearby.
            for (const village of s.villages) {
                const near = new Hex(village.q, village.r)
                    .distance(new Hex(s.player.q, s.player.r)) <= PRIVILEGE_AURA_RADIUS;
                const rolls = near ? priv.growthRolls : 1;
                for (let i = 0; i < rolls; i++) {
                    if (!Rando.bool(VILLAGE_GROWTH_CHANCE)) continue;
                    const grown = this.growFarm(village);
                    if (grown) events.push({ type: 'growth', q: grown.q, r: grown.r, village: village.name });
                }
            }

            // A village with at least one farm heals — the fields sustain it.
            for (const village of s.villages) {
                if (village.farms.length > 0 && village.hp < VILLAGE_HP) village.hp++;
            }

            // Raider spawn pressure scales with total prosperity, not time.
            const chance = this.totalFarms() * RAIDER_SPAWN_PER_FARM;
            if (Rando.bool(Math.min(1, chance))) this.spawnRaider(events);

            // Yeoman's rest: end the turn on a village to heal.
            const onVillage = this.villageAt(s.player.q, s.player.r);
            if (priv.healAtVillage > 0 && onVillage && s.player.hp < PLAYER_HP) {
                s.player.hp = Math.min(PLAYER_HP, s.player.hp + priv.healAtVillage);
            }

            // Prestige decay: small fame lingers, great fame fades.
            s.prestige -= Math.floor(s.prestige / PRESTIGE_DECAY_DIVISOR);

            // The status ladder, one step per turn.
            if (s.prestige > STATUS_PROMOTE_MULT * s.status && s.status < PRIVILEGES.length - 1) {
                s.status++;
                events.push({ type: 'status', to: s.status, promoted: true });
            } else if (s.prestige < s.status) {
                s.status--;
                events.push({ type: 'status', to: s.status, promoted: false });
            }
        }

        // A raider spawns in the wilds (far from every village), rolls its speed die,
        // and remembers home — sated raiders walk their plunder back there.
        spawnRaider(events) {
            const s = this.state;
            const reach = bfsHexes(s.player, s.hexes, hex => this.moveCost(hex), Infinity);
            const occupied = new Set(s.enemies.map(e => Hex.key(e.q, e.r)));
            occupied.add(Hex.key(s.player.q, s.player.r));

            const sites = this.passableHexes().filter(h => {
                const key = Hex.key(h.q, h.r);
                if (!reach.has(key) || occupied.has(key)) return false;
                return s.villages.every(v =>
                    new Hex(h.q, h.r).distance(new Hex(v.q, v.r)) > RAIDER_WILD_DIST);
            });
            if (sites.length === 0) return;

            const site = Rando.choice(sites);
            const scheme = ColorTheory.randomScheme(() => Rando.random());
            const [cr, cg, cb] = Rando.choice(scheme);
            const raider = {
                id: s.nextEnemyId++,
                q: site.q, r: site.r,
                speed: RAIDER_SPEED_DIE[Rando.int(1, 6)],
                burned: 0, sated: false, hp: 1,
                color: ColorTheory.rgbToHex(cr, cg, cb),
                homeQ: site.q, homeR: site.r
            };
            s.enemies.push(raider);
            events.push({ type: 'spawn', id: raider.id, q: raider.q, r: raider.r, color: raider.color });
        }
    }

    return GameEngine;
})();
