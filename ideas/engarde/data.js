// En Garde! — The Season in Paris
// data.js — game tables adapted from the official En Garde! reference tables
// (www.engarde.co.uk). MIT License, see LICENSE.

// ---------- Calendar ----------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const CAMPAIGN_MONTHS = [6, 7, 8]; // June, July, August (1-based)

// ---------- Birth Tables ----------

// Birth Table A: 1-2 Commoner, 3-4 Gentleman, 5-6 Nobleman
const BIRTH_CLASSES = ['Commoner', 'Commoner', 'Gentleman', 'Gentleman', 'Nobleman', 'Nobleman'];

// Birth Table C: Father's Position, indexed by class then d6-1.
// funds = initial funds, allowance = monthly, inherit = inheritance (orphans)
const FATHERS_POSITION = {
  Commoner: [
    { position: 'Peasant', funds: 10, allowance: 0, inherit: 0, sl: 2 },
    { position: 'Peasant', funds: 10, allowance: 0, inherit: 0, sl: 2 },
    { position: 'Small Merchant', funds: 25, allowance: 5, inherit: 100, sl: 3 },
    { position: 'Merchant', funds: 150, allowance: 20, inherit: 750, sl: 3 },
    { position: 'Wealthy Merchant', funds: 250, allowance: 50, inherit: 1500, sl: 3 },
    { position: 'Very Wealthy Merchant', funds: 500, allowance: 100, inherit: 4000, sl: 3 },
  ],
  Gentleman: [
    { position: 'Impoverished Gentleman', funds: 40, allowance: 0, inherit: 100, sl: 4 },
    { position: 'Impoverished Gentleman', funds: 40, allowance: 0, inherit: 100, sl: 4 },
    { position: 'Well-to-do Gentleman', funds: 250, allowance: 50, inherit: 1500, sl: 4 },
    { position: 'Well-to-do Gentleman', funds: 250, allowance: 50, inherit: 1500, sl: 4 },
    { position: 'Wealthy Gentleman', funds: 500, allowance: 100, inherit: 4000, sl: 4 },
    { position: 'Very Wealthy Gentleman', funds: 750, allowance: 125, inherit: 5000, sl: 5 },
  ],
  Nobleman: [
    { position: 'Impoverished Nobleman', funds: 40, allowance: 0, inherit: 100, sl: 0 },
    { position: 'Impoverished Nobleman', funds: 40, allowance: 0, inherit: 100, sl: 0 },
    { position: 'Well-to-do Nobleman', funds: 250, allowance: 50, inherit: 1500, sl: 0 },
    { position: 'Wealthy Nobleman', funds: 500, allowance: 100, inherit: 4000, sl: 0 },
    { position: 'Very Wealthy Nobleman', funds: 750, allowance: 125, inherit: 5000, sl: 0 },
    { position: 'Very Wealthy Nobleman', funds: 750, allowance: 125, inherit: 5000, sl: 0 },
  ],
};

// Birth Table D: Father's Title (if Noble) + Initial Social Level table.
const FATHERS_TITLES = [
  { title: 'Knight', sl: 6 },
  { title: 'Baron', sl: 7 },
  { title: 'Marquis', sl: 8 },
  { title: 'Earl', sl: 9 },
  { title: 'Viscount', sl: 10 },
  { title: 'Count', sl: 11 },
];

// ---------- Clubs ----------

