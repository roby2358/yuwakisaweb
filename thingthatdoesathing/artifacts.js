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
    //            it sinks only if it comes down on water. Every flight (and every `clears`
    //            shot) that comes down on slick ground (bare ice or a Slide) skids on, on the
    //            ground, full range or short, unless it splatted a gremlin (D-17, D-37)
    //   overMountains — a flying push that passes over mountains too; it can't come down on
    //            one, so it lands on the last hex short of it that it flew over (D-35)
    //   clears — how many hexes of its push pass over everything (water, mountains, Walls,
    //            pieces, targets, Traps): the shot touches nothing on them, and the rest of the
    //            push goes on the ground from the last one. Stopped right after them, it comes
    //            down on that last cleared hex if the ground there could take it, or doesn't
    //            fire; a path off the map doesn't fire either (D-36)
    //   blocks — pieces can't enter
    //   traps  — a piece that splats dies when it comes onto it (walked, pushed, slid, or
    //            landing from a flight; a flight passing over doesn't count)
    //   colored — placed in an open crate color the player picks, never white (it acts only
    //            on crates of that color, and on every gremlin); its card is drawn plain, and
    //            not while only one color is open (D-22, D-32)
    //   slides — a piece that comes onto it on the ground keeps going the same way, free,
    //            like bare ice (and a flight or shot that comes down on it skids on)
    //   on     — 'land' (plains/ice), 'water', or 'unslick' (plains or water: not bare ice,
    //            which already slides, D-29): where it may be built
    //   weight — relative draw chance for the hand
    const THINGS = {
        BELT:    { push: 1, pull: 0, shove: 0, splat: false, flies: false, overMountains: false, clears: 0, blocks: false, traps: false, colored: false, slides: false, on: 'land',  weight: 6 },
        SPRING:  { push: 3, pull: 0, shove: 0, splat: false, flies: true,  overMountains: true,  clears: 0, blocks: false, traps: false, colored: false, slides: false, on: 'land',  weight: 2 },
        ROCKET:  { push: 8, pull: 0, shove: 0, splat: true,  flies: true,  overMountains: false, clears: 0, blocks: false, traps: false, colored: false, slides: false, on: 'land',  weight: 1 },
        PUSHER:  { push: 0, pull: 0, shove: 1, splat: false, flies: false, overMountains: false, clears: 0, blocks: false, traps: false, colored: true,  slides: false, on: 'land',  weight: 0.5 },
        PULLER:  { push: 0, pull: 1, shove: 0, splat: false, flies: false, overMountains: false, clears: 0, blocks: false, traps: false, colored: true,  slides: false, on: 'land',  weight: 0.5 },
        WALL:    { push: 0, pull: 0, shove: 0, splat: false, flies: false, overMountains: false, clears: 0, blocks: true,  traps: false, colored: false, slides: false, on: 'land',  weight: 2 },
        TRAP:    { push: 0, pull: 0, shove: 0, splat: false, flies: false, overMountains: false, clears: 0, blocks: false, traps: true,  colored: false, slides: false, on: 'land',  weight: 1 },
        BRIDGE:  { push: 1, pull: 0, shove: 0, splat: false, flies: false, overMountains: false, clears: 0, blocks: false, traps: false, colored: false, slides: false, on: 'water', weight: 1 },
        SLIDE:   { push: 0, pull: 0, shove: 0, splat: false, flies: false, overMountains: false, clears: 0, blocks: false, traps: false, colored: false, slides: true,  on: 'unslick', weight: 2 },
        CANNON:  { push: 5, pull: 0, shove: 0, splat: false, flies: false, overMountains: false, clears: 4, blocks: false, traps: false, colored: false, slides: false, on: 'land',  weight: 1 },
    };

    // The order cards unlock in (R-49). A new game deals only from the first step; each
    // milestone opens the next step the board can ever deal from (a step of only `colored`
    // kinds is passed over on a board with one color, since those are never drawn there).
    // Every THINGS kind is in exactly one step; past the last step nothing more unlocks.
    const UNLOCKS = [
        ['BELT', 'BRIDGE', 'WALL', 'TRAP'],
        ['PUSHER', 'PULLER'],
        ['SLIDE'],
        ['SPRING'],
        ['ROCKET'],
        ['CANNON'],
    ];

    // Piece templates, keyed by Piece.kind:
    //   label   — the counter's glyph (gremlins; crates draw as a box)
    //   cargo   — delivered on reaching the target; counted as lost when it sinks
    //   value   — how many crates it's worth: what a delivery adds to `delivered` (and its
    //             target's count), and what losing it (sunk, wrecked, blasted) adds to `lost` (D-34)
    //   wanders   — takes a random step on a tick when no Thing moved it
    //   splats    — a splatting push (the Rocket) destroys it: the piece it lands on, and the
    //               piece it launches once that one lands; so does coming onto a Trap
    //   wrecks    — its own wandering step into a cargo piece's hex destroys that piece (lost)
    //               and takes the hex; being pushed, pulled or flung into one doesn't
    //   reemerges — when one sinks or splats (counted in exGremlins or trapped), a new one climbs out on a shore hex at the end
    //               of the tick
    const PIECES = {
        crate:    { label: '📦', cargo: true,  value: 1,  wanders: false, splats: false, wrecks: false, reemerges: false },
        bigcrate: { label: '📦', cargo: true,  value: 10, wanders: false, splats: false, wrecks: false, reemerges: false },
        gremlin:  { label: '👹', cargo: false, value: 0,  wanders: true,  splats: true,  wrecks: true,  reemerges: true },
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

    const CRATE_CAP_PER_ROOT = 0.6;   // crates of the board's cap per hex of sqrt(board area)

    // How many crates a board size holds at once before any milestone: CRATE_CAP_PER_ROOT times
    // the square root of its area, rounded, at least one: small 8, medium 12, large 18, huge 36.
    // Each milestone reached adds one (D-31, R-19).
    const crateCap = size => Math.max(1, Math.round(CRATE_CAP_PER_ROOT * Math.sqrt(MAP_SIZES[size].cols * MAP_SIZES[size].rows)));

    // How many milestones `delivered` crates have reached (0 below FIRST_MILESTONE).
    const milestonesReached = delivered => {
        let n = 0;
        for (let m = nextMilestone(0); m <= delivered; m = nextMilestone(m)) n++;
        return n;
    };

    const BIG_CRATE_HALF = 4;   // milestones reached at which half the spawns are big crates

    // The chance a spawned crate is a big crate (D-34, R-52), with `m` milestones reached:
    // m / (m + BIG_CRATE_HALF). None before the first milestone, 1 in 5 after it, half at
    // BIG_CRATE_HALF, and on toward 1 without reaching it.
    const bigCrateChance = m => m / (m + BIG_CRATE_HALF);

    // Does this kind of Thing have a facing (it pushes, pulls or shoves)? Only those can be turned.
    const aims = kind => THINGS[kind].push > 0 || THINGS[kind].pull > 0 || THINGS[kind].shove > 0;

    return {
        TERRAIN,
        THINGS,
        UNLOCKS,
        PIECES,
        CRATE_COLORS,
        WHITE,
        aims,
        nextMilestone,
        gremlinDice,
        crateCap,
        milestonesReached,
        bigCrateChance,
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
        SPAWN_INTERVAL: 3,           // ticks between spawn chances, board-wide (a crate comes if under the cap and the rolled color's source is clear)
        CRATE_CAP_PER_ROOT,
        BIG_CRATE_HALF,
        ENHANCE_CHANCE: 0.5,         // a newly opened color comes out of an existing source, else a new one
        HAND_SIZE: 3,
        BUMP_ADVANCE: 2,             // hexes a bumped line advances; its bumper follows to one behind it (D-33)
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
