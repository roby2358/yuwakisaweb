# RADIO FREE SECTOR 9 — Rationale

Why each current choice and number is what it is, and what's still open. Rules live in
ONTOLOGY.md, criteria in CRITERIA.md, the fun in DYNAMICS.md, history in ARCHITECTURE_LOG.md.

**Measurement commands** (seeded, DOM-free):
- `node test/sim.js 40 --maps` — best single rig per map with no Sweepers, as a fraction of
  blocks, three ways: pulled after one broadcast, pulled at `TX_RANGE_MAX`, left on air.
- `node test/sim.js 40` — a greedy bot plays 40 games. It plans one cascade at a time,
  rescues hunted rigs it can reach, and won't end a turn where a Sweeper can reach it. It
  measures whether the ecology is winnable and close, not what optimal play looks like; a
  human should do better. By default it leaves a rig on air until it reaches `TX_RANGE_MAX`
  with nothing left to wake; `--pull-early` pulls it once nothing is left within `TX_RANGE`.

---

## The core: the Wake

### D-1 The Wake is a threshold cellular automaton seeded by rigs — *Proposed, tuned by sim*
- **Alternatives:** (a) probabilistic spread (each awake neighbor gives a % chance);
  (b) rigs wake a radius and nothing spreads; (c) threshold 1 (any awake neighbor).
- **Why:** G-1 needs a chain reaction the player *sets up* and can *read*. Deterministic
  threshold spread is fully previewable (readable consequences); randomness would turn the
  windfall into a slot machine. Threshold 1 floods every connected block at once (no
  setup); a radius with no spread is no cascade at all. `WAKE_THRESHOLD` 2 on a hex grid
  makes two-wide streets carry the Wake and one-wide alleys stop it — terrain becomes the
  puzzle. `TX_RANGE` 2 lets one rig light a 19-hex patch and jump a 1–2 hex firebreak,
  which is what bridging needs.
- **Evidence:** see D-3 for the cascade measurement.

### D-3 Neighborhoods are clumpy but gappy — *Proposed, tuned by sim*
- **Alternatives:** pure smooth density noise (big blobs); pure random scatter (no
  neighborhoods); lower block fraction.
- **Why:** with smooth noise alone, one rig woke most of the city and the game ended at
  plant one. With pure scatter there are no neighborhoods to read. Smooth noise plus heavy
  per-hex jitter (`DENSITY_JITTER`) gives recognizable districts with ragged edges and
  gaps, so the Wake needs several bridges. Anti-strategy "one cluster wins alone" is
  prevented by this geometry.
- **Evidence:** `Measured by: node test/sim.js 40 --maps` → best single rig, as a share of
  blocks (`WIN_FRAC` is 50%): pulled after one broadcast — min 8%, median 16%, p90 33%,
  max 47%; pulled at `TX_RANGE_MAX` — median 22%, max 50%; left on air — min 14%, median
  24%, p90 40%, max 51%. One map in 40 lets a lone rig left on air reach the win line, but
  only with no Sweepers, and Hounds hunt rigs. Sweep on 8 maps (cascade without growth or
  fading): no jitter at `BLOCK_FRAC` 0.4 gave median 60%; jitter 30 → 41%;
  `BLOCK_FRAC` 0.45 with jitter 80 → 17% (chosen).

### D-4 Win by a global awake fraction, not by reaching the Ministry — *Proposed*
- **Alternatives:** (a) walk @ into the Ministry; (b) wake the Ministry's neighbors;
  (c) survive N turns.
- **Why:** G-1 says every way to win runs through the Wake. A positional goal (a, b) makes
  the cascade optional — you'd sneak there. A global meter can only be filled by
  cascades, and the WAKE bar shows progress every turn (near-miss: "47%!").
- **Evidence:** `Modeled by: sim` — median bot peak 47% (see D-8).

### D-2 The terrain set — *Proposed*
- **Alternatives:** reuse the base's natural terrain renamed.
- **Why:** each terrain must say one thing at a glance (terrain as language): blocks are
  tinder, everything else is a firebreak; canals and arcologies wall movement; factories
  and ruins slow it. Plaza and block both cost 1, so the player isn't punished for walking
  through the neighborhoods they're waking.

---

## The lesser dynamics

### D-5 Jamming blocks waking; only a Sweeper's own hex is sedated — *Proposed, tuned by sim*
- **Alternatives:** (a) Sweepers sedate every awake block within `JAM_RADIUS`; (b) no
  jamming, Sweepers only smash and capture.