// requiresHorseGuards: The Horse Guards club admits only officers of the
// Horse Guards Brigade. houseLimit = max single bet (null = none),
// minBet = minimum single bet, divisor = crowns wagered per bonus status pt.
const CLUBS = [
  { id: 'bothwells', name: "Bothwell's", minSL: 12, requiresHorseGuards: false, dues: 30, status: 8, houseLimit: null, minBet: 100, divisor: 500 },
  { id: 'hunters', name: "Hunter's", minSL: 9, requiresHorseGuards: false, dues: 20, status: 6, houseLimit: 200, minBet: 1, divisor: 300 },
  { id: 'horseguards', name: 'The Horse Guards', minSL: 0, requiresHorseGuards: true, dues: 20, status: 4, houseLimit: 250, minBet: 1, divisor: 300 },
  { id: 'bluegables', name: 'The Blue Gables', minSL: 7, requiresHorseGuards: false, dues: 15, status: 4, houseLimit: 150, minBet: 1, divisor: 200 },
  { id: 'frogpeach', name: 'The Frog & Peach', minSL: 5, requiresHorseGuards: false, dues: 10, status: 3, houseLimit: 100, minBet: 1, divisor: 150 },
  { id: 'redphillips', name: 'Red Phillips', minSL: 3, requiresHorseGuards: false, dues: 5, status: 2, houseLimit: 50, minBet: 1, divisor: 150 },
];

// Admission fee is an adaptation (not on the reference sheet): 3 months' dues.

// Bawdyhouse gambling terms (adaptation: the low end of the club table).
const BAWDYHOUSE_GAMBLING = { houseLimit: 25, minBet: 1, divisor: 150 };

const MAX_BETS_PER_WEEK = 9;

// ---------- Regiments ----------

// column: pay/price/status column in Regiment Table B (1-10, stored 0-9).
// firstSL: lowest social level at which application is possible; the die
// roll needed is 5 - floor((sl - firstSL) / 2), automatic at 0 or less.
// mods: Personal Outcome modifiers {death, mention, promotion, crowns}.
// friends/enemies: adaptation (ids) — the sheet leaves these to the full rules.
const REGIMENTS = [
  { id: 'rfg', name: 'Royal Foot Guards', brigade: 'Brigade of Guards', column: 0, cavalry: false, firstSL: 7, mods: { death: 3, mention: 0, promotion: 1, crowns: -2 }, friends: ['km'], enemies: ['cg'] },
  { id: 'cg', name: "Cardinal's Guard", brigade: 'Brigade of Guards', column: 1, cavalry: false, firstSL: 6, mods: { death: 2, mention: 0, promotion: 0, crowns: -1 }, friends: [], enemies: ['km', 'rfg'] },
  { id: 'km', name: "King's Musketeers", brigade: 'Brigade of Guards', column: 1, cavalry: false, firstSL: 6, mods: { death: 2, mention: -1, promotion: 0, crowns: -1 }, friends: ['rfg'], enemies: ['cg'] },
  { id: 'dg', name: 'Dragoon Guards', brigade: 'Horse Guards Brigade', column: 2, cavalry: true, firstSL: 5, mods: { death: 2, mention: -1, promotion: 0, crowns: -1 }, friends: ['qoc'], enemies: ['cpc'] },
  { id: 'qoc', name: "Queen's Own Carabiniers", brigade: 'Horse Guards Brigade', column: 3, cavalry: true, firstSL: 4, mods: { death: 2, mention: 0, promotion: 0, crowns: 0 }, friends: ['dg'], enemies: ['alc'] },
  { id: 'alc', name: 'Archduke Leopold Cuirassiers', brigade: 'Heavy Brigade', column: 3, cavalry: true, firstSL: 4, mods: { death: 2, mention: 0, promotion: 0, crowns: 0 }, friends: ['cpc'], enemies: ['qoc'] },
  { id: 'cpc', name: 'Crown Prince Cuirassiers', brigade: 'Heavy Brigade', column: 4, cavalry: true, firstSL: 3, mods: { death: 1, mention: -1, promotion: -1, crowns: 0 }, friends: ['alc'], enemies: ['dg'] },
  { id: 'rm', name: 'Royal Marines', brigade: '1st Brigade of Foot', column: 5, cavalry: false, firstSL: 2, mods: { death: 1, mention: 0, promotion: 0, crowns: 0 }, friends: ['pm'], enemies: ['gascon'] },
  { id: 'gdm', name: "Grand Duke Max's Dragoons", brigade: 'Dragoon Brigade', column: 5, cavalry: true, firstSL: 2, mods: { death: 1, mention: 0, promotion: 0, crowns: 0 }, friends: ['plld'], enemies: [] },
  { id: 'pm', name: 'Picardy Musketeers', brigade: '1st Brigade of Foot', column: 6, cavalry: false, firstSL: 1, mods: { death: 0, mention: 0, promotion: 1, crowns: 0 }, friends: ['rm'], enemies: ['13f'] },
  { id: '13f', name: '13th Fusiliers', brigade: '2nd Brigade of Foot', column: 7, cavalry: false, firstSL: 0, mods: { death: 0, mention: 0, promotion: 0, crowns: 0 }, friends: ['53f'], enemies: ['pm'] },
  { id: 'plld', name: "Princess Louisa's Light Dragoons", brigade: 'Dragoon Brigade', column: 7, cavalry: true, firstSL: 0, mods: { death: 0, mention: 0, promotion: 0, crowns: 0 }, friends: ['gdm'], enemies: [] },
  { id: '53f', name: '53rd Fusiliers', brigade: '2nd Brigade of Foot', column: 8, cavalry: false, firstSL: -1, mods: { death: 0, mention: 0, promotion: 0, crowns: 0 }, friends: ['13f'], enemies: ['27m'] },
  { id: '27m', name: '27th Musketeers', brigade: '3rd Brigade of Foot', column: 8, cavalry: false, firstSL: -1, mods: { death: 0, mention: 0, promotion: 0, crowns: 0 }, friends: ['4a'], enemies: ['53f'] },
  { id: '4a', name: '4th Arquebusiers', brigade: '3rd Brigade of Foot', column: 8, cavalry: false, firstSL: -1, mods: { death: 0, mention: 0, promotion: 0, crowns: 0 }, friends: ['27m'], enemies: ['69a'] },
  { id: '69a', name: '69th Arquebusiers', brigade: '4th Brigade of Foot', column: 9, cavalry: false, firstSL: -2, mods: { death: -1, mention: 0, promotion: 1, crowns: -2 }, friends: ['gascon'], enemies: ['4a'] },
  { id: 'gascon', name: 'The Gascon Regiment', brigade: '4th Brigade of Foot', column: 9, cavalry: false, firstSL: -2, mods: { death: -1, mention: 0, promotion: 1, crowns: -2 }, friends: ['69a'], enemies: ['rm'] },
  { id: 'frontier', name: 'The Frontier Regiment', brigade: 'The Frontier', column: 9, cavalry: false, firstSL: -99, mods: { death: -1, mention: 0, promotion: 1, crowns: -1 }, friends: [], enemies: [] },
];

