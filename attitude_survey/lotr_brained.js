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
                { text: "Like the War of the Ring, some real-world conflicts truly are good versus evil.", positive: true },
                { text: "I've never met anyone I'd actually call an orc or a Wormtongue.", positive: false },
                { text: "Real people are too complex to sort into Gandalfs and Sarumans.", positive: false },
                { text: "There are no real Mordors - just complicated situations with no clear villains.", positive: false },
                { text: "Thinking of real conflicts as 'good versus evil' oversimplifies them.", positive: false },
                { text: "Everyone I've met has been a mix of good and bad - no pure orcs, no pure elves.", positive: false }
            ]
        },
        {
            name: "The Fellowship",
            positive: true,
            questions: [
                { text: "Every group needs a Samwise - the loyal one who carries you when you can't go on.", positive: true },
                { text: "The best teams are like the Fellowship - diverse people united by a shared purpose.", positive: true },
                { text: "I've had friendships that felt like Frodo and Sam's bond.", positive: true },
                { text: "Nine walkers destroyed the Ring - that's how real change happens too.", positive: true },
                { text: "I know exactly who would be in my Fellowship.", positive: true },
                { text: "I don't think about who my 'Samwise' would be.", positive: false },
                { text: "Real change comes from institutions, not from assembling your own Fellowship.", positive: false },
                { text: "I've never had a friendship I'd compare to Frodo and Sam.", positive: false },
                { text: "Thinking of your friend group as a 'Fellowship' is a bit much.", positive: false },
                { text: "The 'small band of heroes' thing works in stories, not real life.", positive: false }
            ]
        },
        {
            name: "The Ring",
            positive: true,
            questions: [
                { text: "Some things in life are like the Ring - they promise power but corrupt anyone who uses them.", positive: true },
                { text: "Social media is basically a Palantír - it shows you things but twists your perspective.", positive: true },
                { text: "I've watched someone be destroyed by their own 'precious.'", positive: true },
                { text: "Like the Ring corrupting Boromir's good intentions, power twists what you started out wanting.", positive: true },
                { text: "Certain technologies should be thrown into Mount Doom.", positive: true },
                { text: "I don't see real-world things as 'Rings of Power' that corrupt everyone who touches them.", positive: false },
                { text: "Power in the real world doesn't work like the One Ring - it depends who wields it.", positive: false },
                { text: "I've never thought of someone's obsession as their 'precious.'", positive: false },
                { text: "The Palantír metaphor doesn't really apply to technology I use.", positive: false },
                { text: "Nothing in real life needs to be 'thrown into Mount Doom' - that's dramatic.", positive: false }
            ]
        },
        {
            name: "The Shire",
            positive: true,
            questions: [
                { text: "I dream of having my own Shire - a simple peaceful place away from the world's troubles.", positive: true },
                { text: "Modern life has too much Isengard energy - industry and efficiency destroying what's beautiful.", positive: true },
                { text: "The hobbits had it right - tend your garden, enjoy your meals, keep things simple.", positive: true },
                { text: "The Scouring of the Shire shows what's lost when big systems replace small local things.", positive: true },
                { text: "I would rather live in the Shire than in Minas Tirith.", positive: true },
                { text: "I don't dream of a 'Shire' - I like modern life just fine.", positive: false },
                { text: "Calling things 'Isengard energy' is silly - progress and efficiency are good.", positive: false },
                { text: "Hobbit life sounds boring - I'd rather be in Minas Tirith where things happen.", positive: false },
                { text: "I've never thought about the 'Scouring of the Shire' when seeing local shops close.", positive: false },
                { text: "The Shire is a nice fantasy, but I wouldn't actually want to live there.", positive: false }
            ]
        },
        {
            name: "Eucatastrophe",
            positive: true,
            questions: [
                { text: "Bilbo was meant to find the Ring - and we are each meant for certain things.", positive: true },
                { text: "Sometimes the Eagles just arrive - unexpected salvation when all seems lost.", positive: true },
                { text: "Pity stayed Bilbo's hand, and that ruled the fate of many - small mercies change everything.", positive: true },
                { text: "Like Gandalf seeing how the Ring came to Frodo, I sense a pattern behind events in my life.", positive: true },
                { text: "Meeting certain people felt like Bilbo's 'unexpected journey' - clearly meant to happen.", positive: true },
                { text: "I don't feel like I was 'meant' for anything the way Bilbo was meant to find the Ring.", positive: false },
                { text: "The Eagles don't arrive in real life - you have to save yourself.", positive: false },
                { text: "I don't see 'eucatastrophe' patterns in my own life.", positive: false },
                { text: "Gandalf's talk of fate sounds nice, but real life is just chance.", positive: false },
                { text: "I've never felt a meeting was 'meant to be' like Bilbo meeting Gandalf.", positive: false }
            ]
        },
        {
            name: "The Long Defeat",
            positive: true,
            questions: [
                { text: "We live in the Age of Men - the magic and wonder are leaving the world.", positive: true },
                { text: "Like Lothlórien fading, the most beautiful things in our world are slowly diminishing.", positive: true },
                { text: "Like the Last Alliance, sometimes you have to fight knowing you'll lose.", positive: true },
                { text: "Like the Elves sailing West, sometimes the noblest thing is to gracefully depart.", positive: true },
                { text: "There's beauty in fighting the long defeat, as Tolkien called it.", positive: true },
                { text: "I don't feel like we're living in a 'fading age' - things are fine.", positive: false },
                { text: "The world isn't 'diminishing' like Lothlórien - that's just nostalgia.", positive: false },
                { text: "Fighting battles you know you'll lose isn't noble, it's just losing.", positive: false },
                { text: "I don't think about 'sailing West' when I imagine leaving something behind.", positive: false },
                { text: "The 'long defeat' framing is too melancholy for how I see life.", positive: false }
            ]
        }
    ]
};
