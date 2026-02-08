const bluesky_topt = {
    name: "Bluesky tpot",
    intro: "It's everywhere now--tpot. No one knows what it means but the Bluesky variant vying for dominance on every timeline. How deep are you in the posting trenches? Let's find out.",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Threadmaxxing",
            positive: true,
            questions: [
                { text: "If a thought can't fill at least seven posts, it wasn't worth thinking.", positive: true },
                { text: "I have drafts folders organized by thread arc.", positive: true },
                { text: "The best threads have a narrative structure with rising action and a denouement.", positive: true },
                { text: "I number my posts even when there's only one.", positive: true },
                { text: "A thread that doesn't get quoted into someone else's thread has failed.", positive: true },
                { text: "I've threaded a thread responding to someone else's thread about threading.", positive: true },
                { text: "Most things can be said in a single post.", positive: false },
                { text: "Meta-threading is the moment threading disappeared up its own ass.", positive: false },
                { text: "Threads are just blog posts that lost their way.", positive: false },
                { text: "If you need more than three posts, write an article.", positive: false },
                { text: "I mute anyone who starts a post with '1/'.", positive: false },
                { text: "Threading is what happens when someone discovers pagination but not blogs.", positive: false }
            ]
        },
        {
            name: "Earnestpostism",
            positive: true,
            questions: [
                { text: "I post my genuine feelings knowing full well it will get zero engagement.", positive: true },
                { text: "Vulnerability online is an act of courage, not cringe.", positive: true },
                { text: "I have cried while composing a post and hit send anyway.", positive: true },
                { text: "The best posts come from the heart, not from the algorithm.", positive: true },
                { text: "I would rather be sincere and ignored than ironic and viral.", positive: true },
                { text: "I've shared a personal struggle and been genuinely moved by the responses.", positive: true },
                { text: "Posting your real emotions online is fundamentally embarrassing.", positive: false },
                { text: "Being 'genuinely moved' by replies from strangers is a red flag, not a flex.", positive: false },
                { text: "Sincerity is a liability on social media.", positive: false },
                { text: "Anyone who posts 'I love my friends' is performing.", positive: false },
                { text: "The only safe posture online is detached irony.", positive: false },
                { text: "Earnest posts are just fishing for sympathy.", positive: false }
            ]
        },
        {
            name: "Shenaniganism",
            positive: true,
            questions: [
                { text: "The funniest posts are the ones where nobody can tell if you're joking.", positive: true },
                { text: "I have created at least one alt account purely for bits.", positive: true },
                { text: "A well-executed shitpost is high art.", positive: true },
                { text: "I've started a fake discourse to see if it would take off.", positive: true },
                { text: "Getting someone to earnestly fact-check your obvious joke is the highest form of comedy.", positive: true },
                { text: "I have posted something so unhinged that people checked if my account was hacked.", positive: true },
                { text: "Jokes should be clearly labeled so nobody gets confused.", positive: false },
                { text: "Posting unhinged things for attention is just being a theater kid on the internet.", positive: false },
                { text: "Deliberately misleading posts are harmful even if funny.", positive: false },
                { text: "Shitposting is just being annoying with extra steps.", positive: false },
                { text: "The timeline would be better if everyone was normal.", positive: false },
                { text: "Most 'bits' are just people being unfunny with plausible deniability.", positive: false }
            ]
        },
        {
            name: "Contrarianism",
            positive: true,
            questions: [
                { text: "If everyone agrees on something, that's when I start getting suspicious.", positive: true },
                { text: "The most valuable post in any pile-on is the dissent.", positive: true },
                { text: "I've taken a position I wasn't sure about just because the consensus felt too comfortable.", positive: true },
                { text: "Being called 'deliberately contrarian' is a compliment.", positive: true },
                { text: "The best way to find out what you actually think is to argue the other side.", positive: true },
                { text: "I have quote-posted a viral take just to say 'actually, no.'", positive: true },
                { text: "Sometimes the popular opinion is popular because it's correct.", positive: false },
                { text: "Quote-posting a viral take to disagree is just drafting off someone else's reach.", positive: false },
                { text: "Disagreeing for its own sake is intellectual cosplay.", positive: false },
                { text: "Not every consensus needs a devil's advocate.", positive: false },
                { text: "People who always take the contrarian position are just as predictable as everyone else.", positive: false },
                { text: "Reflexive disagreement is just conformity with a persecution complex.", positive: false }
            ]
        },
        {
            name: "Replyguyism",
            positive: true,
            questions: [
                { text: "Every post is an invitation to conversation, whether the poster knows it or not.", positive: true },
                { text: "I reply to people with way more followers than me and I'm not embarrassed about it.", positive: true },
                { text: "I've added context to a stranger's post and they thanked me for it.", positive: true },
                { text: "Notifications from people I've never interacted with are delightful.", positive: true },
                { text: "The reply section is where the real content lives.", positive: true },
                { text: "I have replied 'this' and meant it with my whole chest.", positive: true },
                { text: "Replying to strangers unprompted is inherently weird.", positive: false },
                { text: "Replying 'this' is the posting equivalent of clapping on the beat at a concert.", positive: false },
                { text: "If someone didn't ask for my opinion, they don't want it.", positive: false },
                { text: "The best posts have zero replies.", positive: false },
                { text: "I have muted someone specifically because they kept replying to me.", positive: false },
                { text: "Nobody wants unsolicited 'well actually' from a stranger.", positive: false }
            ]
        },
        {
            name: "Excessive Argumentativism",
            positive: true,
            questions: [
                { text: "I have continued an argument long after I stopped enjoying it because I couldn't let it go.", positive: true },
                { text: "Being technically correct is the most important kind of correct.", positive: true },
                { text: "I've spent more time on a rebuttal than the original post took to write.", positive: true },
                { text: "If someone mischaracterizes my position, I am morally obligated to correct them.", positive: true },
                { text: "I have screenshotted a deleted post to continue arguing with it.", positive: true },
                { text: "Walking away from a wrong person is a form of intellectual surrender.", positive: true },
                { text: "Some arguments are not worth having, even if you're right.", positive: false },
                { text: "Refusing to let someone delete their bad take in peace is unhinged behavior.", positive: false },
                { text: "Knowing when to disengage is a sign of maturity.", positive: false },
                { text: "The mute button is the most underrated feature on any platform.", positive: false },
                { text: "Most online arguments are two people restating their positions at increasing volume.", positive: false },
                { text: "Winning an argument online has never changed anyone's mind.", positive: false }
            ]
        },
        {
            name: "Longpostism",
            positive: true,
            questions: [
                { text: "Character limits are an obstacle to truth.", positive: true },
                { text: "I have written a post so long that I had to edit it down, and then didn't.", positive: true },
                { text: "Nuance requires length, and I will not apologize for providing it.", positive: true },
                { text: "I regularly hit the character limit and feel censored.", positive: true },
                { text: "The ideal social media post is indistinguishable from a short essay.", positive: true },
                { text: "I've been told 'this should be a blog post' and taken it as encouragement.", positive: true },
                { text: "Brevity is the soul of wit.", positive: false },
                { text: "'This should be a blog post' is not a compliment and never was.", positive: false },
                { text: "If your post needs a scroll bar, you've already lost your audience.", positive: false },
                { text: "The best communicators say more with less.", positive: false },
                { text: "Nobody is reading all of that.", positive: false },
                { text: "Long posts are just a lack of editing disguised as thoroughness.", positive: false }
            ]
        }
    ]
};