// Chance in 6 that a brigade deploys for the summer campaign.
const BRIGADE_DEPLOYMENT = {
  'Brigade of Guards': 1,
  'Horse Guards Brigade': 2,
  'Heavy Brigade': 2,
  'Dragoon Brigade': 3,
  '1st Brigade of Foot': 3,
  '2nd Brigade of Foot': 4,
  '3rd Brigade of Foot': 4,
  '4th Brigade of Foot': 4,
  'The Frontier': 6,
};

// Regiment Table B — one row per rank; ten columns of regiment classes.
// minSL 0 = no requirement. price 0 = no purchase (enlisting as Private).
// dutyWeeks: mandatory duty weeks per month in Paris.
const RANKS = [
  { name: 'Private', dutyWeeks: 2, minSL: [7, 6, 5, 4, 3, 2, 0, 0, 0, 0], price: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pay: [12, 10, 10, 8, 8, 6, 4, 4, 2, 2], status: [6, 5, 4, 3, 3, 2, 1, 0, 0, 0] },
  { name: 'Subaltern', dutyWeeks: 1, minSL: [8, 7, 6, 5, 4, 3, 2, 2, 0, 0], price: [140, 130, 120, 110, 100, 90, 80, 70, 60, 50], pay: [16, 14, 14, 10, 10, 8, 6, 6, 4, 4], status: [7, 6, 5, 4, 4, 3, 2, 1, 0, 0] },
  { name: 'Captain', dutyWeeks: 0, minSL: [9, 8, 7, 6, 5, 4, 3, 3, 2, 2], price: [150, 140, 130, 120, 110, 100, 90, 80, 70, 60], pay: [18, 16, 16, 14, 14, 12, 10, 10, 8, 8], status: [8, 7, 6, 5, 5, 4, 3, 2, 1, 0] },
  { name: 'Major', dutyWeeks: 0, minSL: [10, 9, 8, 7, 6, 5, 4, 4, 3, 3], price: [170, 160, 150, 140, 130, 120, 110, 100, 90, 80], pay: [22, 20, 20, 18, 18, 16, 14, 14, 12, 12], status: [9, 8, 7, 6, 6, 5, 4, 3, 2, 1] },
  { name: 'Lieutenant-Colonel', dutyWeeks: 0, minSL: [11, 10, 9, 8, 7, 6, 5, 5, 4, 4], price: [190, 180, 170, 160, 150, 140, 130, 120, 110, 100], pay: [26, 24, 24, 22, 22, 20, 18, 18, 16, 16], status: [10, 9, 8, 7, 7, 6, 5, 4, 3, 2] },
  { name: 'Colonel', dutyWeeks: 0, minSL: [12, 11, 10, 9, 8, 7, 6, 6, 5, 5], price: [240, 230, 220, 210, 200, 190, 180, 170, 160, 150], pay: [30, 28, 28, 26, 26, 24, 22, 22, 20, 20], status: [11, 10, 9, 8, 8, 7, 6, 5, 4, 3] },
];

