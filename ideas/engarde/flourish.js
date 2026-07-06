// En Garde! — The Season in Paris
// flourish.js — SL-ranked descriptive flavor. MIT License.
//
// A message can carry a purely cosmetic line whose tone fits the gentleman's
// station. Each table below runs humble (index 0) to grand (last index); a
// gentleman's social level indexes into it, with a d6 of jitter, so a pauper's
// dull war is mud and fever and a grandee's is hock and hunting. The mechanism
// is one function; adding a new ranked flourish is one more 20-item table.
//
// Loaded before engine.js; depends only on dice.js (d6).

// Index a humble-to-grand table by social level, with -2..+3 of jitter, and
// return the chosen line. Tables are 20 entries so a full career (SL ~1-21)
// scrolls across the whole range.
function flourish(table, sl) {
  const last = table.length - 1;
  const index = Math.max(0, Math.min(last, (sl - 1) + (d6() - 3)));
  return table[index];
}

// The ways a gentleman leaves Paris feet-first without a sword in his hand.
// Composed after his name, so each is a sentence fragment: "<Name> " + line.
const NATURAL_DEATHS = [
  'is knifed in an alley off the Rue des Mauvais-Garçons for the coat on his back.',
  'perishes when a tavern quarrel he did not start turns to fire.',
  'is found floating in the Seine, his purse long gone.',
  'succumbs to the gaol-fever after a night in the watch-house.',
  'is found cold in a garret by a distraught landlady.',
  'is trampled in a crowd pressing to see a hanging.',
  'is carried off by the smallpox despite every attention.',
  'drowns when his hired boat overturns crossing to the Left Bank.',
  'is taken by a wasting sickness that had long troubled him.',
  'succumbs to a fever the physicians cannot name.',
  'is thrown by his horse on the Pont Neuf and does not recover.',
  'is bled to death by a physician for a complaint that would have passed.',
  'takes a chill at the opera and is dead within the week.',
  'is crushed when a balcony gives way beneath the press of admirers.',
  'succumbs to an apoplexy at the card table, three kings in his hand.',
  'expires of a surfeit of lampreys at the Duc’s own table.',
  'chokes upon a fish bone at a banquet, to the horror of his host.',
  'is found insensible in a bawdy-house and never wakes.',
  'breaks his neck upon the grand staircase, deep in his cups.',
  'is carried off by a fit while berating his tailor over the cut of a sleeve.',
];

// A campaign month where the war keeps its distance — no engagement, just the
// texture of the season as the gentleman's rank would know it.
const QUIET_CAMPAIGN = [
  'Thin rations, sodden boots, and the flux; the war keeps its distance.',
  'Camp fever, mud, and drill; the enemy never shows his face.',
  'You dig latrines and curse the sergeant, and no battle comes.',
  'Weeks of picket duty in the rain, and not a shot fired in anger.',
  'Hard biscuit and harder marches, but the campaign stays quiet.',
  'Drill at dawn, drill at dusk; the war is a rumor over the next hill.',
  'You share a leaking tent and thin wine while the front never stirs.',
  'Foraging and card games pass the season; the enemy declines to oblige.',
  'A dull season of manoeuvres, your boots worn thin for nothing.',
  'The regiment marches and counter-marches, and you see no fighting.',
  'A tolerable camp, decent wine, and no alarms to speak of.',
  'You keep a fair table in the mess while the war idles elsewhere.',
  'Your servant pitches a dry tent and the weeks pass without a battle.',
  'Hunting and hospitality fill the season; the cannon stay silent.',
  'You dine with the colonel and hear the distant guns as after-dinner talk.',
  'A comfortable pavilion, good hock, and the war safely over the horizon.',
  'You review the lines from horseback and retire to a well-set table.',
  'The general keeps you at headquarters; the fighting is someone else’s affair.',
  'You pass the season in a requisitioned château, the war a pleasant abstraction.',
  'Couriers, banquets, and a soft bed; you scarcely knew there was a campaign.',
];
