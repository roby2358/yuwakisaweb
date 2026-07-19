// namegen.js — NameGen
//
// Seeded villager names: rustic, pronounceable, mildly damp. Routes through Rando
// so a seed reproduces the same village.
const NameGen = (function () {
    const STARTS = ['Mar', 'Bet', 'Wen', 'Hal', 'Os', 'Tam', 'Ger', 'Ida', 'Rob', 'Sil', 'Ed', 'Bran', 'Nel', 'Gods', 'Per', 'Aldr', 'Hew', 'Mab', 'Cott', 'Dun'];
    const ENDS = ['en', 'ric', 'wyn', 'a', 'ott', 'ery', 'ild', 'stan', 'ny', 'is', 'red', 'yth', 'kin', 'ifer', 'ard', 'et'];

    class NameGen {
        static villager() {
            return Rando.choice(STARTS) + Rando.choice(ENDS);
        }
    }

    return NameGen;
})();
