// Monster roster: an adjective or adverb, then a body word from a character-trigram model
// trained on odd real words. Everything about a species is a pure function of its name.
(function (ID) {
  const N = ID.N;

  const ADJECTIVES = [
    'Gleefully', 'Brittle', 'Sullen', 'Politely', 'Damp', 'Furtive', 'Gilded', 'Hollow',
    'Quietly', 'Restless', 'Velvet', 'Crooked', 'Earnest', 'Lopsided', 'Patiently', 'Rancid',
    'Solemn', 'Tepid', 'Unwashed', 'Wistful', 'Briskly', 'Curdled', 'Dimly', 'Feral',
    'Grimly', 'Humming', 'Itchy', 'Jaunty', 'Knotted', 'Lurking', 'Moist', 'Nimbly',
    'Oddly', 'Pallid', 'Quilted', 'Rattling', 'Squelching', 'Tangled', 'Unbidden', 'Vexed',
    'Wobbly', 'Yawning', 'Zealous', 'Ashen', 'Bloated', 'Clammy', 'Dreadfully', 'Eerily',
    'Fussy', 'Gaunt', 'Haughty', 'Inky', 'Jittery', 'Lanky', 'Mumbling', 'Needlessly',
    'Ornery', 'Prickly', 'Smugly', 'Twitching', 'Utterly', 'Vaguely', 'Bashful', 'Clattering',
    'Drowsy', 'Fervently', 'Grumbling', 'Shrill', 'Sideways', 'Sticky', 'Mildewed', 'Tenderly',
    'Bristling', 'Overly', 'Spongy', 'Ceremonial', 'Unlicensed', 'Moonlit', 'Lukewarm', 'Rusted',
  ];

  // Latin anatomy, minerals, and far-off places: plausible-sounding, never fantasy clichés.
  const CORPUS = (
    'clavicle scapula sternum ossicle vertebra patella tibia fibula humerus femur sacrum coccyx ' +
    'mandible maxilla phalanx metacarpus tarsus cochlea stapes incus malleus thalamus cerebellum ' +
    'medulla pancreas duodenum jejunum ileum caecum pylorus esophagus trachea bronchus alveolus ' +
    'ventricle atrium aorta nasion glabella philtrum uvula epiglottis larynx pharynx sartorius ' +
    'gracilis soleus gastrocnemius deltoid trapezius latissimus pectoralis rhomboid omentum ' +
    'feldspar quartz gypsum olivine garnet beryl zircon malachite azurite cinnabar galena pyrite ' +
    'sphalerite chalcedony obsidian basalt gneiss schist dolomite calcite fluorite apatite corundum ' +
    'topaz tourmaline spodumene lepidolite vermiculite serpentine chrysotile bauxite hematite ' +
    'magnetite limonite cassiterite wolframite molybdenite stibnite realgar orpiment marcasite ' +
    'kyanite staurolite andalusite rhodonite smithsonite vanadinite wulfenite ' +
    'ulaanbaatar ouagadougou tegucigalpa reykjavik antananarivo vladivostok yakutsk kamchatka ' +
    'patagonia zanzibar timbuktu samarkand bukhara tashkent ashgabat dushanbe bishkek novosibirsk ' +
    'irkutsk murmansk arkhangelsk svalbard longyearbyen hammerfest kirkenes ilulissat qaanaaq ' +
    'iqaluit yellowknife unalaska kodiak ketchikan skagway wrangell nunavut tromso'
  ).split(' ');

  const SHAPES = ['squat', 'tall', 'wide', 'blob', 'spiky', 'stack'];

  function buildModel(words) {
    const model = {};
    for (const w of words) {
      const s = '^^' + w + '$';
      for (let i = 2; i < s.length; i++) {
        const k = s.substr(i - 2, 2);
        (model[k] = model[k] || []).push(s[i]);
      }
    }
    return model;
  }

  const MODEL = buildModel(CORPUS);
  const REAL = new Set(CORPUS);

  function genBody(rng) {
    for (let tries = 0; tries < 500; tries++) {
      let k = '^^', out = '';
      for (;;) {
        const c = rng.pick(MODEL[k]);
        if (c === '$' || out.length > 10) break;
        out += c;
        k = k[1] + c;
      }
      if (out.length >= 4 && out.length <= 9 && !REAL.has(out)) return out[0].toUpperCase() + out.slice(1);
    }
    return 'Blorb';
  }

  // Base stats come from the adjective + body; abilities multiply them and add a title.
  function makeSpecies(adjective, body, abilities) {
    const base = adjective + ' ' + body;
    const abs = abilities.map(a => ID.ABILITIES[a]);
    const prod = key => abs.reduce((m, a) => m * a[key], 1);
    const name = [base].concat(abs.map(a => a.title)).join(' ');
    const hb = ID.hashStr(body);
    const r = new ID.Rng(ID.hashStr(base));
    const hue = hb % 360, sat = 45 + (hb >>> 9) % 35, lit = 48 + (hb >>> 17) % 14;
    const hpMult = r.range(N.SPECIES_MIN, N.SPECIES_MAX), dmgMult = r.range(N.SPECIES_MIN, N.SPECIES_MAX);
    const blob = [];
    const br = new ID.Rng(hb);
    for (let i = 0; i < 5; i++) blob.push([br.range(-0.6, 0.6), br.range(-0.6, 0.4)]);
    return {
      name, adjective, body,
      color: `hsl(${hue},${sat}%,${lit}%)`,
      dark: `hsl(${hue},${sat}%,${lit - 22}%)`,
      shape: SHAPES[(hb >>> 5) % SHAPES.length],
      size: (8 + 5 * hpMult) * prod('size'),
      hpMult: hpMult * prod('hp'),
      dmgMult: dmgMult * prod('dmg'),
      xpMult: hpMult * dmgMult * prod('xp'),
      speedMult: r.range(N.SPECIES_MIN, N.SPECIES_MAX),
      blob,
      abilities,
      labelColor: abs.length ? abs[abs.length - 1].labelColor : null,
    };
  }

  function makeRoster(seed) {
    const rng = new ID.Rng(ID.hash(seed, 'roster'));
    const names = new Set(), pairs = [];
    while (pairs.length < N.ROSTER_SIZE) {
      const adj = rng.pick(ADJECTIVES), body = genBody(rng);
      if (names.has(adj + ' ' + body)) continue;
      names.add(adj + ' ' + body);
      pairs.push([adj, body]);
    }
    // Hand out abilities to distinct roster slots.
    const abilities = pairs.map(() => []);
    const free = pairs.map((_, i) => i);
    for (const [ab, count] of Object.entries(N.ROSTER_ABILITIES)) {
      for (let k = 0; k < count && free.length; k++) abilities[free.splice(rng.int(0, free.length - 1), 1)[0]].push(ab);
    }
    return pairs.map(([adj, body], i) => makeSpecies(adj, body, abilities[i]));
  }

  ID.makeRoster = makeRoster;
  ID.makeSpecies = makeSpecies;
  ID.SHAPES = SHAPES;
})(this.ID = this.ID || {});
