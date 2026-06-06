# Game Dynamics — The Night of the Simoor

> Design journal. Answers *why this is fun* before *what the code does*.
> Built on the hex-and-counter base game (move a counter across a hex map toward
> a target). This document supersedes the generic base dynamics.

---

## Theme

**The emotional experience:** the giddy, sweaty-palmed comedy of working a room you
don't belong in — trying to find the one person who matters in a sea of masks, before
your insufferable rival does, while one wrong move turns the whole court against you.

It is a **bawdy farce of mistaken identity and social nerve.** Not war. Not romance,
exactly. The feeling is: *"I think that's them — but if I'm wrong in front of everyone,
I will perish."* Confidence and humiliation are one bad guess apart.

Setting (fuel, not mechanics): **Simoor**, a sun-scorched jewel-world where the great
psionic dynasties duel with seduction and secrets instead of fleets. Once a year the
hot desert wind — the *simoor* — blows in and the **Sapphire Court** throws a masked
revel. One night to win in an evening what armies couldn't take in a decade. You are
your house's agent. So is **the Vicomte de Vavoom**, and he is *also* terrible.

The prize: **the Veiled Sovereign**, who tonight is masked and indistinguishable from a
crowd of identically-veiled impostors drifting through the party. Find them, woo them,
beat the Vicomte to it. Don't get thrown out first.

---

## Key Drivers (the load-bearing pillars)

This theme naturally activates three drivers; every mechanic weaves into them.

1. **Information as Currency** — you don't know which masked figure is the real Sovereign.
   Narrowing it down is the whole game — clues are a contested resource, and you never
   quite know how much your rival has learned.
2. **Scarcity of Agency** — the night is short (turn limit = dawn), Poise per turn is
   small, and you cannot both gather certainty *and* outrace the rival. You triage.
3. **Comedy** — overlapping systems (wrong guesses, charmed guards keeling over,
   the rival flinging himself at a giggling baronet) are tuned to produce retellable
   disasters. The court is all nobility — there are no commoners to blame, only titled
   flirts you mistook for royalty.

Supporting: **Rival NPCs Need Constraints** (the Vicomte), **Loss Aversion** (the
Scandal meter), **Near-Miss Architecture** (the Vicomte woos them one turn before you).

---

## Key Mechanics (one sentence each)

- **K1 — Move (Poise):** spend Poise points to step across court zones, paying a
  per-zone cost, exactly like the base game's MP movement. *(Scarcity of agency.)*
- **K2 — The Masked Court:** until a Favor is claimed the *entire* court is masked — the 5
  impostors, the Sovereign, and the 12 revelers all render as identical blank counters, with
  no `?`s and no `G`s to read. Claiming **a Favor** (by anyone) *opens the court*: every
  figure now shows as a `?` and the Gossips light up. **The Favor is your invitation** — and
  approaching the still-hidden Sovereign *before* you hold one is fatal (see K2b).
  *(Information as currency.)*
