# RIVERWORLD — DYNAMICS

*A design journal. Answers "why is this fun?" before "what does it do."*
*Source: Philip José Farmer's Riverworld. We extract the relationships and tensions — the grail tether, death-as-relocation, grail slavery, the pilgrimage — not the plot beats.*

## Theme

**"The River is patient, and so are you."**

The feeling: a long pilgrimage that fits into a life. The Tower is not going anywhere; neither
is the gong. You camp, you eat, you gather strength — and when you are ready, you push a few
leagues upriver. Nothing in the valley can end your journey: death is a toll paid in goods and
ground, never in graves. The tension is not "will I survive the next gong" but "what will this
push cost me, and is today the day." A run is meant to be picked up and put down over days and
weeks — the game saves itself and waits, like the River.

*(Revision note: v1 was a doomed sprint — 3 lives, death by starvation. Rewritten for
long-term, recurring play: all clocks were converted from executioners into rhythm.)*

## Key Drivers

1. **Accumulation and windfall** — camp at a stone, eat at the gong, stockpile grail goods,
   equip the band. Progress compounds at whatever pace the player chooses; the push upriver is
   a *decision*, never a deadline.
2. **Guardianship + loss aversion (as setback, not ending)** — named historical companions with
   unique abilities. Death doesn't kill anyone; it sends them "far downriver" — companions are
   *out there*, lost; Burton wakes at a random stone, half his hoard gone. Losses cost ground
   and goods, never the run.
3. **Escalating commitment** — the only direction is upriver. Stones get scarcer and more
   contested, and the final stretch has no stones at all. But the escalation is *spatial*:
   walk back downriver and the game gets gentler again.

## Key Mechanics (one per driver)

1. **The Gong.** Every 12 turns, all grailstones fire; any unit within 1 hex of a stone is fed
   (hunger resets) and receives one random grail item. Hunger rises 1/turn; past the famine
   threshold a unit is **famished** — HP drains to a floor of 1 (never death), −1 movement,
   −1 attack. One meal restores everything. *(Driver: accumulation — the gong is a metronome of
   income, and hunger is a tax on wandering, not a death sentence. Scarcity of agency survives
   in miniature: a famished band crawls, so you still route around the gong when traveling.)*
