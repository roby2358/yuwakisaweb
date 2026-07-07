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

// The double-width variant: 40-entry tables indexed at (SL - 1) x 2 with a
// uniform d8 - 4 swing (-3..+4), so a station sees a spread of its neighbours
// without clustering on its own row or reaching across the whole room.
function flourishWide(table, sl) {
  const last = table.length - 1;
  const swing = rollDice(1, 8) - 4;
  return table[Math.max(0, Math.min(last, (sl - 1) * 2 + swing))];
}

// The ways a gentleman leaves Paris feet-first without a sword in his hand —
// inglorious to a man. 40 entries, picked with flourishWide. Composed after
// his name, so each is a sentence fragment: "<Name> " + line.
const NATURAL_DEATHS = [
  'is knifed in an alley off the Rue des Mauvais-Garçons for the coat on his back.',
  'chokes on a cookshop pie with no one troubling to help.',
  'perishes when a tavern quarrel he did not start turns to fire.',
  'falls down a well while relieving himself in the dark.',
  'is found floating in the Seine, his purse long gone.',
  'dies of a rat-bite gone bad in a gambling cellar.',
  'succumbs to the gaol-fever after a night in the watch-house.',
  'is kicked in the head by a dray-horse he was taunting.',
  'is found cold in a garret by a distraught landlady.',
  'perishes of a chill caught dodging a creditor in the rain.',
  'is trampled in a crowd pressing to see a hanging.',
  'is shot on his own stairs by a landlord who took him for a burglar.',
  'is carried off by the smallpox despite every attention.',
  "dies in a barber-surgeon's chair, having gone in for a shave.",
  'drowns when his hired boat overturns crossing to the Left Bank.',
  'drinks a wager of brandy at a single draught and never stands again.',
  'is taken by a wasting sickness that had long troubled him.',
  'swallows a leech with his wine, and the physicians make it worse.',
  'succumbs to a fever the physicians cannot name.',
  'eats oysters out of season, twice, on a wager.',
  'is thrown by his horse on the Pont Neuf and does not recover.',
  'is bitten by a performing monkey at the Saint-Germain fair and wastes away.',
  'is bled to death by a physician for a complaint that would have passed.',
  'is crushed by a toppling armoire while hiding from a husband.',
  'takes a chill at the opera and is dead within the week.',
  "is struck by a falling gargoyle, to no one's surprise but his own.",
  'is crushed when a balcony gives way beneath the press of admirers.',
  "is found dead in another man's pew, which the parish finds typical.",
  'succumbs to an apoplexy at the card table, three kings in his hand.',
  'is smothered, the valet swears, by his own featherbed.',
  'expires in a sedan chair halted two hours in the Rue Saint-Honoré.',
  'expires of a surfeit of lampreys at the Duc’s own table.',
  'dies of an apoplexy while shouting down his wine merchant.',
  'chokes upon a fish bone at a banquet, to the horror of his host.',
  "is poisoned by his cook's ambition with mushrooms.",
  'is found insensible in a bawdy-house and never wakes.',
  'breaks his neck upon the grand staircase, deep in his cups.',
  'expires of rage at a gazette misprinting his name.',
  'chokes upon a partridge wing while laughing at his own jest.',
  'is carried off by a fit while berating his tailor over the cut of a sleeve.',
];

