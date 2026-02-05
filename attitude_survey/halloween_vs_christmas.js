const halloweenVsChristmas = {
    name: "Halloween vs. Christmas",
    intro: "Two holidays enter, one holiday leaves! On one side: adults cosplaying their alternative high school phase while their kids collect diabetes fuel. On the other: mandatory family togetherness, financial ruin disguised as 'generosity,' and Mariah Carey's annual resurrection. Both holidays peaked in childhood and we're all just chasing that dragon. Answer honestly - your coping mechanisms are showing.",
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
                { text: "I respect anyone willing to turn their yard into a graveyard for exactly 31 days.", positive: true },
                { text: "Fake cobwebs are a valid substitute for actually cleaning your house.", positive: true },
                { text: "Nothing says 'I've given up' like 47 inflatable lawn decorations competing for air pressure.", positive: true },
                { text: "Spending $800 on Christmas lights to impress neighbors you hate is a power move.", positive: false },
                { text: "A Christmas tree is just a dying plant you invited inside to watch it slowly perish while covered in capitalism.", positive: false },
                { text: "People who put up Christmas decorations on November 1st are why we can't have nice things.", positive: false },
                { text: "Orange and black is what happens when Hot Topic becomes a color scheme.", positive: true },
                { text: "The real Christmas decoration is the passive-aggressive tension in the living room we made along the way.", positive: false }
            ]
        },
        {
            name: "Food & Treats",
            positive: true,
            questions: [
                { text: "Candy corn is the fruitcake of Halloween - everyone claims to hate it but someone keeps buying it.", positive: true },
                { text: "Fun-sized candy bars are just regular corporations gaslighting you about portions.", positive: true },
                { text: "The parent candy tax is just preparing kids for future government taxation.", positive: true },
                { text: "Pumpkin spice is a cry for help disguised as a seasonal flavor profile.", positive: true },
                { text: "Hot cocoa is just warm chocolate milk for people who need Instagram content.", positive: false },
                { text: "Christmas cookies are emotional labor disguised as baking.", positive: false },
                { text: "Eggnog is proof that people will drink anything if you add enough alcohol and call it 'traditional.'", positive: false },
                { text: "Nothing says 'holiday magic' like forcing yourself to eat dry turkey with relatives who voted differently than you.", positive: false }
            ]
        },
        {
            name: "Music & Media",
            positive: true,
            questions: [
                { text: "Horror movie marathons: because sometimes you need fictional terror to distract from existential dread.", positive: true },
                { text: "The Monster Mash slaps and anyone who disagrees peaked too early to appreciate it.", positive: true },
                { text: "Spooky season playlists are for people who made 'darkness' their entire personality one month a year.", positive: true },
                { text: "Listening to the same 15 Christmas songs 847 times builds character (and homicidal ideation).", positive: false },
                { text: "Hallmark Christmas movies exist to gaslight people about what small-town life is actually like.", positive: false },
                { text: "All I Want for Christmas is for Mariah Carey to return to her cryogenic chamber until next year.", positive: false },
                { text: "People who start Christmas music before December are the same people who clap when planes land.", positive: false },
                { text: "Thriller is unironically better choreographed than anything you did at your wedding.", positive: true }
            ]
        },
        {
            name: "Activities",
            positive: true,
            questions: [
                { text: "Haunted houses are staffed by theater kids who peaked in high school and I respect the commitment to craft.", positive: true },
                { text: "Trick-or-treating is the only honest transaction left in America: knock, receive candy, no small talk required.", positive: true },
                { text: "Adult Halloween parties are just people spending $300 on costumes to fish for compliments and hook up.", positive: true },
                { text: "Costume planning is just anxiety dressed up as creativity with a firm deadline.", positive: true },
                { text: "Gift shopping is financial Russian roulette where everyone pretends to know what others want.", positive: false },
                { text: "Office Secret Santa is institutionalized forced affection with a spending minimum.", positive: false },
                { text: "Decorating the Christmas tree is just arguing about ornament placement with people you're legally obligated to love.", positive: false },
                { text: "Christmas caroling is home invasion but with worse vocal training.", positive: false }
            ]
        },
        {
            name: "Atmosphere",
            positive: true,
            questions: [
                { text: "Halloween lets you embrace darkness and death for a month - finally, honesty in holiday form.", positive: true },
                { text: "The slight edge of fear and mystery is more honest than forced cheer while crying in a Target parking lot.", positive: true },
                { text: "'Spooky season' as a personality trait is cringe but at least it's seasonal unlike year-round Disney adults.", positive: true },
                { text: "Gothic aesthetics: because sometimes Hot Topic really does capture how you feel inside.", positive: true },
                { text: "Christmas spirit is just manufactured nostalgia for a childhood you've idealized beyond recognition.", positive: false },
                { text: "'It's the most wonderful time of the year' is what you tell yourself while maxing out credit cards.", positive: false },
                { text: "The real Christmas magic is pretending your dysfunctional family is Norman Rockwell for exactly one dinner.", positive: false },
                { text: "People who say 'War on Christmas' have never experienced actual adversity and it shows.", positive: false }
            ]
        }
    ]
};