2. **Death is Downriver.** A companion at 0 HP "wakes far downriver" — removed from the party.
   Later recruit encounters have a chance to be a lost companion returned ("the River gives
   back"). Burton (the leader) *always* resurrects at a random grailstone in the current
   stretch — fresh body, half the shared hoard left behind. A deaths counter keeps score, but
   nothing ends the run except reaching the Tower. *(Drivers: guardianship, loss aversion —
   protecting the hoard and the band — plus low-probability hope.)*
3. **The Stretches.** The valley is generated in stretches of increasing hostility: more slaver
   states, fewer free stones, until the polar stretch — no stones, only ice and the Tower. The
   endgame converts hoarded rations into strength: cross the ice unfed and you *crawl* to the
   Tower famished, at 1 MP, through whatever hunts there. *(Driver: escalating commitment,
   near-miss architecture — arriving weak is survivable but memorable.)*
4. **The River waits.** The game autosaves every turn (browser localStorage) and resumes where
   you stood — a run is built to span many sittings. *(Driver: accumulation across real days;
   this is the "recurring" in recurring play.)*

## Secondary Mechanics (each woven into a key mechanic)

- **Grail slavery.** Some stones are held by a named slaver captain and their guards. Slaver
  stones yield **two** items per meal (rich states). Kill the captain and the stone is free —
  and their captive joins you or hands over the captain's hoard. *Weaves into the Gong: the
  rich meal is the risky meal. Drivers: enemy identity, revenge, variable reinforcement.*
- **The state notices you.** Each meal your party eats in a stretch beyond the second spawns a
  press-gang from the nearest slaver stone. *Weaves into the Gong: eating reveals you.
  Anti-turtle pressure with a thematic face. Driver: escalating commitment — tied to the
  player's own consumption, not a timer.*
- **Companions as mechanical exceptions** (roles through rule-breaking, not stat deltas):
  - **The Leader** (player-named at wake-up; Richard Burton if left blank — internally still the
    `burton` role, which keys its mechanics) — explorer: long sight, and only the leader rides
    the Suicide Express. *Naming serves guardianship: it is harder to feed a stranger to the
    River than yourself.*
  - **Alice Hargreaves** — grace: at the Gong, allies within 2 hexes of Alice count as at a stone if *she* is. (Logistics queen — turns one stone into a camp.)
  - **Kazz the Neanderthal** — flint-finder: his kills yield a flint edge (+1 attack, equippable) 50% of the time.
  - **Cyrano de Bergerac** — master fencer: enemies never counterattack him.
  - **Joe Miller** (titanthrop) — dread: adjacent enemies hesitate (50% chance to lose their action). Hits like a falling tree.
  - **Sam Clemens** — riverman: the raft gains +1 move and never drifts while he's aboard.
  *Weaves into guardianship: each is irreplaceable because each breaks a different rule.*
- **The raft.** Gather 4 bamboo to build a raft. On water it moves 3 (4 with Sam); at end of
  each enemy phase it **drifts 1 hex downriver** unless Sam is aboard. You must land to eat. *Weaves into the Gong (the river is fast but the tether pulls
  you ashore) and into escalating commitment (leapfrog stones between gongs). Double-edged
  gold: the current is a cost baked into the movement system, not a bolted-on rule.*
- **The Suicide Express.** At any time, Burton may deliberately die: half the hoard is left
  behind, and he wakes at a *random* stone in the current stretch — possibly forward, possibly
  not. Companions keep standing where they were, on their own until you regroup. *Weaves into
  Death is Downriver. Drivers: double-edged escape hatch, comedy, variable reinforcement. The
  price is paid in goods and scatter, so it never becomes free fast-travel.*
- **Grail items** (variable reinforcement on every meal), built on 3 templates:
  - *consume-self:* ration (eat anywhere — resets hunger; **the endgame currency**), whiskey (heal 2), dreamgum (chew: +2 attack this turn, then stagger to a random adjacent hex — comedy on a stick).
  - *passive equip:* flint edge (+1 atk), woven cloth (+1 max HP style armor).
  - *trade:* cigars — bribe a press-gang to disband, or sweeten a recruit.
- **Fog of war.** Upriver is hidden; grailstones reveal at long range (they're enormous).
  *Weaves into scarcity of agency: scouting ahead vs. being near a stone at the gong. Driver:
  information as currency.*

## Rival Constraints (slaver AI is predictable and counterable)

- Guards patrol within a **leash radius** of their home stone; they chase visible party units
  and give up beyond the leash. (Counterplay: bait guards off a stone, loop back, eat.)
- Same terrain costs as the player; full pathfinding, no teleporting; no knowledge of units
  they can't see.
- Press-gangs commit to the nearest party unit *at spawn time* and don't switch targets.
- Joe's dread and Cyrano's no-counter are exceptions guards do not share.

## State Model (fits in a struct)

`game = { turn, gongIn, deaths, stretch, tiles[], units[] (side, name, hp, hunger, mp, acted, role, items), raft {hex, aboard[]}, lostCompanions[], log[] }`
Every mechanic above reads/writes only these fields — and the whole struct serializes to
localStorage in one JSON blob, which is what makes "the River waits" a one-mechanic feature.

## Strategies (reviewed against the mechanics)

- **Early:** learn the gong rhythm; recruit at free stones; gather bamboo between gongs.
- **Mid:** raft leapfrog — ride the river hard for 8–10 turns, land at a stone 2 turns before
  the gong. Sam turns this from risky to routine.
- **Risk line:** raid rich slaver stones for double meals, hoards, and freed companions.
  Revenge fuel: the captain who killed Kazz is standing next to his stone, and you know his name.
- **Hoarding line:** the polar stretch has no stones — rations hoarded all game are the only
  food. Cross without them and you arrive famished and crawling, not dead — but you will
  remember it (near-miss architecture).
- **Camping line (now legitimate):** settle at a good stone for many gongs, stack cloth and
  flint, and only then push. The cost is press-gangs — camping converts food into skirmishes,
  which is *content*, not punishment: each gang beaten is a band that got stronger.
- **Desperation line:** cornered, famished, gong 9 turns out — take the Suicide Express and
  gamble the respawn against half the hoard.

### Anti-strategies (and the specific mechanic that prices each)

- **Turtling at one stone:** allowed by design in a long-term game — but press-gangs spawn per
  meal beyond the second in a stretch, so camping is never *quiet*. ✔ priced, not forbidden.
- **Kiting guards forever:** leash radius returns them home; meanwhile your band goes famished
  and slows to a crawl. ✔
- **Suicide Express as free fast-travel:** halves the hoard, scatters you from your
  companions, and the destination is random. ✔ priced.
- **Skipping all combat:** viable! But then no double meals, no hoards, fewer recruits, thin
  rations on the ice. Pacifism is a legitimate slow mode, not a dominant strategy. ✔
- **Ignoring hunger entirely (no death, so why eat?):** a famished unit fights at −1 attack,
  moves at −1 MP, and sits at 1 HP — one guard swat sends Burton downriver with half the hoard.
  Hunger is priced through the loss-aversion mechanics, not a kill screen. ✔

## Tuning Notes

- Gong every 12 turns; famine at 24 — you can skip exactly one meal before you slow down.
- No mechanic may end the run except the Tower. Every failure must convert into setback
  (goods, ground, scattered companions) — this is the load-bearing rule of the revision.
- Halve/double first: if the ice crossing is trivial, double its length before touching ration
  drop rates.
- Death must be an event: guards kill on screen in the enemy phase, hop by hop — never a
  post-turn state check.