// The ladies of Paris die as the ballads demand — tragically, overwrought,
// and always at the worst possible moment. 40 entries, picked with
// flourishWide. Composed after her name: "<Name> " + line.
const LADY_DEATHS = [
  'dies of the damp in a garret, her last candle sold for bread.',
  'is carried off by a fever taken nursing a beggar-child no one else would touch.',
  'wastes away of a winter cough, singing, they say, to the very end.',
  'follows her drowned linnet into the Seine, or so the ballad now insists.',
  'perishes of a broken heart over a letter that never came.',
  'is found cold at her prie-dieu, her rosary worn down to thread.',
  'dies of a chill caught singing at an open window to a street that never looked up.',
  'is taken by the smallpox, and Paris mourns a beauty it never deigned to notice.',
  'expires of grief on the anniversary of a sorrow she would never name.',
  'succumbs to a decline the physicians blame on novels and the night air.',
  'dies of a pricked finger gone septic, embroidering a standard for a man at the wars.',
  'perishes of a midnight vigil kept too long on a cold balcony.',
  'is carried off by a consumption she hid behind rouge until the very last evening.',
  'swoons at ill news and never wakes, the letter still folded in her hand.',
  'is lost to a fever taken at a masked ball; the mask was never found.',
  'dies on the eve of her name-day, her gown for the fête still upon its stand.',
  'wilts with her hothouse lilies in the first frost of the season.',
  'perishes when her carriage overturns racing to a deathbed reconciliation.',
  'expires clutching a miniature that no one in the family can identify.',
  'drinks the wrong cordial by candlelight and is mourned by two men who despise each other.',
  'is found lifeless among her unsent letters, every one addressed to the same name.',
  'succumbs in the convent she entered a fortnight before, to the astonishment of all Paris.',
  'dies with the first snow, having promised all summer that she would.',
  'expires at the harpsichord, midway through a lament of her own composing.',
  'is carried off by grief for a sister that Paris never knew she had.',
  'fades after the opera; the aria, her physicians insist, was more than her heart could carry.',
  'perishes the very night her portrait is unveiled, as though the canvas had taken what it required.',
  'is felled on the eve of her wedding, her heart, they whisper, promised elsewhere.',
  'dies of a poisoned glove, the salons swear, that was meant for another.',
  'is found in the orangerie fountain at first light, lilies, impossibly, already in her hair.',
  'succumbs to a wasting elegance the fashionable physicians dare not name.',
  "expires upon hearing her name in a song sung beneath a rival's window.",
  'dies in her sleep between the movements of a private concert, and the violins play on.',
  'is taken the night the comet passes, as she always said she would be.',
  'perishes of a fever caught kneeling all night on the cathedral stones for a man who did not deserve it.',
  "dies refusing the Duchesse's physician, the Duchesse's carriage, and the Duchesse's son.",
  'expires on the grand staircase at the height of her own ball, in the dress all Paris will now copy.',
  'is carried off at Versailles between the fountains and the fireworks, and the fête goes dark.',
  'dies, the poets swear, of a heart too great for so small an age.',
  'ascends, the abbé declares at the graveside, because Heaven grew impatient; the King himself sends white roses.',
];

// Paris's gentler cruelties: the mishaps and maladies that put a gentleman
// to bed without putting him in the ground. 40 entries, picked with
// flourishWide. Full sentences in the second person.
const PLAYER_MALADIES = [
  'You are bitten by something in a lodging-house bed, and the bite knows its business.',
  'A winter in thin boots settles into your chest.',
  'You take the flux from a pot of tavern stew that had outlived its era.',
  'A quarrel between carters is settled across your foot.',
  'You slip on the icy steps of your garret and count every one.',
  'The barber draws the wrong tooth, and then, apologizing, the right one.',
  'A dog of no particular breeding takes exception to your calves.',
  'You catch the itch from a borrowed cloak and scratch your way through the month.',
  'A low shop-shutter swings as you pass, and the street applauds.',
  'You drink from the wrong well and regret it for weeks.',
  'Your horse declines a fence you had already committed to.',
  'A plate of oysters late in the month mounts a rearguard action.',
  'You turn an ankle demonstrating a dance you had seen only once.',
  'A fencing lesson goes one exchange too long, and your pride is not the only thing bruised.',
  'The new fashion in tight boots costs you a toenail and your good temper.',
  'You sit a draughty box at the theatre through five acts and pay for every one.',
  'A physician bleeds you for vigour, and the vigour goes with the blood.',
  'You wrench your shoulder handing a lady into a carriage that lurched.',
  'A hired horse with a grudge against hired riders has the last word.',
  'Late suppers and later arguments bring on a fever of some standing.',
  'You are knocked flat by a sedan chair racing another sedan chair.',
  'The gout announces itself in your left foot, precisely at the ball.',
  'You take a soaking on the Pont Neuf and cough until Lent.',
  "An apothecary's tonic, taken for strength, proves stronger than you.",
  'A wager to swim the Seine is won, at a cost the far bank did not mention.',
  'You strain your back holding a fashionable pose through an entire portrait sitting.',
  'A masked ball ends in a fountain; the fever arrives by morning.',
  'Your new carriage takes a corner as though it had a rival, and you are the loser.',
  "You eat the Marquis's celebrated sauce against your better judgment, and your judgment is avenged.",
  'A short-sighted count peppers your hat at the autumn shoot, and some of the shot finds you.',
  'The waters, taken for your health, very nearly finish it.',
  'You bow too deeply in too tight a coat, and something in your back gives notice.',
  'The gout, promoted along with your fortunes, claims the right foot as well.',
  'You keep pace with a visiting ambassador through six courses and a night of toasts, and lose by a length.',
  'A firework at a royal fête returns to earth still lit, and chooses your shoulder.',
  "You take a chill riding uncovered in the King's hunt, it being unthinkable to leave early.",
  'The fashionable new physician prescribes mercury; the old complaint departs and takes your strength with it.',
  'You faint in the crush of the levee and are trodden upon by the best people in France.',
  "A surfeit at the Cardinal's table lays you up a fortnight.",
  'The strain of precedence — four hours standing at Versailles — puts you to bed like a common mortal.',
];

