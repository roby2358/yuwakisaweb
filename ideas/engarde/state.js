// En Garde! — The Season in Paris
// state.js — character generation (Birth Tables A-D) and world state. MIT License.

const START_YEAR = 1631;
const LADY_COUNT = 30;
const NPC_COUNT = 16;

// ---------- Character generation ----------

function rollBirth() {
  const birthClass = BIRTH_CLASSES[d6() - 1];
  const positionRoll = d6();
  const position = FATHERS_POSITION[birthClass][positionRoll - 1];

  let funds = position.funds;
  let allowance = position.allowance;
  let sl = position.sl;
  let fatherTitle = null;
  if (birthClass === 'Nobleman') {
    fatherTitle = FATHERS_TITLES[d6() - 1];
    sl = fatherTitle.sl;
  }

  const siblingRoll = d6();
  let sibling = 'Second son';
  let orphan = false;
  let inheritedTitle = null;
  if (siblingRoll === 1) {
    sibling = 'First son';
    funds = Math.round(funds * 1.1);
    allowance = Math.round(allowance * 1.1);
    sl += 1;
    if (d6() === 1) {
      orphan = true;
      allowance = 0;
      funds = position.inherit;
      if (fatherTitle !== null) {
        inheritedTitle = fatherTitle.title;
        sl += 3;
      }
    }
  }
  if (siblingRoll >= 5) {
    sibling = 'Bastard';
    funds = Math.round(funds * 0.9);
    allowance = Math.round(allowance * 0.9);
    sl -= 1;
  }

  return {
    birthClass: birthClass,
    fatherPosition: position.position,
    fatherTitle: fatherTitle === null ? null : fatherTitle.title,
    sibling: sibling,
    orphan: orphan,
    inheritedTitle: inheritedTitle,
    funds: funds,
    allowance: allowance,
    sl: Math.max(1, sl),
  };
}

function generateCharacter() {
  const birth = rollBirth();
  const str = roll3d6();
  const con = roll3d6();
  return {
    name: randomMaleName(birth.birthClass === 'Nobleman'),
    birthClass: birth.birthClass,
    fatherPosition: birth.fatherPosition,
    fatherTitle: birth.fatherTitle,
    sibling: birth.sibling,
    orphan: birth.orphan,
    str: str,
    con: con,
    exp: roll3d6(),
    ma: d6(),
    endMax: str * con,
    endCur: str * con,
    cash: birth.funds,
    allowance: birth.allowance,
    sl: birth.sl,
    peakSL: birth.sl,
    title: birth.inheritedTitle,
    pension: 0,
    clubId: null,
    regimentId: null,
    rankIndex: -1,
    seniority: 0,
    appointmentId: null,
    mistressId: null,
    lonelyMonths: 0,
    mentions: 0,
    carrySP: 0,
    debt: 0,
    debtMonths: 0,
    horses: 0,
    woundWeeks: 0,
    firstWeekHeal: 0,
    atFront: null,
    dead: false,
    epitaph: null,
  };
}

// ---------- Ladies ----------

function generateLady(id) {
  const sl = 3 + Math.floor(Math.random() * 14);
  return {
    id: id,
    name: randomLadyName(sl),
    sl: sl,
    beautiful: chance(0.25),
    wealthy: chance(0.3),
    influential: chance(0.25),
    lover: null, // null | 'player' | npc id
  };
}

function generateLadies() {
  const ladies = [];
  for (let i = 0; i < LADY_COUNT; i++) ladies.push(generateLady('lady' + i));
  return ladies;
}

// Ladies are never struck from the list, so length-based ids stay unique.
// Tops up saves from before LADY_COUNT grew.
function ensureLadies(state) {
  while (state.ladies.length < LADY_COUNT) {
    state.ladies.push(generateLady('lady' + state.ladies.length));
  }
}

// ---------- Rival NPCs ----------

function eligibleRegimentsForSL(sl) {
  return REGIMENTS.filter(function (r) {
    return r.id !== 'frontier' && sl >= r.firstSL;
  });
}