// A commission may be purchased on joining, up through Major, paying for
// every rank up to it (purchase is cumulative).
const MAX_ENTRY_RANK = 3;

// General officer ranks sit above the regimental ladder (rank index 6+).
// Reached by petition at court, not purchase. inf/roll: influence needed to
// petition and the 2d6 roll required.
const GENERAL_RANKS = [
  { name: 'Brigadier-General', minSL: 6, pay: 30, status: 8, inf: 3, roll: 8 },
  { name: 'Lieutenant-General', minSL: 8, pay: 35, status: 9, inf: 4, roll: 9 },
  { name: 'General', minSL: 10, pay: 40, status: 10, inf: 5, roll: 10 },
  { name: 'Field Marshal', minSL: 12, pay: 45, status: 20, inf: 6, roll: 11 },
];

// Horses: cavalrymen and captains must keep a horse; majors and above keep
// three. Any stable, large or small, needs a single groom.
const HORSE_PRICE = 100;
const HORSE_UPKEEP = 3; // crowns per horse per month
const GROOM_WAGE = 2;   // crowns per month while any horses are kept

// ---------- Campaign tables ----------

// Battle Result Table: row = die roll 1-10, column = Military Ability 1-6.
// Lower result = greater victory.
const BATTLE_RESULT = [
  [6, 6, 5, 4, 4, 3],
  [6, 5, 5, 4, 3, 3],
  [6, 5, 4, 3, 3, 2],
  [5, 5, 4, 3, 3, 2],
  [5, 4, 4, 3, 2, 2],
  [5, 4, 3, 3, 2, 1],
  [4, 4, 3, 2, 2, 1],
  [4, 3, 3, 2, 1, 1],
  [4, 3, 2, 2, 1, 1],
  [3, 3, 2, 1, 1, 1],
];

