// config.js — The Night of the Simoor: game constants
//
// The 7 terrain slots of the base hex game are re-skinned as court ZONES. Each zone
// carries four parallel lookups keyed by the zone id: move cost (Poise), a Scandal
// multiplier (how public the zone is), a glamour weight (how strongly masked figures
// drift toward it), and display color/name. See DYNAMICS.md.

export const HEX_SIZE = 24;

// Zone ids reuse the base terrain slots so map generation is unchanged.
export const ZONE = {
    POOL: 0,        // wall (reflecting pool)
    PROMENADE: 1,   // default floor
    COLONNADE: 2,   // the watched route — costs extra Poise
    FOUNTAIN: 3,    // wall (fountain / orchestra dais)
    GARDEN: 4,      // private; cheap Scandal; figures rarely stray here
    BALLROOM: 5,    // glamour; the Sovereign's haunt; Scandal is loud here
    ALCOVE: 6       // shadowed shortcut; misbehave here unseen
};

// Cost to enter a zone (Poise). Walls are Infinity.
export const ZONE_COST = {
    [ZONE.POOL]: Infinity,
    [ZONE.PROMENADE]: 1,
    [ZONE.COLONNADE]: 2,
    [ZONE.FOUNTAIN]: Infinity,
    [ZONE.GARDEN]: 1,
    [ZONE.BALLROOM]: 1,
    [ZONE.ALCOVE]: 1
};

// How much a botched woo's Scandal is amplified by how public the zone is. Never below
// 1.0 — wooing is never "free", or blind-wooing every figure becomes a no-risk strategy.
// (Private-zone discounts return in v2 for CHARMING guards, which has no such exploit.)
export const ZONE_SCANDAL = {
    [ZONE.POOL]: 1,
    [ZONE.PROMENADE]: 1,
    [ZONE.COLONNADE]: 1.3,
    [ZONE.FOUNTAIN]: 1,
    [ZONE.GARDEN]: 1,
    [ZONE.BALLROOM]: 1.6,
    [ZONE.ALCOVE]: 1
};

// Glamour weight that biases where masked figures wander. Higher = more crowd-pleasing.
export const ZONE_GLAMOUR = {
    [ZONE.POOL]: 0,
    [ZONE.PROMENADE]: 3,
    [ZONE.COLONNADE]: 2,
    [ZONE.FOUNTAIN]: 0,
    [ZONE.GARDEN]: 1,
    [ZONE.BALLROOM]: 6,
    [ZONE.ALCOVE]: 0
};

// ---- Tuning (halve-and-double first, then find the feel) ----
export const POISE = 5;          // your movement points per turn
export const RIVAL_POISE = Math.floor(POISE / 2);  // the Vicomte moves at half your pace
export const MAX_TURNS = 16;     // dawn — the night ends here
export const FIGURE_COUNT = 6;   // masked figures: 1 Sovereign + 5 impostors
export const SCANDAL_CAP = 10;   // hit this and the Veil-Wardens throw you out
export const WOO_SCANDAL = 5;    // base Scandal of a botched woo (half the cap), pre-zone
// The crowd: 12 revelers wander and block. Some carry a claimable token. GOSSIP_COUNT <
// impostors (5), so gossips alone can never reach certainty — every night ends on a woo.
export const REVELER_COUNT = 12;
export const GOSSIP_COUNT = 4;   // revelers carrying a Gossip (claim -> unmask an impostor)
export const FAVOR_COUNT = 4;    // revelers carrying a Favor (first one claimed by anyone
                                 // flushes the disguised Sovereign into view)

export const MAP_COLS = 28;
export const MAP_ROWS = 20;

// ---- Display constants ----
export const COUNTER_SIZE = 28;

// Pool (blue) and Fountain (white) are fixed; the other five are generated each night by
// ColorTheory (see generatePalette in index.js) and these values are only fallbacks.
export const ZONE_COLORS = {
    [ZONE.POOL]: '#06104a',
    [ZONE.PROMENADE]: '#8a5a66',
    [ZONE.COLONNADE]: '#6b5a8a',
    [ZONE.FOUNTAIN]: '#ffffff',
    [ZONE.GARDEN]: '#2f5d4a',
    [ZONE.BALLROOM]: '#b8923c',
    [ZONE.ALCOVE]: '#3a3340'
};

export const ZONE_NAMES = {
    [ZONE.POOL]: 'Reflecting Pool',
    [ZONE.PROMENADE]: 'Promenade',
    [ZONE.COLONNADE]: 'Watched Colonnade',
    [ZONE.FOUNTAIN]: 'Fountain',
    [ZONE.GARDEN]: 'Moonlit Garden',
    [ZONE.BALLROOM]: 'Ballroom',
    [ZONE.ALCOVE]: 'Shadowed Alcove'
};

export const PLAYER_COLOR = '#f0c850';   // you — gold
export const RIVAL_COLOR = '#c850c8';    // the Vicomte de Vavoom — magenta
export const FIGURE_COLOR = '#3aa0d0';   // a masked suspect — sapphire
export const UNMASKED_COLOR = '#555a60'; // a revealed impostor — grey
export const INFORMANT_COLOR = '#d8b048'; // a gossip — amber
