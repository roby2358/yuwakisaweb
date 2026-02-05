const halloweenVsChristmas = {
    name: "Halloween vs. Christmas",
    intro: "Two holidays enter, one holiday leaves! Do you prefer spooky thrills or cozy chills? Candy corn or candy canes? This survey will reveal your true holiday allegiance. Answer honestly - your inner child is watching.",
    questionsPerCategory: 2,
    options: {
        a: "Halloween",
        b: "Christmas"
    },
    categories: [
        {
            name: "Decorations",
            positive: true,
            questions: [
                { text: "Fake cobwebs are peak seasonal decoration.", positive: true },
                { text: "A carved pumpkin on the porch brings me genuine joy.", positive: true },
                { text: "Skeletons and gravestones in the yard? Yes please.", positive: true },
                { text: "Twinkling string lights on a tree feel magical.", positive: false },
                { text: "I love seeing houses compete for most elaborate light display.", positive: false },
                { text: "A well-decorated Christmas tree is the ultimate seasonal centerpiece.", positive: false },
                { text: "Orange and black is an underrated color combination.", positive: true },
                { text: "Wreaths on doors signal the best time of year.", positive: false }
            ]
        },
        {
            name: "Food & Treats",
            positive: true,
            questions: [
                { text: "Candy corn gets unfairly criticized.", positive: true },
                { text: "Fun-sized candy bars are the perfect portion.", positive: true },
                { text: "Caramel apples are a top-tier seasonal treat.", positive: true },
                { text: "Pumpkin spice everything is fine by me.", positive: true },
                { text: "Hot cocoa by a fire is peak comfort.", positive: false },
                { text: "Christmas cookies are worth the effort to bake.", positive: false },
                { text: "Eggnog is genuinely delicious.", positive: false },
                { text: "Holiday roasts and big family dinners are what the season is about.", positive: false }
            ]
        },
        {
            name: "Music & Media",
            positive: true,
            questions: [
                { text: "Horror movie marathons are essential seasonal viewing.", positive: true },
                { text: "The Monster Mash is an unironic banger.", positive: true },
                { text: "Spooky soundtracks and ambient haunted house sounds are my jam.", positive: true },
                { text: "I never get tired of classic Christmas songs.", positive: false },
                { text: "Holiday specials like Charlie Brown Christmas hit different.", positive: false },
                { text: "Christmas movie marathons are a cherished tradition.", positive: false },
                { text: "I start listening to Christmas music well before December.", positive: false },
                { text: "Thriller and Ghostbusters count as Halloween music.", positive: true }
            ]
        },
        {
            name: "Activities",
            positive: true,
            questions: [
                { text: "Haunted houses are worth the adrenaline spike.", positive: true },
                { text: "Trick-or-treating (or handing out candy) never gets old.", positive: true },
                { text: "Pumpkin patches and corn mazes are underrated outings.", positive: true },
                { text: "Costume planning is half the fun of the season.", positive: true },
                { text: "Gift shopping and wrapping is actually enjoyable.", positive: false },
                { text: "Building a snowman or having a snowball fight is pure joy.", positive: false },
                { text: "Decorating the Christmas tree is a highlight of the year.", positive: false },
                { text: "Caroling or attending holiday concerts sets the mood.", positive: false }
            ]
        },
        {
            name: "Atmosphere",
            positive: true,
            questions: [
                { text: "Crisp autumn air and falling leaves beat any other season.", positive: true },
                { text: "The slight edge of fear and mystery makes the season exciting.", positive: true },
                { text: "I prefer eerie and playful over warm and fuzzy.", positive: true },
                { text: "Cozy blankets and warm fires define the best time of year.", positive: false },
                { text: "Snow falling outside while you're warm inside is perfection.", positive: false },
                { text: "The spirit of generosity and togetherness is what matters most.", positive: false },
                { text: "Gothic aesthetics appeal to me more than winter wonderland vibes.", positive: true },
                { text: "Nothing beats the anticipation of Christmas morning.", positive: false }
            ]
        }
    ]
};