// Personal Outcome Table: for each mission, rows indexed by battle result
// (1-6). Roll 2d6 for each column; >= threshold means it happens.
// plunder: [dice, multiplier] or null.
const PERSONAL_OUTCOME = {
  'Siege': [
    { death: 10, mention: 11, promotion: 9, crowns: 9, plunder: [3, 100] },
    { death: 8, mention: 9, promotion: 7, crowns: 8, plunder: [4, 100] },
    { death: 11, mention: 12, promotion: 10, crowns: 11, plunder: [2, 100] },
    { death: 11, mention: 12, promotion: 10, crowns: 12, plunder: [1, 100] },
    { death: 9, mention: 10, promotion: 8, crowns: 13, plunder: null },
    { death: 7, mention: 8, promotion: 6, crowns: 13, plunder: null },
  ],
  'Assault': [
    { death: 9, mention: 9, promotion: 8, crowns: 4, plunder: [4, 100] },
    { death: 8, mention: 7, promotion: 7, crowns: 5, plunder: [6, 100] },
    { death: 7, mention: 6, promotion: 6, crowns: 6, plunder: [4, 100] },
    { death: 9, mention: 11, promotion: 8, crowns: 13, plunder: null },
    { death: 8, mention: 9, promotion: 7, crowns: 13, plunder: null },
    { death: 6, mention: 8, promotion: 5, crowns: 13, plunder: null },
  ],
  'Defence': [
    { death: 9, mention: 9, promotion: 8, crowns: 7, plunder: [2, 100] },
    { death: 8, mention: 10, promotion: 7, crowns: 9, plunder: [2, 50] },
    { death: 10, mention: 12, promotion: 9, crowns: 12, plunder: [1, 50] },
    { death: 10, mention: 12, promotion: 9, crowns: 12, plunder: [1, 50] },
    { death: 6, mention: 7, promotion: 5, crowns: 13, plunder: null },
    { death: 7, mention: 11, promotion: 6, crowns: 13, plunder: null },
  ],
  'Field Operations': [
    { death: 10, mention: 9, promotion: 9, crowns: 8, plunder: [2, 50] },
    { death: 10, mention: 10, promotion: 9, crowns: 9, plunder: [2, 100] },
    { death: 9, mention: 12, promotion: 8, crowns: 10, plunder: [2, 50] },
    { death: 8, mention: 12, promotion: 7, crowns: 11, plunder: [1, 50] },
    { death: 7, mention: 10, promotion: 6, crowns: 12, plunder: [1, 50] },
    { death: 6, mention: 7, promotion: 5, crowns: 13, plunder: null },
  ],
};

// Rank modifiers to Personal Outcome rolls (rank index into RANKS/GENERAL_RANKS).
const RANK_OUTCOME_MODS = [
  { death: 0, mention: 0, promotion: 0, crowns: 0 },  // Private
  { death: 1, mention: 0, promotion: 0, crowns: -1 }, // Subaltern
  { death: 1, mention: 0, promotion: 0, crowns: -1 }, // Captain
  { death: 2, mention: 0, promotion: 0, crowns: -2 }, // Major
  { death: 2, mention: 0, promotion: 0, crowns: -2 }, // Lieutenant-Colonel
  { death: 2, mention: 0, promotion: 0, crowns: -2 }, // Colonel
  { death: 3, mention: 0, promotion: -1, crowns: -4 }, // Brigadier-General
  { death: 4, mention: 0, promotion: 0, crowns: -5 }, // Lieutenant-General
  { death: 5, mention: 0, promotion: 0, crowns: -6 }, // General
  { death: 5, mention: 0, promotion: 0, crowns: -6 }, // Field Marshal
];

const MISSION_TYPES = ['Field Operations', 'Siege', 'Assault', 'Defence', 'Field Operations', 'Field Operations'];

// ---------- Social tables ----------

// Mistress Courting Table: difference (your SL - her SL) => d6 roll needed.
// More than 6 below her: automatic failure.
function courtingRollNeeded(slDifference) {
  if (slDifference <= -7) return 99;
  if (slDifference === -6) return 6;
  if (slDifference >= -5 && slDifference <= -4) return 5;
  if (slDifference >= -3 && slDifference <= -1) return 4;
  if (slDifference >= 0 && slDifference <= 2) return 3;
  return 2;
}

const COURTING_COST_MULT = 3;   // 3 x her social level in crowns
const MISTRESS_SUPPORT_MULT = 3; // 3 x her social level per month
const MISTRESS_GIFT_MULT = 2;    // wealthy mistress pays 2 x the SL difference