- **Why:** (a) let Sweepers grind the Wake down faster than it heals; progress leaked away
  and the core (accumulation) stopped accumulating. (b) leaves the Alert with no grip on
  the Wake itself. Blocking-only jam makes Sweepers *checkpoints*: they stop the frontier
  but can't erase a district, so accumulation sticks and the fight is over chokepoints.
  `TX_RANGE` > `JAM_RADIUS` keeps a counterplay: plant just outside a checkpoint's reach.
- **Evidence:** `Measured by: node test/sim.js 30` under (a): 0 of 30 bot wins, median peak
  13–19% across `AWAKE_PER_SWEEPER` 20–40; under (a) with `JAM_RADIUS` 0: 1 of 30, peak 35%.
  Under the current rule (with D-12): see D-8.

### D-15 A rig's range grows while it stays on air — *Proposed, tuned by sim*
- **Alternatives:** (a) a fixed range (pull after one broadcast is always right); (b) range
  growth with no cap; (c) growth that survives a pull.
- **Why:** with a fixed range, a rig's job ends after one broadcast — strike-and-pull was
  the only sensible play, and leaving a rig out was all risk. Growth (+1 per unjammed
  broadcast to `TX_RANGE_MAX`) makes "one more turn on air" pay: the rig reaches blocks
  beyond the first patch, often across a firebreak. It's double-edged: every turn on air is
  a turn a Hound closes in (RIGS feeds CORE). A cap keeps one rig from becoming the whole
  game (X-1); resetting on pull keeps the decision live each time; a jammed broadcast adds
  nothing, so a parked Warden stunts a rig as well as silencing it.
- **Evidence:** see D-3 for what growth adds to one rig, and D-16 for the bot.

