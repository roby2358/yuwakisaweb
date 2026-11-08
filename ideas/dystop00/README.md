# RADIO FREE SECTOR 9

*BITROT SOFTWORKS presents — an insurrection simulation. © 1987. Disk 1 of 2.*

Sector 9 sleeps under forty years of state broadcast. You are `@`, a pirate radio operator
with five hand-built transmitters. Plant them where the tenements are thick, and the
woken blocks will wake their neighbors. A rig reaches farther every turn it stays on air,
and holds up the ragged edges of what it woke — but every turn on air is a turn for the
Sweepers to find it. Wake **half the city at once** and the Ministry
falls. Every woken block raises the Alert, and the Sweepers come for your rigs and for you.

**Double-click `index.html` to play.** No build, no install.

- [DYNAMICS.md](DYNAMICS.md): why it's fun (one core dynamic, two feeding it).
- [ONTOLOGY.md](ONTOLOGY.md): the rules, the implementation reference.
- [CRITERIA.md](CRITERIA.md) / [RATIONALE.md](RATIONALE.md) / [ARCHITECTURE_LOG.md](ARCHITECTURE_LOG.md)

Built on the Hex & Counters base platform.

## Controls

- **Click `@`** to select it, then click a yellow hex to move. Left-drag pans.
- **T** transmits (plants a rig here, 2 MP); **R** retrieves the rig here (2 MP).
- With a rig in hand, hover a hex to see in cyan what a rig there would wake.
- Hover a planted rig to see its range and, shaded black, what would fade if you pulled it.
- **Space / Enter** ends the turn: broadcast, then the regime moves. **C** recenters, **Esc** deselects.

## Reading the city

| You see | It means |
|---|---|
| Mid-gray hex | A sleeping tenement block: tinder |
| Magenta hex | An awake block: it hides you and slows Sweepers |
| Light gray / dark gray / rust | Plaza / factory / ruins: firebreaks |
| Blue / green | Toxic canal / arcology: impassable |
| Cyan counter, dashed ring | A planted rig and its broadcast range (it widens each turn on air) |
| Red counter with a number | A Sweeper and its MP (WARDEN 3 · HOUND 4 · HUNTER 6) |
| Red tint | Jammed air: nothing wakes there, and rigs there are silent |
| Dashed red line | Where a Sweeper is headed |

## Tests

`node test/run.js` runs the rule tests. `node test/sim.js 40` runs the bot, and
`node test/sim.js 40 --maps` runs the cascade study.
