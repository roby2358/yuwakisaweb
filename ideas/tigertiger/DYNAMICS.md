# TIGER! TIGER! — Dynamics

A turn-based hunt adapted from Alfred Bester's *The Stars My Destination*.

## Theme

**Rage as a resource you can barely afford.** The player is not a hero — he is a
grudge with legs. The emotional experience: being hunted while hunting, and
discovering that the thing that makes you powerful (fury) is the same thing
that gives you away. Every escape tool is also a flare.

## Key Drivers

1. **Revenge as Fuel** — the entire objective structure is a manhunt for named
   Vorga crewmen. Losses (wounds) convert directly into power (rage).
2. **Information as Currency** — jaunting is gated on *memorized* locations;
   exploration literally builds your movement network. Informants sell you
   target locations. Every jaunte leaks your position to hunters.
3. **Escalating Commitment** — each crewman you confront raises the Manhunt
   level: more hunters, faster spawns. Progress makes the world worse.

## Key Mechanics (one per driver)

1. **Rage meter**: wounds and confessions raise rage; at maximum, TIGER mode
   fires for 5 turns — 3 actions per turn, jaunte to any *seen* tile, PyrE
   becomes detonable, but every hunter tracks your exact position live.
2. **Jaunte**: teleport to any previously *visited* tile for 1 action, but the
   arrival shockwave alerts every hunter within 7 tiles.
3. **Manhunt level**: +1 per crewman confronted; hunter spawn interval and cap
   scale with it, and each confrontation pings hunters toward the scene.

## Woven Secondary Mechanics

- **Radiation fields** (asymmetric terrain): hunters refuse to enter; Foyle can,
  but ending a turn there costs 1 vitality *and grants +3 rage* (the Burning
  Man). Weaves into rage: pain is a lever the player can deliberately pull to
  force TIGER mode. Driver: loss aversion vs. revenge, double-edged.
- **The Nomad wreck** (home base): start tile; ending a turn there heals 1.
  Weaves into jaunte: the wreck is always memorized, so it is the natural
  bolt-hole — but jaunting home still pings hunters near it. Driver:
  guardianship, landmarks as anchors.
- **Jaunte stages** (landmarks): public platforms where hunters materialize.
  Spawn escalation is visible on the map, not in a rulebook. Driver: readable
  consequences.
- **Informants**: one-use contacts who each reveal one crewman's location.
  Weaves into jaunte network: knowing *where* is useless until you've walked
  a route near it. Driver: information as currency.
- **PyrE**: one-use cache. Detonable **only in TIGER mode** (Will and Idea) —
  kills every hunter within 5 tiles and levels the ruins there (opens paths).
  Weaves into rage: the biggest windfall in the game is locked behind the most
  dangerous state in the game. Driver: accumulation and windfall.
- **Named hunters**: couriers (speed 1) and elite agents (speed 2, sharper
  eyes) with names — the log tells you *who* shot you. Driver: enemy identity,
  revenge.

## Mechanics as Code (gut-check)

- Jaunte: `if (tile.visited || (tiger && tile.seen)) move(); alertHuntersWithin(7, dest)`
- Rage: `rage += 3 on wound; += 2 on confession; += 1 if hunter visible; -= 1 if calm; if rage >= 10 → tigerTurns = 5`
- Manhunt: `on confront: manhunt++; spawnInterval = max(2, 8 - manhunt); cap = 3 + 2*manhunt`
- Radiation: terrain table row `{ foyleWalk: true, hunterWalk: false, endTurn: burn }`
- Hunters: alerted → A* toward last known position, walk `speed` steps; else patrol.

## Strategies

- **Early**: circle outward from the wreck, memorizing ground and finding
  informants before the manhunt heats up. Tension: every tile walked is a tile
  you can flee to later — exploration is armor.
- **Mid**: confront crewmen in an order that keeps a memorized escape line
  open; use radiation fields as hunter-proof corridors, paying vitality.
  Tension: heal at the wreck (safe, slow, pings when you jaunte home) vs.
  press on wounded (fast, fragile, rage-rich).
- **Late**: manhunt 5-6 floods the map. Deliberately tip into TIGER mode —
  ideally holding PyrE — to blast a corridor to the citadel through hunters
  who all know exactly where you are.
- **Anti-strategy — turtling at the wreck**: prevented mechanically: hunters
  keep spawning on an interval, patrol toward sightings, and the wreck heals
  only 1/turn while attacks cost 1 — camping loses ground. Objectives never
  come to you.
- **Anti-strategy — jaunte spam**: prevented by the ping: each jaunte drags
  every hunter within 7 tiles toward your arrival point. Chain-jaunting
  assembles a convention of hunters at your destination.
- **Anti-strategy — outracing instead of outplaying hunters**: hunters have
  information limits (sight 4, or your live position only in TIGER), terrain
  limits (no radiation, no ruins), and commitment (they walk to your *last
  known* position, then give up). Counterplay exists: break line of sight,
  duck into radiation, jaunte to a stale corner of the network.

## Tuning Notes

- Grid 22×15, sight 3 (Chebyshev), ping radius 7, hunter sight 4 (elite 6).
- Vitality 5, rage cap 10, TIGER 5 turns then rage resets to 2.
- 2 AP per turn (3 in TIGER); all actions cost 1 AP.
- Start: 2 couriers; spawn interval `max(3, 8 - manhunt)`; cap `3 + manhunt`.
- All values live in `js/artifacts.js` — halve/double there first.
- Simulation check (greedy pathfinding bot with mild hunter evasion, 100 seeds):
  37% wins, median win at turn 46. The original cap `3 + 2*manhunt` flooded the
  endgame (18% for the same bot) and was halved. A skilled human using jaunte
  escapes, informant routing, and PyrE should land comfortably above the bot.
