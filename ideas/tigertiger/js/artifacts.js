'use strict';

// TIGER! TIGER! — static content and tuning constants.
// All balance numbers live here. Halve and double first.

var GameArtifacts = (function () {

  var TUNING = {
    GRID_W: 22,
    GRID_H: 15,
    SIGHT: 3,            // Foyle's sight radius (Chebyshev)
    PING_RADIUS: 7,      // jaunte arrival shockwave alert radius
    CONFRONT_PING: 10,   // alert radius when a crewman is confronted
    HP_MAX: 5,
    RAGE_MAX: 10,
    RAGE_WOUND: 3,
    RAGE_CONFESSION: 2,
    RAGE_HUNTED: 1,      // per turn a hunter is visible
    RAGE_AFTER_TIGER: 2,
    TIGER_TURNS: 5,
    AP_NORMAL: 2,
    AP_TIGER: 3,
    HUNTER_SIGHT: 4,
    ELITE_SIGHT: 6,
    ELITE_MANHUNT: 4,    // manhunt level at which elites join the hunt
    PYRE_RADIUS: 5,
    START_HUNTERS: 2,
    SPAWN_BASE: 8,       // spawn interval = max(2, SPAWN_BASE - manhunt)
    SPAWN_MIN: 3,
    HUNTER_CAP_BASE: 3,  // cap = base + manhunt
    RUIN_DENSITY: 0.18,
    RAD_DENSITY: 0.07,
    STAGE_COUNT: 4,
    MIN_CREW_DIST: 8     // crew spawn at least this far from the wreck
  };

  // Terrain table: one row per kind, no scattered conditionals.
  var TERRAIN = {
    OPEN:  { foyleWalk: true,  hunterWalk: true,  fill: '#161a26', edge: '#1d2333' },
    RUIN:  { foyleWalk: false, hunterWalk: false, fill: '#2a2320', edge: '#4a3b30' },
    RAD:   { foyleWalk: true,  hunterWalk: false, fill: '#12251a', edge: '#2f6b3a' },
    STAGE: { foyleWalk: true,  hunterWalk: true,  fill: '#101d2b', edge: '#2b5b7a' },
    WRECK: { foyleWalk: true,  hunterWalk: true,  fill: '#241a2b', edge: '#6a4a7a' }
  };

  var CREW = [
    { name: 'Ben Forrest',   city: 'Jaunte-slum, Jacksonville',
      confession: '"There was a passenger list, me. Somebody rich rode Vorga that run. I saw nothing, is all. Nothing!"' },
    { name: 'Rodger Kempsey', city: 'Bacteria works, Mars',
      confession: '"We took on refugees off Callisto. Six hundred. Took their money... and spaced them. Every one, God help."' },
    { name: 'Sergei Orel',   city: 'Quarantine row, Luna',
      confession: '"The order came down from the bridge, gospodin. The captain watched you burn in space and never blinked."' },
    { name: 'Angelo Poggi',  city: 'Spanish Stairs, Roma',
      confession: '"Not a captain — a commander. A woman ran Vorga that voyage. A lady of ice and snow, capisce?"' },
    { name: 'Lindsey Joyce', city: 'Skoptsy colony, Mars',
      confession: 'The Skoptsy cannot speak, cannot feel, cannot repent. But the name surfaces, terrible and clear: OLIVIA PRESTEIGN.' }
  ];

  var COURIER_NAMES = ['Kranz', 'Webb', 'Bunny', 'Sam Quatt', 'Keemah', 'Ras', 'Flatch', 'Orczy'];
  var ELITE_NAMES = ['Saul Dagenham', "Y'ang-Yeovil", 'Regis Sheffield', 'Central Intelligence'];

  var FOYLE_MUTTERS = [
    '"Vorga, I kill you filthy."',
    '"Gully Foyle is my name..."',
    '"I find you, Vorga. I find you, me."',
    '"One hundred and seventy days dying, and not dead."'
  ];

  var PORTRAITS = {
    calm: [
      ' .-------. ',
      '|  o   o  |',
      '|    L    |',
      '|  \\___/  |',
      " '-------' "
    ].join('\n'),
    simmer: [
      ' .-------. ',
      '| /o   o\\ |',
      '| \\  L  / |',
      '| /\\___/\\ |',
      " '-------' "
    ].join('\n'),
    tiger: [
      ' .-N?M-D-. ',
      '|//o   o\\\\|',
      '|\\\\  L  //|',
      '|//\\===/\\\\|',
      " '-------' "
    ].join('\n')
  };

  var QUATRAIN = [
    'Gully Foyle is my name',
    'And Terra is my nation.',
    'Deep space is my dwelling place,',
    'The stars my destination.'
  ];

  return {
    TUNING: TUNING,
    TERRAIN: TERRAIN,
    CREW: CREW,
    COURIER_NAMES: COURIER_NAMES,
    ELITE_NAMES: ELITE_NAMES,
    FOYLE_MUTTERS: FOYLE_MUTTERS,
    PORTRAITS: PORTRAITS,
    QUATRAIN: QUATRAIN
  };
})();