// Influence Table A: influence from own social level.
function influenceFromSL(sl) {
  if (sl < 8) return 0;
  if (sl >= 24) return 9;
  return Math.floor((sl - 6) / 2);
}

// Influence Table C: influence of a mistress by her social level.
function mistressInfluence(sl, influential) {
  const normal = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 5, 6, 6, 7, 8, 9];
  const boosted = [0, 0, 0, 1, 1, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 9];
  const idx = Math.max(0, Math.min(18, sl));
  const table = influential ? boosted : normal;
  return table[idx];
}

// Toady Table: status points the great man is awarded for being seen with
// someone lower — used here as how reluctant he is to accept the toady.
function toadyAcceptNeeded(slDifference) {
  if (slDifference <= 3) return 2;
  if (slDifference <= 6) return 3;
  if (slDifference <= 8) return 4;
  if (slDifference <= 10) return 5;
  return 6;
}

// ---------- Duelling Table D: status consequences ----------

const DUEL_STATUS = {
  winVsFriendly: -1,
  winVsNeutral: 2,
  winVsEnemy: 5,
  loseVsEnemy: -2,
  challengeWithoutCause: -2,
  opponentRefused: 2,
  kill: 2,
};

// ---------- Affairs of honour ----------

// One honour-event check per ordinary month; if it passes, HONOR_EVENTS
// decides the affront. A rival paying court to the mistress is deliberately
// NOT on that table — it gets its own separate flat check, at home and on
// campaign alike.
const HONOR_EVENT_CHANCE = 0.06;
const MISTRESS_SUIT_CHANCE = 0.06;

// Paris is mortal: gentlemen, ladies, and the player alike may simply expire,
// each with a flavour table to suit — inglorious, tragic, or tragicomic.
const NATURAL_DEATH_CHANCE = 0.001; // per person, per month

// The affront itself, humble (index 0) to grand: 40-entry tables picked with
// flourishWide() — indexed at twice the social level with a ±1d6 swing — so a
// pauper is shoved into the gutter and a grandee slighted in the King's
// antechamber. Two tables, one per direction of offence: CHALLENGE is offence
// given to you (an 'insult' affair — demanding satisfaction is yours to
// choose), CHALLENGED is offence you have given (a 'challenged' affair — his
// seconds are already calling, and you may accept or refuse).

const HONOR_EVENTS_CHALLENGE = [
  'He empties a chamber-pot from an upper window as you pass, and does not trouble to call a warning.',
  'He shoulders you off the footway into the gutter and laughs about it with his cronies.',
  'He spits upon your boots outside a cookshop and calls it an accident.',
  'He names you a cheat over dice in a low gaming den.',
  'He douses you with sour wine and offers the room, not you, his apology.',
  'He tells a tavern full of strangers that your father was hanged for a horse-thief.',
  "He calls your sword a kitchen spit and your baldric a rope's end.",
  'He sneers, loudly, that your sword is for hire to anyone with a crown.',
  'He sets his dog at your heels the length of the Rue Saint-Antoine.',
  'He knocks your hat into the mud and invites you to fetch it.',
  'He mocks your provincial accent for the amusement of the company.',
  "He declares your horse fit only for the knacker's yard.",
  'He tells the fencing salle your master ought to return the fees.',
  'He reads aloud, in company, a letter he swears is in your hand — comically misspelled.',
  'His carriage forces yours against the parapet of the Pont Neuf and he does not look back.',
  'He hisses your entrance at the theatre and sets the pit doing likewise.',
  'He names you, at cards, the sort of man who wins too often.',
  'He circulates a scurrilous verse touching the manner of your birth.',
  'He takes your chair at the club and affects astonishment that you want it back.',
  'He calls your tailor a criminal and your figure the evidence.',
  'He toasts your misfortunes at a public table.',
  'He proposes, at supper, a wager on the month your credit will fail.',
  'He asks the table whether your family bought its arms or merely borrowed them.',
  'He returns your dinner invitation unopened, by a kitchen boy.',
  'He questions your courage within earshot of half the salon.',
  'He blows his nose at the mention of your name.',
  'He compliments your dress as the finest of the previous reign.',
  'He wonders aloud, at the opera, how much your box cost and who truly paid for it.',
  'He repeats your confidences at a salon, improved for laughter.',
  'He mimics your bow before the ladies at a levee.',
  'He assures a duchess you are the second-best swordsman of your province.',
  'He turns his back as you are presented and examines a tapestry.',
  'He has his lackey return your card, torn across.',
  'He offers you his left hand, and his condolences on your prospects.',
  'He yawns, elaborately, through your remarks to the Marshal.',
  'He seats himself above you at a state dinner, against all precedence.',
  "He disputes your precedence in the King's antechamber.",
  'At Versailles he affects, twice, not to know your name.',
  'He asks the Minister, smiling, whether your pension is charity or an oversight.',
  "He suggests, within the King's hearing, that your pedigree is nothing but paper.",
];

