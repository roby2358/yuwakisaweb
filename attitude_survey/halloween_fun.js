const halloweenFunTheme = {
    name: "Halloween Fun",
    intro: "How much do you embrace the spirit of Halloween? This survey explores your feelings about spooky creatures, scary entertainment, and festive frights. Answer honestly and discover your inner ghoul.",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Spooky Creatures",
            positive: true,
            questions: [
                { text: "I find spiders fascinating.", positive: true },
                { text: "Bats are wonderful animals.", positive: true },
                { text: "I would enjoy owning a black cat.", positive: true },
                { text: "Snakes make me curious, not scared.", positive: true },
                { text: "I think rats get a bad reputation.", positive: true },
                { text: "I squish bugs without hesitation.", positive: false },
                { text: "I avoid walking under trees at night because of bats.", positive: false }
            ]
        },
        {
            name: "Scary Entertainment",
            positive: true,
            questions: [
                { text: "I enjoy watching horror movies.", positive: true },
                { text: "Haunted houses are exciting.", positive: true },
                { text: "I like reading scary stories before bed.", positive: true },
                { text: "Jump scares are fun.", positive: true },
                { text: "I prefer comedies over thrillers.", positive: false },
                { text: "I cover my eyes during tense movie scenes.", positive: false },
                { text: "Scary music makes me anxious.", positive: false }
            ]
        },
        {
            name: "Safety Concerns",
            positive: false,
            questions: [
                { text: "I always check my candy for tampering.", positive: true },
                { text: "Children should only visit well-lit houses.", positive: true },
                { text: "I prefer daytime trick-or-treating.", positive: true },
                { text: "Costumes should include reflective tape.", positive: true },
                { text: "I would explore an abandoned building.", positive: false },
                { text: "Walking through a cemetery at night sounds fun.", positive: false },
                { text: "I like taking shortcuts through dark alleys.", positive: false }
            ]
        },
        {
            name: "Festive Spirit",
            positive: true,
            questions: [
                { text: "I decorate my home for Halloween.", positive: true },
                { text: "Carving pumpkins is a highlight of fall.", positive: true },
                { text: "I enjoy planning elaborate costumes.", positive: true },
                { text: "Halloween candy is the best candy.", positive: true },
                { text: "I start Halloween shopping in September.", positive: true },
                { text: "Halloween is overrated.", positive: false },
                { text: "I usually forget Halloween is coming.", positive: false }
            ]
        }
    ]
};
