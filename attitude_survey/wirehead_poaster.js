const wireheadPoaster = {
    name: "Wirehead Bluesky Poaster",
    intro: "How deep into the Bluesky posting mines have you descended? This survey measures your alignment with the terminally online poaster lifestyle. Answer honestly—your notifications will still be there when you're done.",
    questionsPerCategory: 2,
    categories: [
        {
            name: "Engagement Brain",
            positive: true,
            questions: [
                { text: "I check my notifications within minutes of posting.", positive: true },
                { text: "A post getting zero engagement ruins my mood.", positive: true },
                { text: "I've deleted posts that didn't perform well.", positive: true },
                { text: "Getting reposted by a popular account is a genuine thrill.", positive: true },
                { text: "I know my peak posting hours.", positive: true },
                { text: "I rarely check how my posts are doing.", positive: false },
                { text: "Likes and reposts don't affect my self-worth.", positive: false },
                { text: "I post and forget about it.", positive: false },
                { text: "I've never felt anxious about engagement.", positive: false },
                { text: "Numbers are just numbers to me.", positive: false }
            ]
        },
        {
            name: "Discourse Participation",
            positive: true,
            questions: [
                { text: "I have opinions on most trending topics.", positive: true },
                { text: "I've been part of at least one ratio.", positive: true },
                { text: "I enjoy crafting the perfect dunk.", positive: true },
                { text: "I follow discourse even when I don't participate.", positive: true },
                { text: "I've posted a take I knew would be controversial.", positive: true },
                { text: "I avoid trending topics.", positive: false },
                { text: "Most online arguments seem pointless to me.", positive: false },
                { text: "I don't understand why people get so heated online.", positive: false },
                { text: "I've never felt the urge to correct someone's bad take.", positive: false },
                { text: "I prefer posting about my own life to joining discourse.", positive: false }
            ]
        },
        {
            name: "Reply Guy Energy",
            positive: true,
            questions: [
                { text: "I reply to accounts way bigger than mine hoping they'll notice.", positive: true },
                { text: "I've cultivated relationships entirely through replies.", positive: true },
                { text: "I have a strategy for getting mutuals.", positive: true },
                { text: "I feel a small victory when a popular account likes my reply.", positive: true },
                { text: "I've refreshed to see if someone replied to my reply.", positive: true },
                { text: "I mostly just post my own things without replying to others.", positive: false },
                { text: "I don't care if popular accounts notice me.", positive: false },
                { text: "Replying feels like shouting into the void.", positive: false },
                { text: "I've never thought about my reply strategy.", positive: false },
                { text: "I only reply to people I already know.", positive: false }
            ]
        },
        {
            name: "Platform Evangelism",
            positive: true,
            questions: [
                { text: "Bluesky is clearly superior to Twitter/X.", positive: true },
                { text: "I've tried to recruit people from other platforms.", positive: true },
                { text: "I get excited about Bluesky feature updates.", positive: true },
                { text: "I've made or shared a starter pack.", positive: true },
                { text: "I feel a sense of community ownership over Bluesky.", positive: true },
                { text: "All social media platforms are basically the same.", positive: false },
                { text: "I don't really care which platform people use.", positive: false },
                { text: "I haven't paid attention to Bluesky's development.", positive: false },
                { text: "Platform loyalty seems silly to me.", positive: false },
                { text: "I'd leave Bluesky without hesitation if something better came along.", positive: false }
            ]
        },
        {
            name: "Posting Through It",
            positive: true,
            questions: [
                { text: "I've posted during a personal crisis.", positive: true },
                { text: "My first instinct when something happens is to post about it.", positive: true },
                { text: "I've live-posted an experience as it was happening.", positive: true },
                { text: "I compose posts in my head throughout the day.", positive: true },
                { text: "I've posted when I probably should have been doing something else.", positive: true },
                { text: "I can easily go days without posting.", positive: false },
                { text: "Most of my experiences stay offline.", positive: false },
                { text: "I rarely think about posting when I'm away from my phone.", positive: false },
                { text: "I don't feel compelled to share things publicly.", positive: false },
                { text: "Posting is something I do occasionally, not constantly.", positive: false }
            ]
        },
        {
            name: "Chronically Online",
            positive: true,
            questions: [
                { text: "I understand references that would confuse normal people.", positive: true },
                { text: "I know the lore of multiple micro-celebrities.", positive: true },
                { text: "I've used a phrase IRL that only makes sense online.", positive: true },
                { text: "I can identify posters by their style without seeing the username.", positive: true },
                { text: "I know about drama before it hits mainstream awareness.", positive: true },
                { text: "Most internet humor goes over my head.", positive: false },
                { text: "I don't know who any of the 'famous' accounts are.", positive: false },
                { text: "I feel out of the loop on most online references.", positive: false },
                { text: "I don't understand why people care about internet micro-celebrities.", positive: false },
                { text: "My online and offline vocabularies are basically the same.", positive: false }
            ]
        },
        {
            name: "Touch Grass Aversion",
            positive: true,
            questions: [
                { text: "I check my phone within moments of waking up.", positive: true },
                { text: "I feel uncomfortable being away from my phone for hours.", positive: true },
                { text: "Online interactions often feel more real than offline ones.", positive: true },
                { text: "I've chosen staying online over going out.", positive: true },
                { text: "IRL socializing can feel like a chore compared to posting.", positive: true },
                { text: "I genuinely enjoy being away from screens.", positive: false },
                { text: "I prefer face-to-face conversations to online ones.", positive: false },
                { text: "I've taken extended breaks from social media without difficulty.", positive: false },
                { text: "Being in nature feels more fulfilling than being online.", positive: false },
                { text: "I don't understand people who are always on their phones.", positive: false }
            ]
        },
        {
            name: "Drama Appreciation",
            positive: true,
            questions: [
                { text: "I enjoy watching online beef unfold.", positive: true },
                { text: "I've subtweeted someone.", positive: true },
                { text: "I maintain mental notes about who has beef with whom.", positive: true },
                { text: "I've curated my block list with care.", positive: true },
                { text: "Drama is one of the best parts of being online.", positive: true },
                { text: "I find online drama exhausting and pointless.", positive: false },
                { text: "I've never blocked anyone.", positive: false },
                { text: "I don't pay attention to who's fighting with whom.", positive: false },
                { text: "I actively avoid dramatic accounts.", positive: false },
                { text: "Life is too short to care about online conflicts.", positive: false }
            ]
        },
        {
            name: "Main Character Syndrome",
            positive: true,
            questions: [
                { text: "I assume my mutuals care about my daily updates.", positive: true },
                { text: "I've posted a thread about something that happened to me.", positive: true },
                { text: "I feel like my followers know me as a person.", positive: true },
                { text: "I've felt parasocial comfort from online interactions.", positive: true },
                { text: "My posts are part of an ongoing narrative about my life.", positive: true },
                { text: "Nobody online really knows or cares about me personally.", positive: false },
                { text: "I don't share personal details on social media.", positive: false },
                { text: "I find it strange when people post about their daily lives.", positive: false },
                { text: "Online relationships aren't real relationships.", positive: false },
                { text: "I'm just one anonymous account among millions.", positive: false }
            ]
        }
    ]
};