const HONOR_EVENTS_CHALLENGED = [
  'You laughed when a fishwife got the better of him in the market; his glove crosses your face.',
  'A tavern reckoning goes round twice; he swears you shorted your share and will have satisfaction.',
  'You won his last crown at dice, and he has decided the dice were yours.',
  'Deep in his cups, he swears you insulted him — no one else remembers it — and he demands satisfaction.',
  'Your spilled tankard ruined his only good coat, and he calls it deliberate.',
  'You beat him to a hackney coach in the rain; by morning it is an affair of honour.',
  'You laughed in the pit when his wig came off, and he means to wash the stain out in blood.',
  'Your servant thrashed his servant, and the quarrel has climbed the stairs.',
  'He says you mocked his fencing in the salle, before his own master.',
  'You outbid him for a horse he had told half Paris was already his.',
  'You called his verses doggerel; the report reached him accurate to the syllable.',
  'You forgot his name while presenting him — twice, and the second time with a smile.',
  'He swears the anonymous epigram on his nose is in your style.',
  'You declined his toast and set your glass down full, before the whole company.',
  'An altercation in the street — swords half-drawn before the watch parts you — and his seconds call in the morning.',
  'You were seen laughing with his creditors.',
  "He blames you for a lady's cooling affections and will have satisfaction.",
  'You danced twice with the lady he had marked for his own.',
  'Your praise of his card-play was so warm the whole table understood it perfectly.',
  'You quoted his own words back to him at supper, in his own accent.',
  'Your caricature of him is passing from hand to hand, and he has seen it.',
  'You yawned through the reading of his memoirs, and he has chosen to remember it.',
  'You seated his rival above him at your own table.',
  'You repeated the Duchesse’s jest about him — and improved it.',
  'You corrected his account of the campaign in front of the company, with dates.',
  'You omitted him from your guest list, and all Paris has noticed.',
  'You failed to return his bow in the gallery of the Louvre, before witnesses.',
  "He swears your advancement was stolen from him, and will have it back at sword's point.",
  'You praised his lady’s amiability in terms he found a shade too warm.',
  'He conceives himself slighted by your manner at court; his seconds call before breakfast.',
  'Your new equipage outshone his at the promenade, and he takes it as a studied insult.',
  'You smiled during his address to the Marshal, and he has witnesses.',
  "He holds you responsible for the Minister's little joke at his expense.",
  'You were preferred before him at the levee, and he swears you engineered it.',
  "He says you turned the Cardinal's ear against him with a single whispered word.",
  "You contradicted him in the King's antechamber, and were right.",
  'The King repeated your jest about him — he cannot call out the King, so his seconds call on you.',
  "You were admitted to the King's lever while he waited without, and he swears you smiled.",
  'His disgrace at the autumn hunt is laid, by him, entirely at your door.',
  "His fall from the King's favour is laid, by him, entirely at your door; nothing but blood will restore him.",
];

