// Seeded random: Park-Miller LCG returning a function in [0, 1).
var Rng = {
  make: function (seed) {
    return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  }
};