- **K2b — Lèse-majesté (the Sovereign trap):** before the court opens, the Sovereign is a
  blank in the crowd; lay hands on it — click that blank while adjacent — and the
  Veil-Wardens expel you instantly (you lose). The risk is the cost of the hidden
  information: you can't tell the Sovereign from a reveler, so the safe play is to earn a
  Favor first, which turns the lethal blank into a wooable `?`. *(Loss aversion; the Favor's
  reveal is double-edged — it's also what makes the approach survivable.)*
- **K3 — Claim a clue (from the crowd):** Gossips and Favors are *carried by revelers*,
  not fixed tiles — approach a carrier (it blocks, so you stand adjacent) and claim it.
  A Gossip privately unmasks one impostor for you alone; it's then spent, so the rival who
  reaches it second gets nothing, and you never see which clues the Vicomte has claimed.
  **Claiming is a commitment — like a woo, it spends the rest of your Poise and ends the
  turn.** Leaning in to charm a token off someone costs you the night's tempo, so each claim
  is a turn you didn't spend closing on the Sovereign — and a turn the Vicomte gets to move.
  *(Information as currency; contested + asymmetric — and now priced in tempo, not free.
  Each carrier is a small state machine — PLAIN / GOSSIP / FAVOR, claiming into a spent
  state — see the reveler crowd below.)*
- **K4 — Woo (the commit):** end your move beside a masked figure and woo them; if it's
  the Sovereign you win, and if it isn't you take a humiliating Scandal hit while they
  flounce off. *(Near-miss + comedy + loss aversion.)*
- **K5 — Scandal:** charming guards and botched woos fill a Scandal meter; max it and
  the Veil-Wardens throw you out — you lose. *(Loss aversion; escalating commitment.)*

The tension triangle these create: **certainty vs. speed vs. composure.** Clues buy
certainty but cost turns — and every Gossip is a footrace, since whoever reaches it first
denies it to the other. Gambling early is fast but Scandal-expensive when wrong. Playing
it safe in the shadows keeps Scandal low but the Sovereign is never in the shadows.

---

## Secondary Mechanics (each woven into a key one)

- **Charm a Guard** — Chaperones/Veil-Wardens occupy hexes and block passage (the base
  game's "enemies as impassable"). Instead of being walls, you can **Charm** an adjacent
  guard to clear their hex for one turn — but charming adds Scandal (weaves into **K5**).
  *Makes K1 movement a Scandal decision, not just a Poise decision.*
- **Witnesses amplify (zones as language)** — the Scandal cost of any charm or botched
  woo is **scaled by the zone you're standing in**: free in private Alcoves, doubled on
  the public Ballroom floor. *Weaves K5 into the map itself; terrain becomes the plan.*
- **The Sovereign loves a crowd** — masked figures wander with a bias toward glamorous,
  public zones (Ballroom, Promenade) and avoid private ones. So the prize is always
  where Scandal is most expensive. *Weaves K2 into K5 — escalating commitment, baked in:
  you must leave the safe shadows to win.*
- **The Vicomte de Vavoom** — a rival agent under the same rules (K1 movement, K3 clues
  he only knows if *he* claimed them, K4 woo) but at **half your Poise**, so you can
  out-pace him to the Gossips and the Sovereign. He **starts on the same side as you** — at
  your elbow, both racing inward from the same end of the hall — so the contest is a true
  side-by-side dash rather than a converge-from-opposite-corners meet. He commits to the
  figure he believes is the Sovereign and races there. *Weaves the whole loop into a
  contest; creates near-misses; the shared start makes early blocking and racing legible.*
- **The reveling crowd** — 12 revelers wander with a little inertia and **block movement
  for everyone** (you, the Vicomte, the figures). Each holds a wandering *strategy* and
  mostly keeps it; **25% of turns it re-rolls** into one of three equally-likely modes —
  **hold position**, **drift toward another counter** (any piece on the board: you, the
  Vicomte, a figure, another reveler), or **step to a random free neighbor**. A mode that
  can't make a legal move this turn just holds. The "drift toward" mode gives the crowd
  brief, readable currents — a little knot will trail a counter for a few turns before
  scattering again — instead of pure white-noise jitter, while staying unpredictable enough
  to never be a reliable wall. The floor's open lanes shift every turn, so a reveler
  drifting into the Vicomte's only path is a free roadblock. The crowd is also where the
  game's interactables *live*: each reveler is a small **state machine** — **4 carry a
  Gossip**, **4 carry a Favor**, **4 are plain** — and the disguised Sovereign hides among
  the blanks. So the same wandering counters you route around are also the clues you chase
  and the cover the Sovereign hides behind. *A shared obstacle (per "shared obstacles create
  emergent alliances"); serves comedy + variable reinforcement + information-as-currency.
  Cosmetically, each night's five walkable zones are recolored by ColorTheory and revelers
  wear a lightened tint of that palette, so no two nights look alike.*
- **A charmed guard keels over** — a charmed guard doesn't just step aside; he faints
  into the punch bowl, leaving his hex **impassable for a few turns**. Your own charm can
  wall off a corridor — sometimes against you, sometimes (gloriously) against the Vicomte.
  *Weaves the charm action into emergent comedy and board-blocking.*

### Later layers (designed now, inert in v1)

These map onto the base game's optional input layers (L4 targeting, L5 overlays):

- **Rumor (a weapon):** spread a scandalous rumor about the Vicomte — adds to *his*
  Scandal or freezes him a turn — but it draws eyes to you (small Scandal to yourself).
  *Double-edged; pure intrigue. Uses the targeting modal (L4).*
- **The slipped-away tryst:** occasionally one figure peels off into a moonlit Garden
  alone — a rare private chance to woo with no witnesses (zero Scandal on a wrong guess),
  *if* you dare assume the Sovereign would be so indiscreet. *Low-probability hope.*

---

## Gut Checks (does it satisfy common sense cold?)

- **Charm clears a guard** → yes; flirting your way past a doorman is intuitive.
- **Wrong woo = Scandal** → yes; publicly hitting on the wrong person is *obviously*
  mortifying. The player feels the logic before reading a rule.
- **Public places cost more Scandal** → yes; everyone knows you misbehave in the
  cloakroom, not the ballroom.
- **A claimed Gossip/Favor is spent for everyone** → intuitive: a secret heard is a secret
  spent; whoever got there first got it. The carrier's badge dims so the loss is visible.
- **Nobody is readable until a Favor opens the court** → needs a one-line cue (the intro
  says so), else the masked-blank opening reads as "nothing to do." Once learned, "get a
  favor first, *then* read the room" is intuitive — the favor is plainly your way in.
- **Touching the Sovereign uninvited gets you thrown out** → yes; barging up to royalty
  without an invitation is *obviously* a faux pas. The danger of poking blanks before you
  hold a favor lands as etiquette, not a bug — and the favor visibly makes it safe.

---

## State Model (every mechanic must fit in a struct)

```javascript
// Court hex (re-skin of the base hex; zone replaces terrain semantics)
{ q, r, col, row, zone, isEdge }

// A masked figure: 5 impostors + 1 Sovereign. Until sovereignRevealed flips true ALL
// figures render as blank `disguise`-tinted counters (no `?`), indistinguishable from
// revelers; after it, impostors+Sovereign show as `?`. disguise is set for every figure.
// strategy/target carry the hidden Sovereign's wandering while it drifts with the crowd.
{ id, q, r, isSovereign: bool, wooedBy: null | 'player' | 'rival', disguise: hexColor,
  strategy, target }

// A reveler — wanders + blocks. State machine over what it carries (see REV/CLAIM):
//   state: 'plain' | 'gossip' | 'gossip-spent' | 'favor' | 'favor-spent'
// strategy: 'still' | 'toward' | 'random' (re-rolled 25%/turn); target: the counter it
// drifts toward while strategy === 'toward', else null.
{ q, r, color: hexColor, state, eliminates: figureId | null, strategy, target }  // eliminates set for gossips

// The two agents. `known` is PRIVATE per-agent unmasking knowledge.
agent = { q, r, poise, scandal, known: Set<figureId>,
          // rival-only:
          out: bool }

// Module globals: sovereignRevealed: bool (first Favor claimed by anyone)

// Game
{ hexes: Map, figures: [figure], player: agent, rival: agent,
  turn, maxTurns, phase, // dawn = maxTurns
  // inherited modal stack: overlay, selection { reachable, wooable, claimable } }
```

Each agent's `known` set is the information state: it grows as that agent claims Gossips
(or botches woos). `suspectFigures(agent)` returns `[]` while the court is masked, and once
`sovereignRevealed` is true returns figures not wooed and not in `known` (the Sovereign
included). Win = a Sovereign figure's `wooedBy === 'player'`; touching the Sovereign while
`!sovereignRevealed` is the lèse-majesté loss (K2b).

### Zones (re-skin of the 7 existing TERRAIN slots — costs provisional, halve/double later)

| Existing slot | Zone | Move cost | Role |
|---|---|---|---|
| PLAINS | **Promenade** | 1 | default floor; figures wander here; woo Scandal ×1 |
| GOLD | **Ballroom** | 1 | glamour; Sovereign's haunt; woo Scandal ×1.6 (worst place to be wrong) |
| FOREST | **Moonlit Garden** | 1 | private; woo Scandal ×1; rare tryst spot (v2) |
| HILLS | **Watched Colonnade** | 2 | the seen route; extra Poise; woo Scandal ×1.3 |
| QUARRY | **Shadowed Alcove** | 1 | smuggler's shortcut; woo Scandal ×1 (charm discount lands here in v2) |
| WATER | **Reflecting Pool** | ∞ | wall |
| MOUNTAIN | **Orchestra Dais / Fountain** | ∞ | wall |

> **No zone gives a woo Scandal multiplier below 1.0.** An earlier build let Alcoves
> (×0) and Gardens (×0.5) make a wrong woo free — which removed all downside from
> blind-wooing every figure. Private-zone *discounts* return in v2 for **charming
> guards**, an action with no equivalent exploit. Public zones still read as language:
> being wrong in the Ballroom/Colonnade hurts most, and that's exactly where the prize is.

---

## Action Templates (template, don't snowflake)

A small set of templates covers everything; content is parameters, not new code paths.
Both the player and the Vicomte share the same `computeApproach` / `claimReveler` /
`resolveWoo` code — only the trigger differs (clicks vs. the rival's plan→walk→act).

1. **MOVE(toHex)** — pay zone cost from Poise (base game's move, unchanged).
2. **CLAIM(revelerHex)** — approach an adjacent carrier and `claimReveler`, which runs the
   reveler state machine: GOSSIP → GOSSIP_SPENT (`agent.known.add(eliminates)`, private)
   or FAVOR → FAVOR_SPENT (first one sets `sovereignRevealed`). Dispatched on `state` via
   the `CLAIM` table — no per-type branching. **A claim ends the player's turn** (Poise → 0,
   then `endTurn`), the same commitment shape as WOO — so it is paid in tempo, not free.
3. **WOO(figureHex)** — adjacent suspect → if `isSovereign`: WIN; else
   Scandal += BASE_WOO × zoneScandal, `agent.known.add(id)`, figure flounces, comedic line.
   (Only reachable once the court is open — pre-Favor `suspectFigures` is empty, so there
   are no woo targets.)
4. **BREACH(sovereignHex)** *(player-only, implicit)* — clicking the still-hidden Sovereign
   while adjacent (`isAdjacentHiddenSovereign`) is an instant expulsion loss (K2b). It isn't
   a chosen action so much as the trap the masked opening sets; the Favor reveal removes it
   by turning the blank into a normal WOO target.
5. **CHARM(guardHex)** / **RUMOR(rivalHex)** *(later layers)* — see above.

The Vicomte runs the **same** templates via A* (`findPath` in `hex.js`): each turn he plans
a single `{ kind, target }` (claim a Favor pre-reveal, else claim a Gossip or Woo), paths
to an adjacent standable hex, and acts. Constraints satisfied: information limit (only
gossips he claimed), terrain cost (same zones, **half Poise**), commitment (one target per
turn), counterplay (out-race him to carriers/Sovereign, block his path, later Rumor him).

---

## Strategies (the play patterns the design must support)

**Early game** — *find your way in.* The court is masked: every counter is a blank, Gossips
are dormant, and the Sovereign is a lethal blank you must not touch. The only move that
matters is the **race to a Favor** — you start at the Vicomte's elbow, so it's a flat-out
dash to the nearest ❀ through the shifting crowd. Claiming it opens the court for everyone,
so whoever gets there first dictates the tempo of the whole night.

**Mid game** — *the squeeze.* The field is narrowing for both of you. The Sovereign drifts
in the glamorous, Scandal-expensive zones. You weigh: race the Vicomte to one more Gossip
(claiming it denies it to him), or commit now on a narrowed guess.
Charming a guard to cut a corner trades Scandal for tempo.

**Late game** — *the desperate commit.* Dawn (turn limit) closes in. Someone has to gamble.
The crescendo is converging on a figure on the crowded Ballroom floor (max Scandal zone)
with the Vicomte one corridor away. A charmed guard fainting in the right doorway can wall
him out for the turn you need. Near-miss central.

**Recurring tensions (every game):**
- *Certainty vs. speed* — clues cost turns the rival uses to close distance.
- *Race for the Gossips* — every clue is exclusive; reaching one first both informs you
  and denies it to the Vicomte (and you never see what he's already learned).
- *Composure vs. tempo* — charming past a guard is faster but feeds Scandal.
- *Where the prize is vs. where it's safe* — they are mechanically opposite zones.

**Anti-strategies (degenerate patterns and the mechanic that prevents each):**
- *Woo-spam every figure until one hits* → first, you **can't woo at all until the court is
  open** (pre-Favor there are no targets — and clicking the hidden Sovereign by accident is
  an instant expulsion, K2b). Once open, a wrong woo adds **5** Scandal (half the cap) and is
  **never free** (no sub-1 zone multiplier), so the **second miss ejects you**. With **6
  figures** a blind run is a ~33% bet that also burns turns the Vicomte spends winning. And
  because **Gossips (4) < impostors (5)**, you can never consult your way to certainty — so
  even the patient line ends on a woo you have to *dare*. Prevention is mechanical, not
  "it's suboptimal."
- *Poke blanks to find the Sovereign before earning a Favor* → the **lèse-majesté trap**
  (K2b) makes that a coin-flip with expulsion on one face: touching the hidden Sovereign
  ends the game instantly. The safe line is to claim a Favor first, which converts the
  Sovereign from a lethal blank into a wooable `?`.
- *Turtle in the Alcoves farming zero-Scandal* → the Sovereign never enters Alcoves
  (K2 wander bias) and dawn ends the night (turn limit). You cannot win from the shadows.
- *Consult every Gossip for total certainty* → impossible by design: there are fewer
  Gossips than impostors, so claiming them all still leaves two suspects. The night always
  ends on a woo you must dare.
- *Rival is omniscient / teleports* → **explicitly prevented:** the Vicomte only knows
  clues he personally claimed, pays the same zone costs at **half your Poise**, and commits
  to one suspect (no free target-switching). Counterplay exists: out-race him to the
  Gossips and the Sovereign, block his A* path, Rumor him (later). He can be
  *outmaneuvered*, not just outraced.

**Comedy cracks (left open on purpose):**
- Wrong-woo scandal panel: an exclamation (one of 20 — *"Zounds!"*, *"It cannot be!"*) over
  the saucy lesser aristocrat you actually wooed (20 per gender, matched to the Sovereign
  you sought): *"You sink to one knee before… the Marquess of Quivering Repute. The court gasps."*
- Your charmed guard faints into a doorway and walls off your own escape.
- The Vicomte flings himself at a giggling baronet while you watch from across the room.
- A figure slips into the Garden alone — is it the Sovereign being indiscreet, or a trap
  for your dignity?

---

## Implementation Layers (align with the base game's L1–L5 input model)

- **v1 core (L1–L2):** MOVE, the Masked Court (K2) — fully masked until a Favor opens it,
  with the lèse-majesté trap (K2b) guarding the hidden Sovereign — the reveler crowd
  (blockers carrying Gossips/Favors, glyphs drawn centered), CLAIM, WOO, Scandal, and the
  Vicomte starting at your elbow. This is a complete, winnable, funny game.
- **v2 (L3–L4):** CHARM guards + fainting obstacles; zone-scaled Scandal; RUMOR targeting.
- **v3 (L5):** overlays/tutorial cards, the slipped-away tryst, richer comedy lines.

Current v1 numbers (provisional — *halve and double first*): Poise **5**/turn (Vicomte
**2**, half), dawn at **16** turns, **6** figures (1 Sovereign + 5 impostors), **4**
Gossips, Scandal cap **10**, botched woo **5** before zone scaling. **Invariants to
preserve when retuning:** `Gossips < impostors` (no path to total certainty) and
`2 × base-woo-Scandal ≥ cap` (a second wrong guess always ejects). These give wooing its
teeth. If the Vicomte feels too weak at half Poise, raise his Poise toward yours before
reaching for other levers.
