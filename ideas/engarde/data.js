// En Garde! — The Season in Paris
// data.js — the solo-play layer: house rules, invented odds, and tables of
// our own devising that make the game playable alone. Everything traceable
// to the published reference tables lives in core.js; deliberate deviations
// are listed in README.md. MIT License, see LICENSE.

// ---------- Calendar ----------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- Gambling ----------

// Bawdyhouse gambling terms (the low end of the club table in core.js).
const BAWDYHOUSE_GAMBLING = { houseLimit: 25, minBet: 1, divisor: 150 };

const MAX_BETS_PER_WEEK = 9;

// ---------- Regiments ----------

// Friendships and enmities between regiments (the reference sheet leaves
// them to the full rules); King's Musketeers vs. Cardinal's Guard, naturally.
// One entry per regiment in core.js's REGIMENTS; read by regimentRelation().
const REGIMENT_RELATIONS = {
  rfg: { friends: ['km'], enemies: ['cg'] },
  cg: { friends: [], enemies: ['km', 'rfg'] },
  km: { friends: ['rfg'], enemies: ['cg'] },
  dg: { friends: ['qoc'], enemies: ['cpc'] },
  qoc: { friends: ['dg'], enemies: ['alc'] },
  alc: { friends: ['cpc'], enemies: ['qoc'] },
  cpc: { friends: ['alc'], enemies: ['dg'] },
  rm: { friends: ['pm'], enemies: ['gascon'] },
  gdm: { friends: ['plld'], enemies: [] },
  pm: { friends: ['rm'], enemies: ['13f'] },
  '13f': { friends: ['53f'], enemies: ['pm'] },
  plld: { friends: ['gdm'], enemies: [] },
  '53f': { friends: ['13f'], enemies: ['27m'] },
  '27m': { friends: ['4a'], enemies: ['53f'] },
  '4a': { friends: ['27m'], enemies: ['69a'] },
  '69a': { friends: ['gascon'], enemies: ['4a'] },
  gascon: { friends: ['69a'], enemies: ['rm'] },
  frontier: { friends: [], enemies: [] },
};

// A commission may be purchased on joining, up through Major, paying for
// every rank up to it (purchase is cumulative).
const MAX_ENTRY_RANK = 3;

// ---------- Preferment cooldowns ----------

// The ladder is slowed: after each grant a waiting period must pass before
// the next of its kind, and petitions in the interval are met with counsel
// of patience (the PATIENCE tables in flourish.js). A field promotion won in
// battle ignores the wait but restarts the clock. Each wait is rolled at
// grant time with a gaussian -50%..+50% spread (gaussianMult in dice.js), so
// an unlucky knight who says the wrong thing near the King may wait a year
// longer for his marquisate.
const TITLE_COOLDOWN_MONTHS = 24;
const PROMOTION_COOLDOWN_MONTHS = 12;
const APPOINTMENT_COOLDOWN_MONTHS = 12;

// ---------- Campaigns ----------

// Chance in 6 that a brigade deploys for the summer campaign — the solo
// stand-in for the full rules' army and division assignment.
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

// What the season's single engagement is, by d6 — likewise a stand-in for
// mission assignment under the full campaign rules.
const MISSION_TYPES = ['Field Operations', 'Siege', 'Assault', 'Defence', 'Field Operations', 'Field Operations'];

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

// And short of the grave, the player may be laid low: a mishap or malady
// costing 1-50% of full endurance, floored so it bruises but never kills.
const MALADY_CHANCE = 0.002; // per month
const MALADY_MAX_LOSS_PCT = 50;

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
