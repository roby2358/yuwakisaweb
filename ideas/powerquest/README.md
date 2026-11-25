# Power Quest

A browser hex-and-counter game. Civilization has fallen; tribes live primitively among relic tech. You are a
villager who found an ancient set of **power armor**. Range a fogged wilderness of plains, jungle and flat-topped
mesas, hunt the powered monsters and raiders that menace the villages, craft relic parts into armor modules, and
level up: yourself and your villages. The game does not end. When you are strong enough, you may leave and
found a new village.

Open `index.html` (double-click; no build step). Tests: `node test/run.js`. Bot sim: `node test/sim.js 500 8`.

Design: [DYNAMICS.md](DYNAMICS.md) (why it works) · [ONTOLOGY.md](ONTOLOGY.md) (the reference) ·
[CRITERIA.md](CRITERIA.md) · [RATIONALE.md](RATIONALE.md) · [ARCHITECTURE_LOG.md](ARCHITECTURE_LOG.md).

## Playing

- **Click a yellow hex** to move (jungle costs 2, mesa 3). **Click a red enemy** next to you to melee it.
- **1–6** arm a weapon (then click an orange target) or fire an active module. **Right-click** or **Esc** disarms.
- **B** boosts: 1 charge becomes 1 extra move. **Space** ends the turn. **F** founds a village. **Drag** pans.
- Stand on an **open village** to rest, give salvage (raises its tier and trust) and craft modules. Other villages
  open once you have hunted what threatens them. Ruins hold blueprints and recharge you.
- Level-ups ask you to pick a perk and eventually unlock more module sockets.
- If your armor shuts down you wake depleted in a village, minus half your pack and half your xp toward the next
  level. The monster that did it is marked with a skull.