// Duelling stats, rolled as for the player. Also patches NPCs from saves
// that predate these fields.
function ensureNpcStats(npc) {
  if (npc.endMax !== undefined) return;
  npc.str = roll3d6();
  npc.con = roll3d6();
  npc.exp = roll3d6();
  npc.endMax = npc.str * npc.con;
}

function generateNpc(id, ladies, sl) {
  const regiment = chance(0.7) ? pick(eligibleRegimentsForSL(sl)) : null;
  const npc = {
    id: id,
    name: randomMaleName(sl >= 7),
    sl: sl,
    regimentId: regiment === null ? null : regiment.id,
    rankIndex: regiment === null ? -1 : Math.min(2, Math.floor(Math.random() * 3)),
    mistressId: null,
    alive: true,
    grudge: 0,
  };
  ensureNpcStats(npc);
  if (chance(0.4)) {
    const free = ladies.filter(function (l) { return l.lover === null && l.sl <= sl + 4; });
    if (free.length > 0) {
      const lady = pick(free);
      lady.lover = id;
      npc.mistressId = lady.id;
    }
  }
  return npc;
}

// Ids must stay unique for the life of a world even as the fallen are
// struck from the list, so index past the highest ever issued.
function nextNpcId(state) {
  const max = state.npcs.reduce(function (m, n) { return Math.max(m, parseInt(n.id.slice(3), 10)); }, -1);
  return 'npc' + (max + 1);
}

function generateNpcs(ladies) {
  const npcs = [];
  for (let i = 0; i < NPC_COUNT; i++) npcs.push(generateNpc('npc' + i, ladies, 3 + Math.floor(Math.random() * 10)));
  return npcs;
}

// ---------- Game state ----------

function newGame(character) {
  const ladies = generateLadies();
  return {
    character: character,
    ladies: ladies,
    npcs: generateNpcs(ladies),
    monthIndex: 0, // months elapsed since January START_YEAR
    gazette: [],
    affairs: [],   // pending affairs of honour awaiting the player's answer
    campaign: null, // active summer deployment for the player's brigade
    applications: { club: -1, regiment: -1 }, // monthIndex of the last attempt
    adviceMonth: -1, // monthIndex the knowing friend last gave counsel
    pendingCampaign: false, // set when a brigade call-up awaits the campaign panel
    lastPlan: null, // last month's plan, used to pre-fill the planner
  };
}

// Lazy init so saves from before this field existed keep working.
function applications(state) {
  if (state.applications === undefined) state.applications = { club: -1, regiment: -1 };
  return state.applications;
}

// Lazy init so saves from before this field existed keep working.
function adviceAsked(state) {
  if (state.adviceMonth === undefined) state.adviceMonth = -1;
  return state.adviceMonth === state.monthIndex;
}

function currentMonth(state) {
  return (state.monthIndex % 12) + 1;
}

function currentYear(state) {
  return START_YEAR + Math.floor(state.monthIndex / 12);
}

function monthLabel(state) {
  return MONTH_NAMES[state.monthIndex % 12] + ' ' + currentYear(state);
}

function findLady(state, id) {
  return state.ladies.find(function (l) { return l.id === id; });
}

function findNpc(state, id) {
  return state.npcs.find(function (n) { return n.id === id; });
}

function findRegiment(id) {
  return REGIMENTS.find(function (r) { return r.id === id; });
}

function findClub(id) {
  return CLUBS.find(function (c) { return c.id === id; });
}

function findAppointment(id) {
  return APPOINTMENTS.find(function (a) { return a.id === id; });
}

// ---------- Save / load ----------

const SAVE_KEY = 'engarde-save';

function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw === null) return null;
  const state = JSON.parse(raw);
  state.npcs.forEach(ensureNpcStats);
  ensureLadies(state);
  // Campaigns no longer persist across months; drop any stale mid-season state
  // from an older save so the gentleman simply starts fresh in Paris.
  state.character.atFront = null;
  if (state.pendingCampaign === undefined) state.pendingCampaign = false;
  return state;
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
