/* The Great-Souled Sam — game engine (pure logic, no DOM).
   Loaded via <script> in the browser; require()-able in Node for tests. */
(function (global) {
  'use strict';

  /* ---------------- static data ---------------- */

  const MAP = {
    nodes: {
      heaven:      { name: 'The Celestial City', x: 450, y: 62,  kind: 'heaven' },
      hellwell:    { name: 'Hellwell',           x: 130, y: 150, kind: 'hellwell' },
      rajgir:      { name: 'Rajgir',             x: 330, y: 175, kind: 'city' },
      pataliputra: { name: 'Pataliputra',        x: 605, y: 160, kind: 'city' },
      alundil:     { name: 'Alundil',            x: 195, y: 305, kind: 'city' },
      keenset:     { name: 'Keenset',            x: 455, y: 290, kind: 'city' },
      khaipur:     { name: 'Khaipur',            x: 705, y: 290, kind: 'city' },
      lananda:     { name: 'Lananda',            x: 330, y: 425, kind: 'city' },
      sarnath:     { name: 'Sarnath',            x: 560, y: 420, kind: 'city' },
      mahartha:    { name: 'Mahartha',           x: 205, y: 540, kind: 'city' },
      kusinara:    { name: 'Kusinara',           x: 455, y: 550, kind: 'city' },
      vaishali:    { name: 'Vaishali',           x: 760, y: 480, kind: 'city' },
    },
    edges: [
      ['heaven', 'rajgir'], ['heaven', 'pataliputra'],
      ['hellwell', 'rajgir'], ['hellwell', 'alundil'],
      ['rajgir', 'keenset'], ['rajgir', 'pataliputra'], ['rajgir', 'alundil'],
      ['pataliputra', 'khaipur'],
      ['alundil', 'lananda'], ['alundil', 'keenset'],
      ['keenset', 'sarnath'], ['keenset', 'khaipur'], ['keenset', 'lananda'],
      ['khaipur', 'sarnath'], ['khaipur', 'vaishali'],
      ['lananda', 'mahartha'], ['lananda', 'kusinara'],
      ['sarnath', 'kusinara'], ['sarnath', 'vaishali'],
      ['mahartha', 'kusinara'],
      ['kusinara', 'vaishali'],
    ],
  };

  const BODIES = {
    siddhartha: { name: 'Siddhartha, Binder of Demons', power: 3, perk: 'binder',
                  perkText: 'Demon-binding costs half karma' },
    kshatriya:  { name: 'a scarred Kshatriya warrior', power: 5, perk: 'warrior',
                  perkText: 'Formidable in battle (power 5)' },
    monk:       { name: 'a frail monk of the purple grove', power: 2, perk: 'orator',
                  perkText: 'Sermons ring true (+17 conversion)' },
    thief:      { name: 'a wiry thief of Mahartha', power: 3, perk: 'elusive',
                  perkText: 'Flight from battle always succeeds' },
    merchant:   { name: 'a perfumed merchant prince', power: 3, perk: 'tithed',
                  perkText: '+3 karma every turn' },
  };

  const GODS = [
    { id: 'agni', name: 'Agni', title: 'Lord of Flames', power: 5, speed: 1, threshold: 20,
      trait: 'Burns converted cities to ash' },
    { id: 'kali', name: 'Kali', title: 'Goddess of Destruction', power: 6, speed: 2, threshold: 45,
      trait: 'Moves two roads each turn' },
    { id: 'yama', name: 'Yama', title: 'Deathgod', power: 8, speed: 1, threshold: 70,
      trait: 'Near-unbeatable; demons fight him at double strength' },
  ];

  const DEMON_NAMES = ['Taraka', 'Bakasura', 'Puloman', 'Dhumaketu', 'Kabandha'];

  const T = {
    PREACH_CONVERSION: 34,
    ORATOR_BONUS: 17,
    PREACH_KARMA: 4,
    PREACH_ENLIGHTENMENT: 2,
    PREACH_WRATH: 2,
    CONVERT_ENLIGHTENMENT: 5,
    CONVERT_WRATH: 8,
    CONVERT_KARMA: 6,
    MEDITATE_KARMA: 4,
    CITY_KARMA: 2,
    CITY_ENLIGHTENMENT: 2,
    TITHED_KARMA: 3,
    BIND_BASE: 25,
    BIND_PER_DEMON: 10,
    EXORCISE_COST: 10,
    CHANNEL_STEP: 10,
    CHANNEL_MAX: 3,
    VICTORY_KARMA: 15,
    VICTORY_ENLIGHTENMENT: 10,
    VICTORY_WRATH: 10,
    GOD_RESPAWN: 6,
    PURGE_AMOUNT: 25,
    BURN_ENLIGHTENMENT: 5,
    REBIRTH_BASE: 25,
    REBIRTH_PER_DEATH: 15,
    START_KARMA: 30,
    WIN_ENLIGHTENMENT: 100,
    DETECT_HIDDEN: 0.4,
    FLEE_CHANCE: 0.5,
    HARRIED_STALL: 0.5,
    DEMON_BREAK: 0.15,
    DEMON_SLAIN: 0.1,
  };

  /* ---------------- rng (mulberry32, state lives in the struct) ---------------- */

  function rand(state) {
    state.rng = (state.rng + 0x6D2B79F5) | 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randInt(state, n) { return Math.floor(rand(state) * n); }
  function d6(state) { return 1 + randInt(state, 6); }
  function pick(state, arr) { return arr[randInt(state, arr.length)]; }

  /* ---------------- graph helpers ---------------- */

  const ADJ = {};
  Object.keys(MAP.nodes).forEach((id) => { ADJ[id] = []; });
  MAP.edges.forEach(([a, b]) => { ADJ[a].push(b); ADJ[b].push(a); });

  // Shortest path from -> to, skipping nodes in `blocked`. Returns node list or null.
  function bfsPath(from, to, blocked) {
    if (from === to) return [from];
    const prev = { [from]: from };
    const queue = [from];
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const next of ADJ[cur]) {
        if (prev[next] !== undefined || blocked.includes(next)) continue;
        prev[next] = cur;
        if (next === to) {
          const path = [to];
          while (path[0] !== from) path.unshift(prev[path[0]]);
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  /* ---------------- state queries ---------------- */

  function isConverted(city) { return city.conversion >= 100; }
  function isActive(city) { return isConverted(city) && city.possessedBy === null; }
  function activeCities(state) { return Object.values(state.cities).filter(isActive); }
  function huntingGods(state) { return state.gods.filter((g) => g.status === 'hunting'); }
  function godAt(state, nodeId) { return huntingGods(state).find((g) => g.city === nodeId) || null; }
  function demonBoundTo(state, godId) { return state.demons.find((d) => d.bound === godId) || null; }
  function body(state) { return BODIES[state.sam.bodyId]; }
  function hasPerk(state, perk) { return body(state).perk === perk; }

  function nearestNode(state, from, candidateIds) {
    let best = null;
    let bestLen = Infinity;
    for (const id of candidateIds) {
      const path = bfsPath(from, id, ['hellwell']);
      if (path !== null && path.length < bestLen) { best = id; bestLen = path.length; }
    }
    return best;
  }

  function bindCost(state) {
    const base = T.BIND_BASE + T.BIND_PER_DEMON * state.demons.length;
    return hasPerk(state, 'binder') ? Math.floor(base / 2) : base;
  }

  function rebirthCost(state) { return T.REBIRTH_BASE + T.REBIRTH_PER_DEATH * state.deaths; }

  /* ---------------- logging & animation events ---------------- */

  function log(state, kind, text) { state.log.push({ turn: state.turn, kind, text }); }
  function event(state, ev) { state.turnEvents.push(ev); }

  /* ---------------- game setup ---------------- */

  function newGame(seed) {
    const cities = {};
    for (const [id, node] of Object.entries(MAP.nodes)) {
      if (node.kind !== 'city') continue;
      cities[id] = { id, conversion: 0, burned: false, possessedBy: null };
    }
    const state = {
      rng: seed | 0,
      turn: 1,
      phase: 'play',
      sam: { city: 'mahartha', bodyId: 'siddhartha', hidden: true, lastSeen: null },
      karma: T.START_KARMA,
      wrath: 0,
      enlightenment: 0,
      deaths: 0,
      cities,
      gods: GODS.map((g) => ({ ...g, status: 'heaven', city: null, respawnIn: 0 })),
      demons: [],
      demonsBound: 0,
      confront: null,
      log: [],
      turnEvents: [],
    };
    log(state, 'sam', 'His followers called him Mahasamatman and said he was a god. ' +
      'He preferred to drop the Maha- and the -atman, and called himself Sam. ' +
      'He walks ashore at Mahartha, wearing the body of a prince.');
    return state;
  }

  /* ---------------- player actions (dispatch table) ---------------- */

  const ACTIONS = {
    travel(state, action) {
      if (!ADJ[state.sam.city].includes(action.city)) return fail('That road does not exist.');
      if (action.city === 'heaven') return fail('No mortal road leads up the ice to Heaven.');
      state.sam.city = action.city;
      state.sam.hidden = true;
      log(state, 'sam', `Sam travels quietly to ${MAP.nodes[action.city].name}.`);
      const god = godAt(state, action.city);
      if (god !== null) {
        beginConfrontation(state, god, `Sam walks into ${MAP.nodes[action.city].name} — and ${god.name} is waiting.`);
        return ok();
      }
      endTurn(state);
      return ok();
    },

    preach(state, action) {
      const city = state.cities[state.sam.city];
      if (city === undefined) return fail('There is no one to preach to in this place.');
      if (isConverted(city)) return fail('This city already follows the Path of the Eightfold Way.');
      const gain = T.PREACH_CONVERSION + (hasPerk(state, 'orator') ? T.ORATOR_BONUS : 0);
      city.conversion = Math.min(100, city.conversion + gain);
      city.burned = false;
      state.karma += T.PREACH_KARMA;
      state.enlightenment += T.PREACH_ENLIGHTENMENT;
      state.wrath = Math.min(100, state.wrath + T.PREACH_WRATH);
      state.sam.hidden = false;
      state.sam.lastSeen = state.sam.city;
      log(state, 'sam', `Sam preaches in ${MAP.nodes[city.id].name}. The word spreads — and so does word of the one who speaks it.`);
      if (isConverted(city)) {
        state.enlightenment += T.CONVERT_ENLIGHTENMENT;
        state.wrath = Math.min(100, state.wrath + T.CONVERT_WRATH);
        state.karma += T.CONVERT_KARMA;
        log(state, 'event', `${MAP.nodes[city.id].name} embraces Acceleration! Its temples turn from the gods; its tithes now flow to Sam.`);
        event(state, { type: 'convert', city: city.id });
      }
      endTurn(state);
      return ok();
    },

    meditate(state, action) {
      state.karma += T.MEDITATE_KARMA;
      state.sam.hidden = true;
      log(state, 'sam', 'Sam sits in meditation, gathering karma, and slips from the sight of Heaven.');
      endTurn(state);
      return ok();
    },

    bind(state, action) {
      if (state.sam.city !== 'hellwell') return fail('The Rakasha are bound only at the flame pits of Hellwell.');
      const god = state.gods.find((g) => g.id === action.god && g.status === 'hunting');
      if (god === undefined) return fail('That god does not walk the world.');
      if (demonBoundTo(state, god.id) !== null) return fail(`A demon already harries ${god.name}.`);
      const cost = bindCost(state);
      if (state.karma < cost) return fail('Not enough karma to bind a demon.');
      state.karma -= cost;
      const name = DEMON_NAMES[Math.min(state.demonsBound, DEMON_NAMES.length - 1)];
      const power = state.demonsBound === 0 ? 3 : 2;
      state.demonsBound += 1;
      state.demons.push({ name, power, bound: god.id, possessing: null });
      log(state, 'demon', `In the flame pits, Sam binds ${name} of the Rakasha and sends him screaming across the sky to harry ${god.name}.`);
      endTurn(state);
      return ok();
    },

    exorcise(state, action) {
      const city = state.cities[state.sam.city];
      if (city === undefined || city.possessedBy === null) return fail('No demon dwells here.');
      if (state.karma < T.EXORCISE_COST) return fail('Not enough karma for the rite of exorcism.');
      state.karma -= T.EXORCISE_COST;
      const demon = state.demons.find((d) => d.name === city.possessedBy);
      state.demons = state.demons.filter((d) => d !== demon);
      city.possessedBy = null;
      log(state, 'demon', `Sam names ${demon.name} by his true name and drives him back to the flame pits. ${MAP.nodes[city.id].name} breathes again.`);
      endTurn(state);
      return ok();
    },

    fight(state, action) {
      if (state.phase !== 'confront') return fail('There is no one to fight.');
      resolveFight(state, action.channel);
      return ok();
    },

    flee(state, action) {
      if (state.phase !== 'confront') return fail('There is nothing to flee.');
      resolveFlee(state);
      return ok();
    },

    rebirth(state, action) {
      if (state.phase !== 'dead') return fail('Sam still lives.');
      const cost = rebirthCost(state);
      const havens = activeCities(state);
      if (state.karma < cost || havens.length === 0) return fail('The Lords of Karma refuse.');
      state.karma -= cost;
      state.deaths += 1;
      const haven = pick(state, havens);
      const others = Object.keys(BODIES).filter((id) => id !== state.sam.bodyId);
      state.sam = { city: haven.id, bodyId: pick(state, others), hidden: true, lastSeen: null };
      state.phase = 'play';
      log(state, 'event', `The pray-machines hum. Sam wakes on a slab in ${MAP.nodes[haven.id].name}, wearing ${body(state).name}. Heaven does not yet know this face.`);
      return ok();
    },

    acceptFate(state, action) {
      if (state.phase !== 'dead') return fail('Sam still lives.');
      state.phase = 'lost';
      log(state, 'death', 'No body, no karma, no road back. The tale of the Binder ends here — until someone else remembers how it was told.');
      return ok();
    },
  };

  function ok() { return { ok: true, error: null }; }
  function fail(error) { return { ok: false, error }; }

  function takeAction(state, action) {
    if (state.phase === 'won' || state.phase === 'lost') return fail('The tale is over.');
    const handler = ACTIONS[action.type];
    if (handler === undefined) return fail(`Unknown action: ${action.type}`);
    state.turnEvents = [];
    return handler(state, action);
  }

  /* ---------------- confrontation ---------------- */

  function beginConfrontation(state, god, text) {
    state.phase = 'confront';
    state.confront = { god: god.id, penalty: false };
    state.sam.hidden = false;
    state.sam.lastSeen = state.sam.city;
    log(state, 'god', text);
    event(state, { type: 'confront', god: god.id, city: state.sam.city });
  }

  function resolveFight(state, channel) {
    const god = state.gods.find((g) => g.id === state.confront.god);
    const pips = Math.min(T.CHANNEL_MAX, Math.floor(channel / T.CHANNEL_STEP),
      Math.floor(state.karma / T.CHANNEL_STEP));
    state.karma -= pips * T.CHANNEL_STEP;
    const demon = demonBoundTo(state, god.id);
    const demonAid = demon === null ? 0 : demon.power * (god.id === 'yama' ? 2 : 1);
    const penalty = state.confront.penalty ? 1 : 0;
    const samTotal = body(state).power + pips + demonAid - penalty + d6(state);
    const godTotal = god.power + d6(state);
    const aidText = demon === null ? '' : ` ${demon.name} fights beside him, laughing.`;
    log(state, 'god', `Sam turns and gives battle to ${god.name}, ${god.title}.${aidText}`);
    if (samTotal > godTotal) { winFight(state, god, demon); return; }
    if (samTotal === godTotal) {
      log(state, 'god', `They are matched, blow for blow — and in the smoke and thunder, Sam slips away.`);
      escapeToAdjacent(state, god);
      return;
    }
    loseFight(state, god);
  }

  function winFight(state, god, demon) {
    god.status = 'heaven';
    god.city = null;
    god.respawnIn = T.GOD_RESPAWN;
    god.power += 1;
    state.karma += T.VICTORY_KARMA;
    state.enlightenment += T.VICTORY_ENLIGHTENMENT;
    state.wrath = Math.min(100, state.wrath + T.VICTORY_WRATH);
    if (demon !== null) {
      state.demons = state.demons.filter((d) => d !== demon);
      log(state, 'demon', `His quarry slain, ${demon.name} shrieks his delight and returns to the flame pits.`);
    }
    log(state, 'event', `${god.name}'s body falls! Men saw a god bleed today, and the songs are already being written. ` +
      `But in Heaven the Lords of Karma are growing ${god.name} a mightier body...`);
    event(state, { type: 'godSlain', god: god.id });
    state.phase = 'play';
    state.confront = null;
    endTurn(state);
  }

  function loseFight(state, god) {
    log(state, 'death', `${god.name} strikes, and the body that was Sam's falls empty to the earth.`);
    event(state, { type: 'samSlain', god: god.id, city: state.sam.city });
    state.sam.city = null;
    state.sam.lastSeen = null;
    state.phase = 'dead';
    state.confront = null;
    if (state.karma < rebirthCost(state) || activeCities(state).length === 0) {
      state.phase = 'lost';
      log(state, 'death', 'And there is no haven left to wake in, no karma left to pay. This death is the real death.');
    }
  }

  function resolveFlee(state) {
    const god = state.gods.find((g) => g.id === state.confront.god);
    const exits = ADJ[state.sam.city].filter((id) => id !== 'heaven' && godAt(state, id) === null);
    const succeeds = exits.length > 0 && (hasPerk(state, 'elusive') || rand(state) < T.FLEE_CHANCE);
    if (!succeeds) {
      log(state, 'god', `Sam runs — but ${god.name} is faster. Cornered, he must fight at a disadvantage.`);
      state.confront.penalty = true;
      resolveFight(state, 0);
      return;
    }
    const refuge = pick(state, exits);
    log(state, 'sam', `Sam vanishes into the crowd and slips away to ${MAP.nodes[refuge].name}.`);
    state.sam.city = refuge;
    state.sam.hidden = true;
    state.phase = 'play';
    state.confront = null;
    endTurn(state);
  }

  function escapeToAdjacent(state, god) {
    const exits = ADJ[state.sam.city].filter((id) => id !== 'heaven' && godAt(state, id) === null);
    if (exits.length > 0) {
      const refuge = pick(state, exits);
      state.sam.city = refuge;
      log(state, 'sam', `Sam withdraws to ${MAP.nodes[refuge].name}, hidden by the dust of battle.`);
    }
    state.sam.hidden = true;
    state.phase = 'play';
    state.confront = null;
    endTurn(state);
  }

  /* ---------------- enemy phase ---------------- */

  function endTurn(state) {
    if (state.phase !== 'play') return;
    deployGods(state);
    moveGods(state);
    demonsAct(state);
    income(state);
    state.turn += 1;
    if (state.enlightenment >= T.WIN_ENLIGHTENMENT) {
      state.phase = 'won';
      log(state, 'win', 'It is done. In a hundred cities the temples stand empty and the printing presses run all night. ' +
        'The Age of Reason has come to the world, and not all the thunderbolts of Heaven can call it back.');
    }
  }

  function deployGods(state) {
    for (const god of state.gods) {
      if (god.status !== 'heaven') continue;
      if (state.wrath < god.threshold) continue;
      if (god.respawnIn > 0) { god.respawnIn -= 1; continue; }
      god.status = 'hunting';
      god.city = 'heaven';
      log(state, 'god', `The Bridge of the Gods flares. ${god.name}, ${god.title}, descends from the Celestial City to hunt the Binder. (${god.trait}.)`);
      event(state, { type: 'deploy', god: god.id });
    }
  }

  function godTarget(state, god) {
    if (state.sam.lastSeen !== null) return state.sam.lastSeen;
    const converted = Object.values(state.cities).filter(isConverted).map((c) => c.id);
    if (converted.length > 0) return nearestNode(state, god.city, converted);
    return null;
  }

  function moveGods(state) {
    for (const god of huntingGods(state)) {
      if (demonBoundTo(state, god.id) !== null && rand(state) < T.HARRIED_STALL) {
        log(state, 'demon', `${god.name} makes no progress — ${demonBoundTo(state, god.id).name} wrestles him across the sky.`);
        continue;
      }
      let caught = false;
      for (let step = 0; step < god.speed && !caught; step += 1) {
        caught = godStep(state, god);
      }
      if (!caught) godArrivalEffects(state, god);
      if (caught) return; // confrontation set; stop all movement drama here
    }
    // A stationary god sharing a city with a revealed Sam does not politely wait.
    if (state.phase === 'play' && state.sam.city !== null && !state.sam.hidden) {
      const god = godAt(state, state.sam.city);
      if (god !== null) beginConfrontation(state, god, `${god.name} turns, and his gaze falls upon Sam.`);
    }
  }

  // Returns true if the god caught Sam (movement stops).
  function godStep(state, god) {
    const target = godTarget(state, god);
    if (target === null || target === god.city) {
      if (target === god.city && state.sam.lastSeen === god.city && state.sam.city !== god.city) {
        state.sam.lastSeen = null;
        log(state, 'god', `${god.name} finds ${MAP.nodes[god.city].name} full of rumors and empty of Sam. The scent is lost.`);
      }
      return false;
    }
    const path = bfsPath(god.city, target, ['hellwell']);
    if (path === null || path.length < 2) return false;
    const from = god.city;
    god.city = path[1];
    event(state, { type: 'godMove', god: god.id, from, to: god.city });
    return godEnters(state, god);
  }

  // Detection check when a god enters Sam's node. Returns true if confrontation begins.
  function godEnters(state, god) {
    if (state.sam.city !== god.city) return false;
    if (!state.sam.hidden) {
      beginConfrontation(state, god, `${god.name} strides into ${MAP.nodes[god.city].name} and finds Sam waiting in plain sight.`);
      return true;
    }
    if (rand(state) < T.DETECT_HIDDEN) {
      beginConfrontation(state, god, `${god.name}'s eyes pierce the beggar's rags. "I know you, Binder," says the god.`);
      return true;
    }
    log(state, 'sam', `${god.name} passes through ${MAP.nodes[god.city].name}, close enough to touch. Sam does not breathe until the god has gone.`);
    return false;
  }

  function godArrivalEffects(state, god) {
    const city = state.cities[god.city];
    if (city === undefined || !isConverted(city)) return;
    if (state.sam.city === god.city) return; // drama defers to the confrontation
    if (god.id === 'agni') {
      city.conversion = 0;
      city.burned = true;
      if (city.possessedBy !== null) {
        state.demons = state.demons.filter((d) => d.name !== city.possessedBy);
        city.possessedBy = null;
      }
      state.enlightenment = Math.max(0, state.enlightenment - T.BURN_ENLIGHTENMENT);
      log(state, 'god', `Agni raises the fire-wand, and ${MAP.nodes[city.id].name} burns. The scriptures, the presses, the purple grove — ash.`);
      event(state, { type: 'burn', city: city.id });
      return;
    }
    city.conversion = Math.max(0, city.conversion - T.PURGE_AMOUNT);
    log(state, 'god', `${god.name} throws down the shrines in ${MAP.nodes[city.id].name}, and the faithful recant at swordpoint.`);
    event(state, { type: 'purge', city: city.id });
  }

  function demonsAct(state) {
    for (const demon of [...state.demons]) {
      if (demon.possessing !== null) continue;
      const god = state.gods.find((g) => g.id === demon.bound);
      if (god.status !== 'hunting') {
        state.demons = state.demons.filter((d) => d !== demon);
        log(state, 'demon', `With no quarry to torment, ${demon.name} grows bored and drifts home to Hellwell.`);
        continue;
      }
      const roll = rand(state);
      if (roll < T.DEMON_SLAIN) {
        state.demons = state.demons.filter((d) => d !== demon);
        log(state, 'demon', `${god.name} catches ${demon.name} at last and scatters his flame across the sky.`);
        continue;
      }
      if (roll < T.DEMON_SLAIN + T.DEMON_BREAK) {
        const targets = activeCities(state).map((c) => c.id);
        if (targets.length === 0) {
          state.demons = state.demons.filter((d) => d !== demon);
          log(state, 'demon', `${demon.name} snaps his binding and, finding nothing worth ruining, returns to the pits.`);
          continue;
        }
        const cityId = nearestNode(state, god.city, targets);
        demon.bound = null;
        demon.possessing = cityId;
        state.cities[cityId].possessedBy = demon.name;
        log(state, 'demon', `${demon.name} snaps his binding! He descends upon ${MAP.nodes[cityId].name} and wears its magistrate like a coat. The tithes stop.`);
        event(state, { type: 'possess', city: cityId });
      }
    }
  }

  function income(state) {
    const cities = activeCities(state);
    state.karma += cities.length * T.CITY_KARMA;
    state.enlightenment += cities.length * T.CITY_ENLIGHTENMENT;
    if (hasPerk(state, 'tithed')) state.karma += T.TITHED_KARMA;
  }

  /* ---------------- UI affordances ---------------- */

  function availableActions(state) {
    const here = state.sam.city;
    const city = here === null ? undefined : state.cities[here];
    const huntingIds = huntingGods(state).map((g) => g.id);
    return {
      phase: state.phase,
      travel: state.phase === 'play' ? ADJ[here].filter((id) => id !== 'heaven') : [],
      preach: state.phase === 'play' && city !== undefined && !isConverted(city),
      meditate: state.phase === 'play',
      bind: {
        can: state.phase === 'play' && here === 'hellwell' && huntingIds.length > 0
          && state.karma >= bindCost(state)
          && huntingIds.some((id) => demonBoundTo(state, id) === null),
        cost: bindCost(state),
        gods: huntingIds.filter((id) => demonBoundTo(state, id) === null),
      },
      exorcise: {
        can: state.phase === 'play' && city !== undefined && city.possessedBy !== null
          && state.karma >= T.EXORCISE_COST,
        cost: T.EXORCISE_COST,
      },
      confront: state.phase !== 'confront' ? null : {
        god: state.confront.god,
        channelMax: Math.min(T.CHANNEL_MAX, Math.floor(state.karma / T.CHANNEL_STEP)),
      },
      rebirth: {
        can: state.phase === 'dead' && state.karma >= rebirthCost(state) && activeCities(state).length > 0,
        cost: rebirthCost(state),
      },
    };
  }

  /* ---------------- exports ---------------- */

  const Engine = {
    MAP, ADJ, BODIES, GODS, T,
    newGame, takeAction, availableActions,
    bfsPath, isConverted, isActive, activeCities, huntingGods, godAt,
    bindCost, rebirthCost, body, demonBoundTo,
    rand, randInt, d6,
  };

  global.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
