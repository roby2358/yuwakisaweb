# The Waking Isle — Game Dynamics

## Theme

Curiosity curdling into dread. You land on a silent island, and for a while the game is
pure discovery — pushing back the fog, finding standing stones, spotting the glint of a
relic tomb. The moment you take one, the island wakes, and every hex you explored on the
way in becomes your lifeline on the way out. The map is the same; the *meaning* of the
map flips from "what's out there?" to "how do I get home?"

## Key Drivers

1. **Information as currency / Accumulation & windfall** — map knowledge is the resource.
   You spend turns to earn sight, and you cash that knowledge in during the escape.
2. **Escalating commitment** — winning *requires* waking the island. Each relic carried
   makes the pursuit worse, and the relics you haven't grabbed yet are always deeper in.
3. **Near-miss architecture / Loss aversion** — the run home is a chase you almost lose.
   Getting caught two hexes from the boat is the story you retell.

## Key Mechanics (one per driver)

1. **Fog of war**: you can only move onto hexes you have seen; sight is radius 3
   (4 from hills), and once seen, a hex stays seen.
2. **Waking tombs**: stepping onto a relic hex takes the relic and wakes the tomb —
   two hunters claw out of the earth 6–10 hexes away, dormant for one turn.
3. **The escape**: reach your boat carrying at least one relic to win; a hunter
   stepping onto your hex kills you.

## Secondary Mechanics (each woven into a key one)

- **Scent** (→ escape, the load-bearing one): hunters smell the *stolen relics*, not
  you — pursuit only happens within `9 + 2 × relics carried` hexes (+4 at night).
  Beyond that a hunter stands torpid. Two consequences: you can always break contact
  by running, and every relic you take makes breaking contact harder. Greed is a
  dial you turn on yourself.
- **The trickle** (→ waking tombs): every plundered tomb births one more hunter every
  `max(2, 7 − carried)` turns. Lingering after a theft compounds; so does greed.
- **The glimpse** (→ fog): straight sightlines out to 8 hexes show terrain *faded* —
  the shape of the land, not its details (no relics, no stones, not walkable). Hills,
  mountains, and forests block the line; the blocker itself is seen, what's behind it
  isn't. You steer by the glimpse and still have to walk the fog back for the truth.
- **Cairns** (→ fog): entering a standing-stone hex reveals radius 6 around it, once.
  A windfall of pure information — sometimes it shows you a tomb, sometimes your route home.
- **Hill sight** (→ fog): hills cost 2 MP but see radius 4 — and open country ahead
  of them glimpses far. Terrain as language: the high ground is worth the climb
  *because* of the fog.
- **Variable hunter speed** (→ escape): each hunter rolls speed at spawn
  (d6: 1–3 → 2 MP, 4–5 → 3 MP, 6 → 4 MP). Most are slower than you (6 MP);
  any one might not be. Counters shade brighter red the faster they are — the lesson
  every player learns once: *never end your turn within reach of the bright ones.*
- **Hesitation** (→ escape): each hunter has a 30% chance per turn to stand still.
  Ancient, torpid things — ecology, not choreography.
- **Nightfall** (→ escape): at turn 60 night falls — hunters gain +1 MP, smell 4 hexes
  farther, and tombs trickle faster. Anti-turtle pressure: mapping the whole island
  before the first theft is possible, but the turns are borrowed against the night.
- **Decay** (→ escape): a hunter more than 15 hexes from you has a 20% chance per turn
  to sink back into the earth. Broken contact becomes *shed* pursuit, and the chase
  stays a chase, not an ever-growing wall. Pack size is hard-capped at 10.

## Hunter Constraints (why the rival is beatable)

- Hunters pay the same terrain costs as you and cannot cross water or mountains.
- Information limit: they track you only inside scent range; outside it they stand
  torpid and eventually decay. Breaking contact is real counterplay, priced in relics.
- Within scent they path with full A* (no local-horizon wandering), but most roll
  slower than your 6 MP, and hesitation bleeds their average speed further.
- They spawn at fixed, known places — the tombs — never within 5 hexes of you, and
  burst spawns are dormant for a turn: no spawn can ever seal a pocket before you've
  had a chance to run.
