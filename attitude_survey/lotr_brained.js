const lotrBrained = {
    name: "LOTR-Brained",
    intro: "Some people watch Lord of the Rings. Others see the world through it. They spot Wormtongues at work, dream of their own Shire, and know exactly who would be in their Fellowship. This survey measures how LOTR-brained you are - not your knowledge of the lore, but how much Tolkien's moral framework shapes how you see reality. Do you live in Middle-earth?",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Moral Clarity",
            positive: true,
            questions: [
                { text: "Some people are basically orcs - corrupted beyond any possibility of redemption.", positive: true },
                { text: "I can usually tell who the Gandalfs and who the Sarumans are in any organization.", positive: true },
                { text: "There are real Mordors in the world - places and institutions of concentrated evil.", positive: true },
                { text: "When I meet someone untrustworthy, I think of Gríma Wormtongue.", positive: true },
                { text: "Some conflicts really are between good and evil, not just competing interests.", positive: true },
                { text: "Most villains are just misunderstood or responding to their circumstances.", positive: false },
                { text: "The idea that some people are irredeemably evil is childish.", positive: false },
                { text: "Real life is too morally complex for good-versus-evil framing.", positive: false },
                { text: "Calling things 'evil' is lazy thinking.", positive: false },
                { text: "Everyone has both light and shadow - no one is purely good or bad.", positive: false }
            ]
        },
        {
            name: "The Fellowship",
            positive: true,
            questions: [
                { text: "Every group needs a Samwise - the loyal one who carries you when you can't go on.", positive: true },
                { text: "The best teams are like the Fellowship - diverse people united by a shared purpose.", positive: true },
                { text: "I've had friendships that felt like Frodo and Sam's bond.", positive: true },
                { text: "A small group of committed friends can accomplish what institutions cannot.", positive: true },
                { text: "I know exactly who would be in my Fellowship.", positive: true },
                { text: "Institutions and systems matter more than individual heroics.", positive: false },
                { text: "The 'band of heroes' narrative is naive - real change requires movements, not fellowships.", positive: false },
                { text: "Loyalty to friends can be a liability as much as a virtue.", positive: false },
                { text: "I don't think of my friendships in epic or mythic terms.", positive: false },
                { text: "Large organizations are more effective than small dedicated groups.", positive: false }
            ]
        },
        {
            name: "The Ring",
            positive: true,
            questions: [
                { text: "Some things in life are like the Ring - they promise power but corrupt anyone who uses them.", positive: true },
                { text: "Social media is basically a Palantír - it shows you things but twists your perspective.", positive: true },
                { text: "I've watched someone be destroyed by their own 'precious.'", positive: true },
                { text: "Power doesn't just corrupt - it specifically corrupts the good intentions you started with.", positive: true },
                { text: "Certain technologies should be thrown into Mount Doom.", positive: true },
                { text: "Power is a neutral tool - it depends entirely on who wields it.", positive: false },
                { text: "The idea that some things are inherently corrupting is superstitious.", positive: false },
                { text: "Good people can handle power without being corrupted.", positive: false },
                { text: "Technology problems have technology solutions - nothing needs to be destroyed.", positive: false },
                { text: "The 'corrupting influence' framing is just fear of capability.", positive: false }
            ]
        },
        {
            name: "The Shire",
            positive: true,
            questions: [
                { text: "I dream of having my own Shire - a simple peaceful place away from the world's troubles.", positive: true },
                { text: "Modern life has too much Isengard energy - industry and efficiency destroying what's beautiful.", positive: true },
                { text: "The hobbits had it right - tend your garden, enjoy your meals, keep things simple.", positive: true },
                { text: "Something precious is lost when small local things get replaced by big efficient systems.", positive: true },
                { text: "I would rather live in the Shire than in Minas Tirith.", positive: true },
                { text: "Romanticizing pre-industrial life ignores how brutal and short it actually was.", positive: false },
                { text: "The pastoral fantasy is escapism, not wisdom.", positive: false },
                { text: "Progress and industrialization have improved far more lives than they've harmed.", positive: false },
                { text: "I would find Shire life boring and provincial.", positive: false },
                { text: "Nostalgia for 'simpler times' is usually just nostalgia for ignorance.", positive: false }
            ]
        },
        {
            name: "Eucatastrophe",
            positive: true,
            questions: [
                { text: "Bilbo was meant to find the Ring - and we are each meant for certain things.", positive: true },
                { text: "Sometimes the Eagles just arrive - unexpected salvation when all seems lost.", positive: true },
                { text: "Pity stayed Bilbo's hand, and that ruled the fate of many - small mercies change everything.", positive: true },
                { text: "I believe some encounters and events are meant to happen.", positive: true },
                { text: "There's a pattern to events that only makes sense looking backward.", positive: true },
                { text: "There is no 'meant to be' - things just happen.", positive: false },
                { text: "Counting on unexpected rescue is foolish - you have to save yourself.", positive: false },
                { text: "The universe has no plan - we impose narrative on randomness.", positive: false },
                { text: "Fate and destiny are comforting fictions.", positive: false },
                { text: "Coincidences are just coincidences, nothing more.", positive: false }
            ]
        },
        {
            name: "The Long Defeat",
            positive: true,
            questions: [
                { text: "We live in the Age of Men - the magic and wonder are leaving the world.", positive: true },
                { text: "The world is slowly diminishing, and the most beautiful things are fading.", positive: true },
                { text: "Sometimes you have to fight for something even knowing you'll lose.", positive: true },
                { text: "Like the Elves, sometimes the noblest thing is to gracefully depart.", positive: true },
                { text: "There's beauty in fighting the long defeat.", positive: true },
                { text: "The best days are ahead, not behind.", positive: false },
                { text: "The 'fading of magic' narrative is just dressed-up pessimism.", positive: false },
                { text: "Fighting battles you know you'll lose is foolish, not noble.", positive: false },
                { text: "The world is not diminishing - that's just nostalgia talking.", positive: false },
                { text: "Progress means the future will be better than the past.", positive: false }
            ]
        }
    ]
};
