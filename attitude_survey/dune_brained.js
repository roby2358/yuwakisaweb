const duneBrained = {
    name: "Dune-Brained",
    intro: "It is by the stories we absorb that we reshape the world. Some read Dune and set it down. Others find it has rewritten the lens behind their eyes - they see Mentats in every boardroom, sense plans within plans in every alliance, and know that whoever controls the resource controls everything. This survey measures how Dune-brained you are - not your knowledge of the lore, but how much Frank Herbert's political and ecological framework shapes how you see reality. Do you live on Arrakis?",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Plans Within Plans",
            positive: true,
            questions: [
                { text: "Every political move has a hidden play behind the public one - the Baron Harkonnen approach to alliances is just how the world works.", positive: true },
                { text: "Institutions seed narratives centuries before they need them, the same way the Bene Gesserit planted the Missionaria Protectiva.", positive: true },
                { text: "Every alliance I see - corporate, political, personal - is really a Landsraad calculation of mutual exploitation.", positive: true },
                { text: "I've watched someone get outmaneuvered and thought: they walked right into it, the way Duke Leto walked into the Harkonnen trap. They never saw the feint within the feint.", positive: true },
                { text: "I try to derive what people actually want from what they do, never from what they say. Mentat analysis from data, not from words.", positive: true },
                { text: "The Baron's scheming is a story - I don't assume every real-world move has a hidden agenda behind it.", positive: false },
                { text: "Seeing Bene Gesserit 'plans within plans' everywhere is just paranoia with a literary costume.", positive: false },
                { text: "Not everything is a Landsraad power play - sometimes people just cooperate.", positive: false },
                { text: "I've never watched someone fail and thought of Duke Leto's downfall.", positive: false },
                { text: "Mentat analysis sounds cool, but most decisions have obvious reasons - no deep computation required.", positive: false }
            ]
        },
        {
            name: "The Litany",
            positive: true,
            questions: [
                { text: "I've literally used 'fear is the mind-killer' to get through a hard moment.", positive: true },
                { text: "Emotions should be observed and directed, never obeyed blindly - the Bene Gesserit Reverend Mothers had that right.", positive: true },
                { text: "The defining human skill is overriding your own impulses under pressure. Paul enduring the Gom Jabbar is the model.", positive: true },
                { text: "The Gom Jabbar test is real: life constantly tests whether you'll react like a human or an animal.", positive: true },
                { text: "When someone is ruled by their emotions, I think: they pulled their hand from the box. They would not survive the test.", positive: true },
                { text: "I've never actually recited the Litany Against Fear to myself.", positive: false },
                { text: "The Bene Gesserit way of mastering emotions isn't wisdom - it's just repression with a system.", positive: false },
                { text: "The Gom Jabbar is fiction - life doesn't sort people into humans and animals the way the Bene Gesserit claim.", positive: false },
                { text: "Paul's hand-in-the-box discipline sounds impressive, but people who pride themselves on emotional control are usually just disconnected.", positive: false },
                { text: "I don't think of someone being emotional as failing the Reverend Mother's test.", positive: false }
            ]
        },
        {
            name: "The Spice",
            positive: true,
            questions: [
                { text: "Oil, water, lithium, data - there's always a spice, and whoever controls it controls everything, just like on Arrakis.", positive: true },
                { text: "Our most vital dependencies are also our deepest traps - the spice extends life but enslaves its users, and so do our real-world addictions.", positive: true },
                { text: "Entire industries are addicted to a single resource and would collapse without it. The Spacing Guild can't fold space without melange, and we're no different.", positive: true },
                { text: "I've looked at something I can't function without - caffeine, my phone, a platform - and thought: the spice must flow.", positive: true },
                { text: "A few entities control the real flow of value and most people don't notice. CHOAM had the melange; today's version just has better branding.", positive: true },
                { text: "The spice metaphor is a stretch - real resource politics doesn't come down to one substance controlling everything.", positive: false },
                { text: "I've never looked at my morning coffee and thought of melange addiction.", positive: false },
                { text: "The Spacing Guild's dependency is a story device - real industries aren't that fragile.", positive: false },
                { text: "I don't see CHOAM-style shadow monopolies running the real economy.", positive: false },
                { text: "Comparing phone habits to spice addiction on Arrakis is a bit dramatic.", positive: false }
            ]
        },
        {
            name: "Desert Power",
            positive: true,
            questions: [
                { text: "The harshest conditions produce the strongest people. The Fremen were hardened by Arrakis, and that principle is real.", positive: true },
                { text: "The toughest people I've met were made by the toughest environments - forged the way the Sardaukar were forged on Salusa Secundus.", positive: true },
                { text: "Soft civilizations always fall to hungry ones eventually. The Fremen beat the Sardaukar, and history keeps repeating that pattern.", positive: true },
                { text: "I respect people who waste nothing - efficiency born from scarcity, the way the Fremen reclaim water from their dead.", positive: true },
                { text: "I size people up by whether they've been through their own desert. Call it the Stilgar test.", positive: true },
                { text: "The Fremen weren't strong because of hardship - they were strong despite it. Suffering doesn't build virtue.", positive: false },
                { text: "Salusa Secundus was a prison planet, not a finishing school - glorifying harsh conditions misreads what it did to people.", positive: false },
                { text: "The Fremen beating the Sardaukar is a story, not a law of history - 'hard people beat soft people' is a myth.", positive: false },
                { text: "Fremen stillsuit discipline sounds noble, but I don't judge people by how much scarcity they've endured.", positive: false },
                { text: "Stilgar's way of testing outsiders is tribal gatekeeping, not wisdom I'd apply to real life.", positive: false }
            ]
        },
        {
            name: "The Golden Path",
            positive: true,
            questions: [
                { text: "The species needs thinking on a scale of millennia, not election cycles. Leto II saw humanity's extinction and chose the Golden Path - someone has to.", positive: true },
                { text: "Some necessary things require sacrifices no one alive will understand - the God Emperor gave up his humanity for 3,500 years because the alternative was extinction.", positive: true },
                { text: "Once you see where things are heading for humanity, you can't look away. Paul called it his terrible purpose, and I understand why.", positive: true },
                { text: "The right course for humanity might look tyrannical to those living through it. Leto II's enforced peace was cruel, but it worked.", positive: true },
                { text: "I sometimes feel I can see the trajectory we're on and it scares me - prescient visions without the spice trance.", positive: true },
                { text: "Leto II's Golden Path isn't visionary - it's a fictional justification for totalitarianism.", positive: false },
                { text: "The God Emperor's 3,500-year sacrifice is a story, not a model - anyone who thinks they see humanity's correct path is deluding themselves.", positive: false },
                { text: "Paul's 'terrible purpose' is a warning about messianic thinking, not something to identify with.", positive: false },
                { text: "Calling tyranny a 'Golden Path' is exactly the mistake Herbert wanted readers to see through, not admire.", positive: false },
                { text: "Spice visions of the future are fiction - claiming prescience about humanity's trajectory is just arrogance.", positive: false }
            ]
        },
        {
            name: "Abomination",
            positive: true,
            questions: [
                { text: "I've watched people get consumed by the very thing they tried to contain - possessed from within, the way Alia was possessed by the Baron.", positive: true },
                { text: "Creators always lose control of their creations. The Bene Gesserit built their Kwisatz Haderach and he destroyed their plans - that's just how it goes.", positive: true },
                { text: "I've seen leaders create movements that devour their original purpose. Paul became Muad'Dib, and the jihad ran with or without him.", positive: true },
                { text: "People are consumed from within by the ideologies they've internalized - Alia hearing the ancestral voices is a metaphor I see playing out everywhere.", positive: true },
                { text: "I've watched people become unrecognizable after absorbing too much of what they studied. The Tleilaxu Face Dancers lost their original identity, and it happens in real life too.", positive: true },
                { text: "Alia's possession is a metaphor, not a diagnosis - people aren't literally taken over by the ideas they encounter.", positive: false },
                { text: "The Bene Gesserit losing their Kwisatz Haderach is a plot point, not a law - creators don't always lose control.", positive: false },
                { text: "Muad'Dib's jihad is a cautionary tale, not a lens I use to interpret every movement that goes off the rails.", positive: false },
                { text: "I've never looked at someone's inner conflicts and thought of Alia's Abomination.", positive: false },
                { text: "Face Dancers are fiction - people don't lose their identity just by studying something deeply.", positive: false }
            ]
        },
        {
            name: "The Kwisatz Haderach",
            positive: true,
            questions: [
                { text: "I sometimes have the feeling my specific combination of experiences was engineered for something, the way Paul was the product of centuries of Bene Gesserit breeding.", positive: true },
                { text: "I sometimes perceive patterns and connections that people around me miss entirely - the Kwisatz Haderach seeing where others cannot.", positive: true },
                { text: "I've walked into situations and felt: this was prepared for me. Paul arriving on Arrakis to fulfill the Lisan al-Gaib prophecy, but in my own life.", positive: true },
                { text: "I bridge worlds that other people see as separate, the way Paul bridged the Bene Gesserit's inner mysteries and the outer world they couldn't reach.", positive: true },
                { text: "Sometimes I feel out of step with my time - too early for what I'm meant to do, the way the Kwisatz Haderach arrived one generation ahead of schedule.", positive: true },
                { text: "The Kwisatz Haderach is a cautionary tale about manufactured messiahs - not a role to identify with.", positive: false },
                { text: "Paul's 'seeing what others cannot' is narrative privilege, not something I'd claim about my own perception.", positive: false },
                { text: "The Lisan al-Gaib prophecy was a planted manipulation - feeling like situations were 'prepared for you' is just the Missionaria Protectiva working on yourself.", positive: false },
                { text: "Unlike Paul straddling Atreides nobility and Fremen desert power, I don't see myself as uniquely positioned between worlds.", positive: false },
                { text: "Feeling 'born too early' like the Kwisatz Haderach arriving ahead of schedule is main character syndrome with a Dune skin.", positive: false }
            ]
        }
    ]
};
