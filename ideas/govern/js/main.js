// CHARTER — bootstrap. Seed from ?seed= for reproducible regencies.

(function () {
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed');
  const seed = seedParam === null ? (Math.random() * 0x7fffffff) | 0 : Number(seedParam) | 0;
  CharterUI.bind();
  CharterUI.start(seed);
})();