// And the player's own exits: pure tragicomedy, fortune's joke landing at
// last. 40 entries, picked with flourishWide. Full sentences in the second
// person; used both as the month's narrative and as the epitaph.
const PLAYER_DEATHS = [
  'You choke on a crust begged from a pie-seller, one week before your allowance was due.',
  'You drown in a rain-barrel retrieving the last coin of your fortune.',
  'You are trampled at a hanging you attended to feel more fortunate.',
  'You die of a fever caught pawning your winter coat, in January, to cover a gambling debt of two crowns.',
  'You fall through a rotten tavern floor into the cellar, where the wine finishes what the fall began.',
  'You are kicked by the cheapest horse you ever bought, which settles that argument at last.',
  'You expire of laughter at a jest about a man even poorer than you.',
  'You die of a cold caught serenading the wrong window in the right street.',
  'You swallow a bee in a spoonful of honey you had not paid for.',
  'You are knifed by a footpad who, finding your purse empty, takes it personally.',
  'You choke on your own name-day toast, halfway through the word "prosperity".',
  'You are run through by a fencing pupil who never learned to pull his lunge, apologizing all the while.',
  'You die of eating a wager: forty snails, and it was the last one that turned.',
  'You are struck by a bottle flung from a window you yourself once flung bottles from.',
  'You drown crossing the Seine by boat to avoid a bridge toll of one sou.',
  'You are crushed beneath your own new carriage, admiring it from underneath.',
  'You die of an apoplexy disputing a card debt you had, in fact, already paid.',
  'You are poisoned by the first oyster you could ever truly afford.',
  'You break your neck bowing to a duchess who was not, in fact, looking.',
  'You expire in your first sedan chair, holding your breath to seem accustomed to it.',
  'You succumb to a surfeit of celebration over a remarkably small inheritance.',
  'You die rehearsing, before a mirror, your acceptance of an appointment that had gone to another man.',
  'You take a fatal chill demonstrating, in the rain, the correct way to wear a cloak.',
  'You are lost overboard from a pleasure barge while toasting your own reflection.',
  'You choke on a fish bone at a dinner given to celebrate your recovery.',
  'You freeze overnight in a château garden maze, too proud to call for directions.',
  'You die of holding in a sneeze through the whole of a very long and very important sermon.',
  'You fall from a balcony testing whether the trellis would bear a man of your quality; it would not.',
  'You take a fatal chill posing for your portrait in classical undress.',
  'You are struck down by an apoplexy while composing a witty reply, which is found, unfinished, and is not witty.',
  'You expire at a banquet of reconciliation, having toasted every man you ever quarrelled with.',
  'You are smothered by your own wig, worn against all advice in a high wind.',
  'You expire waiting for an apology which, the record shows, was at that moment on its way.',
  "You die of joy, the physicians conclude, upon reading the terms of your uncle's will.",
  'You are crushed by a falling chandelier at the opera, in the seat you insisted was yours by right.',
  'You are felled by the recoil of a ceremonial cannon fired in your honour.',
  "You choke upon laughter at a jest of the Minister's that was not, alas, a jest.",
  'You die of standing motionless four hours in an antechamber, unwilling to surrender your place in line.',
  'You expire of pride on the grand staircase at Versailles, three steps from the top.',
  'You choke upon a compliment from the King, delivered, at long last, in person.',
];

// The court's answer to a gentleman who asks for a second title before the
// King's last favour has aged its two years. 20 entries, picked with
// flourish(). Full sentences in the second person; counsel of patience.
const TITLE_PATIENCE = [
  'A clerk of the third antechamber informs you, through the door, that the King is not to be pestered.',
  'You wait four hours among the footmen and are sent home with nothing but a chill.',
  'An under-clerk glances at your petition and asks, kindly, whether you know how many such he burns in a week.',
  'The word from court is short: the King has given once, and does not care to be reminded of it.',
  'Your petition is received, docketed, and, you are given to understand, buried.',
  'An usher counsels patience: favours, like vintages, must be given their years.',
  'You are told the King remembers you perfectly — which is precisely why he will hear no more of you at present.',
  'A secretary returns your petition unopened; the ink on your last patent, he observes, is scarcely dry.',
  'The chancellery replies that titles ripen slowly, and that yours is still upon the bough.',
  'A gentleman of the bedchamber murmurs that to ask again so soon is the surest way to ask never.',
  'The minister receives you warmly and promises nothing, with an eloquence you almost admire.',
  'Word comes down that His Majesty admires nothing in a gentleman so much as the patience to wait for the next honour.',
  'The minister is all courtesy: the King’s grace, once poured, must be allowed to settle before the glass is filled again.',
  'You are assured your name is written in the book — and shown, gently, how very long the book is.',
  'The chancellor himself regrets that honours given too close together cheapen both, and he is sure you agree.',
  'A duke of your acquaintance advises, over excellent wine, that at court the second favour is won by never asking for it.',
  'The King’s confessor remarks that Heaven itself rested on the seventh day, and Heaven had less correspondence.',
  'His Majesty, you are told, spoke your name warmly on Tuesday; the greater reason not to spend that warmth on paper.',
  'The first minister walks you the length of the gallery, praising your patience so handsomely you cannot now abandon it.',
  'The King, passing, observes that his favour, like the sun, cannot rise twice in one day; the court applauds the mot for a quarter of an hour.',
];

