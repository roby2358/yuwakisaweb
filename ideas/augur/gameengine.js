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

        // The village center: the shrine sits at the middle of the map,
        // with open ground for a radius of 3 around it.
        const shrine = center;
        const shrineHex = state.hexes.get(center.key());
        for (const h of state.hexes.values()) {
            if (new Hex(h.q, h.r).distance(shrine) <= 3) {
                h.terrain = A.TERRAIN.FIELD;
            }
        }
        addBuilding(state, 'shrine', shrineHex, A.BUILDINGS.shrine.name);
        state.oracle = { q: shrineHex.q, r: shrineHex.r };

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
            selfWarned: false,
            aid: 0,
            pendingChoice: null,
            revealed: { kind: false, place: false, day: false, victim: false, magnitude: false },
            riddle: {
                kind: Rando.choice(ev.riddles),
                place: Rando.choice(A.BUILDINGS[building.kind].placeRiddles),
                day: Flourish.pick(daysOut <= 5 ? 'riddle-day-near' : 'riddle-day'),
                victim: Flourish.pick('riddle-victim'),
                magnitude: Flourish.pick('riddle-magnitude')
            }
        };

        let facets = T.FACETS_ON_ARRIVAL;
        if (state.rankIndex() >= 1) facets += 1;              // Second Sight
        if (state.madness >= T.MADNESS_CLOUD) facets -= 1;      // a clouded mind
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

    // Stone-Tongue: the Stones volunteer a second facet after any earned reveal.
    function stoneTongue(state, vision, atStones, msgs) {
        if (!atStones || state.rankIndex() < 2) return;
        const veiled = facetKeys(vision).filter(f => !vision.revealed[f]);
        if (veiled.length === 0) return;
        const extra = Rando.choice(veiled);
        vision.revealed[extra] = true;
        msgs.push(`The Stones add, unasked: ${facetText(state, vision, extra)}.`);
    }

    // Divination is a gamble, paid up front: half the time the veil holds,
    // half of the rest the vision picks the facet, and only the last quarter
    // parts the veil for the augur to choose (divineReveal spends that).
    function divineAttempt(state, visionId) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !canDivineHere(state) || vision.pendingChoice) return null;
        const veiled = facetKeys(vision).filter(f => !vision.revealed[f]);
        if (veiled.length === 0) return null;
        const atStones = atSite(state, ['stones']);

        state.actions -= 1;
        state.madness = clampMadness(state.madness + (atStones ? T.DIVINE_MADNESS_STONES : T.DIVINE_MADNESS_SHRINE));

        if (Rando.bool(T.DIVINE_WHIFF)) return [Flourish.pick('divine-nothing')];
        if (Rando.bool(T.DIVINE_UNBIDDEN)) {
            const facet = Rando.choice(veiled);
            vision.revealed[facet] = true;
            const msgs = [`${Flourish.pick('divine-unbidden')} ${facetText(state, vision, facet)}.`];
            stoneTongue(state, vision, atStones, msgs);
            return msgs;
        }
        vision.pendingChoice = { stones: atStones };
        return [Flourish.pick('divine-parts')];
    }

    function divineReveal(state, visionId, facet) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !vision.pendingChoice || vision.revealed[facet]) return null;
        const atStones = vision.pendingChoice.stones;
        vision.pendingChoice = null;
        vision.revealed[facet] = true;
        const msgs = [`You divine: ${facetText(state, vision, facet)}.`];
        stoneTongue(state, vision, atStones, msgs);
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

    // An honest read of the village's readiness against this doom, leaking
    // nothing the augur has not divined.
    // What the map badge shows: null until kind+place are both revealed;
    // tier stays null while the doom's weight is veiled.
    function preparedness(state, vision) {
        if (!vision.revealed.kind || !vision.revealed.place) return null;
        const ev = A.EVENTS[vision.kind];
        const building = state.buildingById(vision.buildingId);
        const defense = Math.round((building.preps[ev.prep] ?? 0) + vision.aid);
        if (!vision.revealed.magnitude) return { defense, tier: null };
        const ratio = defense / vision.magnitude;
        const tier = ratio < 0.9 ? 'vulnerable' : ratio <= 1.15 ? 'close' : 'ready';
        return { defense, tier };
    }

    function preparednessText(state, vision) {
        const p = preparedness(state, vision);
        if (!p) {
            return 'You cannot judge their readiness while the doom keeps its shape.';
        }
        const defense = p.defense;
        if (!vision.revealed.magnitude) {
            return defense === 0
                ? 'Nothing stands against it — however hard it may come.'
                : `A ward of ${defense} stands — against what weight, you cannot say.`;
        }
        if (defense === 0) return 'Nothing stands against it.';
        const ratio = defense / vision.magnitude;
        if (ratio < 0.5) return `What stands (${defense}) is far from enough.`;
        if (ratio < 0.9) return `The wards are rising (${defense}), but not yet equal to it.`;
        if (ratio <= 1.15) return `It will be a near thing (${defense} against ${vision.magnitude}).`;
        return `The village stands ready (${defense} against ${vision.magnitude}).`;
    }

    function warn(state, visionId) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !canWarnHere(state) || vision.warned) return null;
        if (!vision.revealed.kind || !vision.revealed.place) return null;

        state.actions -= 1;
        vision.warned = true;
        state.madness = clampMadness(state.madness - T.WARN_MADNESS_RELIEF);
        const building = state.buildingById(vision.buildingId);
        return [`You stand up and say it plainly: ${A.EVENTS[vision.kind].name} is coming to ${building.name}. ` +
            `The village takes up the vigil — and starts counting the days.`];
    }

    // The village watches the augur work. If the augur is warding a doom whose
    // what and where they already know, sometimes the vale puts it together and
    // takes up the vigil unasked — the warn, free of charge, with a little
    // madness relief. But the vigil starts whether the augur wanted quiet or not.
    function selfWarn(state, building, msgs) {
        const vision = state.visions.find(v => !v.warned && v.buildingId === building.id &&
            v.revealed.kind && v.revealed.place);
        if (!vision || !Rando.bool(state.effectiveTrust() * T.SELF_WARN_PER_TRUST)) return;
        vision.warned = true;
        vision.selfWarned = true;   // a vigil the vale chose itself drains no trust
        state.madness = clampMadness(state.madness - T.SELF_WARN_MADNESS_RELIEF);
        msgs.push(`The village has been watching you work. By dusk everyone has said it for you: ` +
            `${A.EVENTS[vision.kind].name} is coming to ${building.name}. They take up the vigil unasked.`);
    }

    function prepare(state, prepKind) {
        if (!canPrepareHere(state)) return null;
        const building = state.buildingAtOracle();

        state.actions -= 1;
        state.supplies -= T.PREP_COST;
        state.madness = clampMadness(state.madness - T.PREP_MADNESS_RELIEF);   // action eases suffering
        const strength = Math.max(1, Math.round(Rando.around(T.PREP_STRENGTH, T.PREP_STRENGTH_SD)));
        building.preps[prepKind] = (building.preps[prepKind] ?? 0) + strength;
        const msgs = [`${A.PREPS[prepKind].name} raised at ${building.name} (+${strength}, now ${building.preps[prepKind]}).`];
        selfWarn(state, building, msgs);
        return msgs;
    }

    function work(state) {
        if (!canWorkHere(state)) return null;
        state.actions -= 1;
        const yield_ = Math.max(1, Math.round(Rando.around(T.WORK_YIELD, T.WORK_YIELD_SD)));
        state.supplies += yield_;
        return [Flourish.pick('work', { n: yield_ })];
    }

    function festival(state) {
        if (!canFestivalHere(state)) return null;
        state.actions -= 1;
        state.supplies -= T.FESTIVAL_COST;
        state.trust = clampTrust(state.trust + T.FESTIVAL_TRUST);
        state.madness = clampMadness(state.madness + T.FESTIVAL_MADNESS);
        return [`You stand a round for the whole vale. ${Rando.choice(A.FLAVOR.festival)}`];
    }

    function turnFate(state, visionId) {
        const vision = state.visions.find(v => v.id === visionId);
        if (!vision || !canTurnFate(state)) return null;
        vision.day += T.TURN_FATE_DELAY;
        state.turnFateDay = state.day;
        state.madness = clampMadness(state.madness + T.TURN_FATE_MADNESS);
        return [Flourish.pick('turn-fate')];
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
    function clampMadness(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    function applyLedger(state, ledger) {
        state.renown = Math.max(0, state.renown + ledger.renown);
        state.trust = clampTrust(state.trust + ledger.trust);
        state.madness = clampMadness(state.madness + ledger.madness);
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
            record.msgs.push(Flourish.pick(vision.warned ? 'averted-warned' : 'averted-quiet'));
            applyLedger(state, vision.warned ? T.AVERT_WARNED : T.AVERT_QUIET);
        } else {
            record.outcome = net >= T.RUIN_AT ? 'ruined' : 'scarred';
            if (vision.warned) {
                applyLedger(state, T.HIT_WARNED);
                record.msgs.push(Flourish.pick('hit-warned'));
            } else {
                applyLedger(state, knewMuch ? T.HIT_KNEW : T.HIT_QUIET);
                if (knewMuch) record.msgs.push(Flourish.pick('knew-quiet'));
            }
            if (ev.targetPool !== 'villager') {
                if (record.outcome === 'ruined') {
                    building.ruined = true;
                    building.rebuildDays = T.REBUILD_DAYS;
                    building.preps = {};
                    record.msgs.push(`${building.name} ${ev.verb === 'burns' ? 'burns to the rafters' : 'is ruined'}.`);
                } else {
                    record.msgs.push(Flourish.pick('scarred', { name: building.name }));
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
                    applyLedger(state, { renown: 0, trust: T.DEATH_TRUST, madness: T.DEATH_MADNESS });
                    record.msgs.push(`${victim.name} ${victim.role} is ${ev.verb === 'takes' ? 'taken' : 'lost'}. ${Flourish.pick('memorial')}`);
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
            const extra = state.facetsKnown(vision) >= 3 ? T.MADNESS_KNOWN_EXTRA : 0;
            state.madness = clampMadness(state.madness + T.MADNESS_PER_PENDING + extra);
        }
        state.madness = clampMadness(state.madness - T.MADNESS_DECAY);

        // Dawn. The vale's unnamed hands bring in the harvest — unless a vigil
        // has them scrambling to prep instead.
        state.day += 1;
        if (!state.visions.some(v => v.warned)) {
            state.supplies += state.aliveVillagers().length * T.VILLAGER_YIELD;
        }

        for (const building of state.buildings.filter(b => b.ruined)) {
            building.rebuildDays -= 1;
            if (building.rebuildDays <= 0) {
                building.ruined = false;
                report.msgs.push(Flourish.pick('rebuilt', { name: building.name }));
            }
        }

        // Vigil fatigue and village aid on warned dooms. A vigil the vale took
        // up on its own drains no trust — they are doing it to themselves.
        for (const vision of state.visions.filter(v => v.warned)) {
            if (!vision.selfWarned) state.trust = clampTrust(state.trust - T.VIGIL_TRUST_DRAIN);
            if (state.effectiveTrust() > 0) vision.aid += Math.max(0, Rando.around(T.VILLAGE_AID, T.VILLAGE_AID_SD));
        }

        // Inspiration: some mornings the veil simply slips.
        if (Rando.bool(T.INSPIRATION_CHANCE)) {
            const open = state.visions.filter(v => facetKeys(v).some(f => !v.revealed[f]));
            if (open.length > 0) {
                const vision = Rando.choice(open);
                const facet = Rando.choice(facetKeys(vision).filter(f => !vision.revealed[f]));
                vision.revealed[facet] = true;
                report.msgs.push(`${Flourish.pick('inspiration')} ${facetText(state, vision, facet)}.`);
            }
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
            report.msgs.push(Flourish.pick('fame'));
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
        divineAttempt, divineReveal, warn, prepare, work, festival, turnFate,
        canDivineHere, canWarnHere, canPrepareHere, canWorkHere, canFestivalHere, canTurnFate,
        warnBlocker, divineBlocker,
        facetKeys, facetText, describeVision, magWord, preparedness, preparednessText
    };
})();
