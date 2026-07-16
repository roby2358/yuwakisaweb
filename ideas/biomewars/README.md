# Biome Wars

An alien planet is at war with itself. Living biomes — some lush, some inhospitable,
some outright hostile — grind against each other hex by hex, their fronts pushed by the
auras of settlements and blights. You are one small hero thriving in the cracks:
gather essence, learn skills and talents, feed the settlements that shelter you, hunt
the creatures that hunt you, and cleanse the blights that drive the enemy tide.

The war never ends. The world persists (saved every turn, resumed on relaunch), blights
left alone grow without limit, and cleansing the last one only buys a golden age before
the planet convulses and erupts anew — bigger each time. Defeat comes only when the
last settlement falls.

Built on the [Hex & Counters](../hexandcounter/) baseline. Design rationale and all the
numbers live in `DYNAMICS.md`; the controls specification is `UI_CONTROLS.md`.

## Running

No build or install step — **double-click `index.html`**. (Scripts are plain globals,
so `file://` works; serving over HTTP is fine too.)

## UI

- **Click @** to select the hero — yellow hexes are reachable, red are attackable
  (adjacent creatures and blights). Click a highlighted hex to move or strike.
- **Gather (G)** harvests essence from the hex underfoot — draining its vitality,
  weakening whoever owns it, and taking the rest of your turn: you camp where you
  harvest.
- **Feed (F)** spends 10 essence on the settlement you stand in: prosperity is aura
  power, and aura power is the war.
- **Talents (T)** opens the skill panel — spend essence on permanent levels.
- **Space/Enter** ends the turn; the world phase resolves (creatures, sieges, the
  biome war itself) and the game saves.
- **Right-drag** pans. **Hover** reads out any hex: biome, vitality, hazard, yield,
  creatures, settlements, blights. **Esc** peels back one layer of UI.

Hexes darken as their vitality drains — the sickly bands *are* the front lines.