- Counterplay: route through terrain that slows them, put water between you, grab the
  deepest relic *first* so the wakes happen behind you on the way out.

## Turn Structure

1. **Player phase** — spend 6 MP across moves; entering a hex reveals around it;
   entering a relic hex takes it (and wakes the tomb); entering the boat with ≥1 relic wins.
2. **Enemy phase** — each non-dormant hunter within scent rolls hesitation, then
   A*-walks its MP budget toward you (reaching you kills); plundered tombs trickle-spawn
   on schedule; hunters beyond 15 hexes may decay; night check at turn 60.

## Win / Loss

- **Win**: stand on the boat hex carrying at least one relic. The victory screen shows
  relics carried of the total — escaping with 1 is a win; escaping with 5 is the brag.
- **Loss**: a hunter enters your hex. There is no combat — only the chase.

## Strategies

- **Snatch and run** (safe): push straight in, grab the first tomb you see, sprint home.
  Low plunder, high survival — reliably winnable (sim: ~100%).
- **Deep first** (greedy, correct): scout to the far tombs *before* taking anything —
  waking is triggered by theft, not discovery — then collect on the way back so every
  wake happens behind you, and your scent is short while you're deepest.
- **Shed the pack** (escape): when the pursuit thickens, stop collecting and sprint
  until the pack drops out of scent range, then loop back clean. Costs turns; night
  prices them.
- **Hill-hopping** (scout): route across hills to buy radius-4 sight cheaply; cairns
  are jackpots worth a detour.
- **Water lines** (escape): retreat along coasts and isthmuses — hunters can't swim,
  and a peninsula behind you is a wall (but a pocket ahead of you is a grave).
- **Anti-strategy — turtle scouting**: fully mapping the island before the first theft
  is checked by nightfall (turn 60): +1 hunter MP, +4 scent, faster trickle. Mechanical,
  not advisory.
- **Anti-strategy — camping the boat**: standing at the boat with 0 relics does nothing;
  there is no win without waking the island. (Escalating commitment is mandatory.)

## Tuning Knobs (halve/double first)

| Knob | Value | Watch for |
|---|---|---|
| Sight / glimpse | reveal 3 (4 hills), glimpse 8 | Reveal 2 playtested as thrilling-but-frustrating |
| Relics | 5 | Enough that "how many?" is a real choice |
| Burst | 2, dormant 1 turn, ring 6–10 from tomb | Never a same-turn kill, never seals a pocket |
| Scent | 9 + 2×carried (+4 night) | The greed dial; breaking contact must stay possible |
| Trickle | every max(2, 7−carried) turns per tomb | Lingering cost |
| Hunter speeds | d6 → 2/2/2/3/3/4 MP (+1 night) | Fast ones ≈ 1 in 6 |
| Hesitation | 30% | Bleeds pack speed without making them ignorable |
| Nightfall | turn 60 | Bites dawdling, not ambition (a 3-relic run ≈ 45–55 turns) |
| Decay | >15 hexes, 20%/turn; cap 10 | Keeps the swarm near the story; caps encirclement |

Sim results (`test/sim.js`, greedy bot, 30 seeds): escape@1 **30/30**, escape@3
**20/30**, escape@5 **1/30**, failed runs dying ~3 relics deep — the intended
gradient (a human should beat the bot's numbers; escape@5 is legend tier).

Tuning history worth remembering: bursts that scale with greed (`1+carried`) in a
ring around the player are an *encirclement machine* — random surrounds, unreadable
deaths. Pressure that escalates with greed belongs in scent range and trickle rate
(a wave from behind), not in spawn counts around the player.

## Deferred

- **Relic dropping** — drop a relic to shrink your scent and distract nearby hunters
  (a bribe). Only if playtests show the escape needs a release valve.
- **Enemy-phase animation** — hop-by-hop hunter movement per the base game's animation
  guidance; v1 resolves instantly.
- **Dormant-hunter rendering** — burst spawns look identical to active hunters; a
  "half-risen" visual would make the head-start turn readable.
- **Score beyond relic count** — turns taken, hunters woken. Keep it a count for now.
