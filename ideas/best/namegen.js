// namegen.js — NameGen
//
// Seeded random name generator: syllables assembled from a phoneme style, so heroes
// sound heroic, holdings homely, and dooms wrong in the mouth — and a world's names
// reproduce from state.seed. Draws all randomness from Rando — must load after
// rando.js. Server-side shared lib: no DOM, no display concerns.
const NameGen = (function () {
    // onset + vowel (+ coda, at codaChance) per syllable, syllables per word in [min, max].
    const STYLES = {
        heroic: {  // the hero and their works: ringing and proud
            onsets: ['k', 'd', 'r', 'th', 'g', 'v', 'm', 'al', 'br', 's'],
            vowels: ['a', 'e', 'ae', 'o', 'i'],
            codas: ['n', 'r', 'l', 's', 'th', 'ric', 'wyn'],
            codaChance: 0.7, min: 2, max: 3
        },
        homely: {  // holdings of the small folk: liquid and open
            onsets: ['', 'l', 'm', 's', 'v', 'f', 'th', 'w', 'br', 'h'],
            vowels: ['a', 'e', 'ia', 'o', 'ai', 'ea'],
            codas: ['l', 'n', 'r', 'm', 'ford', 'wick', 'dale', 'mere'],
            codaChance: 0.6, min: 2, max: 3
        },
        dread: {   // lesser dooms: guttural and short
            onsets: ['kr', 'gr', 'br', 'sk', 'r', 'd', 'g', 'v', 'dr'],
            vowels: ['a', 'o', 'u', 'aa'],
            codas: ['k', 'g', 'sh', 'rn', 'x', 'r', 'gor'],
            codaChance: 0.7, min: 1, max: 2
        },
        eldritch: { // great dooms and their champions: wrong in the mouth
            onsets: ['vh', 'x', 'zz', 'ny', 'wr', 'yth', ''],
            vowels: ['o', 'uu', 'ei', 'oa', 'y'],
            codas: ['th', 'x', 'gn', 'l', 'rr'],
            codaChance: 0.6, min: 2, max: 3
        }
    };

    class NameGen {
        // One capitalized word in the given style, e.g. word('dread') -> "Kragorn".
        // Codas land only on the final syllable — interior codas pile up into
        // unpronounceable stacks.
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
