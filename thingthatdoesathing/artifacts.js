// artifacts.js — GameArtifacts
//
// Static rules-data: terrain, the Thing templates, and every tunable number the engine
// reasons over. Server-side: no colors, no pixels. Display attributes live in
// GameDisplayArtifacts. Every number here is listed by name in ONTOLOGY.md's Numbers table.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        WATER: 0,
        PLAINS: 1,
        MOUNTAIN: 2,
        ICE: 3
    };

    // Thing templates. Every kind is a parameter set, not a code path:
    //   push   — hexes it shoves the piece standing on it, in its facing
    //   pull   — hexes it pulls the piece on the far hex (two ahead) back into the near hex
    //   shove  — hexes it pushes the piece on the near hex (the one it faces) on, in its facing
    //   splat  — its push splats what it lands on and what it launches, if that piece splats
    //   flies  — its push is airborne: it passes over inland open water (only the outer sea,
    //            an edge hex, takes it), every hex counts (ice is no shortcut mid-air), and
    //            it sinks only if it comes down on water
    //   skids  — a flying push that comes down on bare ice slides on, like any piece on ice
    //   blocks — pieces can't enter
    //   traps  — a piece that splats dies when it comes onto it (walked, pushed, slid, or
    //            landing from a flight; a flight passing over doesn't count)
    //   colored — its card always comes in an open crate color, never white (it acts only
    //            on crates of that color, and on every gremlin); not drawn while only one
    //            color is open
    //   on     — 'land' (plains/ice) or 'water': where it may be built
    //   weight — relative draw chance for the hand
    const THINGS = {
        BELT:    { push: 1, pull: 0, shove: 0, splat: false, flies: false, skids: false, blocks: false, traps: false, colored: false, on: 'land',  weight: 6 },
        SPRING:  { push: 3, pull: 0, shove: 0, splat: false, flies: true,  skids: true,  blocks: false, traps: false, colored: false, on: 'land',  weight: 2 },
        ROCKET:  { push: 8, pull: 0, shove: 0, splat: true,  flies: true,  skids: false, blocks: false, traps: false, colored: false, on: 'land',  weight: 1 },
        PUSHER:  { push: 0, pull: 0, shove: 1, splat: false, flies: false, skids: false, blocks: false, traps: false, colored: true,  on: 'land',  weight: 0.5 },
        PULLER:  { push: 0, pull: 1, shove: 0, splat: false, flies: false, skids: false, blocks: false, traps: false, colored: true,  on: 'land',  weight: 0.5 },
        WALL:    { push: 0, pull: 0, shove: 0, splat: false, flies: false, skids: false, blocks: true,  traps: false, colored: false, on: 'land',  weight: 2 },
        TRAP:    { push: 0, pull: 0, shove: 0, splat: false, flies: false, skids: false, blocks: false, traps: true,  colored: false, on: 'land',  weight: 1 },
        BRIDGE:  { push: 1, pull: 0, shove: 0, splat: false, flies: false, skids: false, blocks: false, traps: false, colored: false, on: 'water', weight: 1 },
    };

    // Piece templates, keyed by Piece.kind:
    //   label   — the counter's glyph (gremlins; crates draw as a box)
    //   cargo   — delivered on reaching the target; counted as lost when it sinks
    //   wanders   — takes a random step on a tick when no Thing moved it
    //   splats    — a splatting push (the Rocket) destroys it: the piece it lands on, and the
    //               piece it launches once that one lands; so does coming onto a Trap
    //   wrecks    — its own wandering step into a cargo piece's hex destroys that piece (lost)
    //               and takes the hex; being pushed, pulled or flung into one doesn't
    //   reemerges — when one sinks or splats (counted in exGremlins or trapped), a new one climbs out on a shore hex at the end
    //               of the tick
    const PIECES = {
        crate:   { label: '📦', cargo: true,  wanders: false, splats: false, wrecks: false, reemerges: false },
        gremlin: { label: '👹', cargo: false, wanders: true,  splats: true,  wrecks: true,  reemerges: true },
    };

    // The colors a game can open, one at a time. Each open color has one target, which
    // takes only its color's crates, and comes out of one source (a source may make several).
    const CRATE_COLORS = ['red', 'green', 'blue', 'yellow'];
    // The color of every Thing that isn't keyed to one crate color: it acts on every piece.
    const WHITE = 'white';

    // The next milestone above `delivered`: 10, 20, 50, 100, 200, 500, 1000, … (the 1-2-5
    // series from FIRST_MILESTONE). There's no last one; the factory runs forever.
    const FIRST_MILESTONE = 10;   // crates
    const MILESTONE_STEPS = [1, 2, 5];
    const nextMilestone = delivered => {
        for (let decade = FIRST_MILESTONE; ; decade *= 10) {
            const m = MILESTONE_STEPS.map(k => k * decade).find(v => v > delivered);
            if (m !== undefined) return m;
        }
    };

    // Board sizes offered at New Game, in menu order. `heightmap` is the diamond-square
    // grid side (2^n + 1, at least the board's longer side); `knownGoodSeed` has a
    // source→target path on its first attempt at that size (R-23); `colors` is how many
    // CRATE_COLORS the board can open, one more per milestone (R-38).
    const MAP_SIZES = {
        small:  { cols: 16, rows: 10, heightmap: 33, knownGoodSeed: 1, colors: 1 },
        medium: { cols: 20, rows: 20, heightmap: 33, knownGoodSeed: 1, colors: 2 },
        large:  { cols: 30, rows: 30, heightmap: 33, knownGoodSeed: 1, colors: 3 },
        huge:   { cols: 60, rows: 60, heightmap: 65, knownGoodSeed: 1, colors: 4 },
    };

    const GREMLIN_HEXES_PER_DIE = 160;   // one die of gremlins per this many board hexes (the small board's area)

    // How many dice of gremlins a board size starts with: one per GREMLIN_HEXES_PER_DIE of
    // its area, rounded, at least one. Small 1, medium 3, large 6, huge 23.
    const gremlinDice = size => Math.max(1, Math.round(MAP_SIZES[size].cols * MAP_SIZES[size].rows / GREMLIN_HEXES_PER_DIE));

    // Does this kind of Thing have a facing (it pushes, pulls or shoves)? Only those can be turned.
    const aims = kind => THINGS[kind].push > 0 || THINGS[kind].pull > 0 || THINGS[kind].shove > 0;

    return {
        TERRAIN,
        THINGS,
        PIECES,
        CRATE_COLORS,
        WHITE,
        aims,
        nextMilestone,
        gremlinDice,
        // Passability for Board: land is enterable, water and mountain are not. Water
        // still *accepts* a pushed piece (it sinks); that's the step rule, not this table.
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.ICE]: 1
        },
        MAP_SIZES,

        FIRST_MILESTONE,
        SOURCE_INTERVAL: 3,          // ticks between crates, board-wide (if the rolled color's source is clear)
        ENHANCE_CHANCE: 0.5,         // a newly opened color comes out of an existing source, else a new one
        HAND_SIZE: 3,
        IDLE_REDRAW_TICKS: 10,       // ticks in a row with no card used (place or discard) before one random card is redrawn
        GREMLIN_HEXES_PER_DIE,
        GREMLIN_DICE_SIDES: 4,

        // ---- Map generation ----
        GEN_MAX_ATTEMPTS: 10,
        HEIGHTMAP_ROUGHNESS: 0.55,
        WATER_PCT: 0.18,             // elevation percentile: below → water
        MOUNTAIN_PCT: 0.90,          //   at/above → mountain
        ICE_FRAC: 0.08,              // of inner hexes, carved out of plains
        PLACE_SLICE_FRAC: 0.05,      // source/target from this end-fraction of passable hexes by col
        PLACE_SLICE_MIN: 3,
    };
})();