// The army's answer to a gentleman who petitions for a step within a year of
// his last. 20 entries, picked with flourish(). Full sentences in the second
// person; the field promotion alone outruns this counsel.
const PROMOTION_PATIENCE = [
  'The sergeant-clerk laughs you out of the orderly room: two steps in a twelvemonth, in this army?',
  'The adjutant does not look up: the ink of your last commission is still wet, and so is the colonel’s temper.',
  'You are reminded, curtly, that there are subalterns grown grey waiting for less.',
  'The colonel’s man returns your petition with a single word written across it: patience.',
  'The mess finds your ambition amusing; the colonel does not find it at all.',
  'The adjutant prescribes a year of good conduct and better silence.',
  'The colonel is blunt: a step a year is as fast as any man should climb who is not being shot at the top.',
  'Headquarters replies that seniority, like wine, cannot be hurried without turning to vinegar.',
  'The brigade-major reminds you that the army promotes by the calendar, not by the appetite.',
  'The colonel toasts your zeal at mess and assigns it a year’s drill to ripen in.',
  'Your petition travels to brigade and returns with the season’s compliments and nothing else.',
  'The general’s aide is sympathetic: the list is long, the year is short, and your name has lately been crossed off the top of it.',
  'The war office notes that you have been promoted once already this year, a fact it seems to hold against you.',
  'A friend at headquarters shows you the gazette: your last step is still in it, which is precisely the difficulty.',
  'The general receives you kindly and observes that a sword drawn too often at the ladder is drawn too seldom at the enemy.',
  'The commissary of musters explains that France pays for glory annually, and yours is not yet due.',
  'The Marshal’s secretary assures you the Marshal thinks of you often — indeed, only last promotion.',
  'At headquarters they speak of you as a coming man; they are content, for a year, that you should still be coming.',
  'The Minister of War regrets that gazetting you again so soon would oblige him to explain you to the other generals.',
  'The Marshal himself waves your papers away with perfect good humour: France cannot promote you twice a year without unbalancing the army.',
];

// The court's answer to a gentleman angling for a new appointment within a
// year of the last. 20 entries, picked with flourish(). Full sentences in
// the second person.
const APPOINTMENT_PATIENCE = [
  'A porter at the palace gate explains that offices are not handed out at the door, nor twice running to the same coat.',
  'You spend a day among the petitioners and are given thin wine and no encouragement.',
  'A clerk explains, not unkindly, that the court must first tire of the last man it obliged — that is, of you.',
  'The comptroller’s office observes that offices are like pews: one sits in them a decent while before eyeing the next.',
  'You are advised to enjoy the place you have; better men are enjoying the wait for it.',
  'A chamberlain remarks that a new office every season is the mark of a projector, not a gentleman.',
  'The steward of the household is courteous, brief, and entirely unmoved.',
  'Your inquiry is met with the year’s most polished shrug.',
  'A secretary confides that the surest path to the next office is to be seen filling the present one.',
  'The comptroller praises your energy and files it.',
  'You are told the household is quite full, and reminded who was most lately fitted into it.',
  'An intendant explains that the court digests slowly, and that you are, as it were, still on the table.',
  'The master of ceremonies allows that you are much discussed, and begs you not to spoil it by being much seen.',
  'A minister’s wife tells you, behind her fan, that asking twice in a year is dining twice at the same house uninvited.',
  'The first gentleman of the chamber assures you the King knows your worth, and would hate to seem to be paying it off in instalments.',
  'The comptroller-general observes that the budget of favours, like any budget, is annual.',
  'A cardinal’s secretary suggests, with great delicacy, that appetite at court is best worn as indifference.',
  'The minister strolls you past the offices you might one day hold, in the manner of a man showing his cellar to a guest who has drunk enough.',
  'The King’s own valet lets it be known that His Majesty found your last elevation charming, and charm must never be hurried into habit.',
  'The King remarks that a gentleman so lately obliged ought to be the last to remind him of it; you bow to the carpet and withdraw.',
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
