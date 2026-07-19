// gameengine.js — GameEngine
//
// All adjudication: map generation, the day loop, visions, divination, wards,
// warnings, and resolution. DOM-free — runs headless for simulation. Methods
// return message strings (or arrays) for the UI to log; endDay returns a
// structured report so the UI can animate each doom landing as an event.
const GameEngine = (function () {
    const A = GameArtifacts;
    const T = A.TUNING;

    // ---- diamond-square heightmap (size must be 2^n + 1) ----

    function diamondSquare(size) {
        const grid = [];
        for (let y = 0; y < size; y++) grid.push(new Array(size).fill(0));
        const max = size - 1;
        grid[0][0] = Rando.random();
        grid[0][max] = Rando.random();
        grid[max][0] = Rando.random();
        grid[max][max] = Rando.random();

        let step = max;
        let scale = 0.5;
        while (step > 1) {
            const half = step / 2;
            // diamond
            for (let y = half; y < size; y += step) {
                for (let x = half; x < size; x += step) {
                    const avg = (grid[y - half][x - half] + grid[y - half][x + half] +
                        grid[y + half][x - half] + grid[y + half][x + half]) / 4;
                    grid[y][x] = avg + (Rando.random() - 0.5) * scale;
                }
            }
            // square
            for (let y = 0; y < size; y += half) {
                for (let x = (y / half) % 2 === 0 ? half : 0; x < size; x += step) {
                    let sum = 0, n = 0;
                    if (y >= half) { sum += grid[y - half][x]; n++; }
                    if (y + half <= max) { sum += grid[y + half][x]; n++; }
                    if (x >= half) { sum += grid[y][x - half]; n++; }
                    if (x + half <= max) { sum += grid[y][x + half]; n++; }
                    grid[y][x] = sum / n + (Rando.random() - 0.5) * scale;
                }
            }
            step = half;
            scale *= 0.55;
        }
        return grid;
    }

    // ---- map generation ----

    const MAP_COLS = 24;
    const MAP_ROWS = 17;
    const GRID_SIZE = 33;

    function generateHexes(state) {
        const grid = diamondSquare(GRID_SIZE);
        const samples = [];
        for (let row = 0; row < MAP_ROWS; row++) {
            const qOffset = -Math.floor(row / 2);
            for (let col = 0; col < MAP_COLS; col++) {
                const gx = Math.round(col / (MAP_COLS - 1) * (GRID_SIZE - 1));
                const gy = Math.round(row / (MAP_ROWS - 1) * (GRID_SIZE - 1));
                samples.push({ q: qOffset + col, r: row, height: grid[gy][gx] });
            }
        }
        // Terrain by elevation percentile: elev is the hex's rank in [0, 1).
        const sorted = samples.map(s => s.height).sort((a, b) => a - b);
        for (const s of samples) {
            const elev = sorted.indexOf(s.height) / sorted.length;
            const band = A.TERRAIN_BANDS.find(b => elev < b.upTo) || A.TERRAIN_BANDS[A.TERRAIN_BANDS.length - 1];
            state.hexes.set(Hex.key(s.q, s.r), {
                q: s.q, r: s.r, terrain: band.terrain, elev: elev,
                buildingId: null, feature: null
            });
        }
    }

    function movementCost(state, hex) {
        if (hex.buildingId !== null) {
            const building = state.buildingById(hex.buildingId);
            if (building.kind === 'bridge') return 1;
        }
        return A.MOVE_COST[hex.terrain];
    }

    function reachableFrom(state, startHex, maxCost) {
        return bfsHexes(startHex, state.hexes, h => movementCost(state, h), maxCost);
    }

    function addBuilding(state, kind, hex, name) {
        const building = {
            id: state.nextBuildingId++, kind: kind, name: name,
            hexKey: Hex.key(hex.q, hex.r), ruined: false, rebuildDays: 0,
            preps: {}, occupantIds: []
        };
        state.buildings.push(building);
        hex.buildingId = building.id;
        return building;
    }

    function addVillager(state, name, role, home) {
        const villager = { id: state.nextVillagerId++, name: name, role: role, homeId: home.id, alive: true };
        state.villagers.push(villager);
        home.occupantIds.push(villager.id);
        return villager;
    }

    function freshName(state) {
        for (let i = 0; i < 20; i++) {
            const name = NameGen.villager();
            if (!state.villagers.some(v => v.name === name)) return name;
        }
        return NameGen.villager();
    }

    function placeVillage(state) {
        const centerQ = Math.floor(MAP_COLS / 2) - Math.floor(MAP_ROWS / 4);
        const center = new Hex(centerQ, Math.floor(MAP_ROWS / 2));

        const landNear = Array.from(state.hexes.values())
            .filter(h => h.terrain !== A.TERRAIN.WATER && h.terrain !== A.TERRAIN.MARSH)
            .sort((a, b) => new Hex(a.q, a.r).distance(center) - new Hex(b.q, b.r).distance(center));
        const shrineHex = landNear[0];
        addBuilding(state, 'shrine', shrineHex, A.BUILDINGS.shrine.name);
        state.oracle = { q: shrineHex.q, r: shrineHex.r };
        const shrine = new Hex(shrineHex.q, shrineHex.r);

        // A bridge where the road meets the water, if the map offers one.
        const bridgeSpot = Array.from(state.hexes.values()).find(h =>
            h.terrain === A.TERRAIN.WATER &&
            new Hex(h.q, h.r).distance(shrine) <= 6 &&
            new Hex(h.q, h.r).neighbors().filter(n => {
                const nh = state.hexes.get(n.key());
                return nh && nh.terrain !== A.TERRAIN.WATER;
            }).length >= 3);
        if (bridgeSpot) addBuilding(state, 'bridge', bridgeSpot, A.BUILDINGS.bridge.name);

        const reachable = reachableFrom(state, shrineHex, 999);
        const spotsWithin = maxDist => Rando.shuffle(Array.from(state.hexes.values()).filter(h =>
            reachable.has(Hex.key(h.q, h.r)) &&
            h.buildingId === null &&
            h.terrain !== A.TERRAIN.WATER && h.terrain !== A.TERRAIN.MARSH &&
            new Hex(h.q, h.r).distance(shrine) >= 1 &&
            new Hex(h.q, h.r).distance(shrine) <= maxDist));
        let spots = spotsWithin(5);
        if (spots.length < 12) spots = spotsWithin(8);

        const takeSpot = (prefer) => {
            const idx = prefer ? spots.findIndex(prefer) : 0;
            return spots.splice(idx === -1 ? 0 : idx, 1)[0];
        };
        const nearWater = h => new Hex(h.q, h.r).neighbors().some(n => {
            const nh = state.hexes.get(n.key());
            return nh && nh.terrain === A.TERRAIN.WATER;
        });

        const mill = addBuilding(state, 'mill', takeSpot(nearWater), A.BUILDINGS.mill.name);
        const chapel = addBuilding(state, 'chapel', takeSpot(null), A.BUILDINGS.chapel.name);
        const tavern = addBuilding(state, 'tavern', takeSpot(null), A.BUILDINGS.tavern.name);
        const granary = addBuilding(state, 'granary', takeSpot(null), A.BUILDINGS.granary.name);
        const smithy = addBuilding(state, 'smithy', takeSpot(null), A.BUILDINGS.smithy.name);
        const well = addBuilding(state, 'well', takeSpot(null), A.BUILDINGS.well.name);
        const cottages = [];
        for (let i = 0; i < 4; i++) {
            const spot = takeSpot(null);
            if (!spot) break;
            cottages.push(addBuilding(state, 'cottage', spot, ''));
        }

        // Fields to work, close to home.
        const fieldHexes = Array.from(state.hexes.values()).filter(h =>
            h.terrain === A.TERRAIN.FIELD && h.buildingId === null && h.feature === null &&
            reachable.has(Hex.key(h.q, h.r)) &&
            new Hex(h.q, h.r).distance(shrine) <= 4);
        for (const h of Rando.shuffle(fieldHexes).slice(0, 6)) h.feature = 'field';

        // The Standing Stones: a hill worth the trek — the nearest one past 6 hexes,
        // not the far rim of the world.
        const hills = Array.from(state.hexes.values()).filter(h =>
            h.terrain === A.TERRAIN.HILL && h.buildingId === null &&
            reachable.has(Hex.key(h.q, h.r)));
        hills.sort((a, b) => new Hex(a.q, a.r).distance(shrine) - new Hex(b.q, b.r).distance(shrine));
        const far = hills.find(h => new Hex(h.q, h.r).distance(shrine) >= 6) ??
            hills[hills.length - 1] ??
            spotsWithin(99).sort((a, b) =>
                new Hex(b.q, b.r).distance(shrine) - new Hex(a.q, a.r).distance(shrine))[0];
        addBuilding(state, 'stones', far, A.BUILDINGS.stones.name);

        // The named souls of the vale.
        addVillager(state, freshName(state), 'the miller', mill);
        addVillager(state, freshName(state), 'the priest', chapel);
        addVillager(state, freshName(state), 'the taverner', tavern);
        addVillager(state, freshName(state), 'the smith', smithy);
        const roles = ['the farmer', 'the midwife', 'the shepherd', 'the child'];
        cottages.forEach((cottage, i) => {
            const villager = addVillager(state, freshName(state), roles[i % roles.length], cottage);
            cottage.name = `${villager.name}'s cottage`;
        });
        addVillager(state, 'Barnabas', 'the goat', well);
    }

    // ---- visions ----

    function targetPoolBuildings(state, pool) {
        const eligible = state.buildings.filter(b => !b.ruined && b.kind !== 'stones' && b.kind !== 'bridge');
        if (pool === 'flammable') return eligible.filter(b => A.BUILDINGS[b.kind].flammable);
        if (pool === 'rich') return eligible.filter(b => A.BUILDINGS[b.kind].rich);
        if (pool === 'lowland') {
            return eligible
                .sort((a, b) => state.hexes.get(a.hexKey).elev - state.hexes.get(b.hexKey).elev)
                .slice(0, 4);
        }
        return eligible;
    }

    function createVision(state) {
        const kindKey = Rando.weighted(Object.keys(A.EVENTS).map(k =>
            ({ item: k, weight: A.EVENTS[k].weight })));
        const ev = A.EVENTS[kindKey];

        let building, victimId;
        if (ev.targetPool === 'villager') {
            const victim = Rando.choice(state.aliveVillagers());
            if (!victim) return null;
            victimId = victim.id;
            building = state.buildingById(victim.homeId);
        } else {
            building = Rando.choice(targetPoolBuildings(state, ev.targetPool));
            if (!building) return null;
            victimId = Rando.bool(0.6) ? (Rando.choice(building.occupantIds) ?? null) : null;
        }

        const rank = state.rank();
        const daysOut = Math.max(T.VISION_DAYS_MIN, Math.min(T.VISION_DAYS_MAX,
            Math.round(Rando.around(T.VISION_DAYS_MEAN, T.VISION_DAYS_SD))));
        const vision = {
            id: state.nextVisionId++,
            kind: kindKey,
            buildingId: building.id,
            victimId: victimId,
            day: state.day + daysOut,
            magnitude: Math.round(Math.max(4, Rando.around(rank.magMean, rank.magMean * T.MAG_SD_FRAC))),
            arrivedDay: state.day,
            warned: false,
            aid: 0,
            revealed: { kind: false, place: false, day: false, victim: false, magnitude: false },
            riddle: {
                kind: Rando.choice(ev.riddles),
                place: Rando.choice(A.BUILDINGS[building.kind].placeRiddles),
                day: Rando.choice(daysOut <= 5 ? A.RIDDLES.dayNear : A.RIDDLES.day),
                victim: Rando.choice(A.RIDDLES.victim),
                magnitude: Rando.choice(A.RIDDLES.magnitude)
            }
        };

        let facets = T.FACETS_ON_ARRIVAL;
        if (state.rankIndex() >= 1) facets += 1;              // Second Sight
        if (state.burden >= T.BURDEN_CLOUD) facets -= 1;      // a clouded mind
        facets = Math.max(1, facets);
        const available = T.FACET_WEIGHTS.filter(w => w.item !== 'victim' || victimId !== null);
        const pool = available.slice();
        for (let i = 0; i < facets && pool.length > 0; i++) {
            const facet = Rando.weighted(pool);
            vision.revealed[facet] = true;
            pool.splice(pool.findIndex(w => w.item === facet), 1);
        }

        state.visions.push(vision);
        return vision;
    }

    // ---- oracle context (what can be done where) ----

    function atSite(state, kinds) {
        const building = state.buildingAtOracle();
        return building !== null && !building.ruined && kinds.includes(building.kind);
    }

    function canDivineHere(state) {
        return atSite(state, ['shrine', 'stones']) && state.actions > 0;
    }

    function canWarnHere(state) {
        return atSite(state, ['chapel', 'tavern']) && state.actions > 0;
    }

    function canPrepareHere(state) {
        const building = state.buildingAtOracle();
        return building !== null && !building.ruined && building.kind !== 'stones' &&
            state.actions > 0 && state.supplies >= T.PREP_COST;
    }

    function canWorkHere(state) {
        const hex = state.oracleHex();
        const atMill = atSite(state, ['mill']);
        return (hex.feature === 'field' || atMill) && state.actions > 0;
    }

    function canFestivalHere(state) {
        return atSite(state, ['tavern']) && state.actions > 0 && state.supplies >= T.FESTIVAL_COST;
    }

    // Why a vision can't be warned right now, or null if it can. The UI shows this
    // on the disabled button — a greyed control must explain itself.
    function warnBlocker(state, vision) {
        if (vision.warned) return null;
        if (!vision.revealed.kind || !vision.revealed.place) return 'divine WHAT and WHERE first';
        if (!atSite(state, ['chapel', 'tavern'])) return 'warnings are given at the Chapel or the Wan Hart';
        if (state.actions <= 0) return 'no actions left today';
        return null;
    }

    // Same, for divination.
    function divineBlocker(state) {
        if (!atSite(state, ['shrine', 'stones'])) return 'divine at the Shrine or the Standing Stones';
        if (state.actions <= 0) return 'no actions left today';
        return null;
    }

    function canTurnFate(state) {
        return state.rankIndex() >= 3 && state.day - state.turnFateDay >= T.TURN_FATE_COOLDOWN;
    }

    // ---- actions ----

    function divine(state, visionId, facet) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !canDivineHere(state) || vision.revealed[facet]) return null;
        const atStones = atSite(state, ['stones']);

        state.actions -= 1;
        state.burden = clampBurden(state.burden + (atStones ? T.DIVINE_BURDEN_STONES : T.DIVINE_BURDEN_SHRINE));
        vision.revealed[facet] = true;
        const msgs = [`You divine: ${facetText(state, vision, facet)}.`];

        // Stone-Tongue: the Stones volunteer a second facet.
        if (atStones && state.rankIndex() >= 2) {
            const veiled = facetKeys(vision).filter(f => !vision.revealed[f]);
            if (veiled.length > 0) {
                const extra = Rando.choice(veiled);
                vision.revealed[extra] = true;
                msgs.push(`The Stones add, unasked: ${facetText(state, vision, extra)}.`);
            }
        }
        return msgs;
    }

    function facetKeys(vision) {
        const keys = ['kind', 'place', 'day', 'magnitude'];
        if (vision.victimId !== null) keys.push('victim');
        return keys;
    }

    function magWord(mag) {
        if (mag <= 10) return 'a lesser doom';
        if (mag <= 15) return 'a grievous doom';
        return 'a great doom';
    }

    // The true text of a revealed facet (UI shows riddle text when veiled).
    function facetText(state, vision, facet) {
        if (facet === 'kind') return A.EVENTS[vision.kind].name;
        if (facet === 'place') return state.buildingById(vision.buildingId).name;
        if (facet === 'day') return `day ${vision.day}`;
        if (facet === 'victim') {
            const victim = state.villagerById(vision.victimId);
            return `${victim.name} ${victim.role}`;
        }
        return `${magWord(vision.magnitude)} (${vision.magnitude})`;
    }

    function warn(state, visionId) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !canWarnHere(state) || vision.warned) return null;
        if (!vision.revealed.kind || !vision.revealed.place) return null;

        state.actions -= 1;
        vision.warned = true;
        state.burden = clampBurden(state.burden - T.WARN_BURDEN_RELIEF);
        const building = state.buildingById(vision.buildingId);
        return [`You stand up and say it plainly: ${A.EVENTS[vision.kind].name} is coming to ${building.name}. ` +
            `The village takes up the vigil — and starts counting the days.`];
    }

    function prepare(state, prepKind) {
        if (!canPrepareHere(state)) return null;
        const building = state.buildingAtOracle();

        state.actions -= 1;
        state.supplies -= T.PREP_COST;
        const strength = Math.max(1, Math.round(Rando.around(T.PREP_STRENGTH, T.PREP_STRENGTH_SD)));
        building.preps[prepKind] = (building.preps[prepKind] ?? 0) + strength;
        return [`${A.PREPS[prepKind].name} raised at ${building.name} (+${strength}, now ${building.preps[prepKind]}).`];
    }

    function work(state) {
        if (!canWorkHere(state)) return null;
        state.actions -= 1;
        const yield_ = Math.max(1, Math.round(Rando.around(T.WORK_YIELD, T.WORK_YIELD_SD)));
        state.supplies += yield_;
        return [`A day's honest work. +${yield_} supplies.`];
    }

    function festival(state) {
        if (!canFestivalHere(state)) return null;
        state.actions -= 1;
        state.supplies -= T.FESTIVAL_COST;
        state.trust = clampTrust(state.trust + T.FESTIVAL_TRUST);
        state.burden = clampBurden(state.burden + T.FESTIVAL_BURDEN);
        return [`You stand a round for the whole vale. ${Rando.choice(A.FLAVOR.festival)}`];
    }

    function turnFate(state, visionId) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !canTurnFate(state)) return null;
        vision.day += T.TURN_FATE_DELAY;
        state.turnFateDay = state.day;
        state.burden = clampBurden(state.burden + T.TURN_FATE_BURDEN);
        return [`You reach into the loom and pull one thread three days looser. Your head rings with it.`];
    }

    // ---- movement ----

    function reachable(state) {
        return reachableFrom(state, state.oracleHex(), state.mp);
    }

    function moveOracle(state, q, r) {
        const costs = reachable(state);
        const cost = costs.get(Hex.key(q, r));
        if (cost === undefined || cost === 0) return false;
        state.mp -= cost;
        state.oracle = { q: q, r: r };
        return true;
    }

    // ---- resolution ----

    function clampTrust(v) { return Math.max(0, Math.min(100, Math.round(v))); }
    function clampBurden(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    function applyLedger(state, ledger) {
        state.renown = Math.max(0, state.renown + ledger.renown);
        state.trust = clampTrust(state.trust + ledger.trust);
        state.burden = clampBurden(state.burden + ledger.burden);
    }

    function placeMemorial(state, building) {
        const chapel = state.buildingsOfKind('chapel')[0];
        const anchor = chapel ?? building;
        const anchorHex = state.hexes.get(anchor.hexKey);
        const spot = new Hex(anchorHex.q, anchorHex.r).inRange(2)
            .map(h => state.hexes.get(h.key()))
            .find(h => h && h.buildingId === null && h.feature === null &&
                h.terrain !== A.TERRAIN.WATER);
        if (spot) spot.feature = 'memorial';
    }

    function resolveVision(state, vision) {
        const ev = A.EVENTS[vision.kind];
        const building = state.buildingById(vision.buildingId);
        const knewMuch = state.facetsKnown(vision) >= 3;

        const dmg = Math.max(0, Math.round(Rando.around(vision.magnitude, vision.magnitude * T.DMG_SD_FRAC)));
        const ward = building.preps[ev.prep] ?? 0;
        const defense = Math.round(ward + vision.aid);
        const net = dmg - defense;
        delete building.preps[ev.prep];   // the matching ward is consumed; wrong wards remain

        const record = {
            visionId: vision.id, kind: vision.kind, hexKey: building.hexKey,
            warned: vision.warned, dmg: dmg, defense: defense, net: net,
            outcome: 'averted', death: false, msgs: []
        };
        const beastName = vision.kind === 'beast' ? ` — they call it ${state.beastName} —` : '';
        record.msgs.push(`${ev.name}${beastName} comes to ${building.name}: ${dmg} fury against ${defense} of ward.`);

        if (net <= 0) {
            record.msgs.push(vision.warned
                ? `The vale holds its breath — and holds. They SAW it break against your ward. They will not forget.`
                : `It breaks and is gone. No one else will ever know what almost happened.`);
            applyLedger(state, vision.warned ? T.AVERT_WARNED : T.AVERT_QUIET);
        } else {
            record.outcome = net >= T.RUIN_AT ? 'ruined' : 'scarred';
            if (vision.warned) {
                applyLedger(state, T.HIT_WARNED);
                record.msgs.push(`It lands despite the vigil. Grim faces — but you were right, and they know it.`);
            } else {
                applyLedger(state, knewMuch ? T.HIT_KNEW : T.HIT_QUIET);
                if (knewMuch) record.msgs.push(`You knew. You said nothing. That sits in the chest like a stone.`);
            }
            if (ev.targetPool !== 'villager') {
                if (record.outcome === 'ruined') {
                    building.ruined = true;
                    building.rebuildDays = T.REBUILD_DAYS;
                    building.preps = {};
                    record.msgs.push(`${building.name} ${ev.verb === 'burns' ? 'burns to the rafters' : 'is ruined'}.`);
                } else {
                    record.msgs.push(`${building.name} is scarred, but stands.`);
                }
            }
            const victim = vision.victimId !== null ? state.villagerById(vision.victimId) : null;
            if (victim && victim.alive && net >= T.DEATH_AT) {
                record.death = true;
                victim.alive = false;
                const home = state.buildingById(victim.homeId);
                home.occupantIds = home.occupantIds.filter(id => id !== victim.id);
                placeMemorial(state, building);
                if (victim.role === 'the goat') {
                    state.renown += T.GOAT_RENOWN;
                    record.msgs.push(`${victim.name} the goat is taken. The vale composes a ballad by nightfall. He was a very good goat.`);
                } else {
                    applyLedger(state, { renown: 0, trust: T.DEATH_TRUST, burden: T.DEATH_BURDEN });
                    record.msgs.push(`${victim.name} ${victim.role} is ${ev.verb === 'takes' ? 'taken' : 'lost'}. A stone is raised by the chapel.`);
                }
            } else if (victim && victim.alive) {
                record.msgs.push(ev.targetPool === 'villager'
                    ? `${victim.name} ${victim.role} takes to bed for a few days, and lives.`
                    : `${victim.name} ${victim.role} crawls out of it, singed and furious, but alive.`);
            }
        }

        state.visions = state.visions.filter(v => v.id !== vision.id);
        return record;
    }

    function addNewcomer(state, msgs) {
        const shrine = state.buildingsOfKind('shrine')[0];
        const shrineHex = state.hexes.get(shrine.hexKey);
        const reach = reachableFrom(state, shrineHex, 999);
        const spot = Array.from(state.hexes.values()).find(h =>
            reach.has(Hex.key(h.q, h.r)) && h.buildingId === null && h.feature === null &&
            h.terrain !== A.TERRAIN.WATER && h.terrain !== A.TERRAIN.MARSH &&
            new Hex(h.q, h.r).distance(new Hex(shrineHex.q, shrineHex.r)) <= 5);
        const home = spot
            ? addBuilding(state, 'cottage', spot, '')
            : Rando.choice(state.buildingsOfKind('cottage').filter(c => !c.ruined)) ?? shrine;
        const villager = addVillager(state, freshName(state), 'the settler', home);
        if (spot) home.name = `${villager.name}'s cottage`;
        msgs.push(Rando.choice(A.FLAVOR.newcomer).replaceAll('{name}', villager.name));
    }

    // ---- the day loop ----

    function endDay(state) {
        const report = { resolutions: [], msgs: [] };
        const rankBefore = state.rankIndex();

        // Dusk: dooms whose day has come land, one by one, visibly.
        const due = state.visions.filter(v => v.day <= state.day);
        for (const vision of due) report.resolutions.push(resolveVision(state, vision));

        // Pending futures accrue weight; knowing more weighs more.
        for (const vision of state.visions) {
            const extra = state.facetsKnown(vision) >= 3 ? T.BURDEN_KNOWN_EXTRA : 0;
            state.burden = clampBurden(state.burden + T.BURDEN_PER_PENDING + extra);
        }
        state.burden = clampBurden(state.burden - T.BURDEN_DECAY);

        // Dawn.
        state.day += 1;

        for (const building of state.buildings.filter(b => b.ruined)) {
            building.rebuildDays -= 1;
            if (building.rebuildDays <= 0) {
                building.ruined = false;
                report.msgs.push(`${building.name} stands again, smelling of new timber.`);
            }
        }

        // Vigil fatigue and village aid on warned dooms.
        for (const vision of state.visions.filter(v => v.warned)) {
            state.trust = clampTrust(state.trust - T.VIGIL_TRUST_DRAIN);
            if (state.trust > 0) vision.aid += Math.max(0, Rando.around(T.VILLAGE_AID, T.VILLAGE_AID_SD));
        }

        if (state.visions.length < state.rank().cap && Rando.bool(T.VISION_CHANCE)) {
            const vision = createVision(state);
            if (vision) report.msgs.push(`${Rando.choice(A.FLAVOR.arrival)} ${describeVision(state, vision)}`);
        }

        if (state.aliveVillagers().length < 4 && Rando.bool(0.1)) addNewcomer(state, report.msgs);

        const rankAfter = state.rankIndex();
        if (rankAfter > rankBefore) {
            const rank = A.RANKS[rankAfter];
            report.msgs.push(`Word of you spreads. You are now ${rank.name}. ${rank.gift ?? ''}`);
            report.msgs.push(`Fame is a lamp: it draws grander moths.`);
            addNewcomer(state, report.msgs);
        }

        if (Rando.bool(0.3)) {
            const someone = Rando.choice(state.aliveVillagers().filter(v => v.role !== 'the goat'));
            if (someone) report.msgs.push(Rando.choice(A.FLAVOR.mutterings).replaceAll('{name}', someone.name));
        }

        state.actions = state.actionsPerDay();
        state.mp = T.MP_PER_DAY;
        return report;
    }

    // One line summarizing a vision as the player currently knows it.
    function describeVision(state, vision) {
        const part = facet => vision.revealed[facet]
            ? facetText(state, vision, facet)
            : vision.riddle[facet];
        const bits = [part('kind'), part('place'), part('day')];
        if (vision.victimId !== null) bits.push(part('victim'));
        return bits.join(' · ');
    }

    // ---- new game ----

    function newGame(seed) {
        Rando.seed(seed);
        const state = new GameState();
        state.seed = seed;
        state.supplies = T.START_SUPPLIES;
        state.trust = T.START_TRUST;
        state.beastName = Rando.choice(['Old Groan', 'the Grey Sow', 'Longtooth', 'the Hollow Stag']);
        generateHexes(state);
        placeVillage(state);
        state.actions = state.actionsPerDay();
        state.mp = T.MP_PER_DAY;
        createVision(state);   // the loop starts with a doom already gathering
        return state;
    }

    return {
        newGame, endDay, reachable, moveOracle, movementCost,
        divine, warn, prepare, work, festival, turnFate,
        canDivineHere, canWarnHere, canPrepareHere, canWorkHere, canFestivalHere, canTurnFate,
        warnBlocker, divineBlocker,
        facetKeys, facetText, describeVision, magWord
    };
})();
