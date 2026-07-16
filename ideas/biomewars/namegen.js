// namegen.js — NameGen
//
// Seeded random name generator: syllables assembled from a phoneme style, so each
// culture (biome) sounds like itself and a world's names reproduce from state.seed.
// Draws all randomness from Rando — must load after rando.js. Server-side shared lib:
// no DOM, no display concerns.
const NameGen = (function () {
    // onset + vowel (+ coda, at codaChance) per syllable, syllables per word in [min, max].
    const STYLES = {
        soft: {   // meadow folk: liquid and open
            onsets: ['', 'l', 'm', 's', 'v', 'f', 'th', 'w', 'br'],
            vowels: ['a', 'e', 'ia', 'o', 'ai', 'ea'],
            codas: ['l', 'n', 'r', 'm', 'le', 'ss'],
            codaChance: 0.4, min: 2, max: 3
        },
        fungal: { // spore folk: damp and humming
            onsets: ['m', 'sp', 'f', 'gl', 'v', 'dr', 'sh', 'b'],
            vowels: ['y', 'u', 'o', 'oo', 'e'],
            codas: ['th', 'm', 'sh', 'll', 'x', 'ng'],
            codaChance: 0.5, min: 2, max: 3
        },
        crystal: { // crystal folk: sharp and ringing
            onsets: ['k', 'z', 'x', 'v', 'q', 'sh', 't'],
            vowels: ['y', 'i', 'a', 'ei', 'ia'],
            codas: ['x', 'th', 'n', 'r', 'k'],
            codaChance: 0.6, min: 2, max: 3
        },
        ash: {    // the waste: guttural and short
            onsets: ['kr', 'gr', 'br', 'sk', 'r', 'd', 'g', 'v'],
            vowels: ['a', 'o', 'u', 'aa'],
            codas: ['k', 'g', 'sh', 'rn', 'x', 'r'],
            codaChance: 0.7, min: 1, max: 2
        },
        eldritch: { // the writhe: wrong in the mouth
            onsets: ['vh', 'x', 'zz', 'ny', 'wr', 'yth', ''],
            vowels: ['o', 'uu', 'ei', 'oa', 'y'],
            codas: ['th', 'x', 'gn', 'l', 'rr'],
            codaChance: 0.6, min: 2, max: 3
        }
    };

    class NameGen {
        // One capitalized word in the given style, e.g. word('ash') -> "Kragorn".
        // Codas land only on the final syllable — interior codas pile up into
        // unpronounceable stacks ("Shiathsheithxia").
        static word(style) {
            const s = STYLES[style];
            const syllables = Rando.int(s.min, s.max);
            let out = '';
            for (let i = 0; i < syllables; i++) {
                out += Rando.choice(s.onsets) + Rando.choice(s.vowels);
                if (i === syllables - 1 && Rando.bool(s.codaChance)) out += Rando.choice(s.codas);
            }
            return out.charAt(0).toUpperCase() + out.slice(1);
        }

        // A word guaranteed not to collide with `used` (a Set the caller owns);
        // adds the result to the set. Gives up on uniqueness after a few tries —
        // a rare duplicate beats an infinite loop.
        static uniqueWord(style, used) {
            for (let i = 0; i < 10; i++) {
                const w = NameGen.word(style);
                if (!used.has(w)) { used.add(w); return w; }
            }
            return NameGen.word(style);
        }
    }

    return NameGen;
})();