// ---------- Titles ----------

const TITLES = [
  { name: 'Knight', minSL: 6, newSL: 10, statusBurst: 10, pension: 0, inf: 4, roll: 9 },
  { name: 'Baron', minSL: 7, newSL: 11, statusBurst: 10, pension: 10, inf: 5, roll: 9 },
  { name: 'Marquis', minSL: 8, newSL: 12, statusBurst: 15, pension: 15, inf: 6, roll: 10 },
  { name: 'Earl', minSL: 9, newSL: 13, statusBurst: 15, pension: 25, inf: 7, roll: 10 },
  { name: 'Viscount', minSL: 10, newSL: 14, statusBurst: 20, pension: 100, inf: 8, roll: 11 },
  { name: 'Count', minSL: 11, newSL: 15, statusBurst: 20, pension: 100, inf: 9, roll: 11 },
];

// ---------- Appointments ----------

// rankReq: minimum rank index (RANKS then GENERAL_RANKS, 0-9).
// titleAlt: title index that satisfies the rank requirement instead (or null).
// ma: minimum Military Ability (0 = none). inf: influence required to be
// considered. roll: 2d6 + influence must reach this. status/pay: monthly.
const APPOINTMENTS = [
  { id: 'adjutant', name: 'Regimental Adjutant', rankReq: 2, titleAlt: null, minSL: 0, ma: 3, inf: 1, roll: 5, status: 3, pay: 0, needsRegiment: true },
  { id: 'aidebg', name: 'Aide to a Brigadier-General', rankReq: 1, titleAlt: null, minSL: 2, ma: 0, inf: 1, roll: 7, status: 3, pay: 0, needsRegiment: true },
  { id: 'brigademajor', name: 'Brigade Major', rankReq: 3, titleAlt: null, minSL: 0, ma: 3, inf: 1, roll: 6, status: 4, pay: 0, needsRegiment: true },
  { id: 'aidegen', name: 'Aide to a General', rankReq: 3, titleAlt: null, minSL: 6, ma: 0, inf: 3, roll: 7, status: 6, pay: 0, needsRegiment: true },
  { id: 'divadjutant', name: 'Division Adjutant', rankReq: 4, titleAlt: null, minSL: 0, ma: 4, inf: 2, roll: 6, status: 6, pay: 0, needsRegiment: true },
  { id: 'aidefm', name: 'Aide to the Field Marshal', rankReq: 4, titleAlt: null, minSL: 8, ma: 0, inf: 4, roll: 7, status: 10, pay: 0, needsRegiment: true },
  { id: 'armyadjutant', name: 'Army Adjutant', rankReq: 5, titleAlt: null, minSL: 0, ma: 5, inf: 3, roll: 7, status: 8, pay: 0, needsRegiment: true },
  { id: 'commissioner', name: 'Commissioner of Public Safety', rankReq: 5, titleAlt: 0, minSL: 6, ma: 0, inf: 7, roll: 8, status: 6, pay: 50, needsRegiment: false },
  { id: 'ministerwar', name: 'Minister of War', rankReq: 7, titleAlt: 2, minSL: 12, ma: 0, inf: 8, roll: 8, status: 18, pay: 100, needsRegiment: false },
  { id: 'ministerstate', name: 'Minister of State', rankReq: 8, titleAlt: 3, minSL: 12, ma: 0, inf: 9, roll: 9, status: 20, pay: 150, needsRegiment: false },
];

// ---------- Economy ----------

const MAINTENANCE_MULT = 2;          // 2 x SL crowns per month, mandatory
const CONSPICUOUS_MULT = 1;          // 1 x SL crowns extra per status point
const CAROUSE_STATUS = 1;            // status per week carousing
const LOAN_INTEREST_RATE = 0.10;     // per six months
const LOAN_INTEREST_PERIOD = 6;      // months
const LOAN_LIMIT_PER_SL = 50;        // borrow up to 200 + SL x 50
const LOAN_LIMIT_BASE = 200;
