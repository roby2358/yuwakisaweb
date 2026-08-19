// DOM-free game rules and seeded world generation.
const GameEngine = (function () {
    const A = GameArtifacts;
    const { TERRAIN, RESOURCE, OUTCOME, PHASE, CARAVAN_MP, MAP_COLS, MAP_ROWS } = A;
    const { ResourceStock, Caravan, Market, Raider } = GameDomain;

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        raiderKeys() {
            return new Set(this.state.raiders.map(raider => raider.key()));
        }

        createRaider(q, r) {
            return new Raider(this.state.nextRaiderId++, q, r);
        }

        newGame(seed) {
            const s = this.state;
            s.seed = seed === undefined || seed === null
                ? Math.floor(Math.random() * 0x100000000)
                : seed >>> 0;
            Rando.seed(s.seed);

            let attempts = 0;
            do {
                s.hexes = this.generateRectGrid();
                this.board = new Board(s.hexes);
                this.assignTerrain();
                this.placeCaravanAndCrownMarket();
                attempts++;
            } while (!this.board.hasPath(s.caravan, s.crownMarket) && attempts < 20);

            this.placeTradingPosts();
            this.spawnRaiders();
            s.influence = 0;
            s.unrest = 0;
            s.turn = 1;
            s.mp = CARAVAN_MP;
            s.phase = PHASE.CARAVAN;
            s.outcome = null;
            s.statusMessage = 'The frontier is open. Find resources and make for the eastern markets.';
        }

        diamondSquare(size, roughness) {
            const grid = new Float64Array(size * size);
            const get = (x, y) => grid[y * size + x];
            const set = (x, y, value) => { grid[y * size + x] = value; };
            set(0, 0, Rando.random());
            set(size - 1, 0, Rando.random());
            set(0, size - 1, Rando.random());
            set(size - 1, size - 1, Rando.random());

            let step = size - 1;
            let scale = roughness;
            while (step > 1) {
                const half = step / 2;
                for (let y = half; y < size - 1; y += step) {
                    for (let x = half; x < size - 1; x += step) {
                        const average = (get(x - half, y - half) + get(x + half, y - half) +
                            get(x - half, y + half) + get(x + half, y + half)) / 4;
                        set(x, y, average + (Rando.random() - 0.5) * scale);
                    }
                }
                for (let y = 0; y < size; y += half) {
                    for (let x = (y + half) % step; x < size; x += step) {
                        let sum = 0;
                        let count = 0;
                        if (x >= half) { sum += get(x - half, y); count++; }
                        if (x + half < size) { sum += get(x + half, y); count++; }
                        if (y >= half) { sum += get(x, y - half); count++; }
                        if (y + half < size) { sum += get(x, y + half); count++; }
                        set(x, y, sum / count + (Rando.random() - 0.5) * scale);
                    }
                }
                step = half;
                scale *= roughness;
            }

            let min = Infinity;
            let max = -Infinity;
            for (const value of grid) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
            for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
            return grid;
        }

        generateRectGrid() {
            const hexes = new Map();
            const heightmap = this.diamondSquare(129, 0.55);
            for (let row = 0; row < MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (MAP_COLS - 1) * 128);
                    const gy = Math.round(row / (MAP_ROWS - 1) * 128);
                    const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
                    hexes.set(Hex.key(q, r), {
                        q, r, col, row, isEdge,
                        elevation: heightmap[gy * 129 + gx],
                        terrain: null,
                        depleted: false
                    });
                }
            }
            return hexes;
        }

        assignTerrain() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) hex.terrain = TERRAIN.WATER;
                else inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);
            const count = inner.length;
            for (let i = 0; i < count; i++) {
                const percentile = i / count;
                if (percentile < 0.22) inner[i].terrain = TERRAIN.WATER;
                else if (percentile < 0.84) inner[i].terrain = TERRAIN.PLAINS;
                else if (percentile < 0.95) inner[i].terrain = TERRAIN.HILLS;
                else inner[i].terrain = TERRAIN.MOUNTAIN;
            }

            const plains = inner.filter(hex => hex.terrain === TERRAIN.PLAINS);
            Rando.shuffle(plains);
            const forestCount = Math.round(count * 0.10);
            const goldCount = Math.max(8, Math.round(count * 0.015));
            let plainsIndex = 0;
            for (let i = 0; i < forestCount; i++) plains[plainsIndex++].terrain = TERRAIN.FOREST;
            for (let i = 0; i < goldCount; i++) plains[plainsIndex++].terrain = TERRAIN.GOLD;

            const hills = inner.filter(hex => hex.terrain === TERRAIN.HILLS);
            Rando.shuffle(hills);
            const quarryCount = Math.max(10, Math.round(count * 0.035));
            for (let i = 0; i < quarryCount && i < hills.length; i++) hills[i].terrain = TERRAIN.QUARRY;
        }

        placeCaravanAndCrownMarket() {
            const passable = this.board.passableHexes().sort((a, b) => a.col - b.col);
            const sliceSize = Math.max(5, Math.floor(passable.length * 0.03));
            const start = Rando.choice(passable.slice(0, sliceSize));
            const destination = Rando.choice(passable.slice(-sliceSize));
            this.state.caravan = new Caravan(start.q, start.r, new ResourceStock(A.STARTING_CARGO));
            this.state.crownMarket = new Market(destination.q, destination.r, true);
        }

        placeTradingPosts() {
            const s = this.state;
            const occupied = new Set([s.caravan.key(), s.crownMarket.key()]);
            const connected = bfsHexes(s.caravan, s.hexes, hex => this.board.moveCost(hex), Infinity);
            const candidates = this.board.passableHexes().filter(hex =>
                connected.has(Hex.key(hex.q, hex.r)) &&
                hex.terrain === TERRAIN.PLAINS && hex.col > 6 && hex.col < MAP_COLS - 6);
            Rando.shuffle(candidates);
            s.tradingPosts = [];
            for (const hex of candidates) {
                if (s.tradingPosts.length >= A.TRADING_POST_COUNT) break;
                if (s.tradingPosts.some(market => new Hex(market.q, market.r).distance(hex) < 6)) continue;
                if (occupied.has(Hex.key(hex.q, hex.r))) continue;
                s.tradingPosts.push(new Market(hex.q, hex.r, false));
                occupied.add(Hex.key(hex.q, hex.r));
            }
        }

        spawnRaiders() {
            const s = this.state;
            s.nextRaiderId = 1;
            const connected = bfsHexes(s.caravan, s.hexes, hex => this.board.moveCost(hex), Infinity);
            const occupied = new Set([
                s.caravan.key(),
                s.crownMarket.key(),
                ...s.tradingPosts.map(market => market.key())
            ]);
            const candidates = this.board.passableHexes().filter(hex =>
                connected.has(Hex.key(hex.q, hex.r)) &&
                hex.col > 8 && !occupied.has(Hex.key(hex.q, hex.r)));
            Rando.shuffle(candidates);
            const count = Rando.int(1, 6) + Rando.int(1, 6) + 2;
            s.raiders = candidates.slice(0, count).map(hex => this.createRaider(hex.q, hex.r));
        }

        marketAt(position) {
            const key = Hex.key(position.q, position.r);
            if (key === this.state.crownMarket.key()) return this.state.crownMarket;
            return this.state.tradingPosts.find(market => market.key() === key) || null;
        }

        computeReachable() {
            const s = this.state;
            if (s.mp <= 0 || s.outcome) return new Map();
            const raiderKeys = this.raiderKeys();
            const costs = bfsHexes(s.caravan, s.hexes, hex =>
                raiderKeys.has(Hex.key(hex.q, hex.r)) ? Infinity : this.board.moveCost(hex), s.mp);
            costs.delete(s.caravan.key());
            return costs;
        }

        computeForceTargets() {
            const caravanHex = new Hex(this.state.caravan.q, this.state.caravan.r);
            return new Set(this.state.raiders
                .filter(raider => caravanHex.distance(raider) === 1)
                .map(raider => raider.key()));
        }

        moveCaravan(q, r) {
            const s = this.state;
            const cost = this.computeReachable().get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };
            s.caravan.moveTo(q, r);
            s.mp -= cost;
            const harvest = this.harvestAtCaravan();
            this.checkVictory();
            if (s.outcome === OUTCOME.VICTORY) return { ok: true, won: true, harvest };
            if (s.mp <= 0) {
                this.endTurn();
                return { ok: true, endedTurn: true, harvest };
            }
            return { ok: true, harvest };
        }

        harvestAtCaravan() {
            const s = this.state;
            const hex = this.board.get(s.caravan.q, s.caravan.r);
            if (!hex || hex.depleted) return null;
            const harvest = A.HARVEST_BY_TERRAIN[hex.terrain];
            if (!harvest) return null;
            hex.depleted = true;
            s.caravan.cargo.gain(harvest);
            const [resource, amount] = Object.entries(harvest)[0];
            s.statusMessage = `Gathered ${amount} ${resource}.`;
            return harvest;
        }

        fulfillContract() {
            const s = this.state;
            if (!this.marketAt(s.caravan)) return { ok: false, reason: 'Reach a market first.' };
            if (!s.caravan.cargo.canAfford(A.CONTRACT_COST)) {
                return { ok: false, reason: 'A contract needs 1 timber and 1 ore.' };
            }
            s.caravan.cargo.spend(A.CONTRACT_COST);
            s.caravan.cargo.gain(A.CONTRACT_REWARD);
            s.influence += A.CONTRACT_INFLUENCE;
            s.unrest = Math.max(0, s.unrest - 1);
            s.statusMessage = `Contract fulfilled: +${A.CONTRACT_INFLUENCE} influence, +${A.CONTRACT_REWARD.coin} coin, -1 unrest.`;
            this.checkVictory();
            return { ok: true, won: s.outcome === OUTCOME.VICTORY };
        }

        buySupplies() {
            const s = this.state;
            if (!this.marketAt(s.caravan)) return { ok: false, reason: 'Reach a market first.' };
            if (!s.caravan.cargo.spend(A.SUPPLY_COST)) return { ok: false, reason: `Supplies cost ${A.SUPPLY_COST.coin} coin.` };
            s.caravan.cargo.gain(A.SUPPLY_REWARD);
            s.statusMessage = `Bought ${A.SUPPLY_REWARD.provisions} provisions for ${A.SUPPLY_COST.coin} coin.`;
            return { ok: true };
        }

        useForceAgainstRaider(q, r) {
            const s = this.state;
            const key = Hex.key(q, r);
            if (!this.computeForceTargets().has(key)) return { ok: false, reason: 'That raider is out of reach.' };
            if (!s.caravan.cargo.canAfford(A.FORCE_COST)) {
                return { ok: false, reason: 'Force costs 1 provision and 1 ore.' };
            }
            const index = s.raiders.findIndex(raider => raider.key() === key);
            s.caravan.cargo.spend(A.FORCE_COST);
            s.caravan.cargo.gain(A.FORCE_REWARD);
            s.raiders.splice(index, 1);
            s.unrest++;
            s.statusMessage = `Raider defeated: +${A.FORCE_REWARD.coin} coin, +1 unrest.`;
            this.checkDefeat();
            return { ok: true, lost: s.outcome === OUTCOME.DEFEAT };
        }

        endTurn() {
            const s = this.state;
            if (s.outcome) return { ok: false };
            if (!s.caravan.cargo.spend({ [RESOURCE.PROVISIONS]: 1 })) {
                s.outcome = OUTCOME.DEFEAT;
                s.statusMessage = 'The caravan has no provisions left.';
                return { ok: true, lost: true };
            }
            s.phase = PHASE.RAIDERS;
            this.moveRaiders();
            const stolen = this.resolveRaiderTheft();
            const reinforced = this.maybeSpawnRaider();
            s.phase = PHASE.CARAVAN;
            s.turn++;
            s.mp = CARAVAN_MP;
            this.checkDefeat();
            if (!s.outcome) {
                const events = [];
                if (stolen) events.push(stolen);
                if (reinforced) events.push('Unrest drew another raider onto the road.');
                s.statusMessage = events.join(' ') || 'A quiet night. One provision consumed.';
            }
            return { ok: true, lost: s.outcome === OUTCOME.DEFEAT };
        }

        moveRaiders() {
            const s = this.state;
            const occupied = this.raiderKeys();
            occupied.add(s.caravan.key());
            for (const raider of s.raiders) {
                occupied.delete(raider.key());
                const valid = this.board.neighbors(raider.q, raider.r).filter(hex => {
                    return this.board.isPassable(hex) && !occupied.has(Hex.key(hex.q, hex.r));
                });
                if (valid.length) {
                    valid.sort((a, b) =>
                        new Hex(a.q, a.r).distance(s.caravan) - new Hex(b.q, b.r).distance(s.caravan));
                    const pool = Rando.random() < 0.75 ? valid.slice(0, Math.min(2, valid.length)) : valid;
                    const destination = Rando.choice(pool);
                    raider.moveTo(destination.q, destination.r);
                }
                occupied.add(raider.key());
            }
        }

        resolveRaiderTheft() {
            const s = this.state;
            const thieves = s.raiders.filter(raider => new Hex(raider.q, raider.r).distance(s.caravan) === 1);
            if (!thieves.length) return '';
            const priority = [RESOURCE.TIMBER, RESOURCE.ORE, RESOURCE.COIN];
            const resource = priority.find(name => s.caravan.cargo.amount(name) > 0);
            if (!resource) {
                s.unrest++;
                return 'Raiders found no cargo and spread unrest instead.';
            }
            const amount = Math.min(thieves.length, s.caravan.cargo.amount(resource));
            s.caravan.cargo.spend({ [resource]: amount });
            return `Nearby raiders stole ${amount} ${resource}.`;
        }

        maybeSpawnRaider() {
            const s = this.state;
            if (s.unrest <= 0 || Rando.random() >= s.unrest / 10) return false;
            const occupied = this.raiderKeys();
            occupied.add(s.caravan.key());
            const candidates = this.board.passableHexes().filter(hex => {
                const distance = new Hex(hex.q, hex.r).distance(s.caravan);
                return distance >= 5 && distance <= 10 && !occupied.has(Hex.key(hex.q, hex.r));
            });
            if (!candidates.length) return false;
            const hex = Rando.choice(candidates);
            s.raiders.push(this.createRaider(hex.q, hex.r));
            return true;
        }

        checkVictory() {
            const s = this.state;
            const atCrownMarket = s.caravan.isAt(s.crownMarket.q, s.crownMarket.r);
            if (atCrownMarket && s.influence >= A.VICTORY_INFLUENCE) {
                s.outcome = OUTCOME.VICTORY;
                s.statusMessage = 'The Crown Market recognizes your league. The frontier is open to trade.';
            } else if (atCrownMarket) {
                s.statusMessage = `The Crown Market requires ${A.VICTORY_INFLUENCE - s.influence} more influence.`;
            }
        }

        checkDefeat() {
            const s = this.state;
            if (s.unrest < A.MAX_UNREST) return;
            s.outcome = OUTCOME.DEFEAT;
            s.statusMessage = 'Unrest has consumed the frontier. Your caravan is driven out.';
        }
    }

    return GameEngine;
})();