### D-16 Unheld blocks with too few awake neighbors fade — *Proposed, tuned by sim*
- **Alternatives:** (a) awake is permanent (only a Sweeper's own hex sedates);
  (b) everything outside a rig's range fades; (c) fading only under jam.
- **Why:** with (a), a pulled rig loses nothing, so there's no reason to keep it on air.
  Fading at `FADE_THRESHOLD` makes a rig a prop: the ragged edges of its patch (spurs,
  peninsulas, blocks a Sweeper cut off) stay awake only while it broadcasts. Solid
  districts hold themselves up, so accumulation still sticks (G-1) — (b) would make the Wake
  a pure function of where rigs stand, which undoes accumulation. The rule is the wake rule
  run backward, so the player already knows how to read it, and the pull preview shows it.
- **Evidence:** `Measured by: node test/sim.js 40 --set …` (controlled, one rule at a time;
  the bot's spent rule reduces to the old one when `TX_RANGE_MAX` = `TX_RANGE`):
  neither rule (`FADE_THRESHOLD=0,TX_RANGE_MAX=2`) → 18 won, 12 captured, 10 stalled;
  growth only (`FADE_THRESHOLD=0`) → 16 won, 4 captured, 3 dead air, 17 stalled;
  fading only (`TX_RANGE_MAX=2`) → 6 won, 20 captured, 14 stalled; both → 12 won, 8
  captured, 10 dead air, 10 stalled. Fading alone is harsh (the Wake shrinks, and with it
  your shelter); growth is what pays for it. Policy comparison under both rules (X-6):
  leave-on-air 12 won, 10 dead air, median peak 45%; `--pull-early` 11 won, 15 captured,
  0 dead air, 14 stalled, median peak 42% — neither dominates.

### D-12 Wardens hunt the frontier — *Proposed*
- **Alternatives:** nearest awake block.
- **Why:** with blocking-only jam (D-5), a Warden inside an awake district does nothing.
  The frontier (a sleeping block touching an awake one) is exactly where a checkpoint
  matters. It also makes Wardens predictable — they go to the edge of the unrest.

### D-6 Five named, finite, retrievable rigs; plant and retrieve cost `PLANT_MP` — *Proposed*
- **Alternatives:** unlimited rigs restocked at a hideout; rigs consumed on use; a single
  rig.
- **Why:** loss aversion needs a finite stock that never refills, and guardianship needs
  names. Retrieval gives Hounds a counterplay, and with range growth (D-15) and fading
  (D-16) *when* to pull is the skill expression: early keeps the rig, late reaches farther
  and holds the district's edges. `PLANT_MP` is a third of a turn: enough that
  pulsing (plant/retrieve every turn) is expensive, cheap enough that a plant still leaves
  room to move away.

### D-7 Shelter and crowds: awake blocks hide @ and slow Sweepers — *Proposed*
- **Alternatives:** no sight model (Sweepers always know where @ is); a fog of war.
- **Why:** asymmetry — one hex, two meanings. The Wake becomes your cover, so the core
  feeds survival rather than competing with it (G-2). `SWEEPER_SIGHT` 3 means a careless
  @ in the gray is caught, a careful one isn't. `AWAKE_DRAG` makes deep plants safer, so
  big districts protect their own seeds (compounding).

### D-8 The Alert: a quota from the awake count, with recall — *Proposed, tuned by sim*
- **Alternatives:** time-based escalation; a ratchet (never recalls).
- **Why:** escalation tied to progress (G-2): your Wake summons the crackdown. Without
  recall the ratchet became a death spiral — five Sweepers stayed out over a city of
  zero awake blocks. Recall lets the Alert breathe with the Wake. Stations sit right of
  centre, so the left is quiet early and the end-game push is into the regime's teeth.
- **Evidence:** `Measured by: node test/sim.js 40` → 12 won, 8 captured, 10 dead air, 10
  stalled (400-loop cap); median turn 31; median peak awake 45%; median rigs lost 4 of 5.
  Bot wins come at heavy rig cost and its losses come close to the line — the near-miss
  band G-4 wants. A human player is expected to win more often; tune after playtest
  (halve/double).

### D-10 Sweeper kinds are one d6 template table — *Proposed*
- **Alternatives:** a type per kind; uniform Sweepers.
- **Why:** template, not snowflake: `{ name, mp, prefers }` rows. Mostly slow Wardens
  (frontier) and some Hounds/Hunters (rigs) gives the Hunters-vs-Wardens tension in
  DYNAMICS, and a rare 6-MP Hunter is dread (variable speed). MP printed on the counter
  reads like an old wargame movement factor.

### D-13 Capture is an event in the walk, seen or not — *Proposed*
- **Alternatives:** an end-of-turn adjacency check; hidden @ treated as a wall.
- **Why:** death should be an event — you watch the counter hop onto you. Treating a hidden
  @ as an obstacle would leak your position; letting a blind walk through you capture keeps
  shelter honest: it hides you from *pursuit*, not from *traffic*. It also makes "stand on
  your rig to guard it" self-defeating.

---

## Platform and presentation

### D-9 A 48 × 32 city and 6 MP — *Proposed*
- **Alternatives:** the base's 60 × 40.
- **Why:** smaller cities keep the Wake legible and the crossing to the far districts to a
  handful of turns. 6 MP is two Hound steps' worth of lead: you can outrun most Sweepers if
  you see them coming.

### D-11 The 1987 floppy presentation, and animating from events — *Decided (feel), Proposed (details)*
- **Alternatives:** the base's modern dark UI.
- **Why:** G-3. EGA 16 colors (gray tenements → magenta Wake reads at a glance), VT323,
  DOS double-line panels, scanlines, an INSERT DISK screen that also earns the user gesture
  WebAudio needs, a boot log with drive chatter, a copy-protection gag, PC-speaker cues.
  The regime phase animates from the engine's events (hops of `HOP_MS`, a `FLASH_MS` wake
  flash) because it's where consequences land.

### D-14 Forked from Hex & Counters with a fresh ID namespace — *Proposed*
- **Why:** this is a different game; the base's rows (wandering enemies, a target hex) no
  longer describe it. The base's seam, seeding, controls, and test layout are kept.

---

## Open questions

- **Q-1 Should stalling lose?** Nothing ends a game where every frontier is choked and the
  player stops finding bridges. Options: (a) leave it — the player can always start over;
  (b) a DAWN turn limit; (c) the regime escalates when the Wake hasn't grown for N turns.
  *Recommendation:* (a) until playtest shows humans actually stall (X-4); then (c), which
  is escalation tied to *lack* of progress and keeps the core central.
- **Q-2 Choose which rig to plant?** Today it's the first carried rig in roster order.
  *Recommendation:* keep — the rigs are mechanically identical, and the names are for
  mourning, not min-maxing.
- **Q-3 Can Hounds see every planted rig?** They can today (triangulation). Option: only
  rigs that are on air and waking something. *Recommendation:* keep for now; revisit if
  Hounds feel omniscient in playtest.
- **Q-4 Name and publisher.** "RADIO FREE SECTOR 9" by the fictional BITROT SOFTWORKS,
  © 1987. *Recommendation:* keep unless you have a favorite.

## Deliberately left out
- Combat against Sweepers — the only weapon is the broadcast (G-1).
- A hideout that restocks rigs — would undo loss aversion (D-6).
- Random wake chances — would undo readability (D-1).
